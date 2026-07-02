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
import { useState, useEffect } from 'react';
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

  // Avoid a hydration mismatch: localStorage is empty during SSR (→ 'generic')
  // but populated on the client's very first render (→ the real vertical), so
  // any component rendering vertical-dependent text/emoji on first paint makes
  // React discard the server HTML. Pin to 'generic' until mounted so server and
  // first client render agree, then switch to the resolved value.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return getVertical('generic');

  // 1) API-resolved value (most authoritative)
  // 2) localStorage (set during step-0 or by a prior API hit)
  // 3) 'generic' (verticals.ts default)
  const id = (data?.vertical as string | undefined) ?? getSavedVertical();
  return getVertical(id);
}
