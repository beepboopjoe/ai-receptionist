// ============================================================
// Plan-aware outbound pool sizing. No new SKUs — Growth/Scale/
// Business concurrentOutbound from billing.types.ts is the signal.
// Volume-based scaling (pool.constants.ts) can still grow up to
// POOL_MAX_SIZE after the floor is met.
// ============================================================
import { getPlan } from '@ai-receptionist/shared';
import { POOL_INITIAL_SIZE, POOL_MAX_SIZE } from './pool.constants.js';

/**
 * How many rotating outbound DIDs this plan should start with.
 * Trial / inbound-only → 0. Enterprise unlimited → POOL_MAX_SIZE.
 * Growth 3, Scale 8, Business 25 (capped at POOL_MAX_SIZE).
 */
export function targetPoolSizeForPlan(planKey: string | null | undefined): number {
  const plan = getPlan(planKey ?? '');
  if (!plan || !plan.outbound) return 0;
  if (plan.concurrentOutbound < 0) return POOL_MAX_SIZE;
  if (plan.concurrentOutbound === 0) return 0;
  return Math.min(POOL_MAX_SIZE, Math.max(POOL_INITIAL_SIZE, plan.concurrentOutbound));
}

/**
 * Cap a campaign's maxConcurrentCalls to the plan's concurrentOutbound.
 * Enterprise (-1) is uncapped. Missing input defaults to Growth's 3.
 */
export function capConcurrentOutbound(
  requested: number | undefined,
  planKey: string | null | undefined
): number {
  const fallback = requested ?? 3;
  const safe = Math.max(1, fallback);
  const plan = getPlan(planKey ?? '');
  if (!plan || plan.concurrentOutbound < 0) return safe;
  if (plan.concurrentOutbound === 0) return 1;
  return Math.min(safe, plan.concurrentOutbound);
}

/** True when this plan includes at least one dedicated inbound DID. */
export function planIncludesInboundDid(planKey: string | null | undefined): boolean {
  const plan = getPlan(planKey ?? '');
  if (!plan) return false;
  return plan.includedPhoneNumbers === -1 || plan.includedPhoneNumbers > 0;
}
