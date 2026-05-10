// ============================================================
// Escalation Flow
// Creates an escalation record + notifies staff
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import { advanceStep } from '../state-machine.js';
import { db } from '../../../db/client.js';
import { escalations } from '../../../db/schema.js';
import { queueNotification } from '../../notifications/notification.service.js';
import { auditLog } from '../../../audit/audit-logger.js';

const DENTAL_EMERGENCY_KEYWORDS = [
  'pain', 'emergency', 'swelling', 'abscess', 'bleeding', 'broken tooth',
  'severe', 'urgent', 'cracked', 'knocked out', 'trauma',
];

export class EscalationFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, callId, rcCallId, fromNumber, collectedData, contact } = state;

    await advanceStep(rcCallId, 'escalating');

    const reason = (collectedData.escalationReason as string | undefined) ?? 'caller_requested';
    const escalationText = (collectedData.escalationText as string | undefined) ?? '';

    // Determine priority: urgent if dental emergency keywords present
    const isUrgent =
      reason === 'pain_emergency' ||
      DENTAL_EMERGENCY_KEYWORDS.some((kw) =>
        escalationText.toLowerCase().includes(kw)
      );

    const priority = isUrgent ? 'urgent' : 'normal';

    // Create escalation record in DB
    const [escalation] = await db
      .insert(escalations)
      .values({
        tenantId,
        callId: callId ?? undefined,
        contactId: contact?.id ?? undefined,
        reason,
        priority,
        status: 'open',
      })
      .returning();

    auditLog({
      tenantId,
      actorType: 'system',
      action: 'call.escalated',
      entityType: 'escalation',
      entityId: escalation?.id,
      metadata: { reason, priority, fromNumber, isUrgent },
    });

    // Alert staff via SMS
    await queueNotification({
      tenantId,
      type: 'staff_task',
      channel: 'sms',
      contactId: contact?.id,
      callId: callId ?? undefined,
      metadata: {
        taskType: 'escalation',
        priority,
        reason,
        patientName: contact
          ? `${contact.firstName} ${contact.lastName}`
          : 'Unknown caller',
        patientPhone: fromNumber,
        escalationText,
        escalationId: escalation?.id,
        isUrgent,
      },
    });

    await advanceStep(rcCallId, 'complete');

    return {
      outcome: 'escalated',
      summary: `Call escalated (${priority}). Reason: ${reason}. Staff notified via SMS. Escalation ID: ${escalation?.id ?? 'n/a'}.`,
    };
  }
}
