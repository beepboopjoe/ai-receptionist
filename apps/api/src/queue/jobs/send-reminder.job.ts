// ============================================================
// send-notification job — executed by the notifications worker
// ============================================================
import type { Job } from 'bullmq';
import { sendSms } from '../../modules/notifications/adapters/telnyx-sms.adapter.js';
import { sendEmail } from '../../modules/notifications/adapters/email.adapter.js';
import {
  markNotificationSent,
  markNotificationFailed,
} from '../../modules/notifications/notification.service.js';
import { renderSmsTemplate, type SmsTemplateType } from '../../modules/notifications/templates/sms.templates.js';
import type { NotificationType, NotificationChannel } from '@ai-receptionist/shared';

export interface SendNotificationJobData {
  notificationId: string;
  tenantId: string;
  type: NotificationType;
  channel: NotificationChannel;
  toAddress: string;
  metadata: Record<string, unknown>;
}

export async function processSendNotification(job: Job<SendNotificationJobData>): Promise<void> {
  const { notificationId, type, channel, toAddress, metadata } = job.data;

  try {
    if (channel === 'sms') {
      const body = renderSmsTemplate(type as SmsTemplateType, metadata);
      const sid = await sendSms(toAddress, body);
      await markNotificationSent(notificationId, sid);
    } else if (channel === 'email') {
      // Email templates are more complex; for V1 use a simple HTML wrapper
      const subject = getEmailSubject(type, metadata);
      const html = `<p>${renderSmsTemplate(type as SmsTemplateType, metadata)}</p>`;
      await sendEmail({ to: toAddress, subject, html });
      await markNotificationSent(notificationId, `email:${Date.now()}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await markNotificationFailed(notificationId, reason);
    throw err; // Let BullMQ retry
  }
}

function getEmailSubject(type: NotificationType, vars: Record<string, unknown>): string {
  switch (type) {
    case 'confirmation':
      return vars['isReschedule']
        ? 'Your appointment has been rescheduled'
        : vars['isCancellation']
          ? 'Your appointment has been cancelled'
          : 'Appointment confirmed';
    case 'reminder_24h':
      return `Reminder: Your appointment is tomorrow, ${vars['appointmentDate']}`;
    case 'reminder_2h':
      return `Reminder: Your appointment is in 2 hours`;
    case 'missed_call':
      return `Missed call from ${vars['contactName'] ?? 'contact'}`;
    case 'staff_task':
      return `Action required: ${vars['taskType'] ?? 'staff task'}`;
    default:
      return 'Notification from your dental practice';
  }
}
