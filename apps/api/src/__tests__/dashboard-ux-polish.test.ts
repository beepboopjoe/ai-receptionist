// ============================================================
// Dashboard UX polish — source scans.
// Workflows stay capable but less dense; Try-your-AI is gone;
// Help lands on the existing ticket flow; free-demo gates stand.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlan } from '@ai-receptionist/shared';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

describe('workflows browse (less dense)', () => {
  it('uses a collapsible list with inbound open and outreach/admin collapsed', () => {
    const page = readFileSync(join(dashboardRoot, 'app/(app)/workflows/page.tsx'), 'utf8');
    expect(page).toContain('DEFAULT_OPEN');
    expect(page).toContain('reactive: true');
    expect(page).toContain('proactive: false');
    expect(page).toContain('admin: false');
    expect(page).toContain('buildWorkflowCatalog');
    expect(page).toContain('setupHref');
    expect(page).not.toMatch(/lg:grid-cols-3/);
  });
});

describe('test call replaces Try your AI', () => {
  it('sidebar has Test call and Help, not Try your AI', () => {
    const sidebar = readFileSync(join(dashboardRoot, 'components/layout/sidebar.tsx'), 'utf8');
    expect(sidebar).toContain("label: 'Test call'");
    expect(sidebar).toContain("href: '/test-call'");
    expect(sidebar).toContain("href: '/support'");
    expect(sidebar).toContain("label: 'Help'");
    expect(sidebar).toContain("href: '/platform/support'");
    expect(sidebar).not.toMatch(/Try your AI/);
    expect(sidebar).not.toContain("href: '/voice-demo'");
  });

  it('test-call page reuses TestCallCard and DemoUpgradeCard', () => {
    const page = readFileSync(join(dashboardRoot, 'app/(app)/test-call/page.tsx'), 'utf8');
    expect(page).toContain('TestCallCard');
    expect(page).toContain('DemoUpgradeCard');
    expect(page).toContain('isDemoAccount');
    expect(page).not.toContain('EmbeddedVoiceDemo');
  });

  it('legacy /voice-demo redirects to /test-call', () => {
    const page = readFileSync(join(dashboardRoot, 'app/(app)/voice-demo/page.tsx'), 'utf8');
    expect(page).toContain("redirect('/test-call')");
    expect(page).not.toContain('EmbeddedVoiceDemo');
  });
});

describe('help → ticket → admin', () => {
  it('tenant Help submits tickets and admin has a dedicated queue', () => {
    const support = readFileSync(join(dashboardRoot, 'app/(app)/support/page.tsx'), 'utf8');
    expect(support).toContain('supportApi.submit');
    expect(support).toContain('Submit a ticket');

    const admin = readFileSync(join(dashboardRoot, 'app/(app)/platform/support/page.tsx'), 'utf8');
    expect(admin).toContain('SupportTicketsSection');

    const footer = readFileSync(join(dashboardRoot, 'components/ui/marketing-footer.tsx'), 'utf8');
    expect(footer).toContain("['Support',        '/support']");

    const billing = readFileSync(join(dashboardRoot, 'app/(app)/billing/page.tsx'), 'utf8');
    expect(billing).toContain('href="/support"');

    const palette = readFileSync(join(dashboardRoot, 'components/ui/command-palette.tsx'), 'utf8');
    expect(palette).toContain("href: '/support'");
  });
});

describe('standing constraints', () => {
  it('does not flip DEMO_SKIP_COOLDOWN and keeps catalog prices', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
    expect(getPlan('growth')!.monthlyPrice).toBe(199);
    expect(getPlan('scale')!.monthlyPrice).toBe(399);
    expect(getPlan('business')!.monthlyPrice).toBe(599);
  });
});
