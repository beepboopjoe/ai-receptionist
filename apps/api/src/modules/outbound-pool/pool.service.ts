// ============================================================
// Per-tenant rotating outbound dialer number pool.
//
// Pool numbers are platform-managed rows in tenant_phone_numbers
// (purpose='outbound_pool', pool_auto_managed=true). They are
// bought from Telnyx directly — deliberately NOT via
// purchaseTenantNumber(), which is the only code path that
// creates per-number Stripe invoice items. Pool numbers carry no
// per-number fee; outbound minutes bill through the existing
// minute_usage overage pipeline instead.
//
// Rotation is least-recently-dialed, selected per call by the
// outbound dial job, so no single number concentrates enough
// daily volume to get carrier spam-flagged.
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers, outboundPoolNumberStats } from '../../db/schema.js';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  searchAvailableNumbers as telnyxSearch,
  purchaseNumber as telnyxPurchase,
} from '../phone-numbers/telnyx.client.js';
import { config } from '../../config.js';
import { IntegrationError } from '../../lib/errors.js';
import {
  POOL_INITIAL_SIZE,
  POOL_GROWTH_INCREMENT,
  POOL_MAX_SIZE,
  POOL_GROWTH_DIALS_PER_NUMBER_PER_DAY,
  POOL_GROWTH_MIN_TOTAL_DIALS_PER_DAY,
  POOL_SCALING_SWEEPS_PER_DAY,
} from './pool.constants.js';

export interface PoolNumber {
  id: string;
  phoneE164: string;
  region: string | null;
  purchasedAt: string;
  lastDialedAt: string | null;
  totalDials: number;
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
 * NO Stripe invoice item is created — pool numbers are free to the
 * tenant. monthlyCostCents records the wholesale rate purely for
 * internal cost visibility.
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

  const order = await telnyxPurchase(pick.phoneE164);

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
  };
}

/**
 * Idempotent — tops the tenant's pool up to POOL_INITIAL_SIZE.
 * Called (awaited) from campaign creation so a Telnyx failure
 * surfaces as a create error rather than a campaign with no
 * dialable numbers. Returns the current active pool.
 */
export async function ensureOutboundPool(tenantId: string): Promise<PoolNumber[]> {
  for (let guard = 0; guard < POOL_INITIAL_SIZE; guard++) {
    const rows = await db
      .select({ value: sql<number>`COUNT(*)` })
      .from(tenantPhoneNumbers)
      .where(activePoolWhere(tenantId));
    const count = Number(rows[0]?.value ?? 0);
    if (count >= POOL_INITIAL_SIZE) break;
    await provisionPoolNumber(tenantId);
  }
  return listOutboundPoolNumbers(tenantId);
}

/**
 * Per-call rotation: pick the least-recently-dialed active pool
 * number and bump its counters atomically. Uses FOR UPDATE SKIP
 * LOCKED so concurrent dial jobs never pick the same "least
 * recent" row in a race; if every stats row is momentarily locked
 * (more concurrent dials than pool numbers), falls back to sharing
 * the least-recent number rather than failing the dial.
 */
export async function selectPoolNumberForDial(tenantId: string): Promise<string> {
  const active = await db
    .select({ id: tenantPhoneNumbers.id, phoneE164: tenantPhoneNumbers.phoneE164 })
    .from(tenantPhoneNumbers)
    .where(activePoolWhere(tenantId));

  if (active.length === 0) {
    // Defensive — pool should exist from campaign creation.
    const pool = await ensureOutboundPool(tenantId);
    const first = pool[0];
    if (!first) throw new IntegrationError('telnyx', 'Outbound pool is empty and could not be provisioned');
    await bumpDialStats(first.id);
    return first.phoneE164;
  }

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

    await trx
      .update(outboundPoolNumberStats)
      .set({
        lastDialedAt: new Date(),
        dialsLast24h: sql`${outboundPoolNumberStats.dialsLast24h} + 1`,
        totalDials: sql`${outboundPoolNumberStats.totalDials} + 1`,
        updatedAt: new Date(),
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
  }));
}
