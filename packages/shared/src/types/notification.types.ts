// ============================================================
// Notification Types
// ============================================================

export type NotificationType =
  | 'confirmation'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'missed_call'
  | 'staff_task'
  | 'recall_reminder'
  | 'reschedule_confirmation'
  | 'cancellation_confirmation';

export type NotificationChannel = 'sms' | 'email';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface Notification {
  id: string;
  tenantId: string;
  contactId: string | null;
  appointmentId: string | null;
  callId: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  toAddress: string;
  status: NotificationStatus;
  templateId: string;
  body: string;
  providerMsgId: string | null;
  sentAt: string | null;
  failedReason: string | null;
  createdAt: string;
}

// ---- Notification Adapter Interface ----

export interface SendNotificationParams {
  to: string;
  body: string;
  subject?: string; // email only
  from?: string;
}

export interface SendResult {
  providerId: string;
}

export interface INotificationAdapter {
  readonly channel: NotificationChannel;
  send(params: SendNotificationParams): Promise<SendResult>;
}

// ---- Template variable tokens ----
export interface NotificationTemplateVars {
  contactName?: string;
  practiceNname?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentType?: string;
  providerName?: string;
  callbackNumber?: string;
  confirmUrl?: string;
  cancelUrl?: string;
}
