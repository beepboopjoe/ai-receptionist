// ============================================================
// Tenant-scoped outbound SMS. Shared by the dashboard SMS inbox
// and the MCP `telfin_send_sms` tool so plan / DID / Telnyx
// checks stay in one place.
// ============================================================
import { db } from '../../db/client.js';
import { smsMessages, contacts, tenants } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { sendSms } from '../notifications/adapters/telnyx-sms.adapter.js';
import { getTenantFromNumber } from './tenant-from-number.js';
import { IntegrationError } from '../../lib/errors.js';

/** Plans that unlock two-way SMS send. Trial is blocked. */
export const SMS_SEND_PLANS = new Set(['growth', 'scale', 'business', 'enterprise']);

export type SendTenantSmsResult =
  | { ok: true; messageId: string }
  | { ok: false; httpStatus: 400 | 402 | 412 | 502; code: string; message: string };

export async function sendTenantSms(params: {
  tenantId: string;
  to: string;
  body: string;
}): Promise<SendTenantSmsResult> {
  const to = params.to.trim();
  const body = params.body.trim();
  if (!to || !body) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'BadRequest',
      message: 'to and body are required',
    };
  }

  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, params.tenantId))
    .limit(1);

  if (!tenant || !SMS_SEND_PLANS.has(tenant.plan ?? 'trial')) {
    return {
      ok: false,
      httpStatus: 402,
      code: 'SmsNotEnabled',
      message: 'SMS is not enabled for this tenant. Two-way SMS requires the Starter plan or above.',
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

  let msgId: string;
  try {
    msgId = await sendSms(to, body, fromNumber);
  } catch (err) {
    const message =
      err instanceof IntegrationError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'SMS send failed';
    return {
      ok: false,
      httpStatus: 502,
      code: 'SmsNotEnabled',
      message: `SMS is not enabled: ${message}`,
    };
  }

  void import('../billing/usage-ledger.service.js').then(({ recordSmsUsage }) =>
    recordSmsUsage(params.tenantId, 'outbound')
  );

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tenantId, params.tenantId), eq(contacts.phoneE164, to)))
    .limit(1);

  await db.insert(smsMessages).values({
    tenantId: params.tenantId,
    direction: 'outbound',
    fromNumber,
    toNumber: to,
    body,
    telnyxMessageId: msgId,
    status: 'delivered',
    contactId: contact?.id ?? null,
  });

  return { ok: true, messageId: msgId };
}
