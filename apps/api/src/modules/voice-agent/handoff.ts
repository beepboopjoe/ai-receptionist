// ============================================================
// AI → Human handoff coordination
// ============================================================
import { updateCallState } from './session-manager.js';
import { initiateHumanTransfer } from '../telephony/transfer.js';
import { db } from '../../db/client.js';
import { calls, escalations } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { audit } from '../../audit/audit-logger.js';
import type { EscalationReason } from '@ai-receptionist/shared';

export interface HandoffParams {
  tenantId: string;
  callId: string;
  rcCallId: string;
  contactId?: string;
  reason: EscalationReason;
  priority: 'urgent' | 'normal';
}

export async function executeHandoff(params: HandoffParams): Promise<void> {
  const { tenantId, callId, rcCallId, contactId, reason, priority } = params;

  // Update call state to escalating
  await updateCallState(rcCallId, { currentStep: 'escalating' });

  // Create escalation record
  const [escalation] = await db
    .insert(escalations)
    .values({
      tenantId,
      callId,
      contactId: contactId ?? null,
      reason,
      priority,
      status: 'open',
    })
    .returning();

  // Update call status
  await db
    .update(calls)
    .set({ status: 'transferred', escalationReason: reason, outcome: 'escalated', updatedAt: new Date() })
    .where(eq(calls.id, callId));

  audit.callEscalated(tenantId, callId, reason, priority);

  // If urgent, immediately attempt transfer
  if (priority === 'urgent') {
    void initiateHumanTransfer({ tenantId, callId, rcCallId, reason });
  }

  // Queue staff notification
  void notifyStaff({ tenantId, escalationId: escalation?.id ?? '', reason, priority });
}

async function notifyStaff(params: {
  tenantId: string;
  escalationId: string;
  reason: string;
  priority: string;
}): Promise<void> {
  // Import lazily to avoid circular deps
  const { queueNotification } = await import('../notifications/notification.service.js');
  await queueNotification({
    tenantId: params.tenantId,
    type: 'staff_task',
    channel: 'sms',
    metadata: {
      escalationId: params.escalationId,
      reason: params.reason,
      priority: params.priority,
    },
  });
}
