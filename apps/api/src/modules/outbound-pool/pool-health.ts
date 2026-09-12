// ============================================================
// Pure outbound-pool health helpers (no DB).
//
// Lean v1: repeated dial / provision failures pull a CLI out of
// rotation. Cooling auto-returns; bad waits for manual re-enable.
// ============================================================
import {
  POOL_BAD_AFTER_FAILURES,
  POOL_COOLING_AFTER_FAILURES,
  POOL_COOLING_MS,
} from './pool.constants.js';

export type PoolHealth = 'active' | 'cooling' | 'bad';

export function nextHealthAfterFailure(consecutiveFailures: number): PoolHealth {
  if (consecutiveFailures >= POOL_BAD_AFTER_FAILURES) return 'bad';
  if (consecutiveFailures >= POOL_COOLING_AFTER_FAILURES) return 'cooling';
  return 'active';
}

export function coolingUntilAfterFailure(
  health: PoolHealth,
  now: Date = new Date()
): Date | null {
  if (health !== 'cooling') return null;
  return new Date(now.getTime() + POOL_COOLING_MS);
}

/** True when this row may be used as the next outbound CLI. */
export function isHealthyForRotation(params: {
  provisionStatus: string;
  healthStatus: string | null | undefined;
  coolingUntil: Date | null | undefined;
  now?: Date;
}): boolean {
  if (params.provisionStatus !== 'active') return false;
  const health = (params.healthStatus ?? 'active') as PoolHealth;
  if (health === 'bad') return false;
  if (health === 'cooling') {
    if (!params.coolingUntil) return false;
    return (params.now ?? new Date()) >= params.coolingUntil;
  }
  return true;
}

export function reenableHealthPatch(now: Date = new Date()) {
  return {
    healthStatus: 'active' as const,
    consecutiveFailures: 0,
    coolingUntil: null,
    lastFailureReason: null,
    updatedAt: now,
  };
}
