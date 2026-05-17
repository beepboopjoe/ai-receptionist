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
//
// INTERNAL MARGIN MODEL (never customer-facing):
//   Cost/min: $0.07 | Cost/number: $1/mo
//   margin = (price - (minutes*0.07 + numbers*1)) / price
//   Starter: ($79  - $14.00)  / $79  ≈ 82.3%   (BYO — no number cost)
//   Growth:  ($199 - $54.50)  / $199 ≈ 72.6%
//   Scale:   ($399 - $110.00) / $399 ≈ 72.4%
// ============================================================

export type PlanKey = 'trial' | 'starter' | 'growth' | 'scale' | 'enterprise';
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
  /** Marketing badge — only one plan should be marked popular. */
  popular?: boolean;
  /** Bullet points for the pricing card. */
  features: string[];
}

export const PLANS: readonly Plan[] = [
  {
    key: 'trial',
    name: 'Free Trial',
    tagline: 'Try it free — no card needed',
    description: 'Explore the full platform with real AI calls before committing to a plan.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    monthlyMinutes: 10,
    overagePerMin: 0,
    includedPhoneNumbers: 1,
    outbound: true,
    features: [
      '30 AI voice minutes',
      '1 temporary phone number',
      'Inbound AI receptionist',
      'Basic outbound test call',
      'Call transcript + summary',
      'Missed-call text-back',
      'No credit card required',
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    badge: 'Best for solo offices',
    tagline: 'Answer every call. Never miss a lead.',
    description: 'Perfect for solo operators or single-location businesses ready to stop missing calls.',
    monthlyPrice: 79,
    annualMonthlyPrice: 67,
    monthlyMinutes: 200,
    overagePerMin: 0.29,
    includedPhoneNumbers: 0,
    outbound: true,
    features: [
      '200 AI voice minutes / month',
      'Bring your own number — free porting (or add a line for $5/mo)',
      'English + Spanish AI receptionist',
      'Two-way SMS inbox',
      'Appointment reminder SMS (24h + 2h)',
      'Missed-call text-back SMS',
      'Call transcripts + summaries',
      'Email & SMS notifications',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    badge: 'Most Popular',
    tagline: 'Qualify leads and book appointments automatically.',
    description: 'For growing practices running regular outbound campaigns and intake workflows.',
    monthlyPrice: 199,
    annualMonthlyPrice: 169,
    monthlyMinutes: 750,
    overagePerMin: 0.25,
    includedPhoneNumbers: 2,
    outbound: true,
    popular: true,
    features: [
      '750 AI voice minutes / month',
      '2 local phone numbers included',
      'Everything in Starter',
      'Outbound calling campaigns',
      'Voicemail drop + AMD',
      'Appointment booking',
      'CRM / webhook integrations',
      'Lead qualification templates',
      'Priority support',
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
    monthlyMinutes: 1500,
    overagePerMin: 0.19,
    includedPhoneNumbers: 5,
    outbound: true,
    features: [
      '1,500 AI voice minutes / month',
      '5 local phone numbers included',
      'Everything in Growth',
      'Multi-location support',
      'Advanced outbound campaigns',
      'SMS automation workflows',
      'Custom intake flows',
      'API access',
      'CRM sync',
      'Analytics dashboard',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    badge: 'Custom volume',
    tagline: 'Custom AI workflows for high-volume teams.',
    description: 'HIPAA-ready, white-label, and dedicated onboarding for organizations that need it all.',
    monthlyPrice: 0, // shown as "Custom" in UI
    annualMonthlyPrice: 0,
    monthlyMinutes: -1,
    overagePerMin: -1,
    includedPhoneNumbers: -1,
    outbound: true,
    features: [
      'High-volume AI minutes',
      'HIPAA-ready workflows',
      'Custom SMS workflows',
      'Custom integrations',
      'Dedicated onboarding',
      'White-label options',
      'Multiple locations',
      'Custom number pools',
    ],
  },
] as const;

/** Pay-as-you-go option — de-emphasized alternative to subscriptions.
 *
 * Priced above Starter's effective rate ($79/200 min = $0.395/min) so
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
