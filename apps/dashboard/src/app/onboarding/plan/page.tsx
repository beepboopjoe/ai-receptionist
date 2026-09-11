import { redirect } from 'next/navigation';

/** Legacy use-case / plan picker — removed. Free accounts go to the dashboard. */
export default function OnboardingPlanRedirect() {
  redirect('/dashboard');
}
