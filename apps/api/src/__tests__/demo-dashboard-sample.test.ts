// ============================================================
// Free / demo dashboard sample data — unit + source scans.
// Prefills Home / Calls / Contacts / Appointments / Messages
// for unpaid demo accounts. Does not flip DEMO_SKIP_COOLDOWN
// or change Stripe / catalog prices.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlan, isUnpaidDemoAccount } from '@ai-receptionist/shared';
import { getVertical } from '../../../dashboard/src/lib/verticals.ts';
import {
  buildDemoSample,
  fillDemoList,
  isDemoSampleId,
  DEMO_ID_PREFIX,
  DEMO_READ_ONLY_MESSAGE,
} from '../../../dashboard/src/lib/demo-sample-data.ts';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

function dash(rel: string): string {
  return readFileSync(join(dashboardRoot, rel), 'utf8');
}

describe('fillDemoList', () => {
  const sample = [{ id: 'demo-1' }];

  it('overlays sample rows only for unloaded-empty demo accounts', () => {
    expect(
      fillDemoList({
        isDemoAccount: true,
        planLoading: false,
        listLoading: false,
        realItems: [],
        sampleItems: sample,
      }),
    ).toEqual({ items: sample, total: 1, isSample: true });
  });

  it('keeps live rows when the tenant already has data', () => {
    const real = [{ id: 'live-1' }];
    expect(
      fillDemoList({
        isDemoAccount: true,
        planLoading: false,
        realItems: real,
        realTotal: 4,
        sampleItems: sample,
      }),
    ).toEqual({ items: real, total: 4, isSample: false });
  });

  it('does not overlay while plan or list is loading, or for paid tenants', () => {
    expect(
      fillDemoList({
        isDemoAccount: true,
        planLoading: true,
        realItems: [],
        sampleItems: sample,
      }).isSample,
    ).toBe(false);
    expect(
      fillDemoList({
        isDemoAccount: true,
        planLoading: false,
        listLoading: true,
        realItems: [],
        sampleItems: sample,
      }).isSample,
    ).toBe(false);
    expect(
      fillDemoList({
        isDemoAccount: false,
        planLoading: false,
        realItems: [],
        sampleItems: sample,
      }).isSample,
    ).toBe(false);
  });
});

describe('buildDemoSample', () => {
  const dental = buildDemoSample(getVertical('dental'));
  const legal = buildDemoSample(getVertical('legal'));

  it('prefills the core office lists with demo-* ids', () => {
    expect(dental.calls.length).toBeGreaterThanOrEqual(6);
    expect(dental.contacts.length).toBeGreaterThanOrEqual(6);
    expect(dental.appointments.length).toBeGreaterThanOrEqual(4);
    expect(dental.conversations.length).toBeGreaterThanOrEqual(2);
    expect(dental.escalations.some((e) => e.status === 'open')).toBe(true);
    expect(dental.campaigns.some((c) => c.status === 'running')).toBe(true);
    expect(dental.calls.every((c) => isDemoSampleId(c.id))).toBe(true);
    expect(dental.contacts.every((c) => c.id.startsWith(DEMO_ID_PREFIX))).toBe(true);
  });

  it('adapts appointment copy to the tenant vertical', () => {
    expect(dental.appointments[0]!.appointmentType).toMatch(/exam|Cleaning|Crown|Emergency/i);
    expect(legal.appointments[0]!.appointmentType).toMatch(/Intake|Case|Document|Follow-up/i);
    expect(dental.calls[0]!.summary).toMatch(/patient/i);
    expect(legal.calls[0]!.summary).toMatch(/client/i);
  });

  it('stays view-only branded and does not name vendors', () => {
    const blob = JSON.stringify(dental);
    expect(DEMO_READ_ONLY_MESSAGE).toMatch(/Starter \(\$20\/mo\)/);
    expect(blob).not.toMatch(/Grok|Telnyx|xAI/i);
    expect(blob).not.toMatch(/I'm actually AI/i);
  });
});

describe('demo dashboard wiring (source)', () => {
  const pages = [
    'app/(app)/dashboard/page.tsx',
    'app/(app)/calls/page.tsx',
    'app/(app)/contacts/page.tsx',
    'app/(app)/appointments/page.tsx',
    'app/(app)/messages/page.tsx',
    'app/(app)/missed-calls/page.tsx',
    'app/(app)/escalations/page.tsx',
    'app/(app)/reminders/page.tsx',
    'app/(app)/campaigns/page.tsx',
  ];

  it('list pages overlay useDemoSample and label sample data', () => {
    for (const rel of pages) {
      const src = dash(rel);
      expect(src, rel).toContain('useDemoSample');
      expect(src, rel).toContain('SampleDataBanner');
    }
  });

  it('detail pages resolve demo-* ids without hitting live mutations', () => {
    expect(dash('app/(app)/calls/[id]/page.tsx')).toContain('isDemoSampleId');
    expect(dash('app/(app)/contacts/[id]/page.tsx')).toContain('useDemoReadOnlyGuard');
    expect(dash('app/(app)/messages/[phone]/page.tsx')).toContain('showingSample');
    expect(dash('app/(app)/campaigns/[id]/page.tsx')).toContain('demoCampaign');
  });

  it('lets Free accounts open Messages to browse sample threads', () => {
    const sidebar = dash('components/layout/sidebar.tsx');
    expect(sidebar).toContain('isDemoAccount');
    expect(sidebar).toContain('!isDemoAccount');
    expect(sidebar).toMatch(/Sample/);
  });

  it('public /demo sends signed-in users into the real dashboard', () => {
    const demo = dash('app/demo/page.tsx');
    expect(demo).toContain('isAuthenticated');
    expect(demo).toContain("router.replace('/dashboard')");
    expect(demo).toContain('/signup?plan=trial');
    expect(demo).toContain('Explore the dashboard');
    expect(demo).not.toMatch(/Grok|Telnyx|xAI/);
  });

  it('keeps Free as demo, Starter at $20, and does not skip call-me cooldown', () => {
    expect(isUnpaidDemoAccount('trial', false)).toBe(true);
    expect(getPlan('starter')!.monthlyPrice).toBe(20);
    expect(getPlan('trial')!.name).toBe('Free');
    const helpers = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(helpers).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
