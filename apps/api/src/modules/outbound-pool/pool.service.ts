// ============================================================
// Per-tenant rotating outbound dialer number pool.
//
// Pool numbers are platform-managed rows in tenant_phone_numbers
// (purpose='outbound_pool', pool_auto_managed=true). They are
// bought from Telnyx directly — deliberately NOT via
// purchaseTenantNumber(), which is the customer add-on path
// (included allotment / extra Stripe subscription items). Pool
// numbers carry no per-number fee; outbound minutes bill through
// the existing minute_usage overage pipeline instead.
//
// Rotation is least-recently-dialed, selected per call by the
// outbound dial job, so no single number concentrates enough
// daily volume to get carrier spam-flagged.
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers, outboundPoolNumberStats, tenants } from '../../db/schema.js';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  searchAvailableNumbers as telnyxSearch,
  purchaseNumber as telnyxPurchase,
} from '../phone-numbers/telnyx.client.js';
import { config } from '../../config.js';
import { IntegrationError, NotFoundError } from '../../lib/errors.js';
import {
  POOL_GROWTH_INCREMENT,
  POOL_MAX_SIZE,
  POOL_GROWTH_DIALS_PER_NUMBER_PER_DAY,
  POOL_GROWTH_MIN_TOTAL_DIALS_PER_DAY,
  POOL_SCALING_SWEEPS_PER_DAY,
} from './pool.constants.js';
import { targetPoolSizeForPlan } from './pool-size.js';
import { getTenantDemoFlags } from '../billing/demo-account.js';
import { isUnpaidDemoAccount } from '@ai-receptionist/shared';
import {
  coolingUntilAfterFailure,
  isHealthyForRotation,
  nextHealthAfterFailure,
  reenableHealthPatch,
  type PoolHealth,
} from './pool-health.js';

export interface PoolNumber {
  id: string;
  phoneE164: string;
  region: string | null;
  purchasedAt: string;
  lastDialedAt: string | null;
  totalDials: number;
  provisionStatus: 'provisioning' | 'active' | 'failed';
  provisionError: string | null;
  healthStatus: PoolHealth;
  consecutiveFailures: number;
  coolingUntil: string | null;
}

/** Active (non-released) pool rows for a tenant. */
function activePoolWhere(tenantId: string) {
  return and(
    eq(tenantPhoneNumbers.tenantId, tenantId),
    eq(tenantPhoneNumbers.purpose, 'outbound_pool'),
    isNull(tenantPhoneNumbers.releasedAt)
  );
}

/**
 * Buy ONE local number from Telnyx and register it as a pool number.
 * Prefers the area code of the tenant's existing inbound number so
 * outbound caller IDs look local to the business; falls back to any
 * available local number.
 *
 * NO Stripe add-on is created — pool numbers are free to the
 * tenant and do not consume the plan's includedPhoneNumbers
 * allotment. monthlyCostCents records the wholesale rate purely
 * for internal cost visibility.
 */
async function provisionPoolNumber(tenantId: string): Promise<PoolNumber> {
  // Prefer the tenant's inbound area code (US E.164: +1NXX...).
  const [inbound] = await db
    .select({ phoneE164: tenantPhoneNumbers.phoneE164 })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        eq(tenantPhoneNumbers.purpose, 'inbound'),
        isNull(tenantPhoneNumbers.releasedAt)
      )
    )
    .orderBy(asc(tenantPhoneNumbers.purchasedAt))
    .limit(1);
  const areaCode =
    inbound?.phoneE164?.startsWith('+1') && inbound.phoneE164.length === 12
      ? inbound.phoneE164.slice(2, 5)
      : undefined;

  let candidates = await telnyxSearch({ type: 'local', limit: 5, ...(areaCode ? { areaCode } : {}) });
  if (candidates.length === 0 && areaCode) {
    candidates = await telnyxSearch({ type: 'local', limit: 5 });
  }
  const pick = candidates[0];
  if (!pick) {
    throw new IntegrationError('telnyx', 'No local numbers available for pool provisioning');
  }

  const order = await telnyxPurchase(pick.phoneE164, {
    ...(config.TELNYX_APP_ID ? { connectionId: config.TELNYX_APP_ID } : {}),
    tags: [`tenant:${tenantId}`, 'purpose:outbound_pool'],
  });

  const [row] = await db
    .insert(tenantPhoneNumbers)
    .values({
      tenantId,
      phoneE164: pick.phoneE164,
      telnyxPhoneId: order.telnyxPhoneId,
      country: 'US',
      region: pick.region,
      numberType: 'local',
      // Wholesale rate, informational only — never billed to the tenant.
      monthlyCostCents: config.TELNYX_WHOLESALE_LOCAL_CENTS,
      isPrimary: false,
      purpose: 'outbound_pool',
      poolAutoManaged: true,
      provisionStatus: 'active',
    })
    .returning();
  if (!row) throw new Error('Pool number insert returned no row');

  await db.insert(outboundPoolNumberStats).values({
    tenantId,
    phoneNumberId: row.id,
  });

  return {
    id: row.id,
    phoneE164: row.phoneE164,
    region: row.region,
    purchasedAt: row.purchasedAt.toISOString(),
    lastDialedAt: null,
    totalDials: 0,
    provisionStatus: 'active',
    provisionError: null,
    healthStatus: 'active',
    consecutiveFailures: 0,
    coolingUntil: null,
  };
}

/**
 * Idempotent — tops the tenant's pool up to the plan's concurrentOutbound
 * ops ceiling (see targetPoolSizeForPlan; hard-capped at POOL_MAX_SIZE).
 * Called from campaign creation and go-live. Not a marketed seat.
 */
export async function ensureOutboundPool(tenantId: string): Promise<PoolNumber[]> {
  const demo = await getTenantDemoFlags(tenantId);
  // Free / dashboard-demo accounts do not get a live pool (#43).
  if (demo.isDemo) return listOutboundPoolNumbers(tenantId);

  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const target = targetPoolSizeForPlan(tenant?.plan);
  if (target === 0) return listOutboundPoolNumbers(tenantId);

  for (let guard = 0; guard < target; guard++) {
    const count = await countHealthyPoolNumbers(tenantId);
    if (count >= target) break;
    try {
      await provisionPoolNumber(tenantId);
    } catch (err) {
      console.error('[outbound-pool] Provision failed:', err);
      break;
    }
  }
  return listOutboundPoolNumbers(tenantId);
}

async function countHealthyPoolNumbers(tenantId: string, now: Date = new Date()): Promise<number> {
  const rows = await db
    .select({
      provisionStatus: tenantPhoneNumbers.provisionStatus,
      healthStatus: outboundPoolNumberStats.healthStatus,
      coolingUntil: outboundPoolNumberStats.coolingUntil,
    })
    .from(tenantPhoneNumbers)
    .leftJoin(
      outboundPoolNumberStats,
      eq(outboundPoolNumberStats.phoneNumberId, tenantPhoneNumbers.id)
    )
    .where(and(activePoolWhere(tenantId), eq(tenantPhoneNumbers.provisionStatus, 'active')));

  return rows.filter((r) =>
    isHealthyForRotation({
      provisionStatus: r.provisionStatus,
      healthStatus: r.healthStatus,
      coolingUntil: r.coolingUntil,
      now,
    })
  ).length;
}

async function loadHealthyPoolCandidates(
  tenantId: string,
  now: Date
): Promise<Array<{ id: string; phoneE164: string; healthStatus: PoolHealth; coolingUntil: Date | null }>> {
  const rows = await db
    .select({
      id: tenantPhoneNumbers.id,
      phoneE164: tenantPhoneNumbers.phoneE164,
      provisionStatus: tenantPhoneNumbers.provisionStatus,
      healthStatus: outboundPoolNumberStats.healthStatus,
      coolingUntil: outboundPoolNumberStats.coolingUntil,
    })
    .from(tenantPhoneNumbers)
    .leftJoin(
      outboundPoolNumberStats,
      eq(outboundPoolNumberStats.phoneNumberId, tenantPhoneNumbers.id)
    )
    .where(and(activePoolWhere(tenantId), eq(tenantPhoneNumbers.provisionStatus, 'active')));

  return rows
    .filter((r) =>
      isHealthyForRotation({
        provisionStatus: r.provisionStatus,
        healthStatus: r.healthStatus,
        coolingUntil: r.coolingUntil,
        now,
      })
    )
    .map((r) => ({
      id: r.id,
      phoneE164: r.phoneE164,
      healthStatus: ((r.healthStatus ?? 'active') as PoolHealth),
      coolingUntil: r.coolingUntil ?? null,
    }));
}

/**
 * Per-call rotation: pick the least-recently-dialed healthy pool
 * CLI (active, or cooling whose window expired) and bump counters
 * atomically. Uses FOR UPDATE SKIP LOCKED so concurrent dial jobs
 * never pick the same "least recent" row in a race; if every stats
 * row is momentarily locked, falls back to sharing the first
 * healthy number rather than failing the dial.
 */
export async function selectPoolNumberForDial(tenantId: string): Promise<string> {
  const demo = await getTenantDemoFlags(tenantId);
  if (demo.isDemo) {
    throw new IntegrationError('telnyx', 'Outbound pool is not available until you upgrade');
  }

  const now = new Date();
  const candidates = await loadHealthyPoolCandidates(tenantId, now);

  if (candidates.length === 0) {
    // Defensive — pool should exist from campaign creation. Top up
    // healthy CLIs (bad/cooling do not count toward the floor).
    const pool = await ensureOutboundPool(tenantId);
    const first = pool.find((n) =>
      isHealthyForRotation({
        provisionStatus: n.provisionStatus,
        healthStatus: n.healthStatus,
        coolingUntil: n.coolingUntil ? new Date(n.coolingUntil) : null,
        now,
      })
    );
    if (!first) throw new IntegrationError('telnyx', 'Outbound pool is empty and could not be provisioned');
    await bumpDialStats(first.id);
    return first.phoneE164;
  }

  const active = candidates;

  const byId = new Map(active.map((a) => [a.id, a.phoneE164]));
  const ids = active.map((a) => a.id);

  const picked = await db.transaction(async (trx) => {
    const [stats] = await trx
      .select({ id: outboundPoolNumberStats.id, phoneNumberId: outboundPoolNumberStats.phoneNumberId })
      .from(outboundPoolNumberStats)
      .where(inArray(outboundPoolNumberStats.phoneNumberId, ids))
      .orderBy(sql`${outboundPoolNumberStats.lastDialedAt} ASC NULLS FIRST`)
      .limit(1)
      .for('update', { skipLocked: true });
    if (!stats) return null;

    const pickedRow = active.find((a) => a.id === stats.phoneNumberId);
    const expireCooling =
      pickedRow?.healthStatus === 'cooling' &&
      pickedRow.coolingUntil != null &&
      pickedRow.coolingUntil <= now;

    await trx
      .update(outboundPoolNumberStats)
      .set({
        lastDialedAt: now,
        dialsLast24h: sql`${outboundPoolNumberStats.dialsLast24h} + 1`,
        totalDials: sql`${outboundPoolNumberStats.totalDials} + 1`,
        updatedAt: now,
        ...(expireCooling ? { healthStatus: 'active', coolingUntil: null } : {}),
      })
      .where(eq(outboundPoolNumberStats.id, stats.id));

    return stats.phoneNumberId;
  });

  if (picked) {
    const e164 = byId.get(picked);
    if (e164) return e164;
  }

  // All stats rows locked by concurrent dials — share the first active
  // number and bump its stats outside the lock (best-effort).
  const fallback = active[0];
  if (!fallback) {
    throw new IntegrationError('telnyx', 'Outbound pool unexpectedly empty during dial selection');
  }
  await bumpDialStats(fallback.id).catch(() => void 0);
  return fallback.phoneE164;
}

async function bumpDialStats(phoneNumberId: string): Promise<void> {
  await db
    .update(outboundPoolNumberStats)
    .set({
      lastDialedAt: new Date(),
      dialsLast24h: sql`${outboundPoolNumberStats.dialsLast24h} + 1`,
      totalDials: sql`${outboundPoolNumberStats.totalDials} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(outboundPoolNumberStats.phoneNumberId, phoneNumberId));
}

/**
 * Scaling sweep — runs on a repeatable schedule (every 6h). For each
 * tenant with an active pool: if the window's dial volume crossed
 * both prorated daily thresholds, grow the pool by
 * POOL_GROWTH_INCREMENT (never past POOL_MAX_SIZE). Resets each
 * number's rolling counter after evaluation so the next window
 * starts fresh.
 */
export async function runPoolScalingSweep(): Promise<{ tenantsScaled: number; numbersAdded: number }> {
  // Prorate the daily thresholds down to this sweep's window.
  const perNumberThreshold = POOL_GROWTH_DIALS_PER_NUMBER_PER_DAY / POOL_SCALING_SWEEPS_PER_DAY;
  const minTotalThreshold = POOL_GROWTH_MIN_TOTAL_DIALS_PER_DAY / POOL_SCALING_SWEEPS_PER_DAY;

  const tenantWindows = await db
    .select({
      tenantId: tenantPhoneNumbers.tenantId,
      activeCount: sql<number>`COUNT(*)`,
      windowDials: sql<number>`COALESCE(SUM(${outboundPoolNumberStats.dialsLast24h}), 0)`,
    })
    .from(tenantPhoneNumbers)
    .innerJoin(
      outboundPoolNumberStats,
      eq(outboundPoolNumberStats.phoneNumberId, tenantPhoneNumbers.id)
    )
    .where(
      and(eq(tenantPhoneNumbers.purpose, 'outbound_pool'), isNull(tenantPhoneNumbers.releasedAt))
    )
    .groupBy(tenantPhoneNumbers.tenantId);

  let tenantsScaled = 0;
  let numbersAdded = 0;

  for (const w of tenantWindows) {
    const [tenant] = await db
      .select({ plan: tenants.plan, promoTrial: tenants.promoTrial })
      .from(tenants)
      .where(eq(tenants.id, w.tenantId))
      .limit(1);
    if (isUnpaidDemoAccount(tenant?.plan, tenant?.promoTrial)) continue;

    const activeCount = Number(w.activeCount);
    const windowDials = Number(w.windowDials);
    const perNumber = activeCount > 0 ? windowDials / activeCount : 0;

    const shouldGrow =
      windowDials >= minTotalThreshold &&
      perNumber >= perNumberThreshold &&
      activeCount < POOL_MAX_SIZE;

    if (shouldGrow) {
      const toAdd = Math.min(POOL_GROWTH_INCREMENT, POOL_MAX_SIZE - activeCount);
      let added = 0;
      for (let i = 0; i < toAdd; i++) {
        try {
          await provisionPoolNumber(w.tenantId);
          added++;
        } catch (err) {
          console.error('[outbound-pool] Scaling provision failed:', err);
          break; // Telnyx trouble — retry next sweep rather than hammering.
        }
      }
      if (added > 0) {
        tenantsScaled++;
        numbersAdded += added;
      }
    }

    // Reset the rolling window for this tenant's numbers.
    await db
      .update(outboundPoolNumberStats)
      .set({ dialsLast24h: 0, updatedAt: new Date() })
      .where(eq(outboundPoolNumberStats.tenantId, w.tenantId));
  }

  return { tenantsScaled, numbersAdded };
}

/** Read-only pool listing for the dashboard settings page. */
export async function listOutboundPoolNumbers(tenantId: string): Promise<PoolNumber[]> {
  const rows = await db
    .select({
      id: tenantPhoneNumbers.id,
      phoneE164: tenantPhoneNumbers.phoneE164,
      region: tenantPhoneNumbers.region,
      purchasedAt: tenantPhoneNumbers.purchasedAt,
      lastDialedAt: outboundPoolNumberStats.lastDialedAt,
      totalDials: outboundPoolNumberStats.totalDials,
      provisionStatus: tenantPhoneNumbers.provisionStatus,
      provisionError: tenantPhoneNumbers.provisionError,
      healthStatus: outboundPoolNumberStats.healthStatus,
      consecutiveFailures: outboundPoolNumberStats.consecutiveFailures,
      coolingUntil: outboundPoolNumberStats.coolingUntil,
    })
    .from(tenantPhoneNumbers)
    .leftJoin(
      outboundPoolNumberStats,
      eq(outboundPoolNumberStats.phoneNumberId, tenantPhoneNumbers.id)
    )
    .where(activePoolWhere(tenantId))
    .orderBy(asc(tenantPhoneNumbers.purchasedAt));

  return rows.map((r) => ({
    id: r.id,
    phoneE164: r.phoneE164,
    region: r.region,
    purchasedAt: r.purchasedAt.toISOString(),
    lastDialedAt: r.lastDialedAt ? r.lastDialedAt.toISOString() : null,
    totalDials: r.totalDials ?? 0,
    provisionStatus: (r.provisionStatus as PoolNumber['provisionStatus']) ?? 'active',
    provisionError: r.provisionError,
    healthStatus: ((r.healthStatus ?? 'active') as PoolHealth),
    consecutiveFailures: r.consecutiveFailures ?? 0,
    coolingUntil: r.coolingUntil ? r.coolingUntil.toISOString() : null,
  }));
}

/** Re-run Telnyx orders for failed pool rows, then top the pool back up. */
export async function retryOutboundPool(tenantId: string): Promise<PoolNumber[]> {
  const failed = await db
    .select({ id: tenantPhoneNumbers.id })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        eq(tenantPhoneNumbers.purpose, 'outbound_pool'),
        isNull(tenantPhoneNumbers.releasedAt),
        eq(tenantPhoneNumbers.provisionStatus, 'failed')
      )
    );

  for (const row of failed) {
    await db
      .update(tenantPhoneNumbers)
      .set({ releasedAt: new Date(), updatedAt: new Date() })
      .where(eq(tenantPhoneNumbers.id, row.id));
  }

  return ensureOutboundPool(tenantId);
}

/**
 * Record a successful or failed outbound dial against the CLI that
 * was used. Failures cool then exclude the number; a later success
 * (Telnyx accepted the dial) resets the streak.
 */
export async function recordPoolDialOutcome(params: {
  tenantId: string;
  phoneE164: string;
  outcome: 'success' | 'failure';
  reason?: string;
}): Promise<void> {
  const [row] = await db
    .select({
      phoneNumberId: tenantPhoneNumbers.id,
      consecutiveFailures: outboundPoolNumberStats.consecutiveFailures,
    })
    .from(tenantPhoneNumbers)
    .innerJoin(
      outboundPoolNumberStats,
      eq(outboundPoolNumberStats.phoneNumberId, tenantPhoneNumbers.id)
    )
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, params.tenantId),
        eq(tenantPhoneNumbers.phoneE164, params.phoneE164),
        eq(tenantPhoneNumbers.purpose, 'outbound_pool'),
        isNull(tenantPhoneNumbers.releasedAt)
      )
    )
    .limit(1);

  if (!row) return;

  const now = new Date();
  if (params.outcome === 'success') {
    await db
      .update(outboundPoolNumberStats)
      .set({
        consecutiveFailures: 0,
        healthStatus: 'active',
        coolingUntil: null,
        lastFailureReason: null,
        updatedAt: now,
      })
      .where(eq(outboundPoolNumberStats.phoneNumberId, row.phoneNumberId));
    return;
  }

  const consecutiveFailures = (row.consecutiveFailures ?? 0) + 1;
  const healthStatus = nextHealthAfterFailure(consecutiveFailures);
  await db
    .update(outboundPoolNumberStats)
    .set({
      consecutiveFailures,
      healthStatus,
      coolingUntil: coolingUntilAfterFailure(healthStatus, now),
      lastFailureAt: now,
      lastFailureReason: params.reason ?? 'dial_error',
      updatedAt: now,
    })
    .where(eq(outboundPoolNumberStats.phoneNumberId, row.phoneNumberId));
}

/** Manual re-enable — puts a bad/cooling CLI back into rotation. */
export async function reenablePoolNumber(tenantId: string, phoneNumberId: string): Promise<PoolNumber> {
  const [owned] = await db
    .select({ id: tenantPhoneNumbers.id })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.id, phoneNumberId),
        eq(tenantPhoneNumbers.tenantId, tenantId),
        eq(tenantPhoneNumbers.purpose, 'outbound_pool'),
        isNull(tenantPhoneNumbers.releasedAt)
      )
    )
    .limit(1);
  if (!owned) throw new NotFoundError('Outbound line');

  await db
    .update(outboundPoolNumberStats)
    .set(reenableHealthPatch())
    .where(eq(outboundPoolNumberStats.phoneNumberId, phoneNumberId));

  const listed = await listOutboundPoolNumbers(tenantId);
  const found = listed.find((n) => n.id === phoneNumberId);
  if (!found) throw new NotFoundError('Outbound line');
  return found;
}
