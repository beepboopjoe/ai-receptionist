// ============================================================
// Onboarding cursor math — UI has 6 screens (industry + 5
// tracked steps). `tenants.onboarding_step` is the next
// telephony step to do (0 = industry, 1–5 = phone→activate).
// Completing step N advances the cursor to at least N+1.
// ============================================================

export const ONBOARDING_LAST_STEP = 5;
export const ONBOARDING_UI_STEPS = 6;

/** Completing `completedStep` (0–5) advances the stored cursor. */
export function nextOnboardingStep(current: number, completedStep: number): number {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeCompleted = Number.isFinite(completedStep) ? completedStep : 0;
  const advanced = safeCompleted + 1;
  return Math.max(safeCurrent, Math.min(ONBOARDING_LAST_STEP, advanced));
}

/** Backend 0–5 cursor → 1–6 UI index (industry is step 1). */
export function onboardingUiStep(onboardingStep: number, isActive: boolean): number {
  if (isActive) return ONBOARDING_UI_STEPS;
  const safe = Number.isFinite(onboardingStep) ? onboardingStep : 0;
  return Math.min(ONBOARDING_UI_STEPS, Math.max(1, safe + 1));
}

export function onboardingStepsCompleted(onboardingStep: number, isActive: boolean) {
  const step = Number.isFinite(onboardingStep) ? onboardingStep : 0;
  return {
    step0_industry: step >= 1,
    step1_telephony: step >= 2,
    step2_calendar: step >= 3,
    step3_contacts: step >= 4,
    step4_rules: step >= 5,
    step5_activate: isActive,
  };
}
