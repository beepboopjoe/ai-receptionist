'use client';
// ============================================================
// OnboardingBanner — top-of-app prompt.
// Free / demo accounts get an upgrade CTA (no setup urgency).
// Paid + promo-trial tenants still see the finish-setup strip
// until they activate.
// ============================================================
import useSWR from 'swr';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, X, Sparkles } from 'lucide-react';
import { getPlan } from '@ai-receptionist/shared';
import { onboardingApi } from '@/lib/api';
import { useTenant } from '@/lib/TenantProvider';
import { usePlan } from '@/lib/usePlan';

const TOTAL_STEPS = 6; // step-0-industry + steps 1–5
const DISMISS_KEY = 'onboarding-banner-dismissed-at';
const DEMO_DISMISS_KEY = 'demo-upgrade-banner-dismissed-at';
const DISMISS_TTL_MS = 24 * 3600 * 1000; // 24h

const growth = getPlan('growth')!;

interface OnboardingStatus {
  currentStep: number;
  uiStep?: number;
  isActive: boolean;
}

export function OnboardingBanner() {
  const { tenant } = useTenant();
  const { isDemoAccount, loading: planLoading } = usePlan();
  const { data } = useSWR(
    'onboarding-status',
    () => onboardingApi.getStatus(),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  const status = data as OnboardingStatus | undefined;

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const key = isDemoAccount ? DEMO_DISMISS_KEY : DISMISS_KEY;
      const at = Number(localStorage.getItem(key));
      if (at && Date.now() - at < DISMISS_TTL_MS) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } catch { /* ignore */ }
  }, [isDemoAccount]);

  if (planLoading) return null;
  if (!tenant) return null;
  if (dismissed) return null;

  if (isDemoAccount) {
    return (
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white border-b border-brand-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-3">
          <Sparkles size={16} className="shrink-0 opacity-90" />
          <div className="flex-1 min-w-0 flex items-center gap-3 text-sm">
            <span className="font-medium">You&apos;re exploring the dashboard</span>
            <span className="hidden sm:inline opacity-75">
              Upgrade to go live — {growth.name} ${growth.monthlyPrice}/mo
            </span>
          </div>
          <Link
            href="/billing"
            className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            See plans <ArrowRight size={14} />
          </Link>
          <button
            onClick={() => {
              try {
                localStorage.setItem(DEMO_DISMISS_KEY, String(Date.now()));
              } catch { /* ignore */ }
              setDismissed(true);
            }}
            aria-label="Dismiss for 24 hours"
            className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  if (!status) return null;
  if (status.isActive || tenant.isActive) return null;

  const currentStep = Math.max(1, Math.min(status.uiStep ?? status.currentStep ?? 1, TOTAL_STEPS));
  const completed = Math.max(0, currentStep - 1);
  const percent = Math.round((completed / TOTAL_STEPS) * 100);

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white border-b border-brand-800">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-3">
        <Sparkles size={16} className="shrink-0 opacity-90" />
        <div className="flex-1 min-w-0 flex items-center gap-3 text-sm">
          <span className="font-medium">
            Finish setup — {completed}/{TOTAL_STEPS} steps complete ({percent}%)
          </span>
          <span className="hidden sm:inline opacity-75">
            Your AI receptionist isn&apos;t live yet.
          </span>
        </div>
        <Link
          href="/onboarding"
          className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        >
          Resume <ArrowRight size={14} />
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss for 24 hours"
          className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
