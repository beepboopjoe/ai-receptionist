// ============================================================
// Inbound SMS → AI receptionist loop (lean v1).
//
// After the webhook stores the inbound row: opt-out / HELP,
// plan gate, quiet hours, rate limit, then the same vertical
// brain as voice (reply / lead / escalate). Business DID only.
// ============================================================
import { db } from '../../db/client.js';
import { contacts, escalations, smsMessages, tenantSettings, tenants } from '../../db/schema.js';
import { and, asc, eq, or } from 'drizzle-orm';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import type { OfficeHours, Vertical } from '@ai-receptionist/shared';
import { VERTICAL_ESCALATION_VOCAB } from '../voice-agent/prompt-builder.js';
import { isAfterHoursCall } from '../telephony/office-hours.js';
import { getTenantDemoFlags } from '../billing/demo-account.js';
import { cacheIncr } from '../../db/redis.js';
import { emitWebhook } from '../webhooks/webhook.service.js';
import { pushActivity } from '../activity/activity.service.js';
import { sendTenantSms } from './send-tenant-sms.js';
import { ensureSmsContact } from './sms-contact.js';
import {
  inboundMatchesEscalationVocab,
  isSmsHelpKeyword,
  isSmsStopKeyword,
} from './sms-keywords.js';
import { afterHoursHoldReply, buildSmsSystemPrompt, type SmsAgentDecision } from './sms-agent.prompt.js';
import { completeSmsAgent } from './sms-agent.grok.js';
import pino from 'pino';

dayjs.extend(utc);
dayjs.extend(timezone);

const logger = pino({ name: 'sms-agent' });

const AI_REPLIES_PER_NUMBER_PER_HOUR = 8;
const STOP_ACK = 'You’re unsubscribed. We won’t text this number again.';

export interface InboundSmsJob {
  tenantId: string;
  fromPhone: string;
  toPhone: string;
  body: string;
  contactId: string | null;
}

async function loadThread(
  tenantId: string,
  externalPhone: string,
): Promise<Array<{ direction: 'inbound' | 'outbound'; body: string }>> {
  const rows = await db
    .select({
      direction: smsMessages.direction,
      body: smsMessages.body,
    })
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.tenantId, tenantId),
        or(eq(smsMessages.fromNumber, externalPhone), eq(smsMessages.toNumber, externalPhone)),
      ),
    )
    .orderBy(asc(smsMessages.createdAt))
    .limit(12);

  return rows
    .filter((r) => r.direction === 'inbound' || r.direction === 'outbound')
    .map((r) => ({
      direction: r.direction as 'inbound' | 'outbound',
      body: r.body,
    }));
}

async function createSmsEscalation(params: {
  tenantId: string;
  contactId: string | null;
  reason: string;
  priority: 'normal' | 'urgent';
}): Promise<void> {
  const [row] = await db
    .insert(escalations)
    .values({
      tenantId: params.tenantId,
      contactId: params.contactId ?? undefined,
      reason: params.reason.slice(0, 500),
      priority: params.priority,
      status: 'open',
    })
    .returning({ id: escalations.id, reason: escalations.reason, priority: escalations.priority });

  if (!row) return;
  void emitWebhook(params.tenantId, 'escalation.created', {
    escalationId: row.id,
    contactId: params.contactId,
    reason: row.reason,
    priority: row.priority,
    source: 'sms',
  });
  pushActivity(params.tenantId, 'escalation_created', {
    escalationId: row.id,
    reason: row.reason,
    source: 'sms',
  });
}

function fallbackDecision(params: {
  afterHours: boolean;
  practiceName: string;
  urgent: boolean;
  inboundBody: string;
  newContact: boolean;
}): SmsAgentDecision {
  if (params.urgent) {
    return {
      reply: `Thanks for texting ${params.practiceName}. I’m alerting the team now and someone will follow up.`,
      action: 'escalate',
      escalateReason: params.inboundBody.slice(0, 180),
      priority: 'urgent',
    };
  }
  if (params.afterHours) {
    return {
      reply: afterHoursHoldReply(params.practiceName),
      action: 'hold',
    };
  }
  if (params.newContact) {
    return {
      reply: `Thanks for texting ${params.practiceName}. How can we help? Reply with your name and what you need.`,
      action: 'lead',
    };
  }
  return {
    reply: `Thanks for texting ${params.practiceName}. A teammate will follow up shortly.`,
    action: 'reply',
  };
}

/**
 * Run after the inbound row is stored. Never throws to the webhook.
 */
export async function handleInboundSmsAgent(job: InboundSmsJob): Promise<void> {
  const { tenantId, fromPhone, toPhone, body } = job;
  try {
    const demo = await getTenantDemoFlags(tenantId);
    if (demo.isDemo) {
      logger.info({ tenantId, fromPhone }, 'Inbound SMS stored; skipping AI (demo account)');
      return;
    }

    if (isSmsStopKeyword(body)) {
      const already = await ensureSmsContact({ tenantId, phoneE164: fromPhone });
      if (already.optedOut) {
        logger.info({ tenantId, fromPhone }, 'Inbound SMS STOP ignored (already opted out)');
        return;
      }
      const result = await sendTenantSms({
        tenantId,
        to: fromPhone,
        body: STOP_ACK,
        source: 'ai_inbound',
        ignoreOptOut: true,
      });
      await ensureSmsContact({ tenantId, phoneE164: fromPhone, markOptOut: true });
      logger.info(
        { tenantId, fromPhone, contactId: already.id, ok: result.ok },
        'Inbound SMS STOP processed',
      );
      return;
    }

    const [tenant] = await db
      .select({
        name: tenants.name,
        timezone: tenants.timezone,
        vertical: tenants.vertical,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const [settings] = await db
      .select({
        officeHours: tenantSettings.officeHours,
        transferNumber: tenantSettings.transferNumber,
        businessContext: tenantSettings.businessContext,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    const practiceName = tenant?.name ?? 'our office';
    const tz = tenant?.timezone ?? 'America/New_York';
    const vertical = (tenant?.vertical ?? 'generic') as Vertical;
    const officeHours = (settings?.officeHours ?? {}) as OfficeHours;
    const now = dayjs().tz(tz);
    const afterHours = isAfterHoursCall({
      now,
      officeHours,
      dayKey: now.format('ddd').toLowerCase(),
    });

    if (isSmsHelpKeyword(body)) {
      const help = settings?.transferNumber
        ? `For help, call ${settings.transferNumber} or text us during office hours.`
        : `For help, text us during office hours and a teammate will follow up.`;
      await sendTenantSms({ tenantId, to: fromPhone, body: help, source: 'ai_inbound' });
      return;
    }

    const aiCount = await cacheIncr(`sms:rl:ai:${tenantId}:${fromPhone}`, 3600);
    if (aiCount !== null && aiCount > AI_REPLIES_PER_NUMBER_PER_HOUR) {
      logger.info({ tenantId, fromPhone, aiCount }, 'Inbound SMS AI rate-limited');
      return;
    }

    const vocab = VERTICAL_ESCALATION_VOCAB[vertical] ?? VERTICAL_ESCALATION_VOCAB.generic;
    const urgent = inboundMatchesEscalationVocab(body, vocab);

    const [contactRow] = job.contactId
      ? await db
          .select({ firstName: contacts.firstName, lastName: contacts.lastName })
          .from(contacts)
          .where(and(eq(contacts.id, job.contactId), eq(contacts.tenantId, tenantId)))
          .limit(1)
      : [];

    const contact = contactRow ?? null;
    const thread = await loadThread(tenantId, fromPhone);
    const prompt = buildSmsSystemPrompt({
      practiceName,
      vertical,
      timezone: tz,
      officeHours,
      transferNumber: settings?.transferNumber ?? null,
      businessContext: settings?.businessContext ?? null,
      contact,
      afterHours,
      thread,
      inboundBody: body,
    });

    const decided =
      (await completeSmsAgent(prompt)) ??
      fallbackDecision({
        afterHours,
        practiceName,
        urgent,
        inboundBody: body,
        newContact: !contact,
      });

    const action = urgent && decided.action !== 'escalate' ? 'escalate' : decided.action;
    const reply =
      decided.reply.trim() ||
      (afterHours ? afterHoursHoldReply(practiceName) : `Thanks for texting ${practiceName}.`);

    if (action === 'lead' || (!contact && (decided.firstName || action === 'lead'))) {
      await ensureSmsContact({
        tenantId,
        phoneE164: fromPhone,
        ...(decided.firstName ? { firstName: decided.firstName } : {}),
        ...(decided.lastName ? { lastName: decided.lastName } : {}),
        ...(decided.notes ? { notes: decided.notes } : {}),
      });
    }

    if (action === 'escalate' || urgent) {
      const ensured = await ensureSmsContact({ tenantId, phoneE164: fromPhone });
      await createSmsEscalation({
        tenantId,
        contactId: ensured.id,
        reason: decided.escalateReason || body.slice(0, 180),
        priority: decided.priority === 'urgent' || urgent ? 'urgent' : 'normal',
      });
    }

    const sent = await sendTenantSms({
      tenantId,
      to: fromPhone,
      body: reply.slice(0, 320),
      source: 'ai_inbound',
      ...(decided.firstName ? { firstName: decided.firstName } : {}),
      ...(decided.lastName ? { lastName: decided.lastName } : {}),
    });

    if (!sent.ok) {
      logger.warn(
        { tenantId, fromPhone, toPhone, code: sent.code, message: sent.message },
        'Inbound SMS AI reply not sent',
      );
    }
  } catch (err) {
    logger.error({ err, tenantId, fromPhone }, 'Inbound SMS agent failed');
  }
}
