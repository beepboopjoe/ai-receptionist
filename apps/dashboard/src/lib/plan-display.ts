// Shared plan / minute formatting so sidebar, billing, and home agree.
// Enterprise (and any override) uses -1 as the unlimited sentinel.

const PLAN_LABELS: Record<string, string> = {
  trial: 'Free Trial',
  starter: 'Free Trial',
  growth: 'Growth',
  scale: 'Scale',
  business: 'Business',
  enterprise: 'Enterprise',
};

/** Human plan name. Unknown keys fall back to the raw value. */
export function planDisplayName(plan: string | null | undefined): string {
  if (!plan) return 'Free Trial';
  return PLAN_LABELS[plan] ?? plan;
}

/** True when the included-minute cap means unlimited. */
export function isUnlimitedMinutes(minutesIncluded: number | null | undefined): boolean {
  return minutesIncluded == null || minutesIncluded < 0;
}

/** Format a minute cap for UI: `∞` for unlimited, otherwise the number. */
export function formatMinutesLimit(minutesIncluded: number | null | undefined): string {
  if (isUnlimitedMinutes(minutesIncluded)) return '∞';
  return String(minutesIncluded);
}

/** Price line that matches the plan — never show "Free" for Enterprise. */
export function planPriceLabel(plan: string | null | undefined, monthlyPrice: number): string {
  if (plan === 'enterprise') return 'Custom';
  if (!monthlyPrice || monthlyPrice <= 0) return 'Free';
  return `$${monthlyPrice}/mo`;
}

export function formatMinutesUsedOfLimit(used: number, included: number | null | undefined): string {
  return `${Math.round(used).toLocaleString()} / ${formatMinutesLimit(included)}`;
}
