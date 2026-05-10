// ============================================================
// Activity service — fan-out events to subscribed dashboard
// WebSocket clients. Per-tenant subscriber set so a tenant only
// sees its own events. Fire-and-forget — never throws.
//
// `pushActivity()` is the canonical entry point for any business
// event the live activity feed should reflect. Pair it with
// `emitWebhook()` for the customer-facing webhook delivery.
// ============================================================
import type { WebSocket } from 'ws';
import pino from 'pino';

const logger = pino({ name: 'activity' });

/** Activity event names — match the dashboard's `useActivityFeed` ActivityEventType. */
export type ActivityEventType =
  | 'call_started'
  | 'call_completed'
  | 'call_missed'
  | 'appointment_booked'
  | 'appointment_cancelled'
  | 'escalation_created'
  | 'escalation_resolved'
  | 'campaign_lead_connected'
  | 'campaign_lead_qualified'
  | 'campaign_lead_booked'
  | 'campaign_completed';

export interface ActivityEvent {
  type: ActivityEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/** Per-tenant subscriber set. Garbage-collected when sockets close. */
const subscribers = new Map<string, Set<WebSocket>>();

export function subscribe(tenantId: string, socket: WebSocket): () => void {
  let set = subscribers.get(tenantId);
  if (!set) {
    set = new Set();
    subscribers.set(tenantId, set);
  }
  set.add(socket);
  logger.debug({ tenantId, total: set.size }, 'Activity subscriber added');

  // Return unsubscribe function used by the gateway when the socket closes.
  return () => {
    const s = subscribers.get(tenantId);
    if (!s) return;
    s.delete(socket);
    if (s.size === 0) subscribers.delete(tenantId);
    logger.debug({ tenantId, total: s.size }, 'Activity subscriber removed');
  };
}

/**
 * Push an activity event to every connected subscriber for this tenant.
 * Safe to call from any business event handler — never throws and never
 * blocks. Sockets in a non-OPEN state are skipped (the gateway's close
 * handler will clean them up).
 */
export function pushActivity(
  tenantId: string,
  type: ActivityEventType,
  data: Record<string, unknown> = {}
): void {
  const set = subscribers.get(tenantId);
  if (!set || set.size === 0) return;

  const event: ActivityEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };
  const payload = JSON.stringify(event);

  for (const socket of set) {
    try {
      // ws WebSocket.OPEN === 1
      if ((socket as { readyState: number }).readyState === 1) {
        socket.send(payload);
      }
    } catch (err) {
      logger.warn({ err, tenantId }, 'Failed to push activity event');
    }
  }
}

/** Diagnostic helper — exposed for /healthz dashboards. */
export function getSubscriberCount(): number {
  let total = 0;
  for (const set of subscribers.values()) total += set.size;
  return total;
}
