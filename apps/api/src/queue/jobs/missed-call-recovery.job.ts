// ============================================================
// missed-call-recovery job
// Enqueued when a call is missed; queues a staff follow-up notification
// ============================================================
import type { Job } from 'bullmq';
import { db } from '../../db/client.js';
import { calls, contacts } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { queueNotification } from '../../modules/notifications/notification.service.js';

export interface MissedCallRecoveryJobData {
  callId: string;
  tenantId: string;
  fromNumber: string;
  callSid: string;
}

export async function processMissedCallRecovery(job: Job<MissedCallRecoveryJobData>): Promise<void> {
  const { callId, tenantId, fromNumber } = job.data;

  // Look up the call record
  const [call] = await db
    .select({ contactId: calls.contactId, status: calls.status })
    .from(calls)
    .where(and(eq(calls.id, callId), eq(calls.tenantId, tenantId)))
    .limit(1);

  // Only process if still missed (not since handled)
  if (!call || call.status !== 'missed') {
    return;
  }

  // Look up caller identity
  let contactId: string | undefined;
  let patientName = 'Unknown caller';

  if (call.contactId) {
    const [contact] = await db
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(eq(contacts.id, call.contactId))
      .limit(1);

    if (contact) {
      contactId = contact.id;
      patientName = `${contact.firstName} ${contact.lastName}`;
    }
  }

  await queueNotification({
    tenantId,
    type: 'missed_call',
    channel: 'sms',
    contactId,
    callId,
    metadata: {
      patientName,
      patientPhone: fromNumber,
      callbackRequested: false,
      afterHoursMode: 'n/a',
    },
  });
}
