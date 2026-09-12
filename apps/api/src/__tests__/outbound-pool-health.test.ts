// ============================================================
// Outbound pool lean v1 — health + rotation + Free gates.
// Pure helpers + source scans. No carrier / DB.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  coolingUntilAfterFailure,
  isHealthyForRotation,
  nextHealthAfterFailure,
  reenableHealthPatch,
} from '../modules/outbound-pool/pool-health.js';
import {
  POOL_BAD_AFTER_FAILURES,
  POOL_COOLING_AFTER_FAILURES,
  POOL_COOLING_MS,
} from '../modules/outbound-pool/pool.constants.js';
import { targetPoolSizeForPlan } from '../modules/outbound-pool/pool-size.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

describe('pool health transitions', () => {
  it('cools after the first failure and marks bad after repeated failures', () => {
    expect(POOL_COOLING_AFTER_FAILURES).toBe(1);
    expect(POOL_BAD_AFTER_FAILURES).toBe(3);
    expect(nextHealthAfterFailure(0)).toBe('active');
    expect(nextHealthAfterFailure(1)).toBe('cooling');
    expect(nextHealthAfterFailure(2)).toBe('cooling');
    expect(nextHealthAfterFailure(3)).toBe('bad');
    expect(nextHealthAfterFailure(9)).toBe('bad');
  });

  it('sets a cooling window only for cooling health', () => {
    const now = new Date('2026-09-12T12:00:00.000Z');
    expect(coolingUntilAfterFailure('active', now)).toBeNull();
    expect(coolingUntilAfterFailure('bad', now)).toBeNull();
    expect(coolingUntilAfterFailure('cooling', now)?.toISOString()).toBe(
      new Date(now.getTime() + POOL_COOLING_MS).toISOString()
    );
  });

  it('excludes failed provision, bad, and unexpired cooling from rotation', () => {
    const now = new Date('2026-09-12T12:00:00.000Z');
    expect(
      isHealthyForRotation({ provisionStatus: 'failed', healthStatus: 'active', coolingUntil: null, now })
    ).toBe(false);
    expect(
      isHealthyForRotation({ provisionStatus: 'active', healthStatus: 'bad', coolingUntil: null, now })
    ).toBe(false);
    expect(
      isHealthyForRotation({
        provisionStatus: 'active',
        healthStatus: 'cooling',
        coolingUntil: new Date('2026-09-12T12:30:00.000Z'),
        now,
      })
    ).toBe(false);
    expect(
      isHealthyForRotation({
        provisionStatus: 'active',
        healthStatus: 'cooling',
        coolingUntil: new Date('2026-09-12T11:00:00.000Z'),
        now,
      })
    ).toBe(true);
    expect(
      isHealthyForRotation({ provisionStatus: 'active', healthStatus: 'active', coolingUntil: null, now })
    ).toBe(true);
    expect(
      isHealthyForRotation({ provisionStatus: 'active', healthStatus: null, coolingUntil: null, now })
    ).toBe(true);
  });

  it('re-enable clears the failure streak', () => {
    const patch = reenableHealthPatch(new Date('2026-09-12T12:00:00.000Z'));
    expect(patch.healthStatus).toBe('active');
    expect(patch.consecutiveFailures).toBe(0);
    expect(patch.coolingUntil).toBeNull();
  });
});

describe('Free accounts do not get a live pool', () => {
  it('sizes the trial pool at 0 and paid plans above 0', () => {
    expect(targetPoolSizeForPlan('trial')).toBe(0);
    expect(targetPoolSizeForPlan('growth')).toBeGreaterThan(0);
  });

  it('ensure + dial refuse unpaid demo accounts', () => {
    const pool = readFileSync(join(srcRoot, 'modules/outbound-pool/pool.service.ts'), 'utf8');
    expect(pool).toContain('getTenantDemoFlags');
    expect(pool).toContain('demo.isDemo');
    expect(pool).toContain('Outbound pool is not available until you upgrade');
    expect(pool).toContain('isHealthyForRotation');
    expect(pool).toContain('recordPoolDialOutcome');
    expect(pool).toContain('reenablePoolNumber');
    expect(pool).toContain("purpose: 'outbound_pool'");
    expect(pool).toContain('purchaseTenantNumber');
  });

  it('blocks Free campaign start before a live pool can dial', () => {
    const router = readFileSync(join(srcRoot, 'modules/campaigns/campaign.router.ts'), 'utf8');
    const startIdx = router.indexOf("'/campaigns/:id/start'");
    const startSlice = router.slice(startIdx, startIdx + 900);
    expect(startSlice).toContain('getTenantDemoFlags');
    expect(startSlice).toContain("error: 'upgrade_required'");
  });

  it('dial job records pool health on Telnyx accept / fail', () => {
    const job = readFileSync(join(srcRoot, 'queue/jobs/outbound-dial.job.ts'), 'utf8');
    expect(job).toContain('selectPoolNumberForDial');
    expect(job).toContain('recordPoolDialOutcome');
    expect(job).toContain("outcome: 'success'");
    expect(job).toContain("outcome: 'failure'");
    expect(job).toContain('campaign.fromNumber');
  });
});

describe('inbound public number vs outbound managed lines (UI)', () => {
  it('phone settings copy names both identities and gates Free', () => {
    const page = readFileSync(
      join(dashboardRoot, 'app/(app)/settings/phone-numbers/page.tsx'),
      'utf8'
    );
    expect(page).toContain('Your public number');
    expect(page).toContain('Outbound lines (managed)');
    expect(page).toContain('never rotated for outbound campaigns');
    expect(page).toContain('do not get a live pool');
    expect(page).toContain('isDemoAccount');
    expect(page).toContain('handleReenable');
  });

  it('campaign create does not ask the client to pick a CLI', () => {
    const page = readFileSync(join(dashboardRoot, 'app/(app)/campaigns/new/page.tsx'), 'utf8');
    expect(page).toContain('Outbound lines (managed)');
    expect(page).toContain('You do not pick a caller ID');
    expect(page).not.toMatch(/fromNumber/);
  });

  it('does not enable DEMO_SKIP_COOLDOWN', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
