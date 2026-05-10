// ============================================================
// Notification Service
// Enqueues SMS/email notifications via BullMQ.
// Actual send happens in the worker (send-reminder.job.ts).
// ============================================================
import { Queue } from 'bullmq';
import { redis } from '../../db/redis.js';
import { db } from '../../db/client.js';
import { notifications, contacts, tenantSettings } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { NotificationType, NotificationChannel } from '@ai-receptionist/shared';

// ---- Queue setup ----
let notificationQueue: Queue | null = null;

function getQueue(): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue('notifications', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return notificationQueue;
}

// ---- Public API ----

export interface QueueNotificationParams {
  tenantId: string;
  type: NotificationType;
  channel: NotificationChannel;
  contactId?: string;
  appointmentId?: string;
  callId?: string;
  /** If omitted, sends immediately. Pass a future date for delayed reminders. */
  sendAt?: Date;
  metadata: Record<string, unknown>;
}

export async function queueNotification(params: QueueNotificationParams): Promise<void> {
  const { tenantId, type, channel, contactId, appointmentId, callId, sendAt, metadata } = params;

  // Resolve recipient phone or email from contacts table
  let toAddress = '';
  if (contactId) {
    const [contact] = await db
      .select({ phoneE164: contacts.phoneE164, email: contacts.email })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    toAddress = channel === 'sms'
      ? (contact?.phoneE164 ?? '')
      : (contact?.email ?? '');
  }

  // For staff_task / missed_call notifications, route to the practice's transfer number
  if (!toAddress || type === 'staff_task' || type === 'missed_call') {
    const [settings] = await db
      .select({ transferNumber: tenantSettings.transferNumber })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);
    toAddress = settings?.transferNumber ?? toAddress;
  }

  if (!toAddress) {
    console.warn(`[notification.service] No recipient found for type=${type} contactId=${contactId}`);
    return;
  }

  // Create DB record first (we'll update status after send)
  const [notification] = await db
    .insert(notifications)
    .values({
      tenantId,
      contactId: contactId ?? undefined,
      appointmentId: appointmentId ?? undefined,
      callId: callId ?? undefined,
      type,
      channel,
      toAddress,
      status: 'pending',
      templateId: type,
    })
    .returning({ id: notifications.id });

  const notificationId = notification?.id;

  // Calculate BullMQ delay (ms from now until sendAt)
  const delay = sendAt ? Math.max(0, sendAt.getTime() - Date.now()) : 0;

  await getQueue().add(
    'send-notification',
    {
      notificationId,
      tenantId,
      type,
      channel,
      toAddress,
      metadata,
    },
    { delay }
  );
}

/**
 * Mark a notification as sent (called from worker)
 */
export async function markNotificationSent(
  notificationId: string,
  providerMsgId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({
      status: 'sent',
      providerMsgId,
      sentAt: new Date(),
    })
    .where(eq(notifications.id, notificationId));
}

/**
 * Mark a notification as failed (called from worker)
 */
export async function markNotificationFailed(
  notificationId: string,
  reason: string
): Promise<void> {
  await db
    .update(notifications)
    .set({
      status: 'failed',
      failedReason: reason,
    })
    .where(eq(notifications.id, notificationId));
}
