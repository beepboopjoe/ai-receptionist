// ============================================================
// Missed-call SMS text-back
//
// After a real inbound miss (hang-up, no-answer, after-hours AI
// with no conversation, staff-first overflow that nobody picks
// up) send one short SMS from the public business DID.
//
// Reuses sendTenantSms so demo / plan / STOP / rate-limit /
// carrier-reject gates stay in one place. Idempotent per call id.
// ============================================================
import { db } from '../../db/client.js';
import { calls, notifications, tenantSettings, tenants } from '../../db/schema.js';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { normalizeNanp } from '@ai-receptionist/shared';
import { isUniqueViolation } from '../public-api/public-demo.helpers.js';
import { cacheSetNx } from '../../db/redis.js';
import { getTenantFromNumber } from './tenant-from-number.js';
import { sendTenantSms } from './send-tenant-sms.js';
import pino from 'pino';

const logger = pino({ name: 'missed-call-textback' });

export const MISSED_CALL_TEXTBACK_PREF = 'missedCallTextBack';
export const MISSED_CALL_SMS_TYPE = 'missed_call_sms';
export const MISSED_CALL_SMS_TEMPLATE = 'missed-call-text-back';
export const HANGUP_TEXTBACK_SETTLE_MS = 2500;
export const TEXTBACK_DEBOUNCE_MS = 30 * 60 * 1000;
export const TEXTBACK_CLAIM_TTL_SECONDS = 7 * 24 * 3600;

export type MissedCallTextBackReason = 'missed' | 'hangup';

export type MissedCallTextBackSkipReason =
  | 'outbound'
  | 'staff_answered'
  | 'had_conversation'
  | 'disabled'
  | 'no_caller'
  | 'already_sent'
  | 'recent_textback'
  | 'send_blocked'
  | 'ai_handles';

export type MissedCallTextBackResult =
  | { sent: true; messageId: string }
  | { sent: false; skipped: MissedCallTextBackSkipReason; detail?: string };

/** Default ON — only an explicit `false` turns it off. */
export function isMissedCallTextBackEnabled(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== 'object') return true;
  return (prefs as Record<string, unknown>)[MISSED_CALL_TEXTBACK_PREF] !== false;
}

export function callHasConversationTranscript(transcript: unknown): boolean {
  if (!Array.isArray(transcript) || transcript.length === 0) return false;
  return transcript.some((turn) => {
    if (!turn || typeof turn !== 'object') return false;
    const text = (turn as { text?: unknown }).text;
    return typeof text === 'string' && text.trim().length > 0;
  });
}

export function formatPublicNumberForSms(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  const trimmed = e164.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildMissedCallTextBackBody(opts: {
  businessName: string;
  publicNumber?: string | null;
}): string {
  const name = (opts.businessName || 'our team').trim() || 'our team';
  const pretty = formatPublicNumberForSms(opts.publicNumber ?? null);
  const callBack = pretty
    ? ` Reply here or call back at ${pretty}.`
    : ' Reply here or call us back.';
  return `Sorry we missed you — this is ${name}.${callBack} Want a callback? Just reply to this text.`;
}

export function evaluateMissedCallTextBack(input: {
  isOutbound?: boolean;
  direction?: string | null;
  status?: string | null;
  hasTranscript: boolean;
  enabled: boolean;
  callerPhone?: string | null;
  alreadyClaimed: boolean;
  recentTextBack: boolean;
}): { ok: true } | { ok: false; reason: MissedCallTextBackSkipReason } {
  if (
    input.isOutbound === true ||
    input.direction === 'outbound' ||
    input.direction === 'test'
  ) {
    return { ok: false, reason: 'outbound' };
  }
  if (input.status === 'transferred') {
    return { ok: false, reason: 'staff_answered' };
  }
  if (input.hasTranscript) {
    return { ok: false, reason: 'had_conversation' };
  }
  if (!input.enabled) {
    return { ok: false, reason: 'disabled' };
  }
  const caller = (input.callerPhone ?? '').trim();
  if (!caller) {
    return { ok: false, reason: 'no_caller' };
  }
  if (input.alreadyClaimed) {
    return { ok: false, reason: 'already_sent' };
  }
  if (input.recentTextBack) {
    return { ok: false, reason: 'recent_textback' };
  }
  return { ok: true };
}

function textbackClaimKey(callId: string): string {
  return `sms:textback:call:${callId}`;
}

/**
 * Staff-first / overflow hangup: the caller left while the team line
 * was ringing, so no AI stream will emit call.missed.
 * AI-answered hangups are owned by call.missed so we don't race the
 * transcript write.
 */
export function hangupShouldAttemptTextBack(routing?: string | null): boolean {
  return routing === 'overflow' || routing === 'forward';
}

export async function scheduleMissedCallTextBackOnHangup(params: {
  callId: string;
  tenantId: string;
  callerPhone: string;
  routing?: string | null;
}): Promise<MissedCallTextBackResult> {
  if (!hangupShouldAttemptTextBack(params.routing)) {
    return { sent: false, skipped: 'ai_handles' };
  }
  await new Promise((resolve) => setTimeout(resolve, HANGUP_TEXTBACK_SETTLE_MS));
  return maybeSendMissedCallTextBack({ ...params, reason: 'hangup' });
}

export async function maybeSendMissedCallTextBack(params: {
  callId: string;
  tenantId: string;
  callerPhone: string;
  reason: MissedCallTextBackReason;
}): Promise<MissedCallTextBackResult> {
  const [call] = await db
    .select({
      status: calls.status,
      direction: calls.direction,
      transcript: calls.transcript,
      fromNumber: calls.fromNumber,
    })
    .from(calls)
    .where(eq(calls.id, params.callId))
    .limit(1);

  const callerPhone = normalizeNanp(params.callerPhone) ?? params.callerPhone.trim();

  const [settings] = await db
    .select({ prefs: tenantSettings.notificationPreferences })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, params.tenantId))
    .limit(1);

  const recentCutoff = new Date(Date.now() - TEXTBACK_DEBOUNCE_MS);
  const [recent] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, params.tenantId),
        eq(notifications.type, MISSED_CALL_SMS_TYPE),
        eq(notifications.toAddress, callerPhone),
        gt(notifications.createdAt, recentCutoff),
        inArray(notifications.status, ['pending', 'sent']),
        sql`${notifications.callId} IS DISTINCT FROM ${params.callId}`,
      ),
    )
    .limit(1);

  const redisClaim = await cacheSetNx(textbackClaimKey(params.callId), '1', TEXTBACK_CLAIM_TTL_SECONDS);

  const decision = evaluateMissedCallTextBack({
    direction: call?.direction ?? null,
    status: call?.status ?? null,
    hasTranscript: callHasConversationTranscript(call?.transcript),
    enabled: isMissedCallTextBackEnabled(settings?.prefs),
    callerPhone,
    alreadyClaimed: redisClaim === false,
    recentTextBack: Boolean(recent),
  });

  if (!decision.ok) {
    logger.info(
      { tenantId: params.tenantId, callId: params.callId, reason: params.reason, skipped: decision.reason },
      'Missed-call text-back skipped',
    );
    return { sent: false, skipped: decision.reason };
  }

  const claimed = await claimTextBackSlot({
    tenantId: params.tenantId,
    callId: params.callId,
    callerPhone,
  });
  if (!claimed) {
    return { sent: false, skipped: 'already_sent' };
  }

  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, params.tenantId))
    .limit(1);

  const publicNumber = await getTenantFromNumber(params.tenantId);
  const body = buildMissedCallTextBackBody({
    businessName: tenant?.name ?? 'our team',
    publicNumber,
  });

  const result = await sendTenantSms({
    tenantId: params.tenantId,
    to: callerPhone,
    body,
    source: 'missed_call_textback',
  });

  if (!result.ok) {
    await db
      .update(notifications)
      .set({
        status: 'skipped',
        failedReason: `${result.code}: ${result.message}`.slice(0, 500),
        body,
      })
      .where(
        and(
          eq(notifications.tenantId, params.tenantId),
          eq(notifications.callId, params.callId),
          eq(notifications.type, MISSED_CALL_SMS_TYPE),
        ),
      );
    logger.info(
      {
        tenantId: params.tenantId,
        callId: params.callId,
        code: result.code,
        httpStatus: result.httpStatus,
      },
      'Missed-call text-back not sent',
    );
    return { sent: false, skipped: 'send_blocked', detail: result.code };
  }

  await db
    .update(notifications)
    .set({
      status: 'sent',
      body,
      contactId: result.contactId,
      providerMsgId: result.messageId,
      sentAt: new Date(),
      toAddress: result.toNumber,
    })
    .where(
      and(
        eq(notifications.tenantId, params.tenantId),
        eq(notifications.callId, params.callId),
        eq(notifications.type, MISSED_CALL_SMS_TYPE),
      ),
    );

  logger.info(
    { tenantId: params.tenantId, callId: params.callId, reason: params.reason, to: result.toNumber },
    'Missed-call text-back sent',
  );
  return { sent: true, messageId: result.messageId };
}

async function claimTextBackSlot(params: {
  tenantId: string;
  callId: string;
  callerPhone: string;
}): Promise<boolean> {
  try {
    await db.insert(notifications).values({
      tenantId: params.tenantId,
      callId: params.callId,
      type: MISSED_CALL_SMS_TYPE,
      channel: 'sms',
      toAddress: params.callerPhone,
      status: 'pending',
      templateId: MISSED_CALL_SMS_TEMPLATE,
      body: '',
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}
