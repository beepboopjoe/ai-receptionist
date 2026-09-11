// ============================================================
// Free / demo account gates — source scans + helper unit tests.
// Unpaid trial is a dashboard demo; paid + promo-trial still go live.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlan, isPaidPlanKey, isUnpaidDemoAccount } from '@ai-receptionist/shared';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

describe('isUnpaidDemoAccount', () => {
  it('treats trial and leftover starter as demo, paid plans as live-capable', () => {
    expect(isUnpaidDemoAccount('trial', false)).toBe(true);
    expect(isUnpaidDemoAccount('starter', false)).toBe(true);
    expect(isUnpaidDemoAccount(null, false)).toBe(true);
    expect(isUnpaidDemoAccount('growth', false)).toBe(false);
    expect(isUnpaidDemoAccount('scale', false)).toBe(false);
    expect(isUnpaidDemoAccount('business', false)).toBe(false);
    expect(isUnpaidDemoAccount('enterprise', false)).toBe(false);
  });

  it('does not treat platform-granted promo trials as demo', () => {
    expect(isUnpaidDemoAccount('trial', true)).toBe(false);
    expect(isPaidPlanKey('trial')).toBe(false);
    expect(isPaidPlanKey('growth')).toBe(true);
  });
});

describe('catalog prices for upgrade CTAs', () => {
  it('keeps Growth / Scale / Business at $199 / $399 / $599 and drops Starter', () => {
    expect(getPlan('growth')!.monthlyPrice).toBe(199);
    expect(getPlan('scale')!.monthlyPrice).toBe(399);
    expect(getPlan('business')!.monthlyPrice).toBe(599);
    expect(getPlan('starter')).toBeUndefined();
    expect(getPlan('trial')!.name).toBe('Free');
  });
});

describe('upgrade modal + demo UI (source)', () => {
  it('UpgradeModal uses catalog prices and has no Starter / $79 / $179', () => {
    const modal = readFileSync(join(dashboardRoot, 'components/ui/upgrade-modal.tsx'), 'utf8');
    expect(modal).toContain("getPlan('growth')");
    expect(modal).toContain("getPlan('scale')");
    expect(modal).toContain("getPlan('business')");
    expect(modal).toContain('go_live:');
    expect(modal).not.toMatch(/\$79/);
    expect(modal).not.toMatch(/\$179/);
    expect(modal).not.toMatch(/Starter/);
  });

  it('does not pressure Free accounts through finish-setup / go-live checklist', () => {
    const banner = readFileSync(join(dashboardRoot, 'components/layout/onboarding-banner.tsx'), 'utf8');
    expect(banner).toContain('isDemoAccount');
    expect(banner).toContain("href=\"/billing\"");
    expect(banner).toMatch(/exploring the dashboard/);

    const checklist = readFileSync(join(dashboardRoot, 'components/dashboard/go-live-checklist.tsx'), 'utf8');
    expect(checklist).toContain('DemoUpgradeCard');
    expect(checklist).toContain('isDemoAccount');

    const activate = readFileSync(join(dashboardRoot, 'app/onboarding/step-5-activate/page.tsx'), 'utf8');
    expect(activate).toContain('isDemoAccount');
    expect(activate).toContain('DemoUpgradeCard');
  });

  it('keeps free signup on the dashboard (PR #42) and does not flip DEMO_SKIP_COOLDOWN', () => {
    const signup = readFileSync(join(dashboardRoot, 'app/(auth)/signup/page.tsx'), 'utf8');
    expect(signup).toMatch(/router\.replace\(\s*['"]\/dashboard['"]\s*\)/);
    expect(signup).not.toMatch(/['"`]\/onboarding\/step-0-industry['"`]/);

    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});

describe('paid go-live gates (source)', () => {
  it('blocks unpaid demo activate and phone purchase with 402, still provisions on paid activate', () => {
    const admin = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    expect(admin).toContain('getTenantDemoFlags');
    expect(admin).toContain("error: 'upgrade_required'");
    expect(admin).toMatch(/ensureInboundDid\(tenantId, \{\s*forceRetry:\s*true\s*\}\)/);

    const phones = readFileSync(join(srcRoot, 'modules/phone-numbers/phone.router.ts'), 'utf8');
    expect(phones).toContain('getTenantDemoFlags');
    expect(phones).toContain("error: 'upgrade_required'");
    expect(phones).toContain('purchaseTenantNumber');
    expect(phones).toContain('ensureInboundDid');
  });
});
