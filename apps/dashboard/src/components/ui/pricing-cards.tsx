'use client';
// ============================================================
// Pricing card grid with monthly/annual toggle. Cream theme to
// match /inbound, /outbound, /demo, /pricing.
//
// CTAs always send the visitor to /signup with ?plan + ?cycle so
// the dashboard can resume the upgrade flow after they create
// their account. Authenticated users go through the in-app
// /billing page which calls Stripe Checkout directly.
// ============================================================
import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import type { Plan, BillingCycle } from '@ai-receptionist/shared';

interface PricingCardsProps {
  plans: readonly Plan[];
}

export function PricingCards({ plans }: PricingCardsProps) {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  return (
    <div>
      {/* Cycle toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-white border border-cream-200 rounded-full p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              cycle === 'monthly' ? 'bg-brand-600 text-white' : 'text-cream-600 hover:text-cream-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle('annual')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              cycle === 'annual' ? 'bg-brand-600 text-white' : 'text-cream-600 hover:text-cream-900'
            }`}
          >
            Annual <span className="text-xs ml-1 opacity-80">save 15%</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = cycle === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
          return (
            <div
              key={plan.key}
              className={`rounded-2xl bg-white border p-8 flex flex-col relative shadow-sm ${
                plan.popular ? 'border-brand-400 ring-2 ring-brand-200' : 'border-cream-200'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                  MOST POPULAR
                </span>
              )}

              <div className="mb-6">
                <h2 className="font-serif text-2xl text-cream-900 tracking-tight mb-3">{plan.name}</h2>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-serif text-5xl text-cream-900">${price}</span>
                  <span className="text-cream-500 text-sm">/mo</span>
                </div>
                <p className="text-xs text-cream-500 italic">
                  {cycle === 'annual'
                    ? `Billed yearly at $${price * 12} — save $${(plan.monthlyPrice - plan.annualMonthlyPrice) * 12}/yr`
                    : plan.tagline}
                </p>
                <p className="text-sm text-cream-600 mt-3 leading-relaxed">{plan.description}</p>
              </div>

              <ul className="space-y-3 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-cream-700">
                    <CheckCircle size={15} className="text-brand-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-cream-500 mb-4">
                Overage:{' '}
                <span className="font-semibold text-cream-700">${plan.overagePerMin.toFixed(2)}/min</span>
                {' '}after {plan.monthlyMinutes.toLocaleString()} min
              </p>

              <Link
                href={`/signup?plan=${plan.key}&cycle=${cycle}`}
                className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${
                  plan.popular
                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                    : 'bg-cream-100 hover:bg-cream-200 text-cream-900 border border-cream-200'
                }`}
              >
                Start free trial →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
