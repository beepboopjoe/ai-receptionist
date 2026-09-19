// ============================================================
// Starter $20 — inbound go-live tier. Catalog, gates, checkout
// path, and UI source scans. Does not flip DEMO_SKIP_COOLDOWN.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getPlan,
  isPaidPlanKey,
  isUnpaidDemoAccount,
  planAllowsKb,
  planAllowsOutbound,
  planAllowsSms,
  resolvePlanLimits,
} from '@ai-receptionist/shared';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

describe('Starter catalog', () => {
  it('is $20/mo with 50 minutes, 1 DID, full product, PAYG overage', () => {
    const starter = getPlan('starter')!;
    expect(starter.name).toBe('Starter');
    expect(starter.monthlyPrice).toBe(20);
    expect(starter.annualMonthlyPrice).toBe(17);
    expect(starter.monthlyMinutes).toBe(50);
    expect(starter.overagePerMin).toBe(0.39);
    expect(starter.includedPhoneNumbers).toBe(1);
    expect(starter.outbound).toBe(true);
    expect(starter.concurrentOutbound).toBe(3);
    expect(resolvePlanLimits(starter, {})).toEqual({ minutes: 50, overagePerMin: 0.39 });
  });

  it('does not change Growth / Scale / Business names or prices', () => {
    expect(getPlan('growth')!.name).toBe('Growth');
    expect(getPlan('growth')!.monthlyPrice).toBe(199);
    expect(getPlan('scale')!.name).toBe('Scale');
    expect(getPlan('scale')!.monthlyPrice).toBe(399);
    expect(getPlan('business')!.name).toBe('Business');
    expect(getPlan('business')!.monthlyPrice).toBe(599);
    expect(getPlan('trial')!.name).toBe('Free');
  });

  it('is paid go-live: SMS + outbound yes, KB still Business+', () => {
    expect(isPaidPlanKey('starter')).toBe(true);
    expect(isUnpaidDemoAccount('starter', false)).toBe(false);
    expect(planAllowsSms('starter')).toBe(true);
    expect(planAllowsOutbound('starter')).toBe(true);
    expect(planAllowsKb('starter')).toBe(false);
    expect(planAllowsOutbound('growth')).toBe(true);
    expect(planAllowsSms('trial')).toBe(false);
  });
});

describe('Starter checkout + env wiring (source)', () => {
  it('maps Stripe price env vars and rejects unpaid checkout', () => {
    const config = readFileSync(join(srcRoot, 'config.ts'), 'utf8');
    expect(config).toContain('STRIPE_PRICE_STARTER_MONTHLY');
    expect(config).toContain('STRIPE_PRICE_STARTER_ANNUAL');

    const billing = readFileSync(join(srcRoot, 'modules/billing/billing.service.ts'), 'utf8');
    expect(billing).toContain("STRIPE_PRICE_STARTER_MONTHLY");
    expect(billing).toContain("'starter'");
    expect(billing).toContain('not available for self-serve checkout');

    const setup = readFileSync(join(srcRoot, '../../..', 'scripts/setup-stripe-prices.ts'), 'utf8');
    expect(setup).toContain("key: 'starter'");
    expect(setup).toContain('monthly: 20_00');
  });

  it('gates campaigns and Ask Telfin live dials on outbound, SMS on paid', () => {
    const campaigns = readFileSync(join(srcRoot, 'modules/campaigns/campaign.router.ts'), 'utf8');
    expect(campaigns).toContain('planAllowsOutbound');
    expect(campaigns).toContain('OUTBOUND_UPGRADE_MESSAGE');

    const admin = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    const aiTaskIdx = admin.indexOf("'/calls/ai-task'");
    const aiTaskSlice = admin.slice(aiTaskIdx, aiTaskIdx + 1600);
    expect(aiTaskSlice).toContain('planAllowsOutbound');
    expect(aiTaskSlice).toContain('OUTBOUND_UPGRADE_MESSAGE');

    const sms = readFileSync(join(srcRoot, 'modules/sms/send-tenant-sms.ts'), 'utf8');
    expect(sms).toContain("starter");
    expect(sms).toContain('planAllowsSms');
  });
});

describe('Starter UI (source)', () => {
  it('does not feature-gate Starter below Growth for outbound / SMS / CRM', () => {
    const flags = readFileSync(join(dashboardRoot, 'lib/featureFlags.tsx'), 'utf8');
    expect(flags).toMatch(/outbound_campaigns:\s*'starter'/);
    expect(flags).toMatch(/two_way_sms:\s*'starter'/);
    expect(flags).toMatch(/webhooks:\s*'starter'/);
    expect(flags).toMatch(/crm_integrations:\s*'starter'/);

    const compare = readFileSync(join(dashboardRoot, 'components/ui/plan-comparison-table.tsx'), 'utf8');
    expect(compare).toContain("{ label: 'Outbound calling campaigns'");
    expect(compare).toMatch(/Outbound calling campaigns.*\[false, true, true, true, true, true\]/);
  });

  it('shows Starter on pricing, billing compare, signup, and UpgradeModal', () => {
    const pricing = readFileSync(join(dashboardRoot, 'app/pricing/page.tsx'), 'utf8');
    expect(pricing).toContain('Starter ($20/mo)');

    const compare = readFileSync(join(dashboardRoot, 'components/ui/plan-comparison-table.tsx'), 'utf8');
    expect(compare).toContain("key: 'starter'");
    expect(compare).toContain("'$20/mo'");

    const billing = readFileSync(join(dashboardRoot, 'app/(app)/billing/page.tsx'), 'utf8');
    expect(billing).toContain("key: 'starter'");

    const signup = readFileSync(join(dashboardRoot, 'app/(auth)/signup/page.tsx'), 'utf8');
    expect(signup).toContain("key: 'starter'");
    expect(signup).toContain("'$20/mo'");
    expect(signup).toContain("useState<SignupPlanKey>('trial')");
    expect(signup).toContain('Starter $20 is the first paid tier');

    const modal = readFileSync(join(dashboardRoot, 'components/ui/upgrade-modal.tsx'), 'utf8');
    expect(modal).toContain("getPlan('starter')");
    expect(modal).toMatch(/public_booking:[\s\S]*targetPlan: starter\.name/);

    const upgradeCard = readFileSync(join(dashboardRoot, 'components/dashboard/demo-upgrade-card.tsx'), 'utf8');
    expect(upgradeCard).toContain("getPlan('starter')");

    const booking = readFileSync(join(dashboardRoot, 'components/settings/share-booking-page-card.tsx'), 'utf8');
    expect(booking).toContain('Starter $20 / Growth $199 / Scale $399 / Business $599');

    const campaigns = readFileSync(join(dashboardRoot, 'app/(app)/campaigns/page.tsx'), 'utf8');
    expect(campaigns).toContain('Starter ($20/mo)');
    expect(campaigns).not.toMatch(/\$299/);
  });

  it('does not flip DEMO_SKIP_COOLDOWN', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
