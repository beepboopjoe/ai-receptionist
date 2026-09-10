// ============================================================
// Persist + read the per-tenant usage / COGS ledger.
//
// Fire-and-forget from telephony / SMS / number purchase.
// Never throw — billing must not break calls.
// Stripe remains the customer invoice; this is internal truth.
// ============================================================
import { db } from '../../db/client.js';
import { tenantUsageEvents, tenantPhoneNumbers, tenants } from '../../db/schema.js';
import { and, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { config } from '../../config.js';
import { getPlan } from '@ai-receptionist/shared';
import { periodBoundsFor } from './usage.service.js';
import { PENDING_PHONE_E164 } from '../phone-numbers/inbound-did.js';
import {
  buildCallUsageEvents,
  buildNumberMonthlyEvent,
  buildSmsUsageEvent,
  summarizeUsageEvents,
  type UsageEventWrite,
  type UsageLedgerSummary,
  type UsageRateConfig,
} from './usage-ledger.js';
import pino from 'pino';

const logger = pino({ name: 'usage-ledger' });

export function usageRatesFromConfig(): UsageRateConfig {
  return {
    telnyxInboundCentsPerMin: config.TELNYX_INBOUND_CENTS_PER_MIN,
    telnyxOutboundCentsPerMin: config.TELNYX_OUTBOUND_CENTS_PER_MIN,
    telnyxSmsCents: config.TELNYX_SMS_CENTS,
    grokCentsPerMin: config.GROK_CENTS_PER_MIN,
  };
}

async function insertEvents(tenantId: string, events: UsageEventWrite[]): Promise<void> {
  if (events.length === 0) return;
  try {
    await db
      .insert(tenantUsageEvents)
      .values(
        events.map((e) => ({
          tenantId,
          callId: e.callId ?? null,
          eventType: e.eventType,
          quantity: e.quantity.toFixed(4),
          estimatedCents: e.estimatedCents.toFixed(4),
          direction: e.direction ?? null,
          metadata: e.metadata ?? {},
        }))
      )
      .onConflictDoNothing();
  } catch (err) {
    logger.warn({ err, tenantId, types: events.map((e) => e.eventType) }, 'usage ledger insert failed');
  }
}

export async function recordCallUsage(opts: {
  tenantId: string;
  callId: string;
  minutes: number;
  direction: 'inbound' | 'outbound';
  aiHandled?: boolean;
  isDemo?: boolean;
  mode?: string;
  callDirection?: string;
}): Promise<UsageEventWrite[] | null> {
  const events = buildCallUsageEvents({
    minutes: opts.minutes,
    direction: opts.direction,
    callId: opts.callId,
    rates: usageRatesFromConfig(),
    aiHandled: opts.aiHandled,
    isDemo: opts.isDemo,
    mode: opts.mode,
    callDirection: opts.callDirection,
  });
  if (!events) return null;
  await insertEvents(opts.tenantId, events);
  return events;
}

export async function recordSmsUsage(
  tenantId: string,
  direction: 'inbound' | 'outbound'
): Promise<void> {
  await insertEvents(tenantId, [buildSmsUsageEvent(direction, usageRatesFromConfig())]);
}

export async function recordNumberMonthlyUsage(opts: {
  tenantId: string;
  monthlyCostCents: number;
  phoneE164: string;
}): Promise<void> {
  const event = buildNumberMonthlyEvent(opts.monthlyCostCents, opts.phoneE164);
  if (!event) return;
  await insertEvents(opts.tenantId, [event]);
}

export async function sumActiveInboundNumberCents(tenantId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${tenantPhoneNumbers.monthlyCostCents}), 0)`,
    })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        isNull(tenantPhoneNumbers.releasedAt),
        eq(tenantPhoneNumbers.purpose, 'inbound'),
        ne(tenantPhoneNumbers.provisionStatus, 'failed'),
        ne(tenantPhoneNumbers.phoneE164, PENDING_PHONE_E164)
      )
    );
  return Number(row?.total ?? 0);
}

export interface UsageLedgerSnapshot extends UsageLedgerSummary {
  periodStart: string;
  periodEnd: string;
  planPriceCents: number;
  rates: UsageRateConfig;
  ratesAreEstimates: true;
  days: Array<{
    day: string;
    aiMinutes: number;
    telnyxCents: number;
    grokEstimateCents: number;
    smsCount: number;
  }>;
}

export async function getUsageLedgerSnapshot(tenantId: string): Promise<UsageLedgerSnapshot | null> {
  const [tenant] = await db
    .select({
      id: tenants.id,
      plan: tenants.plan,
      currentPeriodEnd: tenants.currentPeriodEnd,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) return null;

  const { start, end } = periodBoundsFor(tenant);
  const plan = getPlan(tenant.plan);
  const planPriceCents = Math.round((plan?.monthlyPrice ?? 0) * 100);

  const [eventRows, numberMonthlyCents] = await Promise.all([
    db
      .select({
        eventType: tenantUsageEvents.eventType,
        quantity: tenantUsageEvents.quantity,
        estimatedCents: tenantUsageEvents.estimatedCents,
        occurredAt: tenantUsageEvents.occurredAt,
      })
      .from(tenantUsageEvents)
      .where(
        and(
          eq(tenantUsageEvents.tenantId, tenantId),
          gte(tenantUsageEvents.occurredAt, start),
          lt(tenantUsageEvents.occurredAt, end)
        )
      ),
    sumActiveInboundNumberCents(tenantId),
  ]);

  const parsed = eventRows.map((r) => ({
    eventType: r.eventType,
    quantity: Number(r.quantity),
    estimatedCents: Number(r.estimatedCents),
    occurredAt: r.occurredAt,
  }));

  const summary = summarizeUsageEvents(parsed, numberMonthlyCents);
  const daysByKey = new Map<string, UsageLedgerSnapshot['days'][number]>();
  for (const r of parsed) {
    const day = r.occurredAt.toISOString().slice(0, 10);
    const cur = daysByKey.get(day) ?? {
      day,
      aiMinutes: 0,
      telnyxCents: 0,
      grokEstimateCents: 0,
      smsCount: 0,
    };
    if (r.eventType === 'ai_minutes') cur.aiMinutes += r.quantity;
    if (r.eventType === 'telnyx_inbound' || r.eventType === 'telnyx_outbound' || r.eventType === 'telnyx_sms') {
      cur.telnyxCents += r.estimatedCents;
    }
    if (r.eventType === 'grok_estimate') cur.grokEstimateCents += r.estimatedCents;
    if (r.eventType === 'telnyx_sms') cur.smsCount += r.quantity;
    daysByKey.set(day, cur);
  }

  return {
    ...summary,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    planPriceCents,
    rates: usageRatesFromConfig(),
    ratesAreEstimates: true,
    days: [...daysByKey.values()]
      .map((d) => ({
        ...d,
        aiMinutes: Math.round(d.aiMinutes * 10_000) / 10_000,
        telnyxCents: Math.round(d.telnyxCents * 10_000) / 10_000,
        grokEstimateCents: Math.round(d.grokEstimateCents * 10_000) / 10_000,
      }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export interface TenantUsageSnapshotRow {
  tenantId: string;
  aiMinutes: number;
  telnyxCents: number;
  grokEstimateCents: number;
  numberMonthlyCents: number;
  smsCount: number;
}

/** Platform admin: persisted ledger + current number monthly. No invented metrics. */
export async function getUsageSnapshotsForTenants(
  tenantIds: string[],
  since: Date
): Promise<Map<string, TenantUsageSnapshotRow>> {
  const out = new Map<string, TenantUsageSnapshotRow>();
  for (const id of tenantIds) {
    out.set(id, {
      tenantId: id,
      aiMinutes: 0,
      telnyxCents: 0,
      grokEstimateCents: 0,
      numberMonthlyCents: 0,
      smsCount: 0,
    });
  }
  if (tenantIds.length === 0) return out;

  const [eventRows, numberRows] = await Promise.all([
    db
      .select({
        tenantId: tenantUsageEvents.tenantId,
        eventType: tenantUsageEvents.eventType,
        quantity: sql<number>`COALESCE(SUM(${tenantUsageEvents.quantity}), 0)`,
        estimatedCents: sql<number>`COALESCE(SUM(${tenantUsageEvents.estimatedCents}), 0)`,
      })
      .from(tenantUsageEvents)
      .where(and(inArray(tenantUsageEvents.tenantId, tenantIds), gte(tenantUsageEvents.occurredAt, since)))
      .groupBy(tenantUsageEvents.tenantId, tenantUsageEvents.eventType),
    db
      .select({
        tenantId: tenantPhoneNumbers.tenantId,
        total: sql<number>`COALESCE(SUM(${tenantPhoneNumbers.monthlyCostCents}), 0)`,
      })
      .from(tenantPhoneNumbers)
      .where(
        and(
          inArray(tenantPhoneNumbers.tenantId, tenantIds),
          isNull(tenantPhoneNumbers.releasedAt),
          eq(tenantPhoneNumbers.purpose, 'inbound'),
          ne(tenantPhoneNumbers.provisionStatus, 'failed'),
          ne(tenantPhoneNumbers.phoneE164, PENDING_PHONE_E164)
        )
      )
      .groupBy(tenantPhoneNumbers.tenantId),
  ]);

  for (const row of eventRows) {
    const cur = out.get(row.tenantId);
    if (!cur) continue;
    const qty = Number(row.quantity);
    const cents = Number(row.estimatedCents);
    if (row.eventType === 'ai_minutes') cur.aiMinutes += qty;
    if (row.eventType === 'telnyx_inbound' || row.eventType === 'telnyx_outbound' || row.eventType === 'telnyx_sms') {
      cur.telnyxCents += cents;
    }
    if (row.eventType === 'grok_estimate') cur.grokEstimateCents += cents;
    if (row.eventType === 'telnyx_sms') cur.smsCount += qty;
  }
  for (const row of numberRows) {
    const cur = out.get(row.tenantId);
    if (cur) cur.numberMonthlyCents = Number(row.total);
  }
  return out;
}
