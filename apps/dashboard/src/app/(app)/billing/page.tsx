'use client';

import { useEffect, useState } from 'react';
import { billingApi } from '@/lib/api';
import { Phone, Calendar, Zap, CheckCircle, ExternalLink } from 'lucide-react';
import { Skeleton as UiSkeleton, StatCardSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { PLANS as SHARED_PLANS, type BillingCycle } from '@ai-receptionist/shared';

// Local view-model overlay for the badge color + the legacy "trial" tier
// (Stripe doesn't sell a trial — it's the pre-checkout state).
const PLAN_DISPLAY: Record<string, { label: string; color: string; price: number; minutes: number; overagePerMin: number }> = {
  trial: { label: 'Trial', color: 'gray', price: 0, minutes: 10, overagePerMin: 0 },
  ...Object.fromEntries(
    SHARED_PLANS.map((p) => [
      p.key,
      {
        label: p.name,
        color: p.popular ? 'indigo' : p.key === 'scale' ? 'purple' : 'blue',
        price: p.monthlyPrice,
        minutes: p.monthlyMinutes === -1 ? 99999 : p.monthlyMinutes,
        overagePerMin: p.overagePerMin,
      },
    ])
  ),
};

// ── Billing data shape ──────────────────────────────────────────────────────
interface BillingData {
  plan: string;
  minutesUsed: number;
  minutesIncluded: number;
  usagePercent: number;
  callsThisMonth: number;
  appointmentsThisMonth: number;
  renewalDate: string;
  monthlyPrice: number;
  outboundEnabled: boolean;
  /** Phase 20: true for subscribers grandfathered onto pre-2026-05-28 caps. */
  legacyPricing?: boolean;
}

// ── Plan badge color map ────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  gray:   'bg-gray-100 text-gray-700',
  blue:   'bg-blue-100 text-blue-700',
  indigo: 'bg-brand-100 text-brand-700',
  purple: 'bg-purple-100 text-purple-700',
};

// ── Loading skeleton — uses the shared UI primitive ────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <UiSkeleton width="w-24" height="h-6" />
        <UiSkeleton width="w-32" height="h-8" />
        <UiSkeleton width="w-48" height="h-4" />
        <UiSkeleton width="w-40" height="h-10" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <StatCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

// ── Plan comparison table ───────────────────────────────────────────────────
// Each "Switch to X" button hits Stripe Checkout via billingApi.checkout()
// and redirects to the URL Stripe returns. Cycle defaults to monthly here;
// users get the annual upsell on the public /pricing page.
// signupPreference — plan key stored at signup (localStorage 'signup_plan_preference')
// — shown as "Your chosen plan" if the user is still on trial.
function PlanComparisonCards({
  currentPlan,
  signupPreference,
  onCheckoutError,
}: {
  currentPlan: string;
  signupPreference: string | null;
  onCheckoutError: (msg: string) => void;
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const cycle: BillingCycle = 'monthly';
  const sellable = SHARED_PLANS.filter((p) => p.key !== 'enterprise');
  const isOnTrial = currentPlan === 'trial';

  async function startCheckout(planKey: string) {
    setPendingKey(planKey);
    try {
      const { url } = await billingApi.checkout(planKey, cycle);
      // Clear the preference once they've initiated checkout
      try { localStorage.removeItem('signup_plan_preference'); } catch { /* ignore */ }
      window.location.href = url;
    } catch (err) {
      setPendingKey(null);
      onCheckoutError(err instanceof Error ? err.message : 'Checkout failed');
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {sellable.map((plan) => {
        const isCurrentPlan = currentPlan === plan.key;
        const isPending = pendingKey === plan.key;
        const isPreferred = isOnTrial && signupPreference === plan.key;

        return (
          <div
            key={plan.key}
            className={`card p-6 relative flex flex-col ${
              isPreferred
                ? 'ring-2 ring-brand-500 shadow-md'
                : plan.popular
                  ? 'ring-2 ring-brand-500'
                  : ''
            }`}
          >
            {/* Preferred plan badge (signup preference, trial users only) */}
            {isPreferred && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                Your chosen plan
              </span>
            )}
            {!isPreferred && plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                POPULAR
              </span>
            )}

            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">${plan.monthlyPrice}/mo</p>
              <p className="text-xs text-gray-400 italic mt-0.5">{plan.tagline}</p>
            </div>
            <ul className="space-y-2 flex-1 mb-3">
              {plan.features.slice(0, 5).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle size={15} className="text-green-500 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mb-4">
              Overage: <span className="font-semibold text-gray-600">${plan.overagePerMin.toFixed(2)}/min</span>
            </p>
            {isCurrentPlan ? (
              <span className="block text-center text-sm font-medium text-brand-600 border border-brand-200 rounded-lg py-2">
                Current plan
              </span>
            ) : (
              <button
                onClick={() => startCheckout(plan.key)}
                disabled={isPending}
                className={`w-full text-sm py-2 disabled:opacity-60 rounded-lg font-semibold transition-colors ${
                  isPreferred
                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                    : 'btn-primary'
                }`}
              >
                {isPending ? 'Redirecting…' : isPreferred ? `Upgrade to ${plan.name} →` : `Switch to ${plan.name} →`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
type UsageData = Awaited<ReturnType<typeof billingApi.getUsage>>;

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupPreference, setSignupPreference] = useState<string | null>(null);
  const toast = useToast();

  // Read plan preference set at signup — only relevant while still on trial
  useEffect(() => {
    try {
      const pref = localStorage.getItem('signup_plan_preference');
      if (pref) setSignupPreference(pref);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.allSettled([billingApi.get(), billingApi.getUsage()])
      .then(([billingRes, usageRes]) => {
        if (billingRes.status === 'fulfilled') setBilling(billingRes.value);
        else toast.error(billingRes.reason?.message ?? 'Failed to load billing data');
        if (usageRes.status === 'fulfilled') setUsage(usageRes.value);
        // Usage 404s on truly fresh tenants (no period yet) — silent fallback OK.
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planConfig = billing
    ? (PLAN_DISPLAY[billing.plan] ?? PLAN_DISPLAY['trial'])
    : null;
  // Suggest the next-tier upgrade — Starter→Growth→Scale.
  const nextUpgrade =
    billing?.plan === 'trial' || billing?.plan === 'starter'
      ? { key: 'growth', label: 'Growth' }
      : billing?.plan === 'growth'
        ? { key: 'scale', label: 'Scale' }
        : null;
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const { url } = await billingApi.openPortal();
      window.location.href = url;
    } catch (err) {
      setPortalLoading(false);
      toast.error(err instanceof Error ? err.message : 'Could not open billing portal');
    }
  }

  async function upgradeTo(planKey: string) {
    setUpgradeLoading(true);
    try {
      const { url } = await billingApi.checkout(planKey, 'monthly');
      window.location.href = url;
    } catch (err) {
      setUpgradeLoading(false);
      toast.error(err instanceof Error ? err.message : 'Checkout failed');
    }
  }

  // Prefer the real /billing/usage endpoint when it returned. Fall
  // back to the legacy /billing aggregate (which mocks values during
  // dev) when usage isn't available yet — fresh tenants with no calls.
  const minutesUsed = usage?.minutesUsed ?? billing?.minutesUsed ?? 0;
  const minutesIncluded = usage?.minutesIncluded ?? billing?.minutesIncluded ?? planConfig?.minutes ?? 0;
  const overageMinutes = usage?.overageMinutes ?? 0;
  const overageDollars = (usage?.overageChargedCents ?? 0) / 100;
  const usagePercent = usage?.pctUsed ?? billing?.usagePercent ?? 0;
  const progressColor =
    usagePercent >= 95 ? '#dc2626'      // red — already in overage
      : usagePercent >= 80 ? '#f59e0b'  // yellow — warning
      : '#c96442';                       // brand

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Billing &amp; Usage</h1>
        <p className="text-gray-500 mt-1">Manage your plan and monitor usage</p>
      </div>

      {/* Errors surface as toasts via the load effect — no inline banner needed. */}

      {loading ? (
        <LoadingSkeleton />
      ) : billing && planConfig ? (
        <>
          {/* ── Current plan card ── */}
          <div className="card p-6 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    BADGE_COLORS[planConfig.color]
                  }`}
                >
                  <Zap size={13} />
                  {planConfig.label}
                </span>
                {billing.legacyPricing && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                    title="Grandfathered onto the original plan caps. Future pricing changes won't affect this subscription."
                  >
                    Grandfathered · {minutesIncluded} min/mo
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {planConfig.price === 0
                  ? 'Free'
                  : `$${planConfig.price}/mo`}
              </p>
              <p className="text-sm text-gray-500">
                Renews{' '}
                {new Date(billing.renewalDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {nextUpgrade && (
                <button
                  onClick={() => upgradeTo(nextUpgrade.key)}
                  disabled={upgradeLoading}
                  className="btn-primary disabled:opacity-60"
                >
                  {upgradeLoading ? 'Redirecting…' : `Upgrade to ${nextUpgrade.label} →`}
                </button>
              )}
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
                title="Manage payment method, view invoices, or cancel"
              >
                <ExternalLink size={14} />
                {portalLoading ? 'Opening…' : 'Manage billing'}
              </button>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* AI Minutes Used */}
            <div className="card p-6 space-y-3">
              <p className="text-sm font-medium text-gray-500">AI Minutes Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(minutesUsed).toLocaleString()}
                <span className="text-base font-normal text-gray-400">
                  {' '}/ {minutesIncluded === -1 ? '∞' : minutesIncluded.toLocaleString()}
                </span>
              </p>
              <div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(usagePercent, 100)}%`,
                      backgroundColor: progressColor,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{usagePercent}% used this period</p>
                {overageMinutes > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">
                    +{Math.round(overageMinutes)} overage min · ${overageDollars.toFixed(2)} added to next invoice
                  </p>
                )}
                {usagePercent >= 80 && usagePercent < 100 && overageMinutes === 0 && (
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">
                    ⚠ Approaching plan limit
                  </p>
                )}
              </div>
            </div>

            {/* Calls This Month */}
            <div className="card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">Calls This Month</p>
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Phone size={18} className="text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {billing.callsThisMonth.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">Total calls handled by AI</p>
            </div>

            {/* Appointments Booked */}
            <div className="card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">Appointments Booked</p>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Calendar size={18} className="text-emerald-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {billing.appointmentsThisMonth.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">Booked this month</p>
            </div>
          </div>

          {/* ── Plan comparison ── */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Compare Plans</h2>
            <PlanComparisonCards
              currentPlan={billing.plan}
              signupPreference={signupPreference}
              onCheckoutError={(msg) => toast.error(msg)}
            />
          </div>

          {/* ── Footer CTA ── */}
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              Questions? Contact us at{' '}
              <a
                href="mailto:hello@aireceptionist.ai"
                className="text-brand-600 hover:underline font-medium"
              >
                hello@aireceptionist.ai
              </a>
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
