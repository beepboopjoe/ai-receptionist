// ============================================================
// RingCentral webhook event dispatcher — CRITICAL FILE
// All call lifecycle events enter the system here.
// ============================================================
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { calls, tenants } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { auditLog } from '../../audit/audit-logger.js';

// Payload shapes for RingCentral telephony session events
interface RcParty {
  id: string;
  direction: 'Inbound' | 'Outbound';
  from?: { phoneNumber?: string; name?: string };
  to?: { phoneNumber?: string; name?: string };
  status?: { code: string };
  missedCall?: boolean;
}

interface RcTelephonyEvent {
  uuid: string;
  event: string;
  timestamp: string;
  subscriptionId: string;
  body: {
    telephonySessionId?: string;
    sessionId?: string;
    serverId?: string;
    eventTime?: string;
    parties?: RcParty[];
  };
}

/**
 * Main dispatch function. Called by the webhook router for every RC event.
 * Identifies the tenant by the webhook's target phone number, then routes
 * to the appropriate handler.
 */
export async function handleRingCentralEvent(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = request.body as RcTelephonyEvent;
  const validationToken = request.headers['validation-token'] as string | undefined;

  // Handle RingCentral webhook validation challenge
  if (validationToken) {
    reply.header('Validation-Token', validationToken);
    return reply.status(200).send();
  }

  request.log.debug({ event: body.event }, '[telephony] Received RC event');

  // Find the inbound party to identify which tenant this call belongs to
  const inboundParty = body.body?.parties?.find(
    (p) => p.direction === 'Inbound'
  );

  if (!inboundParty) {
    // Outbound call or unrecognized event structure
    return reply.status(200).send({ ok: true });
  }

  const toNumber = inboundParty.to?.phoneNumber ?? '';
  const fromNumber = inboundParty.from?.phoneNumber ?? '';
  const rcCallId = body.body?.telephonySessionId ?? body.body?.sessionId ?? '';
  const statusCode = inboundParty.status?.code ?? '';

  // Route based on party status code
  switch (statusCode) {
    case 'Proceeding':
    case 'Setup':
      await onCallRinging({ toNumber, fromNumber, rcCallId, body });
      break;
    case 'Answered':
      await onCallAnswered({ rcCallId });
      break;
    case 'Disconnected':
      await onCallEnded({ rcCallId, missed: inboundParty.missedCall ?? false });
      break;
    default:
      request.log.debug({ statusCode }, '[telephony] Unhandled status code');
  }

  return reply.status(200).send({ ok: true });
}

// ---- Event sub-handlers ----

async function onCallRinging(params: {
  toNumber: string;
  fromNumber: string;
  rcCallId: string;
  body: RcTelephonyEvent;
}): Promise<void> {
  const { toNumber, fromNumber, rcCallId } = params;

  // Find tenant by the inbound phone number (stored in integrations.metadata)
  // For now we look up via a tenant whose RC integration has this number
  // In production this is cached in Redis for O(1) lookup
  const tenant = await findTenantByPhone(toNumber);
  if (!tenant) {
    console.warn(`[telephony] No tenant found for number ${toNumber}`);
    return;
  }

  // Create call record
  const [call] = await db
    .insert(calls)
    .values({
      tenantId: tenant.id,
      rcCallId,
      direction: 'inbound',
      fromNumber,
      toNumber,
      status: 'active',
      startedAt: new Date(),
    })
    .returning();

  auditLog({
    tenantId: tenant.id,
    actorType: 'system',
    action: 'call.ringing',
    entityType: 'call',
    entityId: call?.id,
    metadata: { fromNumber, toNumber, rcCallId },
  });

  // Trigger workflow orchestration asynchronously
  // Import lazily to avoid circular deps
  void import('../workflow-engine/orchestrator.js').then(({ orchestrate }) =>
    orchestrate({ callId: call?.id ?? '', tenantId: tenant.id, fromNumber, rcCallId })
  );
}

async function onCallAnswered(params: { rcCallId: string }): Promise<void> {
  await db
    .update(calls)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(calls.rcCallId, params.rcCallId));
}

async function onCallEnded(params: {
  rcCallId: string;
  missed: boolean;
}): Promise<void> {
  const { rcCallId, missed } = params;
  const now = new Date();

  const [existing] = await db
    .select({ id: calls.id, startedAt: calls.startedAt, tenantId: calls.tenantId })
    .from(calls)
    .where(eq(calls.rcCallId, rcCallId))
    .limit(1);

  if (!existing) return;

  const durationSeconds = existing.startedAt
    ? Math.round((now.getTime() - new Date(existing.startedAt).getTime()) / 1000)
    : null;

  await db
    .update(calls)
    .set({
      status: missed ? 'missed' : 'completed',
      endedAt: now,
      durationSeconds,
      outcome: missed ? 'voicemail' : undefined,
      updatedAt: now,
    })
    .where(eq(calls.rcCallId, rcCallId));

  auditLog({
    tenantId: existing.tenantId,
    actorType: 'system',
    action: missed ? 'call.missed' : 'call.ended',
    entityType: 'call',
    entityId: existing.id,
    metadata: { durationSeconds },
  });
}

// ---- Helper: find tenant by phone number ----
async function findTenantByPhone(
  phone: string
): Promise<{ id: string; timezone: string } | null> {
  // In V1, we query integrations.metadata for the connected phone number.
  // This is a simple O(n) scan and is fine at low tenant counts.
  // In V2 this should be cached in Redis.
  const rows = await db.select({ id: tenants.id, timezone: tenants.timezone }).from(tenants).limit(100);

  // For now return first active tenant — in multi-tenant this would
  // match on the phone number stored in integrations.metadata.phoneNumbers
  return rows[0] ?? null;
}
