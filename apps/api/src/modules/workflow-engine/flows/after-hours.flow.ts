// ============================================================
// After Hours Flow
// Handles calls outside of office hours
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import { advanceStep } from '../state-machine.js';
import { db } from '../../../db/client.js';
import { calls, tenantSettings } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { queueNotification } from '../../notifications/notification.service.js';
import { auditLog } from '../../../audit/audit-logger.js';

export class AfterHoursFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, callId, rcCallId, fromNumber, contact, collectedData } = state;

    await advanceStep(rcCallId, 'after_hours');

    const [settings] = await db
      .select({ afterHoursMode: tenantSettings.afterHoursMode, transferNumber: tenantSettings.transferNumber })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    const mode = settings?.afterHoursMode ?? 'voicemail';

    // Dental emergency during after hours — always escalate regardless of mode
    const reportedEmergency = collectedData.isEmergency === true;
    const escalationReason = (collectedData.escalationReason as string | undefined) ?? '';

    if (reportedEmergency || escalationReason.toLowerCase().includes('emergency')) {
      // Send urgent staff SMS even after hours
      await queueNotification({
        tenantId,
        type: 'staff_task',
        channel: 'sms',
        contactId: contact?.id,
        callId: callId ?? undefined,
        metadata: {
          taskType: 'after_hours_emergency',
          priority: 'urgent',
          patientName: contact
            ? `${contact.firstName} ${contact.lastName}`
            : 'Unknown caller',
          patientPhone: fromNumber,
          message: collectedData.escalationText ?? 'Emergency reported outside office hours',
        },
      });

      auditLog({
        tenantId,
        actorType: 'system',
        action: 'call.after_hours_emergency',
        entityType: 'call',
        entityId: callId ?? undefined,
        metadata: { fromNumber, mode, reportedEmergency },
      });

      return {
        outcome: 'escalated',
        summary: 'After-hours emergency reported. Staff alerted via SMS.',
      };
    }

    // Standard after-hours: update call record with missed/voicemail status
    if (callId) {
      await db
        .update(calls)
        .set({ outcome: 'voicemail', updatedAt: new Date() })
        .where(eq(calls.id, callId));
    }

    // Notify staff of missed call for callback follow-up
    await queueNotification({
      tenantId,
      type: 'missed_call',
      channel: 'sms',
      contactId: contact?.id,
      callId: callId ?? undefined,
      metadata: {
        patientName: contact
          ? `${contact.firstName} ${contact.lastName}`
          : 'Unknown caller',
        patientPhone: fromNumber,
        afterHoursMode: mode,
        callbackRequested: collectedData.callbackRequested === true,
      },
    });

    await advanceStep(rcCallId, 'complete');

    return {
      outcome: 'voicemail',
      summary: `After-hours call from ${fromNumber}. Mode: ${mode}. Callback requested: ${collectedData.callbackRequested === true ? 'yes' : 'no'}.`,
    };
  }
}
