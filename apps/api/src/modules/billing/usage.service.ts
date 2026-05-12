// ============================================================
// Per-billing-period minute usage tracking + overage billing.
//
// Hooked from telephony's onCallEnded handler — when a call
// completes, we add `duration_seconds / 60` to the tenant's
// current period row in `minute_usage`. If usage crosses the
// plan's included minutes, an overage Stripe invoice item is
// created so the next subscription invoice picks it up.
//
// All operations are fire-and-forget — never throw. Telephony
// must not break because billing failed.
// ============================================================
import { db } from '../../db/client.js';
import { tenants, minuteUsage } from '../../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { getStripe } from './stripe.client.js';
import { getPlan } from '@ai-receptionist/shared';

/**
 * Compute the current billing period's [start, end] for a tenant.
 *
 * Stripe stores `currentPeriodEnd` on the subscription. The period
 * START is end - 1 month (Stripe doesn't expose it on our row, but
 * for monthly subs the start = end - 1 month is exact).
 *
 * For tenants without a Stripe sub yet (trial, never-paid), we use
 * a calendar-month window keyed off the tenant creation date.
 */
function periodBoundsFor(tenant: {
  currentPeriodEnd: Date | null;
  createdAt: Date;
}): { start: Date; end: Date } {
  if (tenant.currentPeriodEnd) {
    const end = tenant.currentPeriodEnd;
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    return { start, end };
  }
  // Trial/no-sub fallback: anchor to the day-of-month the tenant was created.
  const now = new Date();
  const start = new Date(tenant.createdAt);
  // Walk start forward until it's the most recent occurrence on or before now.
  while (true) {
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    if (next > now) break;
    start.setMonth(start.getMonth() + 1);
  }
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

interface AccumulateResult {
  minutesUsed: number;
  overageMinutes: number;
  overageJustCharged: boolean;
}

/**
 * Add `minutes` to the tenant's current period usage row. Returns
 * the post-update totals. Idempotent at the SQL level via UPSERT.
 */
export async function incrementMinuteUsage(
  tenantId: string,
  minutes: number
): Promise<AccumulateResult | null> {
  if (minutes <= 0) return null;

  const [tenant] = await db
    .select({
      id: tenants.id,
      plan: tenants.plan,
      stripeCustomerId: tenants.stripeCustomerId,
      currentPeriodEnd: tenants.currentPeriodEnd,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) return null;

  const { start, end } = periodBoundsFor(tenant);
  const plan = getPlan(tenant.plan);
  const includedMinutes = plan?.monthlyMinutes ?? 0;
  // Enterprise = unlimited (-1) → never overages.
  const isUnlimited = includedMinutes < 0;

  // UPSERT — first call in a period inserts, subsequent calls add.
  const [row] = await db
    .insert(minuteUsage)
    .values({
      tenantId,
      periodStart: start,
      periodEnd: end,
      minutesUsed: minutes.toFixed(4),
    })
    .onConflictDoUpdate({
      target: [minuteUsage.tenantId, minuteUsage.periodStart],
      set: {
        minutesUsed: sql`${minuteUsage.minutesUsed} + ${minutes.toFixed(4)}`,
        updatedAt: new Date(),
      },
    })
    .returning({
      minutesUsed: minuteUsage.minutesUsed,
      overageMinutes: minuteUsage.overageMinutes,
      overageChargedCents: minuteUsage.overageChargedCents,
    });
  if (!row) return null;

  const usedNum = Number(row.minutesUsed);
  const overageNow = isUnlimited ? 0 : Math.max(0, usedNum - includedMinutes);
  const previouslyCharged = Number(row.overageMinutes);

  let overageJustCharged = false;

  // Bill overage in 10-minute chunks to avoid one Stripe invoice item per
  // call (which would generate huge invoices). When overage crosses the
  // next 10-minute boundary, create one invoice item for the delta.
  const CHUNK = 10;
  const previousChunks = Math.floor(previouslyCharged / CHUNK);
  const currentChunks = Math.floor(overageNow / CHUNK);
  const newChunks = currentChunks - previousChunks;

  if (newChunks > 0 && plan && plan.overagePerMin > 0 && tenant.stripeCustomerId) {
    const minutesInChunk = newChunks * CHUNK;
    const cents = Math.round(minutesInChunk * plan.overagePerMin * 100);
    try {
      const stripe = getStripe();
      if (stripe) {
        await stripe.invoiceItems.create({
          customer: tenant.stripeCustomerId,
          amount: cents,
          currency: 'usd',
          description: `Overage minutes (${minutesInChunk} min @ $${plan.overagePerMin.toFixed(2)}/min)`,
          metadata: {
            tenantId,
            periodStart: start.toISOString(),
            kind: 'overage',
          },
        });
        // Persist the delta so the next call doesn't double-bill.
        await db
          .update(minuteUsage)
          .set({
            overageMinutes: sql`${minuteUsage.overageMinutes} + ${minutesInChunk.toFixed(4)}`,
            overageChargedCents: sql`${minuteUsage.overageChargedCents} + ${cents}`,
            updatedAt: new Date(),
          })
          .where(and(eq(minuteUsage.tenantId, tenantId), eq(minuteUsage.periodStart, start)));
        overageJustCharged = true;
      }
    } catch (err) {
      // Don't crash the call — log + carry on. Overage will be charged
      // on the next call once Stripe recovers.
      console.error('[usage] Failed to create overage invoice item:', err);
    }
  }

  return {
    minutesUsed: usedNum,
    overageMinutes: overageNow,
    overageJustCharged,
  };
}

export interface UsageSnapshot {
  periodStart: string;
  periodEnd: string;
  minutesUsed: number;
  minutesIncluded: number;
  overageMinutes: number;
  overageChargedCents: number;
  pctUsed: number;
  warningSent: boolean;
}

/**
 * Read-only snapshot of the current period's usage for the dashboard.
 * Does NOT create a row if none exists — returns zeros instead.
 */
export async function getCurrentUsage(tenantId: string): Promise<UsageSnapshot | null> {
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
  const includedMinutes = plan?.monthlyMinutes ?? 0;

  const [row] = await db
    .select()
    .from(minuteUsage)
    .where(and(eq(minuteUsage.tenantId, tenantId), eq(minuteUsage.periodStart, start)))
    .limit(1);

  const minutesUsed = row ? Number(row.minutesUsed) : 0;
  const overageMinutes = row ? Number(row.overageMinutes) : 0;
  const overageChargedCents = row?.overageChargedCents ?? 0;
  const pct = includedMinutes > 0 ? Math.round((minutesUsed / includedMinutes) * 100) : 0;

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    minutesUsed,
    minutesIncluded: includedMinutes,
    overageMinutes,
    overageChargedCents,
    pctUsed: pct,
    warningSent: Boolean(row?.warningSentAt),
  };
}
