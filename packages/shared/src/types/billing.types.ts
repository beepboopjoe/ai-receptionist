// ============================================================
// Billing — single source of truth for plan catalog.
//
// The Stripe price IDs are populated from env vars at runtime
// (one set for monthly billing + one for annual). The `key`
// is the stable identifier used in the DB (`tenants.plan`)
// and on the URL when starting checkout.
//
// Adding a plan: bump the union type, add a row, add Stripe
// products in the customer's Stripe dashboard, set the
// STRIPE_PRICE_<KEY>_(MONTHLY|ANNUAL) env vars on the API.
//
// INTERNAL MARGIN MODEL (never customer-facing):
//   Cost/min: $0.07 | Cost/number: $1/mo
//   margin = (price - (minutes*0.07 + numbers*1)) / price
//
//   85% margin floor is enforced — every paid tier carries
//   ≥0.2pp cushion above 85% at full utilization.
//
//   Current pricing (Phase 23 rework, 2026-05-30):
//     Growth:   ($199 - $28.60)  / $199 ≈ 85.6%   (380 min, 2 numbers)
//     Scale:    ($399 - $59.60)  / $399 ≈ 85.1%   (780 min, 5 numbers)
//     Business: ($599 - $87.00)  / $599 ≈ 85.5%   (1,100 min, 10 numbers)
//
//   Phase 23 dropped Starter entirely. The 10-min Trial is the
//   only sub-$199 on-ramp; everything else is committed-customer
//   pricing matching the managed-AI-receptionist segment
//   (SmithAI $290+, Ruby $300+).
//
//   Legacy pricing block (kept as defensive infrastructure for
//   future grandfathering — no rows fire it today since no subs
//   existed at Phase 23 cutover):
//     Growth:  ($199 - $54.50)  / $199 ≈ 72.6%   (750 min)
//     Scale:   ($399 - $110.00) / $399 ≈ 72.4%   (1500 min)
// ============================================================

export type PlanKey = 'trial' | 'growth' | 'scale' | 'business' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';

export interface Plan {
  key: PlanKey;
  name: string;
  /** Short marketing badge shown on pricing cards. */
  badge?: string;
  /** Marketing one-liner shown on pricing cards. */
  tagline: string;
  /** Long description for the comparison table. */
  description: string;
  /** Monthly USD list price (annual = monthlyPrice * 12 * 0.85, applied at checkout). */
  monthlyPrice: number;
  /** Effective per-month price when paying annually (15% discount). */
  annualMonthlyPrice: number;
  /** Included AI minutes per billing month. -1 = unlimited (Enterprise). */
  monthlyMinutes: number;
  /** USD per minute charged once monthlyMinutes is exceeded. -1 = N/A. */
  overagePerMin: number;
  /** Local phone numbers included free. -1 = custom pool (Enterprise). */
  includedPhoneNumbers: number;
  /** Whether outbound campaigns are unlocked at this tier. */
  outbound: boolean;
  /**
   * Maximum concurrent inbound calls handled at any moment.
   * -1 = unlimited (Enterprise). Marketing surface in Phase 23;
   * runtime enforcement deferred to Phase 24.
   */
  concurrentInbound: number;
  /** Maximum concurrent outbound calls dialed at any moment. -1 = unlimited. */
  concurrentOutbound: number;
  /** Marketing badge — only one plan should be marked popular. */
  popular?: boolean;
  /** Bullet points for the pricing card. */
  features: string[];
}

export const PLANS: readonly Plan[] = [
  {
    key: 'trial',
    name: 'Free Trial',
    tagline: '10 minutes free — no card needed',
    description: 'Kick the tires on inbound AI answering with 10 minutes of real call time. No credit card, no commitment.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    monthlyMinutes: 10,
    overagePerMin: 0,
    includedPhoneNumbers: 0,
    outbound: false,
    concurrentInbound: 1,
    concurrentOutbound: 0,
    features: [
      '10 AI voice minutes',
      'Bring your own number (free porting)',
      '🌐 7 languages — EN, ES, IT, AR, FA, HY, RU',
      'Call transcripts + summaries',
      'No credit card required',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    badge: 'Most Popular',
    tagline: 'Qualify leads and book appointments automatically.',
    description: 'The entry-level managed AI receptionist tier. For growing practices running regular outbound campaigns and inbound intake.',
    monthlyPrice: 199,
    annualMonthlyPrice: 169,
    monthlyMinutes: 380,
    overagePerMin: 0.35,
    includedPhoneNumbers: 2,
    outbound: true,
    concurrentInbound: 5,
    concurrentOutbound: 3,
    popular: true,
    features: [
      '🌐 7 languages — EN, ES, IT, AR, FA, HY, RU',
      '380 AI voice minutes / month',
      '2 local phone numbers included',
      '5 concurrent inbound · 3 outbound',
      'Outbound calling campaigns',
      'Voicemail drop + AMD',
      'Appointment booking',
      'Two-way SMS inbox',
      'CRM / webhook integrations',
      'Lead qualification templates',
    ],
  },
  {
    key: 'scale',
    name: 'Scale',
    badge: 'Best for growing teams',
    tagline: 'Multi-location AI intake at scale.',
    description: 'Multi-location or high-call-volume businesses with advanced intake and CRM needs.',
    monthlyPrice: 399,
    annualMonthlyPrice: 339,
    monthlyMinutes: 780,
    overagePerMin: 0.29,
    includedPhoneNumbers: 5,
    outbound: true,
    concurrentInbound: 15,
    concurrentOutbound: 8,
    features: [
      '🌐 7 languages — EN, ES, IT, AR, FA, HY, RU',
      '780 AI voice minutes / month',
      '5 local phone numbers included',
      '15 concurrent inbound · 8 outbound',
      'Everything in Growth',
      'Multi-location support',
      'Advanced outbound campaigns',
      'SMS automation workflows',
      'Custom intake flows',
      'API access',
      'Analytics dashboard',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    badge: 'Best for high-volume teams',
    tagline: 'Heavy call volume, ten numbers, one premium tier.',
    description: 'For businesses handling thousands of calls per month across many lines, regions, or campaigns.',
    monthlyPrice: 599,
    annualMonthlyPrice: 509,
    monthlyMinutes: 1100,
    overagePerMin: 0.25,
    includedPhoneNumbers: 10,
    outbound: true,
    concurrentInbound: 50,
    concurrentOutbound: 25,
    features: [
      '🌐 7 languages — EN, ES, IT, AR, FA, HY, RU',
      '1,100 AI voice minutes / month',
      '10 local phone numbers included',
      '50 concurrent inbound · 25 outbound',
      'Everything in Scale',
      'Dedicated account manager',
      'Priority phone + email support',
      'Custom integrations on request',
      'Quarterly success review',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    badge: 'HIPAA + white-label',
    tagline: 'Compliance-grade AI receptionist with custom integrations.',
    description: 'HIPAA-ready with signed BAA, white-label dashboard, unlimited concurrent calls, dedicated onboarding, and SLA-backed uptime.',
    monthlyPrice: 0, // shown as "Custom" in UI
    annualMonthlyPrice: 0,
    monthlyMinutes: -1,
    overagePerMin: -1,
    includedPhoneNumbers: -1,
    outbound: true,
    concurrentInbound: -1,
    concurrentOutbound: -1,
    features: [
      '🌐 7 languages — EN, ES, IT, AR, FA, HY, RU',
      'HIPAA-ready workflows + signed BAA',
      'White-label dashboard',
      'Unlimited concurrent calls',
      'Custom integrations',
      'SLA-backed uptime',
      'Dedicated onboarding + account team',
      'Custom number pools',
    ],
  },
] as const;

/** Pay-as-you-go option — de-emphasized alternative to subscriptions.
 *
 * Priced above Growth's effective rate ($199/380 min = $0.524/min) so
 * subscribing is always the better deal above ~150 min/mo. Shown as a
 * small strip below the main plan grid — not the primary CTA.
 */
export const PAY_AS_YOU_GO = {
  key: 'payg' as const,
  name: 'Pay as you go',
  perMinute: 0.39,
  /** Phone number costs $5/mo even on PAYG; not included free. */
  phoneNumberMonthly: 5,
  description: 'No monthly commitment — pay only for what you use. Good for low-volume testing or occasional backup usage.',
};

/** A la carte add-ons — separate Stripe SKUs, billed alongside the subscription. */
export const ADDONS = {
  extra_local_number: { name: 'Extra local number', monthlyPrice: 5 },
  toll_free_number:   { name: 'Toll-free number',   monthlyPrice: 10 },
  custom_voice_clone: { name: 'Custom voice clone',  monthlyPrice: 49 },
} as const;

/** Minute packs — one-time purchase, never expire. */
export const MINUTE_PACKS = [
  { key: 'pack_100',  name: '100 minutes',   minutes: 100,  priceUsd: 20 },
  { key: 'pack_500',  name: '500 minutes',   minutes: 500,  priceUsd: 80 },
  { key: 'pack_1000', name: '1,000 minutes', minutes: 1000, priceUsd: 140 },
] as const;

/**
 * Look up a plan by key. Returns undefined for unknown keys (callers
 * decide whether to default to Growth or surface an error).
 */
export function getPlan(key: string): Plan | undefined {
  return PLANS.find((p) => p.key === key);
}

/**
 * Pre-Phase-23 cap + overage values. Defensive infrastructure for any
 * future grandfathering — no subscribers carried `legacy_pricing = true`
 * at the Phase 23 cutover (2026-05-30), so this map doesn't fire today.
 *
 * Trial + Enterprise + Business have no legacy equivalents (Business is
 * a Phase 23 introduction; the others' limits never changed).
 */
export const LEGACY_LIMITS: Record<'growth' | 'scale', { minutes: number; overagePerMin: number }> = {
  growth:  { minutes: 750,  overagePerMin: 0.25 },
  scale:   { minutes: 1500, overagePerMin: 0.19 },
};

/**
 * Resolve a tenant's effective minute cap + overage rate. Honors the
 * grandfathered `legacy_pricing` flag for subscribers who signed up
 * before a pricing restructure.
 *
 * Always use this instead of reading `plan.monthlyMinutes` or
 * `plan.overagePerMin` directly when computing billing or enforcement.
 */
export function resolvePlanLimits(
  plan: Plan,
  tenant: { legacyPricing?: boolean | null }
): { minutes: number; overagePerMin: number } {
  if (tenant.legacyPricing && (plan.key === 'growth' || plan.key === 'scale')) {
    return LEGACY_LIMITS[plan.key];
  }
  return { minutes: plan.monthlyMinutes, overagePerMin: plan.overagePerMin };
}

/** Subscription status mirror of Stripe's `subscription.status` enum. */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired';
