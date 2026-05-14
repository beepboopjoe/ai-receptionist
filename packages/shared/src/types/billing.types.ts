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
// STRIPE_PRICE_ID_<KEY>_(MONTHLY|ANNUAL) env vars on the API.
// ============================================================

export type PlanKey = 'trial' | 'starter' | 'growth' | 'scale' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';

export interface Plan {
  key: PlanKey;
  name: string;
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
  /** Local phone numbers included free. Extra ones are $5/mo each. */
  includedPhoneNumbers: number;
  /** Whether outbound campaigns are unlocked at this tier. */
  outbound: boolean;
  /** Marketing badge — only one plan should be marked popular. */
  popular?: boolean;
  /** Bullet points for the pricing card. */
  features: string[];
}

/**
 * Public plan catalog. Order matters — used as-is on the pricing page.
 *
 * Pricing rationale (see PRICING_PROPOSAL section in repo history):
 *   - Starter $79: undercuts Goodcall $79 with explicit minute count
 *   - Growth $179: between Goodcall $129 and Smith.ai $270
 *   - Scale $399: Smith.ai-tier price with way more minutes + outbound
 *   - Enterprise: custom — 5+ locations, white-label, SLA, dedicated rep
 */
export const PLANS: readonly Plan[] = [
  {
    key: 'trial',
    name: 'Free Trial',
    tagline: 'Try AI receptionist for free',
    description: 'A 10-minute free trial to explore the platform.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    monthlyMinutes: 10,
    overagePerMin: 0,
    includedPhoneNumbers: 0,
    outbound: false,
    features: [
      '10 AI minutes included',
      'Uses platform phone number',
      'Inbound calls only',
      'No credit card required',
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'Never miss a call again',
    description: 'Perfect for solo operators or single-location businesses.',
    monthlyPrice: 79,
    annualMonthlyPrice: 67,
    monthlyMinutes: 200,
    overagePerMin: 0.20,
    includedPhoneNumbers: 1,
    outbound: true,
    features: [
      '200 AI minutes / month',
      '1 local phone number included',
      'Inbound + Outbound calling',
      'All 6 verticals (dental, legal, real estate, insurance, home services, generic)',
      'English + Spanish bilingual',
      'Public REST API + webhooks',
      'Email support',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'Turn calls into customers',
    description: 'Multi-staff practices that run regular outbound campaigns.',
    monthlyPrice: 179,
    annualMonthlyPrice: 152,
    monthlyMinutes: 600,
    overagePerMin: 0.18,
    includedPhoneNumbers: 1,
    outbound: true,
    popular: true,
    features: [
      '600 AI minutes / month',
      '1 local phone number included',
      'Inbound + Outbound calling',
      'Unlimited outbound campaigns',
      'Lead qualification & CRM sync',
      'Custom voice clone available (+$49/mo)',
      'Priority email support',
    ],
  },
  {
    key: 'scale',
    name: 'Scale',
    tagline: 'High-volume operations',
    description: 'Multi-location or high-call-volume businesses.',
    monthlyPrice: 399,
    annualMonthlyPrice: 339,
    monthlyMinutes: 2000,
    overagePerMin: 0.15,
    includedPhoneNumbers: 2,
    outbound: true,
    features: [
      '2,000 AI minutes / month',
      '2 local phone numbers included',
      'Everything in Growth',
      'Multi-location support',
      'Advanced analytics dashboard',
      'Dedicated onboarding session',
      'Phone + email support',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'Tailored to your scale',
    description: '5+ locations, white-label, dedicated SLA, and a named CSM.',
    monthlyPrice: 0, // shown as "Custom" in UI
    annualMonthlyPrice: 0,
    monthlyMinutes: -1, // unlimited
    overagePerMin: -1,
    includedPhoneNumbers: 5,
    outbound: true,
    features: [
      'Unlimited AI minutes',
      '5+ phone numbers',
      'Everything in Scale',
      'White-label dashboard available',
      'Dedicated customer success manager',
      'Custom SLA + uptime guarantee',
      'API rate-limit lift',
    ],
  },
] as const;

/** Pay-as-you-go option — alternative to subscriptions. No monthly commit.
 *
 * Priced deliberately HIGHER than the lowest-tier overage rate ($0.20/min
 * on Starter) so that subscribing is a clear discount per minute. At
 * $0.39/min PAYG, even a customer burning only ~200 min/mo saves money
 * by subscribing to Starter ($79/200 min = $0.395/min effective, with
 * overage at $0.20 thereafter). Above ~200 min, the subscription wins
 * by a wide margin. This pushes conversion to subscriptions while
 * keeping PAYG profitable for truly spiky low-volume use cases. */
export const PAY_AS_YOU_GO = {
  key: 'payg' as const,
  name: 'Pay as you go',
  perMinute: 0.39,
  /** Phone number costs $5/mo even on PAYG; not included free. */
  phoneNumberMonthly: 5,
  description: 'Test the platform or handle spiky volumes. Billed only for minutes used + your phone number. Subscribing saves 50%+ per minute once you cross ~150 min/mo.',
};

/** A la carte add-ons — separate Stripe SKUs, billed alongside the subscription. */
export const ADDONS = {
  extra_local_number: { name: 'Extra local number', monthlyPrice: 5 },
  toll_free_number:   { name: 'Toll-free number',   monthlyPrice: 10 },
  custom_voice_clone: { name: 'Custom voice clone', monthlyPrice: 49 },
} as const;

/** Minute packs — one-time purchase, never expire. */
export const MINUTE_PACKS = [
  { key: 'pack_100',  name: '100 minutes',   minutes: 100,  priceUsd: 20 },
  { key: 'pack_500',  name: '500 minutes',   minutes: 500,  priceUsd: 80 },
  { key: 'pack_1000', name: '1,000 minutes', minutes: 1000, priceUsd: 140 },
] as const;

/**
 * Look up a plan by key. Returns undefined for unknown keys (callers
 * decide whether to default to Starter or surface an error).
 */
export function getPlan(key: string): Plan | undefined {
  return PLANS.find((p) => p.key === key);
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
