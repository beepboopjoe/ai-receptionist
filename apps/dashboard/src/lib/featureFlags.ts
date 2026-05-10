// ============================================================
// Feature flags
//
// One typed map of every gated capability in the product. Each flag
// resolves from plan tier today, but the shape (a single function
// returning boolean per flag) leaves room for per-tenant overrides,
// percent rollouts, or a remote flag service later — without changing
// any callsite.
//
// Usage:
//   const { has } = useFeatureFlags();
//   if (has('outbound_campaigns')) { … }
//
// or:
//   <Gated flag="api_access">…</Gated>
// ============================================================
'use client';
import { type ReactNode } from 'react';
import { usePlan, type PlanTier } from './usePlan';

/** Every capability that can be gated. Add new entries here. */
export type FeatureFlag =
  | 'outbound_campaigns'
  | 'analytics'
  | 'multi_location'
  | 'webhooks'
  | 'api_access'
  | 'custom_voice'
  | 'sso'
  | 'priority_support'
  | 'crm_integrations';

/** Lowest plan tier required for each flag. Anything above also gets it. */
const PLAN_REQUIREMENT: Record<FeatureFlag, PlanTier> = {
  outbound_campaigns:  'growth',
  analytics:           'pro',
  multi_location:      'pro',
  webhooks:            'growth',
  api_access:          'pro',
  custom_voice:        'pro',
  sso:                 'enterprise',
  priority_support:    'pro',
  crm_integrations:    'growth',
};

/** Tier ordering — higher index = more capable plan. */
const TIER_RANK: Record<PlanTier, number> = {
  trial: 0,
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4,
};

/** Human-readable labels for upgrade modals/locked feature CTAs. */
export const FLAG_LABELS: Record<FeatureFlag, string> = {
  outbound_campaigns: 'Outbound campaigns',
  analytics:          'Advanced analytics',
  multi_location:     'Multi-location management',
  webhooks:           'Outbound webhooks',
  api_access:         'API access',
  custom_voice:       'Custom voice cloning',
  sso:                'SAML / SSO',
  priority_support:   'Priority support',
  crm_integrations:   'CRM integrations',
};

export interface FeatureFlagApi {
  /** True when the current tenant's plan unlocks this flag. */
  has: (flag: FeatureFlag) => boolean;
  /** The tier required to unlock this flag — useful in upgrade prompts. */
  requiredTier: (flag: FeatureFlag) => PlanTier;
  /** All currently-enabled flags. Handy for rendering chips. */
  enabled: FeatureFlag[];
  /** Loading state from the underlying plan fetch. */
  loading: boolean;
}

/**
 * Hook variant — drop-in replacement for the ad-hoc `usePlan().outboundEnabled`
 * checks scattered across the app.
 */
export function useFeatureFlags(): FeatureFlagApi {
  const { plan, loading } = usePlan();
  const tierRank = TIER_RANK[plan] ?? 0;

  const has = (flag: FeatureFlag): boolean => {
    const required = PLAN_REQUIREMENT[flag];
    return tierRank >= (TIER_RANK[required] ?? 99);
  };

  const requiredTier = (flag: FeatureFlag): PlanTier => PLAN_REQUIREMENT[flag];

  const enabled = (Object.keys(PLAN_REQUIREMENT) as FeatureFlag[]).filter(has);

  return { has, requiredTier, enabled, loading };
}

/**
 * Render-prop convenience: shows children only when the flag is on. Pass
 * `fallback` (e.g. an upgrade nudge) for the locked state.
 */
export function Gated({
  flag,
  children,
  fallback = null,
}: {
  flag: FeatureFlag;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { has, loading } = useFeatureFlags();
  if (loading) return null;
  return <>{has(flag) ? children : fallback}</>;
}
