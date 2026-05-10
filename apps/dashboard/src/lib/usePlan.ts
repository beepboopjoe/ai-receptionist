'use client';
// ============================================================
// usePlan — central hook for plan tier state
// Single source of truth so every component gets consistent
// feature flags without re-fetching billing on each mount.
// SWR caches the request for 60 s and deduplicates concurrent calls.
// ============================================================
import useSWR from 'swr';
import { billingApi } from './api';

export type PlanTier = 'trial' | 'starter' | 'growth' | 'pro' | 'enterprise';

export interface PlanState {
  plan: PlanTier;
  /** true for Growth and above — enables outbound campaigns */
  outboundEnabled: boolean;
  /** true for Pro and above — enables advanced analytics */
  analyticsEnabled: boolean;
  /** true for Pro and above — enables multi-location management */
  multiLocationEnabled: boolean;
  minutesUsed: number;
  minutesIncluded: number;
  usagePercent: number;
  /** true when usagePercent >= 80 */
  isHighUsage: boolean;
  loading: boolean;
}

export function usePlan(): PlanState {
  const { data, isLoading } = useSWR('billing', () => billingApi.get(), {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
  const b = data as any;
  const plan: PlanTier = (b?.plan as PlanTier) ?? 'trial';

  return {
    plan,
    outboundEnabled: b?.outboundEnabled ?? false,
    analyticsEnabled: plan === 'pro' || plan === 'enterprise',
    multiLocationEnabled: plan === 'pro' || plan === 'enterprise',
    minutesUsed: b?.minutesUsed ?? 0,
    minutesIncluded: b?.minutesIncluded ?? 0,
    usagePercent: b?.usagePercent ?? 0,
    isHighUsage: (b?.usagePercent ?? 0) >= 80,
    loading: isLoading,
  };
}
