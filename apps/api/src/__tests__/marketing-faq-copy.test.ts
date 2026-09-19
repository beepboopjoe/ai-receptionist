// ============================================================
// Marketing FAQ + public site copy must match current product:
// Free = dashboard demo (#43), no vendor names (#45),
// Starter $20 / Growth $199 / Scale $399 / Business $599, no onboarding
// plan-picker headline (#42). Legal subprocessors stay named.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dashboardRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../../../dashboard/src');

const MARKETING_FILES = [
  'app/page.tsx',
  'app/pricing/page.tsx',
  'app/how-it-works/page.tsx',
  'app/inbound/page.tsx',
  'app/outbound/page.tsx',
  'app/demo/page.tsx',
  'app/resellers/page.tsx',
  'app/knowledge-base/page.tsx',
  'app/(auth)/signup/page.tsx',
  'lib/vertical-landing-content.ts',
  'components/ui/embedded-voice-demo.tsx',
  'components/ui/outbound-roi.tsx',
  'components/ui/roi-section.tsx',
  'components/ui/plan-comparison-table.tsx',
  'components/ui/pricing-cards.tsx',
  'components/ui/upgrade-modal.tsx',
  'components/dashboard/demo-upgrade-card.tsx',
  'components/settings/share-booking-page-card.tsx',
  'components/ui/homepage-voice-samples.tsx',
  'components/ui/call-me-widget.tsx',
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function extractCopy(src: string): string {
  const stripped = stripComments(src);
  const quoted = [...stripped.matchAll(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g)].map((m) => m[0]);
  const jsxText = [...stripped.matchAll(/>([^<>{]+)</g)].map((m) => m[1]);
  return [...quoted, ...jsxText].join('\n');
}

function readMarketing(rel: string): string {
  return readFileSync(join(dashboardRoot, rel), 'utf8');
}

describe('marketing FAQ and public CTAs match current product', () => {
  it('does not advertise a timed free trial or 10-minute go-live', () => {
    const hits: string[] = [];
    for (const rel of MARKETING_FILES) {
      const copy = extractCopy(readMarketing(rel));
      if (/\bfree trial\b/i.test(copy)) hits.push(`${rel}: free trial`);
      if (/Try Free — 10 min/i.test(copy)) hits.push(`${rel}: Try Free — 10 min`);
      if (/10 inbound minutes/i.test(copy)) hits.push(`${rel}: 10 inbound minutes`);
      if (/10 free inbound/i.test(copy)) hits.push(`${rel}: 10 free inbound`);
      if (/Start free trial/i.test(copy)) hits.push(`${rel}: Start free trial`);
      if (/Start in 10 minutes/i.test(copy)) hits.push(`${rel}: Start in 10 minutes`);
      if (/Setup (takes )?under 10 minutes/i.test(copy)) hits.push(`${rel}: setup under 10 minutes`);
    }
    expect(hits).toEqual([]);
  });

  it('does not list Starter $79 / Growth $179 or the removed plan picker', () => {
    const hits: string[] = [];
    for (const rel of MARKETING_FILES) {
      const copy = extractCopy(readMarketing(rel));
      if (/\$79/.test(copy)) hits.push(`${rel}: $79`);
      if (/\$179/.test(copy)) hits.push(`${rel}: $179`);
      if (/What do you want your AI to do/.test(copy)) hits.push(`${rel}: plan picker headline`);
    }
    expect(hits).toEqual([]);
  });

  it('does not name Grok, Telnyx, or xAI in marketing copy', () => {
    const hits: string[] = [];
    for (const rel of MARKETING_FILES) {
      const copy = extractCopy(readMarketing(rel));
      if (/\b(Grok|Telnyx|xAI)\b/.test(copy)) hits.push(`${rel}: vendor name`);
    }
    expect(hits).toEqual([]);
  });

  it('keeps current paid prices and Free = explore the dashboard', () => {
    const pricing = extractCopy(readMarketing('app/pricing/page.tsx'));
    expect(pricing).toMatch(/Starter \(\$20\/mo\)/);
    expect(pricing).toMatch(/Growth \(\$199\/mo\)|Growth is \$199/);
    expect(pricing).toContain('$399');
    expect(pricing).toContain('$599');
    expect(pricing).toMatch(/explore the dashboard/i);
    expect(pricing).toMatch(/ready to go live/i);

    const home = extractCopy(readMarketing('app/page.tsx'));
    expect(home).toMatch(/Explore the dashboard free/);
    expect(home).toMatch(/Upgrade to go live/);
    expect(home).toMatch(/Starter/);
    expect(home).toMatch(/Try Free/);
    expect(home).not.toMatch(/\$29 answering service/);
    expect(readMarketing('app/page.tsx')).not.toMatch(/I'm actually AI|I&apos;m actually AI|en realidad soy IA/);
    expect(home).toMatch(/Can I try it free\?/);
    expect(home).toMatch(/Explore free/);
    expect(home).toMatch(/Create a Free account/);
    // Homepage pricing preview must include Free — Starter is first paid, not a replacement.
    expect(readMarketing('app/page.tsx')).toMatch(/\['trial', 'starter', 'growth', 'scale', 'business'\]/);

    const signup = readFileSync(join(dashboardRoot, 'app/(auth)/signup/page.tsx'), 'utf8');
    expect(signup).toContain("useState<SignupPlanKey>('trial')");
    expect(signup).toContain("plan === 'trial'");
    expect(signup).toContain('Explore free →');
    expect(signup).toMatch(/Explore the dashboard/);
    expect(signup).not.toMatch(/minutes:\s*'10'/);

    const inbound = extractCopy(readMarketing('app/inbound/page.tsx'));
    expect(inbound).toMatch(/Starter \(\$20\/mo\)/);

    const outbound = extractCopy(readMarketing('app/outbound/page.tsx'));
    expect(outbound).toMatch(/Starter \(\$20\/mo\)/);

    const roi = extractCopy(readMarketing('components/ui/roi-section.tsx'));
    expect(roi).toMatch(/We start at \$20/);

    const chatPrompt = readFileSync(
      join(fileURLToPath(new URL('.', import.meta.url)), '../modules/public-api/site-chat.prompt.ts'),
      'utf8',
    );
    expect(chatPrompt).toContain('Starter $20');
    expect(chatPrompt).toContain('Growth $199');
    expect(chatPrompt).toContain('Scale $399');
    expect(chatPrompt).toContain('Business $599');
    expect(chatPrompt).toMatch(/explore the dashboard/i);
    expect(chatPrompt).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
  });
});
