// ============================================================
// Tenant-scoped outbound SMS. Shared by the dashboard inbox,
// Ask Telfin text shortcut, inbound AI replies, missed-call
// text-back, and MCP `telfin_send_sms` so plan / DID / carrier
// checks stay in one place.
// ============================================================
import { db } from '../../db/client.js';
import { smsMessages } from '../../db/schema.js';
import { sendSms } from '../notifications/adapters/telnyx-sms.adapter.js';
import { getTenantFromNumber } from './tenant-from-number.js';
import { getTenantDemoFlags } from '../billing/demo-account.js';
import { normalizeNanp, planAllowsSms } from '@ai-receptionist/shared';
import { classifySmsSendError } from './sms-send-error.js';
import { ensureSmsContact } from './sms-contact.js';
import { notesHaveSmsOptOut } from './sms-keywords.js';
import { cacheIncr } from '../../db/redis.js';
import { identifyCaller } from '../crm/crm.service.js';
import { emitWebhook } from '../webhooks/webhook.service.js';
import { pushActivity } from '../activity/activity.service.js';
import { auditLog } from '../../audit/audit-logger.js';

export const SMS_SEND_PLANS = new Set(['starter', 'growth', 'scale', 'business', 'enterprise']);

export const SMS_UPGRADE_MESSAGE =
  'Upgrade to a paid plan to send and receive SMS on your business number.';

const NANP_RE = /^\+1[2-9]\d{9}$/;
const SMS_BODY_MAX = 640;
const TENANT_HOURLY_CAP = 40;

export type SendTenantSmsResult =
  | {
      ok: true;
      messageId: string;
      contactId: string;
      contactCreated: boolean;
      toNumber: string;
      fromNumber: string;
    }
  | { ok: false; httpStatus: 400 | 402 | 409 | 412 | 429 | 502; code: string; message: string };

export async function sendTenantSms(params: {
  tenantId: string;
  to: string;
  body: string;
  firstName?: string;
  lastName?: string;
  actorId?: string;
  source?: 'inbox' | 'mcp' | 'ai_inbound' | 'ai_task' | 'missed_call_textback';
  /** Only for the one-time STOP acknowledgement. */
  ignoreOptOut?: boolean;
}): Promise<SendTenantSmsResult> {
  const toRaw = params.to.trim();
  const body = params.body.trim();
  if (!toRaw || !body) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'BadRequest',
      message: 'to and body are required',
    };
  }
  if (body.length > SMS_BODY_MAX) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'BadRequest',
      message: `Keep the text under ${SMS_BODY_MAX} characters.`,
    };
  }

  const to = normalizeNanp(toRaw) ?? toRaw;
  if (!NANP_RE.test(to)) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'BadRequest',
      message: 'Enter a valid US or Canada number, like +15551234567.',
    };
  }

  const demo = await getTenantDemoFlags(params.tenantId);
  if (demo.isDemo) {
    return {
      ok: false,
      httpStatus: 402,
      code: 'upgrade_required',
      message: SMS_UPGRADE_MESSAGE,
    };
  }

  // Promo-trial stays on plan key `trial` but is not a demo. Paid plans
  // plus promo-trial may send; unpaid Free cannot.
  if (!demo.promoTrial && !planAllowsSms(demo.plan ?? 'trial')) {
    return {
      ok: false,
      httpStatus: 402,
      code: 'upgrade_required',
      message: SMS_UPGRADE_MESSAGE,
    };
  }

  const fromNumber = await getTenantFromNumber(params.tenantId);
  if (!fromNumber) {
    return {
      ok: false,
      httpStatus: 412,
      code: 'SmsNotEnabled',
      message:
        'SMS is not enabled: provision a phone number in Settings → Phone Numbers before sending SMS.',
    };
  }

  const existing = await identifyCaller(to, params.tenantId);
  if (!params.ignoreOptOut && notesHaveSmsOptOut(existing?.notes)) {
    return {
      ok: false,
      httpStatus: 409,
      code: 'SmsOptedOut',
      message: 'This number opted out of texts. We will not send more SMS to it.',
    };
  }

  const hourly = await cacheIncr(`sms:rl:tenant:${params.tenantId}`, 3600);
  if (hourly !== null && hourly > TENANT_HOURLY_CAP) {
    return {
      ok: false,
      httpStatus: 429,
      code: 'SmsRateLimited',
      message: 'Too many texts from this account in the last hour. Try again later.',
    };
  }

  let msgId: string;
  try {
    msgId = await sendSms(to, body, fromNumber);
  } catch (err) {
    const classified = classifySmsSendError(err);
    return {
      ok: false,
      httpStatus: classified.httpStatus,
      code: classified.code,
      message: classified.message,
    };
  }

  void import('../billing/usage-ledger.service.js').then(({ recordSmsUsage }) =>
    recordSmsUsage(params.tenantId, 'outbound'),
  );

  const contact = await ensureSmsContact({
    tenantId: params.tenantId,
    phoneE164: to,
    ...(params.firstName ? { firstName: params.firstName } : {}),
    ...(params.lastName ? { lastName: params.lastName } : {}),
  });

  await db.insert(smsMessages).values({
    tenantId: params.tenantId,
    direction: 'outbound',
    fromNumber,
    toNumber: to,
    body,
    telnyxMessageId: msgId,
    status: 'delivered',
    contactId: contact.id,
  });

  pushActivity(params.tenantId, 'sms_sent', {
    toNumber: to,
    fromNumber,
    contactId: contact.id,
    preview: body.slice(0, 120),
    source: params.source ?? 'inbox',
  });
  void emitWebhook(params.tenantId, 'sms.sent', {
    toNumber: to,
    fromNumber,
    contactId: contact.id,
    bodyPreview: body.slice(0, 160),
    source: params.source ?? 'inbox',
  });

  if (params.actorId) {
    auditLog({
      tenantId: params.tenantId,
      actorType: 'admin_user',
      actorId: params.actorId,
      action: 'sms.sent',
      entityType: 'contact',
      entityId: contact.id,
      metadata: { to, fromNumber, source: params.source ?? 'inbox' },
    });
  }

  return {
    ok: true,
    messageId: msgId,
    contactId: contact.id,
    contactCreated: contact.created,
    toNumber: to,
    fromNumber,
  };
}
