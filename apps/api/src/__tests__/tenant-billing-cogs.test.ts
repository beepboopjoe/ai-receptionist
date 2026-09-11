// ============================================================
// Tenant Billing must not show internal COGS / usage ledger.
// Founders keep the ledger on Platform Admin only.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

const billingPage = () => readFileSync(join(dashboardRoot, 'app/(app)/billing/page.tsx'), 'utf8');
const billingApi = () => readFileSync(join(dashboardRoot, 'lib/api.ts'), 'utf8');
const billingRouter = () => readFileSync(join(srcRoot, 'modules/billing/billing.router.ts'), 'utf8');
const platformPage = () => readFileSync(join(dashboardRoot, 'app/(app)/platform/page.tsx'), 'utf8');
const platformRouter = () => readFileSync(join(srcRoot, 'modules/platform/platform.router.ts'), 'utf8');
const demoHelpers = () => readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');

describe('tenant Billing hides internal COGS', () => {
  it('does not render the estimated COGS / internal ledger panel', () => {
    const page = billingPage();
    expect(page).not.toMatch(/estimated COGS/i);
    expect(page).not.toMatch(/Estimated COGS/);
    expect(page).not.toMatch(/Internal ledger/);
    expect(page).not.toMatch(/usage\.ledger/);
    expect(page).not.toMatch(/Est\.\s*(Telnyx|Grok|calling|AI voice)/);
    expect(page).not.toMatch(/est\. gross/i);
    expect(page).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
  });

  it('keeps Stripe plan, usage, and portal UI tenants need', () => {
    const page = billingPage();
    expect(page).toContain('billingApi.get()');
    expect(page).toContain('billingApi.getUsage()');
    expect(page).toContain('billingApi.checkout');
    expect(page).toContain('openPortal');
    expect(page).toContain('Compare Plans');
    expect(page).toContain('AI Minutes Used');
    expect(page).toContain('Manage billing');
    expect(page).toContain('href="/support"');
  });

  it('does not attach the COGS ledger to GET /billing/usage', () => {
    const router = billingRouter();
    expect(router).toContain("app.get('/billing/usage'");
    expect(router).toContain('getCurrentUsage');
    expect(router).not.toContain('getUsageLedgerSnapshot');
    expect(router).not.toMatch(/\bledger\b/);

    const api = billingApi();
    const getUsageSlice = api.slice(api.indexOf('getUsage:'), api.indexOf('getUsage:') + 400);
    expect(getUsageSlice).toContain("'/billing/usage'");
    expect(getUsageSlice).not.toContain('ledger');
    expect(api).not.toContain('export interface UsageLedgerSnapshot');
  });

  it('keeps the usage ledger on Platform Admin only', () => {
    expect(platformRouter()).toContain('usageLedger');
    expect(platformRouter()).toContain('getUsageSnapshotsForTenants');
    expect(platformPage()).toContain('usageLedger');
    expect(platformPage()).toContain('tenant.usageLedger.aiMinutes');
  });

  it('does not flip DEMO_SKIP_COOLDOWN', () => {
    expect(demoHelpers()).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
