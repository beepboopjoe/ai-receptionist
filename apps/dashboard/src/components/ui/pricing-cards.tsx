'use client';
// ============================================================
// Pricing card grid with monthly/annual toggle.
// Handles all 4 purchasable plans (Starter → Enterprise).
// Enterprise renders a "Contact Sales" CTA instead of checkout.
// ============================================================
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle, Mail } from 'lucide-react';
import type { Plan, BillingCycle } from '@ai-receptionist/shared';
import { billingApi } from '@/lib/api';

interface PricingCardsProps {
  plans: readonly Plan[];
}

const BADGE_STYLES: Record<string, string> = {
  'Best for solo offices':   'bg-blue-50   text-blue-700   border-blue-200',
  'Most Popular':            'bg-brand-50  text-brand-700  border-brand-200',
  'Best for growing teams':  'bg-purple-50 text-purple-700 border-purple-200',
  'Custom volume':           'bg-amber-50  text-amber-700  border-amber-200',
};

export function PricingCards({ plans }: PricingCardsProps) {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkoutingPlan, setCheckoutingPlan] = useState<string | null>(null);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('auth_token'));
  }, []);

  async function handleCheckout(planKey: string) {
    setCheckoutingPlan(planKey);
    try {
      const { url } = await billingApi.checkout(planKey, cycle);
      window.location.href = url;
    } catch {
      setCheckoutingPlan(null);
    }
  }

  return (
    <div>
      {/* Cycle toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex bg-white border border-cream-200 rounded-full p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              cycle === 'monthly' ? 'bg-brand-600 text-white shadow-sm' : 'text-cream-600 hover:text-cream-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle('annual')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              cycle === 'annual' ? 'bg-brand-600 text-white shadow-sm' : 'text-cream-600 hover:text-cream-900'
            }`}
          >
            Annual <span className="text-xs ml-1 opacity-70">save 15%</span>
          </button>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const isEnterprise = plan.key === 'enterprise';
          const isFree = plan.key === 'trial';
          const price = isEnterprise || isFree
            ? null
            : cycle === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;

          const badgeStyle = plan.badge ? BADGE_STYLES[plan.badge] ?? 'bg-gray-50 text-gray-600 border-gray-200' : null;

          return (
            <div
              key={plan.key}
              className={`rounded-2xl border p-7 flex flex-col relative ${
                plan.popular
                  ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-200 shadow-lg'
                  : isEnterprise
                    ? 'border-cream-200 bg-cream-900 text-white'
                    : 'border-cream-200 bg-white shadow-sm'
              }`}
            >
              {/* Popular top pill */}
              {plan.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[11px] font-bold px-4 py-1.5 rounded-full shadow-md tracking-wide uppercase">
                  Most Popular
                </span>
              )}

              {/* Badge */}
              {plan.badge && !plan.popular && (
                <span className={`self-start text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider mb-3 ${badgeStyle}`}>
                  {plan.badge}
                </span>
              )}

              {/* Plan name */}
              <h2 className={`font-serif text-2xl tracking-tight mb-2 ${isEnterprise ? 'text-white' : 'text-cream-900'}`}>
                {plan.name}
              </h2>

              {/* Price */}
              <div className="mb-1">
                {isEnterprise ? (
                  <span className={`font-serif text-4xl font-black ${isEnterprise ? 'text-white' : 'text-cream-900'}`}>
                    Custom
                  </span>
                ) : isFree ? (
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-4xl font-black text-cream-900">$0</span>
                    <span className="text-cream-500 text-sm">/mo</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-4xl font-black text-cream-900">${price}</span>
                    <span className="text-cream-500 text-sm">/mo</span>
                  </div>
                )}
              </div>

              {/* Annual savings note */}
              {!isEnterprise && !isFree && cycle === 'annual' && (
                <p className="text-xs text-brand-600 font-medium mb-3">
                  Billed ${(plan.annualMonthlyPrice * 12).toLocaleString()}/yr — save ${((plan.monthlyPrice - plan.annualMonthlyPrice) * 12).toLocaleString()}
                </p>
              )}

              <p className={`text-xs mt-1 mb-5 leading-relaxed ${isEnterprise ? 'text-cream-300' : 'text-cream-500'}`}>
                {plan.tagline}
              </p>

              {/* Included minutes + numbers highlight */}
              {!isEnterprise && (
                <div className={`rounded-xl p-3 mb-5 flex gap-4 text-center ${
                  plan.popular ? 'bg-brand-100/60' : isFree ? 'bg-cream-100' : 'bg-cream-50 border border-cream-200'
                }`}>
                  <div className="flex-1">
                    <p className="text-lg font-black text-cream-900">
                      {plan.monthlyMinutes === -1 ? '∞' : plan.monthlyMinutes.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-cream-500 font-medium uppercase tracking-wide">AI minutes</p>
                  </div>
                  <div className="w-px bg-cream-200" />
                  <div className="flex-1">
                    <p className="text-lg font-black text-cream-900">
                      {plan.includedPhoneNumbers === -1 ? '∞' : plan.includedPhoneNumbers}
                    </p>
                    <p className="text-[10px] text-cream-500 font-medium uppercase tracking-wide">
                      {plan.includedPhoneNumbers === 1 ? 'phone #' : 'phone #s'}
                    </p>
                  </div>
                </div>
              )}

              {/* Features */}
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${isEnterprise ? 'text-cream-200' : 'text-cream-700'}`}>
                    <CheckCircle size={14} className={`shrink-0 mt-0.5 ${isEnterprise ? 'text-brand-400' : 'text-brand-500'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Overage note — de-emphasized */}
              {!isEnterprise && !isFree && plan.overagePerMin > 0 && (
                <p className={`text-[11px] mb-4 ${plan.popular ? 'text-brand-600/70' : 'text-cream-400'}`}>
                  Extra minutes billed at ${plan.overagePerMin.toFixed(2)}/min · Extra numbers $5/mo each
                </p>
              )}

              {/* CTA */}
              {isEnterprise ? (
                <a
                  href="mailto:hello@aireceptionist.ai"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors bg-white/10 hover:bg-white/20 text-white border border-white/20"
                >
                  <Mail size={14} /> Contact Sales
                </a>
              ) : isLoggedIn ? (
                <button
                  onClick={() => void handleCheckout(plan.key)}
                  disabled={checkoutingPlan === plan.key}
                  className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 ${
                    plan.popular
                      ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20'
                      : 'bg-cream-100 hover:bg-cream-200 text-cream-900 border border-cream-200'
                  }`}
                >
                  {checkoutingPlan === plan.key ? 'Redirecting to checkout…' : 'Subscribe Now →'}
                </button>
              ) : (
                <Link
                  href={`/signup?plan=${plan.key}&cycle=${cycle}`}
                  className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${
                    plan.popular
                      ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20'
                      : 'bg-cream-100 hover:bg-cream-200 text-cream-900 border border-cream-200'
                  }`}
                >
                  Subscribe Now →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
