import { redirect } from 'next/navigation';

/** Legacy use-case picker — removed. Direct nav continues into remaining onboarding. */
export default function OnboardingPlanRedirect() {
  redirect('/onboarding');
}
