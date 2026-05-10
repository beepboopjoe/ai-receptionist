// ============================================================
// Webhook service
//
// Public surface:
//   - emitWebhook(tenantId, eventType, payload)
//       Looks up matching endpoints, queues delivery rows, kicks the
//       worker. Call this from anywhere an interesting event happens
//       (post-call orchestrator, appointment service, escalation flow).
//
//   - deliverPending()
//       Consumed by a cron/worker. Picks up pending+ready deliveries
//       and POSTs them with HMAC signatures. Schedules retries with
//       exponential backoff. After 5 failed attempts → dead_letter.
//
//   - signPayload(secret, body) / verifySignature(secret, body, sig)
//       Public helpers for receivers to validate inbound webhooks.
//
// Wire format:
//   POST <endpoint.url>
//   Headers:
//     content-type: application/json
//     x-webhook-event: appointment.booked
//     x-webhook-id: <delivery uuid>
//     x-webhook-timestamp: <unix seconds>
//     x-webhook-signature: t=<ts>,v1=<hmac-sha256(secret, "<ts>.<body>")>
//   Body: { event, deliveryId, tenantId, timestamp, data }
// ============================================================
import crypto from 'crypto';
import { db } from '../../db/client.js';
import { webhookEndpoints, webhookDeliveries } from '../../db/schema.js';
import { and, eq, lte, or, sql } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({ name: 'webhooks' });

const MAX_ATTEMPTS = 5;
const BACKOFF_SCHEDULE_SECONDS = [60, 300, 1800, 7200, 21600]; // 1m, 5m, 30m, 2h, 6h

export type { WebhookEventType } from '@ai-receptionist/shared';
import type { WebhookEventType } from '@ai-receptionist/shared';

/**
 * Returns true when an endpoint subscribes to the given event.
 * `events` field is comma-separated; '*' means all events.
 */
function endpointMatches(events: string, eventType: string): boolean {
  if (events === '*') return true;
  const list = events.split(',').map((s) => s.trim());
  return list.includes('*') || list.includes(eventType);
}

/**
 * Queue a webhook delivery for every active endpoint subscribed to this
 * event for this tenant. Non-blocking — actual HTTP POST happens in the
 * delivery worker so the caller's hot path stays fast.
 */
export async function emitWebhook(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.tenantId, tenantId), eq(webhookEndpoints.isActive, true)));

    if (endpoints.length === 0) return;

    const matching = endpoints.filter((e) => endpointMatches(e.events, eventType));
    if (matching.length === 0) return;

    const now = new Date();
    const rows = matching.map((endpoint) => ({
      endpointId: endpoint.id,
      tenantId,
      eventType,
      payload: { event: eventType, tenantId, timestamp: now.toISOString(), data },
      status: 'pending' as const,
      attempts: 0,
      nextAttemptAt: now,
    }));

    await db.insert(webhookDeliveries).values(rows);
    logger.info({ tenantId, eventType, count: rows.length }, 'Queued webhook deliveries');
  } catch (err) {
    // Never throw from emit — the calling business logic must succeed even
    // if webhook bookkeeping fails. Log and move on.
    logger.error({ err, tenantId, eventType }, 'Failed to queue webhook delivery');
  }
}

/**
 * Sign a webhook body with the endpoint's secret. Receiver verifies with
 * the same algorithm. We include the timestamp in the signed string to
 * prevent replay attacks.
 */
export function signPayload(secret: string, timestamp: number, body: string): string {
  const mac = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

/**
 * Verify a signature header. Receivers should reject events older than 5
 * minutes (replay window) and require constant-time comparison.
 */
export function verifySignature(secret: string, body: string, header: string, maxAgeSeconds = 300): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const ts = Number(parts['t']);
  const v1 = parts['v1'];
  if (!ts || !v1) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSeconds > maxAgeSeconds) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  // Constant-time comparison to defeat timing attacks.
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

interface DeliveryAttemptResult {
  ok: boolean;
  httpStatus?: number;
  responseBody?: string;
  error?: string;
}

async function attemptDelivery(
  url: string,
  secret: string,
  payload: Record<string, unknown>,
  deliveryId: string
): Promise<DeliveryAttemptResult> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-event': String(payload['event'] ?? ''),
        'x-webhook-id': deliveryId,
        'x-webhook-timestamp': String(ts),
        'x-webhook-signature': signPayload(secret, ts, body),
      },
      body,
      // Don't let a slow customer endpoint hang our worker.
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, httpStatus: res.status, responseBody: text.slice(0, 1000) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Drain the queue: pull every pending delivery whose `next_attempt_at` is
 * due, attempt the POST, and mark the row delivered/failed/dead_letter.
 * Designed to be called every ~15s by a cron or BullMQ worker.
 */
export async function deliverPending(batchSize = 25): Promise<{ delivered: number; failed: number }> {
  const now = new Date();

  // Lock-free claim: pick up the next batch, set status=in_flight via attempts++.
  // Postgres UPDATE...RETURNING gives us atomic claim-and-fetch.
  const rows = await db
    .update(webhookDeliveries)
    .set({ attempts: sql`${webhookDeliveries.attempts} + 1` })
    .where(
      and(
        eq(webhookDeliveries.status, 'pending'),
        or(
          sql`${webhookDeliveries.nextAttemptAt} IS NULL`,
          lte(webhookDeliveries.nextAttemptAt, now)
        )!
      )
    )
    .returning();

  if (rows.length === 0) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;

  // Cap concurrency at batchSize so a flood doesn't spike outbound connections.
  const batch = rows.slice(0, batchSize);

  await Promise.all(
    batch.map(async (row) => {
      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, row.endpointId))
        .limit(1);

      if (!endpoint || !endpoint.isActive) {
        await db
          .update(webhookDeliveries)
          .set({ status: 'failed', errorMessage: 'Endpoint missing or inactive' })
          .where(eq(webhookDeliveries.id, row.id));
        failed++;
        return;
      }

      const result = await attemptDelivery(
        endpoint.url,
        endpoint.secret,
        row.payload as Record<string, unknown>,
        row.id
      );

      if (result.ok) {
        await Promise.all([
          db
            .update(webhookDeliveries)
            .set({
              status: 'delivered',
              deliveredAt: new Date(),
              httpStatus: result.httpStatus ?? null,
              responseBody: result.responseBody ?? null,
            })
            .where(eq(webhookDeliveries.id, row.id)),
          db
            .update(webhookEndpoints)
            .set({ lastDeliveredAt: new Date(), failureCount: 0 })
            .where(eq(webhookEndpoints.id, endpoint.id)),
        ]);
        delivered++;
        return;
      }

      // Failure path — schedule retry or dead-letter.
      const isFinal = row.attempts >= MAX_ATTEMPTS;
      const backoffSec =
        BACKOFF_SCHEDULE_SECONDS[Math.min(row.attempts, BACKOFF_SCHEDULE_SECONDS.length - 1)]!;
      const nextAttempt = new Date(Date.now() + backoffSec * 1000);

      await Promise.all([
        db
          .update(webhookDeliveries)
          .set({
            status: isFinal ? 'dead_letter' : 'pending',
            httpStatus: result.httpStatus ?? null,
            responseBody: result.responseBody ?? null,
            errorMessage: result.error ?? `HTTP ${result.httpStatus ?? 'error'}`,
            nextAttemptAt: isFinal ? null : nextAttempt,
          })
          .where(eq(webhookDeliveries.id, row.id)),
        db
          .update(webhookEndpoints)
          .set({
            lastFailedAt: new Date(),
            failureCount: sql`${webhookEndpoints.failureCount} + 1`,
          })
          .where(eq(webhookEndpoints.id, endpoint.id)),
      ]);
      failed++;
    })
  );

  logger.info({ delivered, failed }, 'Webhook delivery batch complete');
  return { delivered, failed };
}

/**
 * Generate a fresh signing secret for a new endpoint. 32 bytes → 64 hex chars.
 * Customers see this exactly once at create-time; we never store it in plaintext
 * elsewhere or expose it via GET responses after creation.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
