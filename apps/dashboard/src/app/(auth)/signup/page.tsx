'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, billingApi } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';
import type { BillingCycle } from '@ai-receptionist/shared';

// Stash the ?ref= attribution code and ?plan=/?cycle= pricing-page params
// in localStorage so they survive the form submission round-trip.
function StashUrlParams({
  onPricingParams,
}: {
  onPricingParams: (plan: string, cycle: BillingCycle) => void;
}) {
  const params = useSearchParams();
  useEffect(() => {
    // Referral code
    const code = params.get('ref');
    if (code) {
      try { localStorage.setItem('referral_code', code); } catch { /* ignore */ }
    }
    // Pricing-page plan/cycle — signals the user wants to buy immediately
    const plan = params.get('plan');
    const cycle = params.get('cycle');
    if (plan && (plan === 'starter' || plan === 'growth' || plan === 'scale')) {
      const validCycle: BillingCycle = cycle === 'annual' ? 'annual' : 'monthly';
      onPricingParams(plan, validCycle);
      try {
        localStorage.setItem('pricing_plan', plan);
        localStorage.setItem('pricing_cycle', validCycle);
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  return null;
}

// ── Plan options shown in the picker ──────────────────────────
type SignupPlanKey = 'trial' | 'starter' | 'growth' | 'scale';

const PLAN_OPTIONS: {
  key: SignupPlanKey;
  name: string;
  priceDisplay: string;
  minutes: string;
  numbers: string;
  badge: string | null;
  popular: boolean;
  note: string;
  paid: boolean;
}[] = [
  {
    key: 'trial',
    name: 'Free Access',
    priceDisplay: 'Free',
    minutes: '10',
    numbers: 'BYO',
    badge: null,
    popular: false,
    note: 'No credit card required',
    paid: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    priceDisplay: '$79/mo',
    minutes: '200',
    numbers: 'BYO',
    badge: 'Solo offices',
    popular: false,
    note: 'Activates immediately after payment',
    paid: true,
  },
  {
    key: 'growth',
    name: 'Growth',
    priceDisplay: '$199/mo',
    minutes: '750',
    numbers: '2',
    badge: 'Most Popular',
    popular: true,
    note: 'Activates immediately after payment',
    paid: true,
  },
  {
    key: 'scale',
    name: 'Scale',
    priceDisplay: '$399/mo',
    minutes: '1,500',
    numbers: '5',
    badge: null,
    popular: false,
    note: 'Activates immediately after payment',
    paid: true,
  },
];

// Derive aiUseCase for the register API from the plan chosen
function aiUseCaseForPlan(plan: SignupPlanKey): 'inbound' | 'both' {
  return plan === 'trial' || plan === 'starter' ? 'inbound' : 'both';
}

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SignupPlanKey>('growth');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Set when user arrives from the pricing page with ?plan=&cycle= — triggers
  // direct Stripe checkout after account creation rather than free trial.
  const [fromPricingPage, setFromPricingPage] = useState(false);
  const [pricingCycle, setPricingCycle] = useState<BillingCycle>('monthly');

  const planInfo = PLAN_OPTIONS.find((p) => p.key === selectedPlan)!;

  function handlePricingParams(plan: string, cycle: BillingCycle) {
    const key = plan as SignupPlanKey;
    if (PLAN_OPTIONS.find((p) => p.key === key)) {
      setSelectedPlan(key);
    }
    setPricingCycle(cycle);
    setFromPricingPage(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      // Carry any vertical hint from the demo page into onboarding defaults
      let preselectedVertical: string | undefined;
      try {
        const v = localStorage.getItem('onboarding_vertical');
        if (v) preselectedVertical = v;
      } catch { /* ignore */ }

      const data = await authApi.register({
        businessName,
        email,
        password,
        aiUseCase: aiUseCaseForPlan(selectedPlan),
        ...(preselectedVertical ? { vertical: preselectedVertical } : {}),
      });
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_refresh_token', data.refreshToken);

      // Attribute affiliate — best-effort, never blocks signup
      try {
        const referralCode = localStorage.getItem('referral_code');
        if (referralCode) {
          await authApi.attributeAffiliate(referralCode);
          localStorage.removeItem('referral_code');
        }
      } catch { /* swallow */ }

      // If the user came from the pricing page with a paid plan selected,
      // send them straight to Stripe Checkout to subscribe immediately.
      if (fromPricingPage && planInfo.paid) {
        try {
          localStorage.removeItem('pricing_plan');
          localStorage.removeItem('pricing_cycle');
          const { url } = await billingApi.checkout(selectedPlan, pricingCycle);
          window.location.href = url;
          return; // navigation happening — don't call router.replace
        } catch {
          // Checkout failed — fall through to onboarding, they can upgrade from billing page
        }
      }

      // Store the plan preference so the billing page can pre-select it
      if (planInfo.paid) {
        try { localStorage.setItem('signup_plan_preference', selectedPlan); } catch { /* ignore */ }
      }

      // Default: start on free trial, billing page handles upgrade
      router.replace('/onboarding/step-0-industry');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <StashUrlParams onPricingParams={handlePricingParams} />
      </Suspense>

      <div className="w-full max-w-md">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-4 text-white font-serif text-2xl">
            ar
          </div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">{BRAND_NAME}</h1>
          <p className="text-cream-600 mt-1">Create your account</p>
        </div>

        <div className="card p-8">
          {/* Google OAuth */}
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/auth/google`}
            className="flex items-center justify-center gap-3 w-full py-2.5 px-4 mb-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </a>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}

            {/* Business name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                Business / practice name
              </label>
              <input
                id="businessName"
                type="text"
                autoComplete="organization"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="input"
                placeholder="My Business"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@practice.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Min. 8 characters"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Re-enter your password"
              />
            </div>

            {/* ── Plan picker ────────────────────────────────── */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Which plan fits you best?</p>
              <p className="text-xs text-gray-400 mb-3">
                {fromPricingPage && planInfo.paid
                  ? "Confirm your plan — you'll continue to secure payment after creating your account."
                  : "Pick a plan. Paid plans charge immediately via Stripe; the free trial activates on signup."}
              </p>

              <div className="space-y-2">
                {PLAN_OPTIONS.map((plan) => {
                  const active = selectedPlan === plan.key;
                  return (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => setSelectedPlan(plan.key)}
                      className={[
                        'w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                        active
                          ? plan.popular
                            ? 'border-brand-600 bg-brand-50'
                            : 'border-brand-500 bg-brand-50/50'
                          : 'border-gray-200 bg-white hover:border-gray-300',
                      ].join(' ')}
                    >
                      {/* Radio dot */}
                      <span className={[
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                        active ? 'border-brand-600 bg-brand-600' : 'border-gray-300 bg-white',
                      ].join(' ')}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>

                      {/* Plan name + badge */}
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${active ? 'text-brand-900' : 'text-gray-800'}`}>
                            {plan.name}
                          </span>
                          {plan.badge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                              plan.popular
                                ? 'bg-brand-600 text-white'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {plan.badge}
                            </span>
                          )}
                        </span>
                        <span className={`text-xs mt-0.5 block ${active ? 'text-brand-700' : 'text-gray-400'}`}>
                          {plan.minutes} min&thinsp;·&thinsp;
                          {plan.numbers === 'BYO'
                            ? 'Bring your own number'
                            : `${plan.numbers} phone ${plan.numbers === '1' ? 'number' : 'numbers'}`}
                          &thinsp;·&thinsp;{plan.note}
                        </span>
                      </span>

                      {/* Price */}
                      <span className={`text-sm font-bold shrink-0 ${
                        plan.paid
                          ? active ? 'text-brand-700' : 'text-gray-700'
                          : active ? 'text-emerald-700' : 'text-emerald-600'
                      }`}>
                        {plan.priceDisplay}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center disabled:opacity-60"
            >
              {loading
                ? (fromPricingPage && planInfo.paid ? 'Redirecting to checkout…' : 'Creating account…')
                : (fromPricingPage && planInfo.paid ? `Create account & subscribe →` : 'Get started free →')}
            </button>

            <p className="text-center text-xs text-gray-400">
              {fromPricingPage && planInfo.paid
                ? `You'll be taken to Stripe to complete your ${planInfo.name} (${planInfo.priceDisplay}) subscription.`
                : planInfo.paid
                  ? `You'll start on the free 10-minute trial; upgrade to ${planInfo.name} (${planInfo.priceDisplay}) any time from the dashboard.`
                  : 'No credit card required. 10 AI minutes to explore.'}
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign in →
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline hover:text-gray-600">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
