// ============================================================
// Webhook event type — shared between API (emitter), dashboard
// (UI gate / list of subscribable events), and any future client
// SDK. Adding a new event:
//   1. Add the literal to `WEBHOOK_EVENT_TYPES` below
//   2. Call emitWebhook(...) from the corresponding business event
//   3. Update the events dropdown in /settings/webhooks
// ============================================================

export const WEBHOOK_EVENT_TYPES = [
  'call.started',
  'call.completed',
  'call.missed',
  'appointment.booked',
  'appointment.cancelled',
  'escalation.created',
  'escalation.resolved',
  'campaign.lead_qualified',
  'campaign.lead_booked',
  'campaign.completed',
] as const;

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number];

export function isWebhookEventType(value: unknown): value is WebhookEventType {
  return typeof value === 'string' && (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}
