// ============================================================
// useVertical — read the current tenant's vertical config.
//
// Shares the SWR cache key 'tenant' with TenantProvider so when
// the provider is mounted (every (app) route), there is exactly
// one /tenant fetch on mount no matter how many components call
// useVertical() / useTenant().
//
// Falls back to localStorage when the API hasn't resolved yet
// (first paint, offline, or non-authenticated routes).
// ============================================================
'use client';
import useSWR from 'swr';
import { tenantsApi } from './api';
import { getSavedVertical, getVertical, type VerticalConfig } from './verticals';

export function useVertical(): VerticalConfig {
  const { data } = useSWR(
    'tenant',
    async () => {
      try {
        const tenant = await tenantsApi.get();
        try {
          if (tenant?.vertical) localStorage.setItem('onboarding_vertical', tenant.vertical);
        } catch { /* ignore */ }
        return tenant;
      } catch {
        return null;
      }
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // 1) API-resolved value (most authoritative)
  // 2) localStorage (set during step-0 or by a prior API hit)
  // 3) 'generic' (verticals.ts default)
  const id = (data?.vertical as string | undefined) ?? getSavedVertical();
  return getVertical(id);
}
