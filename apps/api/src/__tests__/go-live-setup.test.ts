// ============================================================
// Mass-audience go-live path — source scans + invariant checks.
// Paste URL → knowledge, public number, staff-first overflow.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlan } from '@ai-receptionist/shared';
import {
  INBOUND_ROUTING_MODES,
  resolveInboundRoutingAction,
} from '../modules/telephony/inbound-routing.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

function dash(rel: string): string {
  return readFileSync(join(dashboardRoot, rel), 'utf8');
}

describe('staff_first reuses inbound routing', () => {
  it('adds staff_first to the shared mode list and rings the team only during hours', () => {
    expect(INBOUND_ROUTING_MODES).toContain('staff_first');
    expect(
      resolveInboundRoutingAction({
        mode: 'staff_first',
        isAfterHours: false,
        staffNumber: '+15551234567',
      }),
    ).toBe('overflow_try_staff');
    expect(
      resolveInboundRoutingAction({
        mode: 'staff_first',
        isAfterHours: true,
        staffNumber: '+15551234567',
      }),
    ).toBe('ai');
  });

  it('migration extends the check constraint without rewriting existing rows', () => {
    const sql = read('db/migrations/0045_staff_first_routing.sql');
    expect(sql).toContain("'staff_first'");
    expect(sql).toContain("'ai_always'");
    expect(sql).not.toMatch(/UPDATE\s+tenant_settings/i);
  });
});

describe('paste-URL knowledge path', () => {
  it('registers setup routes and writes the website-import block', () => {
    const main = read('main.ts');
    expect(main).toContain("from './modules/website-import/website-import.router.js'");
    expect(main).toContain('setupPlugin');

    const router = read('modules/website-import/website-import.router.ts');
    expect(router).toContain("'/setup/website'");
    expect(router).toContain("'/setup/facts'");

    const helpers = read('modules/website-import/website-import.helpers.ts');
    expect(helpers).toContain('website-import-v1');
    expect(helpers).toContain('BUSINESS_CONTEXT_MAX = 4000');

    const service = read('modules/website-import/website-import.service.ts');
    expect(service).toContain('mergeWebsiteImportBlock');
    expect(service).toContain('uploadDocument');
    expect(service).toContain('canSkip: true');
  });

  it('dashboard setup + knowledge surfaces exist with skip copy', () => {
    expect(existsSync(join(dashboardRoot, 'app/(app)/setup/page.tsx'))).toBe(true);
    const setup = dash('app/(app)/setup/page.tsx');
    expect(setup).toContain('Your public number');
    expect(setup).toContain('isDemoAccount');
    expect(setup).toContain('DemoUpgradeCard');

    const importCard = dash('components/setup/website-import-card.tsx');
    expect(importCard).toContain('Skip for now');
    expect(importCard).toContain('Type a few facts instead');
    expect(importCard).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);

    const kb = dash('app/(app)/settings/knowledge-base/page.tsx');
    expect(kb).toContain('WebsiteImportCard');
  });
});

describe('go-live gates stay intact', () => {
  it('does not flip DEMO_SKIP_COOLDOWN or invent a $29 plan', () => {
    const demo = read('modules/public-api/public-demo.helpers.ts');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
    expect(getPlan('growth')!.monthlyPrice).toBe(199);
    expect(getPlan('scale')!.monthlyPrice).toBe(399);
    expect(getPlan('business')!.monthlyPrice).toBe(599);
    expect(dash('app/(app)/setup/page.tsx')).not.toMatch(/\$29/);
    expect(dash('components/ui/upgrade-modal.tsx')).not.toMatch(/\$29/);
  });

  it('keeps free signup on the dashboard and paid provision gated', () => {
    const signup = dash('app/(auth)/signup/page.tsx');
    expect(signup).toMatch(/router\.replace\(\s*['"]\/dashboard['"]\s*\)/);

    const admin = read('modules/admin/router.ts');
    expect(admin).toContain("error: 'upgrade_required'");
    expect(admin).toContain("error: 'plan_has_no_included_number'");

    const auto = read('modules/phone-numbers/auto-provision.service.ts');
    expect(auto).toMatch(/if \(!planIncludesInboundDid\(tenant\?\.plan\)\)/);
  });

  it('labels staff-first in everyday words on the headline card', () => {
    const card = dash('components/settings/inbound-routing-card.tsx');
    expect(card).toContain('Your team first, then Telfin');
    expect(card).toContain('Telfin answers everything');
    expect(card).toContain('staff_first');
    expect(card).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
  });
});
