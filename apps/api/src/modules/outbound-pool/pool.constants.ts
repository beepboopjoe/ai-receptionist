// ============================================================
// Outbound number pool sizing — single source of truth.
//
// Carriers flag local DIDs that place roughly 100–150+ outbound
// calls/day. The pool spreads a tenant's campaign dials across
// several numbers so no single number approaches that zone, and
// the scaling sweep grows the pool before concentration gets
// risky. Numbers are bought at Telnyx wholesale (~$1–2/mo), so
// the platform cost of a pool is trivial next to call revenue.
// ============================================================

/** Numbers auto-provisioned when a tenant first uses outbound. */
export const POOL_INITIAL_SIZE = 3;

/** Numbers added per scaling-sweep growth event. */
export const POOL_GROWTH_INCREMENT = 2;

/** Hard cap — bounds Telnyx monthly cost exposure per tenant
 *  (~$15–30/mo wholesale at 15 numbers). 15 numbers × ~100
 *  safe dials/day ≈ 1,500 dials/day of capacity. */
export const POOL_MAX_SIZE = 15;

/** Daily dials-per-number rate that triggers pool growth. Kept
 *  well under the ~100–150/day carrier danger zone. */
export const POOL_GROWTH_DIALS_PER_NUMBER_PER_DAY = 100;

/** Minimum total daily dial volume across the pool before growth
 *  is considered at all — a tenant doing 60 calls/day across 3
 *  numbers doesn't need a bigger pool. */
export const POOL_GROWTH_MIN_TOTAL_DIALS_PER_DAY = 150;

/** How many scaling sweeps run per day (worker cron: every 6h).
 *  The sweep resets each number's rolling dial counter, so the
 *  daily thresholds above are prorated by this factor. */
export const POOL_SCALING_SWEEPS_PER_DAY = 4;
