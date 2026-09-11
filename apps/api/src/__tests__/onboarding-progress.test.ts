// ============================================================
// Onboarding cursor + inbound provision plan-gate scans.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  nextOnboardingStep,
  onboardingStepsCompleted,
  onboardingUiStep,
  ONBOARDING_UI_STEPS,
} from '../modules/admin/onboarding-progress.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('nextOnboardingStep', () => {
  it('advances past the completed step instead of rewriting the same cursor', () => {
    expect(nextOnboardingStep(0, 0)).toBe(1);
    expect(nextOnboardingStep(1, 1)).toBe(2);
    expect(nextOnboardingStep(1, 1)).not.toBe(1);
  });

  it('never moves the cursor backwards', () => {
    expect(nextOnboardingStep(4, 1)).toBe(4);
    expect(nextOnboardingStep(5, 4)).toBe(5);
  });

  it('caps at the last tracked step', () => {
    expect(nextOnboardingStep(5, 5)).toBe(5);
  });
});

describe('onboardingUiStep', () => {
  it('maps industry (cursor 0) to UI step 1 and phone-complete (cursor 2) to calendar', () => {
    expect(onboardingUiStep(0, false)).toBe(1);
    expect(onboardingUiStep(1, false)).toBe(2);
    expect(onboardingUiStep(2, false)).toBe(3);
    expect(onboardingUiStep(5, false)).toBe(6);
    expect(onboardingUiStep(5, true)).toBe(ONBOARDING_UI_STEPS);
  });
});

describe('onboardingStepsCompleted', () => {
  it('does not mark phone complete at signup (cursor 0 or the old default 1)', () => {
    expect(onboardingStepsCompleted(0, false).step1_telephony).toBe(false);
    expect(onboardingStepsCompleted(1, false).step1_telephony).toBe(false);
    expect(onboardingStepsCompleted(2, false).step1_telephony).toBe(true);
    expect(onboardingStepsCompleted(5, true).step5_activate).toBe(true);
  });
});

describe('inbound DID plan gate (source)', () => {
  it('does not let forceRetry bypass the trial plan gate', () => {
    const src = readFileSync(join(srcRoot, 'modules/phone-numbers/auto-provision.service.ts'), 'utf8');
    expect(src).toMatch(/if \(!planIncludesInboundDid\(tenant\?\.plan\)\)/);
    expect(src).not.toMatch(/!planIncludesInboundDid\([^)]+\) && !opts\?\.forceRetry/);
  });

  it('retries failed DIDs on activate and paid subscribe', () => {
    const activate = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    expect(activate).toMatch(/ensureInboundDid\(tenantId, \{\s*forceRetry:\s*true\s*\}\)/);
    const billing = readFileSync(join(srcRoot, 'modules/billing/billing.service.ts'), 'utf8');
    expect(billing).toContain('forceRetry: true');
    expect(billing).toContain('/onboarding/step-1-phone?subscribed=1');
  });

  it('does not claim a shared inbound platform number for trial', () => {
    const step1 = readFileSync(
      join(srcRoot, '../../dashboard/src/app/onboarding/step-1-phone/page.tsx'),
      'utf8'
    );
    expect(step1).not.toMatch(/shared platform number/);
    expect(step1).toMatch(/Dedicated inbound number comes with a paid plan/);
  });

  it('does not enable DEMO_SKIP_COOLDOWN', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});

describe('onboarding use-case picker removed', () => {
  const dashboardRoot = join(srcRoot, '../../dashboard/src');

  it('does not send new Google or email signups through /onboarding/plan', () => {
    const google = readFileSync(join(dashboardRoot, 'app/auth/google-complete/page.tsx'), 'utf8');
    const signup = readFileSync(join(dashboardRoot, 'app/(auth)/signup/page.tsx'), 'utf8');
    expect(google).not.toMatch(/['"`]\/onboarding\/plan['"`]/);
    expect(signup).not.toMatch(/['"`]\/onboarding\/plan['"`]/);
    expect(google).toMatch(/\/onboarding\/step-0-industry/);
    expect(signup).toMatch(/\/onboarding\/step-0-industry/);
  });

  it('sends industry continue to phone setup, not the use-case picker', () => {
    const industry = readFileSync(join(dashboardRoot, 'app/onboarding/step-0-industry/page.tsx'), 'utf8');
    expect(industry).not.toMatch(/['"`]\/onboarding\/plan['"`]/);
    expect(industry).toMatch(/\/onboarding\/step-1-phone/);
  });

  it('turns /onboarding/plan into a forward redirect without the use-case picker', () => {
    const plan = readFileSync(join(dashboardRoot, 'app/onboarding/plan/page.tsx'), 'utf8');
    const nextConfig = readFileSync(join(dashboardRoot, '../next.config.js'), 'utf8');
    expect(plan).toMatch(/redirect\(\s*['"]\/onboarding['"]\s*\)/);
    expect(plan).not.toMatch(/What do you want your AI to do/);
    expect(plan).not.toMatch(/onboarding_use_case/);
    expect(nextConfig).toMatch(/source:\s*['"]\/onboarding\/plan['"]/);
    expect(nextConfig).toMatch(/destination:\s*['"]\/onboarding['"]/);
  });
});
