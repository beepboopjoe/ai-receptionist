// ============================================================
// TenantProvider — single fetch fan-out for tenant + vertical.
//
// Mounted once in (app)/layout.tsx so every nested component can
// call useTenant() / useVertical() / useTenantId() without each
// kicking off its own /tenant request. SWR's cache key 'tenant'
// is shared across all consumers.
//
// Existing useVertical() in lib/useVertical.ts continues to work
// (it points at the same SWR key), so this is additive.
// ============================================================
'use client';
import { createContext, useContext, type ReactNode } from 'react';
import useSWR from 'swr';
import { tenantsApi } from './api';
import { getVertical, getSavedVertical, type VerticalConfig } from './verticals';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  vertical: string;
  timezone: string;
  isActive: boolean;
  onboardingStep: number;
}

interface TenantContextValue {
  tenant: TenantInfo | null;
  vertical: VerticalConfig;
  /** True while the initial fetch is in flight. */
  loading: boolean;
  /** Force-refresh the cached tenant. Call after a vertical change in Settings. */
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, mutate } = useSWR<TenantInfo>(
    'tenant',
    async () => {
      const t = await tenantsApi.get();
      // Mirror to localStorage so first-paint of the next route is instant.
      try {
        if (t?.vertical) localStorage.setItem('onboarding_vertical', t.vertical);
      } catch { /* ignore */ }
      return t as TenantInfo;
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // Resolve vertical: API result first, then localStorage, then 'generic'.
  const verticalId = data?.vertical ?? getSavedVertical();
  const vertical = getVertical(verticalId);

  const value: TenantContextValue = {
    tenant: data ?? null,
    vertical,
    loading: isLoading,
    refresh: async () => {
      await mutate();
    },
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/**
 * Read the current tenant + vertical. Falls back to a sensible default
 * (generic vertical, null tenant) if used outside a TenantProvider — useful
 * for storybook and unit tests.
 */
export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (ctx) return ctx;
  // Graceful fallback for components that render outside the provider
  // (e.g. unauthenticated pages). Don't fetch — just return a static default.
  return {
    tenant: null,
    vertical: getVertical(getSavedVertical()),
    loading: false,
    refresh: async () => undefined,
  };
}
