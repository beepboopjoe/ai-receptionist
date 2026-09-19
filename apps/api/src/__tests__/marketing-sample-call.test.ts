// ============================================================
// Homepage demos stay voice MP3s + live call-me.
// No #60 sample-call script, no $29 answering-service framing,
// no #56 AI-reveal copy on marketing surfaces.
// Live English opener is the pre-#56 representative line.
// Free stays the demo signup. Starter stays $20.
// No DEMO_SKIP_COOLDOWN. No Stripe key edits.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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

const REVEAL_COPY = /I'm actually AI|I&apos;m actually AI|en realidad soy IA|umm I'm actually AI/i;
const VS_ANSWERING = /\$29 answering service|Versus a \$29/i;

describe('homepage voice samples + live call-me', () => {
  it('puts the multi-voice MP3 grid back on the homepage with call-me', () => {
    const home = dash('app/page.tsx');
    const samples = dash('components/ui/homepage-voice-samples.tsx');
    expect(home).toContain('HomepageVoiceSamples');
    expect(home).toContain('CallMeWidget');
    expect(home).toContain('id="call-me"');
    expect(home).not.toContain('HomepageSampleCall');
    expect(home).not.toContain('PricingVsAnswering');
    expect(home).not.toContain('demo-opener');
    expect(samples).toContain('SampleLanguageChips');
    expect(samples).toContain('voiceSampleSrc');
    expect(samples).toMatch(/\.mp3/);
    expect(existsSync(join(dashboardRoot, 'components/ui/homepage-sample-call.tsx'))).toBe(false);
    expect(existsSync(join(dashboardRoot, 'lib/demo-opener.ts'))).toBe(false);
  });

  it('does not show the #56 AI-reveal script on marketing surfaces', () => {
    expect(dash('app/page.tsx')).not.toMatch(REVEAL_COPY);
    expect(dash('app/pricing/page.tsx')).not.toMatch(REVEAL_COPY);
    expect(dash('app/demo/page.tsx')).not.toMatch(REVEAL_COPY);
    expect(dash('components/ui/call-me-widget.tsx')).not.toMatch(REVEAL_COPY);
    expect(dash('components/ui/voice-language-demo.tsx')).not.toMatch(REVEAL_COPY);
    expect(dash('app/how-it-works/page.tsx')).not.toMatch(REVEAL_COPY);
    expect(dash('components/ui/marketing-header.tsx')).toContain("href: '/how-it-works'");
    expect(DEMO_OPENING_EN).toBe('Hey, this is a representative of Telfin.');
    expect(DEMO_OPENING_ES).toBe('Hola, soy un representante de Telfin.');
    expect(DEMO_OPENING_EN).not.toMatch(/actually AI/i);
    expect(DEMO_OPENING_ES).not.toMatch(/en realidad soy IA/i);
  });
});

describe('no $29 answering-service framing', () => {
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

  it('removes the versus-$29 section and FAQ from homepage and pricing', () => {
    expect(existsSync(join(dashboardRoot, 'components/ui/pricing-vs-answering.tsx'))).toBe(false);
    expect(dash('app/page.tsx')).not.toMatch(VS_ANSWERING);
    expect(dash('app/pricing/page.tsx')).not.toMatch(VS_ANSWERING);
    expect(dash('app/pricing/page.tsx')).toContain('Try Free');
    expect(dash('app/pricing/page.tsx')).toContain('Starter ($20/mo)');
    expect(dash('app/pricing/page.tsx')).not.toContain('Listen to sample calls');
    expect(dash('app/pricing/page.tsx')).not.toContain('PlanComparisonTable');
    expect(dash('app/pricing/page.tsx')).not.toContain('RoiCalculator');
    expect(dash('app/pricing/page.tsx')).not.toContain('RoiSection');
    expect(dash('app/pricing/page.tsx')).not.toContain('Every missed call is a missed appointment');
    expect(dash('app/pricing/page.tsx')).not.toContain('Become a partner');
    expect(dash('app/how-it-works/page.tsx')).toContain('Five steps');
    expect(dash('app/how-it-works/page.tsx')).toContain("n: '5'");
    expect(dash('app/how-it-works/page.tsx')).not.toContain('LANES');
    expect(dash('app/how-it-works/page.tsx')).not.toMatch(REVEAL_COPY);
    expect(src('modules/public-api/site-chat.prompt.ts')).not.toMatch(VS_ANSWERING);
    expect(src('modules/public-api/site-chat.prompt.ts')).not.toMatch(REVEAL_COPY);
  });

  it('keeps Free as the demo signup and does not skip the call-me cooldown', () => {
    const home = dash('app/page.tsx');
    expect(home).toContain('/signup?plan=trial');
    expect(home).toMatch(/Try Free/);
    expect(home).toMatch(/Explore the dashboard/);
    expect(home).toMatch(/\['trial', 'starter', 'growth', 'scale', 'business'\]/);

    const demoHelpers = src('modules/public-api/public-demo.helpers.ts');
    expect(demoHelpers).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
