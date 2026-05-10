'use client';

import { useEffect, useState } from 'react';
import { billingApi } from '@/lib/api';
import { Phone, Calendar, Zap, CheckCircle } from 'lucide-react';
import { Skeleton as UiSkeleton, StatCardSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

// ── Plan tier config ────────────────────────────────────────────────────────
const PLANS = {
  trial:      { label: 'Trial',      price: 0,    minutes: 200,   color: 'gray',   overagePerMin: 0.14 },
  starter:    { label: 'Starter',    price: 199,  minutes: 1000,  color: 'blue',   overagePerMin: 0.14 },
  growth:     { label: 'Growth',     price: 399,  minutes: 3000,  color: 'indigo', overagePerMin: 0.13 },
  pro:        { label: 'Pro',        price: 799,  minutes: 8000,  color: 'purple', overagePerMin: 0.12 },
  enterprise: { label: 'Enterprise', price: 1500, minutes: 99999, color: 'gray',   overagePerMin: 0.10 },
} as const;

type PlanKey = keyof typeof PLANS;

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
function PlanComparisonCards({ currentPlan }: { currentPlan: string }) {
  const comparisonPlans = [
    {
      key: 'starter',
      name: '🟢 Starter',
      price: '$199/mo',
      tagline: 'Never miss a call again',
      overage: '$0.14/min',
      features: ['1,000 AI minutes', '1 phone number', 'Inbound calls only', 'Message taking & booking', 'SMS confirmations'],
      popular: false,
    },
    {
      key: 'growth',
      name: '🔵 Growth',
      price: '$399/mo',
      tagline: 'Turn calls into customers',
      overage: '$0.13/min',
      features: ['3,000 AI minutes', '2 phone numbers', 'Inbound + Outbound', 'Lead qualification & CRM sync', 'Full analytics dashboard'],
      popular: true,
    },
    {
      key: 'pro',
      name: '🔥 Pro',
      price: '$799/mo',
      tagline: 'Full automation system',
      overage: '$0.12/min',
      features: ['8,000 AI minutes', '5 phone numbers', 'Multi-location (5)', 'Custom workflows & AI tuning', 'Dedicated account manager'],
      popular: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {comparisonPlans.map((plan) => {
        const isCurrentPlan = currentPlan === plan.key;
        return (
          <div
            key={plan.key}
            className={`card p-6 relative flex flex-col ${
              plan.popular ? 'ring-2 ring-brand-500' : ''
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                POPULAR
              </span>
            )}
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{plan.price}</p>
              <p className="text-xs text-gray-400 italic mt-0.5">{plan.tagline}</p>
            </div>
            <ul className="space-y-2 flex-1 mb-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle size={15} className="text-green-500 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mb-4">Overage: <span className="font-semibold text-gray-600">{plan.overage}</span></p>
            {isCurrentPlan ? (
              <span className="block text-center text-sm font-medium text-brand-600 border border-brand-200 rounded-lg py-2">
                Current plan
              </span>
            ) : (
              <button className="btn-primary w-full text-sm py-2">
                Switch to {plan.name}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    billingApi
      .get()
      .then((data) => {
        setBilling(data);
      })
      .catch((err: Error) => {
        toast.error(err.message ?? 'Failed to load billing data');
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planConfig = billing
    ? (PLANS[billing.plan as PlanKey] ?? PLANS.trial)
    : null;

  const usagePercent = billing?.usagePercent ?? 0;
  const progressColor =
    usagePercent >= 80 ? '#f59e0b' : '#c96442';

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
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    BADGE_COLORS[planConfig.color]
                  }`}
                >
                  <Zap size={13} />
                  {planConfig.label}
                </span>
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
            {billing.plan === 'trial' || billing.plan === 'starter' ? (
              <button className="btn-primary shrink-0">
                Upgrade to Growth →
              </button>
            ) : billing.plan === 'growth' ? (
              <button className="btn-primary shrink-0">
                Upgrade to Pro →
              </button>
            ) : null}
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* AI Minutes Used */}
            <div className="card p-6 space-y-3">
              <p className="text-sm font-medium text-gray-500">AI Minutes Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {billing.minutesUsed.toLocaleString()}
                <span className="text-base font-normal text-gray-400">
                  {' '}/ {billing.minutesIncluded.toLocaleString()}
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
                <p className="text-xs text-gray-400 mt-1.5">{usagePercent}% used</p>
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
            <PlanComparisonCards currentPlan={billing.plan} />
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
