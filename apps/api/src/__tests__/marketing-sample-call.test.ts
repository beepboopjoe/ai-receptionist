// ============================================================
// Homepage sample-call + pricing story polish.
// Live opener must match #56. $29 is a competitor answering
// service, not a Telfin plan. Free stays the demo signup.
// No fake MP3s. No DEMO_SKIP_COOLDOWN. No Stripe key edits.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_OPENING_EN, DEMO_OPENING_ES } from '../modules/voice-agent/call-me-demo.prompt.js';
import { PLANS, getPlan } from '@ai-receptionist/shared';

const apiRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(apiRoot, '../../dashboard/src');
const repoRoot = join(apiRoot, '../../..');

function dash(rel: string): string {
  return readFileSync(join(dashboardRoot, rel), 'utf8');
}

function src(rel: string): string {
  return readFileSync(join(apiRoot, rel), 'utf8');
}

describe('homepage sample call matches the live AI-reveal opener', () => {
  it('dashboard opener copy stays locked to the spoken demo lines', () => {
    const opener = dash('lib/demo-opener.ts');
    expect(opener).toContain(DEMO_OPENING_EN);
    expect(opener).toContain(DEMO_OPENING_ES);
    expect(DEMO_OPENING_EN).toMatch(/I'm actually AI/);
    expect(DEMO_OPENING_ES).toMatch(/en realidad soy IA/);
    expect(opener).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
  });

  it('homepage leads with call-me + script, not leftover voice MP3s', () => {
    const home = dash('app/page.tsx');
    const sample = dash('components/ui/homepage-sample-call.tsx');
    expect(home).toContain('HomepageSampleCall');
    expect(home).toContain('CallMeWidget');
    expect(home).toContain('id="call-me"');
    expect(home).not.toContain('HomepageVoiceSamples');
    expect(sample).toContain('Script · not audio');
    expect(sample).toContain('#call-me');
    expect(sample).not.toMatch(/\.mp3/);
    expect(sample).not.toContain('SampleLanguageChips');
    expect(dash('components/ui/call-me-widget.tsx')).toMatch(/actually AI/);
  });
});

describe('pricing story vs a $29 answering service', () => {
  it('does not invent a $29 Telfin plan or edit Stripe price IDs', () => {
    expect(getPlan('starter')!.monthlyPrice).toBe(20);
    expect(getPlan('growth')!.monthlyPrice).toBe(199);
    expect(getPlan('trial')!.monthlyPrice).toBe(0);
    expect(PLANS.every((p) => p.monthlyPrice !== 29)).toBe(true);

    const catalog = readFileSync(
      join(repoRoot, 'packages/shared/src/types/billing.types.ts'),
      'utf8',
    );
    expect(catalog).not.toMatch(/monthlyPrice:\s*29\b/);

    const config = src('config.ts');
    expect(config).toContain("STRIPE_PRICE_STARTER_MONTHLY:  z.string().default('')");
    expect(config).not.toMatch(/STRIPE_PRICE_STARTER_MONTHLY:.*price_/);
  });

  it('marketing copy contrasts $29 answering services with Starter $20 / Growth $199+', () => {
    const vs = dash('components/ui/pricing-vs-answering.tsx');
    expect(vs).toMatch(/\$29 answering service/);
    expect(vs).toContain('Starter $20');
    expect(vs).toContain('Growth $199+');
    expect(vs).toContain('Ask Telfin');
    expect(vs).toContain('Booking page');
    expect(vs).toContain('Outbound');
    expect(vs).toContain('SMS');
    expect(vs).toContain('/signup?plan=trial');
    expect(vs).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);

    const pricing = dash('app/pricing/page.tsx');
    expect(pricing).toContain('Why not just use a $29 answering service?');
    expect(pricing).toContain('Hear it on your phone');
    expect(pricing).not.toContain('Listen to sample calls');
    expect(pricing).toContain('Try Free');

    const compare = dash('components/ui/plan-comparison-table.tsx');
    expect(compare).toContain('Ask Telfin (one call or text from chat)');
    expect(compare).toContain('Public booking page');
  });

  it('keeps Free as the demo signup and does not skip the call-me cooldown', () => {
    const home = dash('app/page.tsx');
    expect(home).toContain('/signup?plan=trial');
    expect(home).toMatch(/Try Free/);
    expect(home).toMatch(/Explore the dashboard/);

    const demoHelpers = src('modules/public-api/public-demo.helpers.ts');
    expect(demoHelpers).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
