'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, billingApi } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';
import type { BillingCycle } from '@ai-receptionist/shared';
import {
  clearReferralCode,
  persistReferralCode,
  readReferralCode,
} from '@/lib/referral';
import { GoogleOAuthButton } from '@/components/ui/referral-capture';

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
    if (code) persistReferralCode(code);
    // Pricing-page plan/cycle — signals the user wants to buy immediately
    const plan = params.get('plan');
    const cycle = params.get('cycle');
    if (plan && (plan === 'growth' || plan === 'scale' || plan === 'business')) {
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
type SignupPlanKey = 'trial' | 'growth' | 'scale' | 'business';

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
    key: 'growth',
    name: 'Growth',
    priceDisplay: '$199/mo',
    minutes: '380',
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
    minutes: '780',
    numbers: '5',
    badge: null,
    popular: false,
    note: 'Activates immediately after payment',
    paid: true,
  },
  {
    key: 'business',
    name: 'Business',
    priceDisplay: '$599/mo',
    minutes: '1,100',
    numbers: '10',
    badge: 'High-volume teams',
    popular: false,
    note: 'Activates immediately after payment',
    paid: true,
  },
];

// Derive aiUseCase for the register API from the plan chosen.
// Trial users start inbound-only; every paid tier unlocks outbound too.
function aiUseCaseForPlan(plan: SignupPlanKey): 'inbound' | 'both' {
  return plan === 'trial' ? 'inbound' : 'both';
}

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SignupPlanKey>('growth');
  const [referralInput, setReferralInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Set when user arrives from the pricing page with ?plan=&cycle= — triggers
  // direct Stripe checkout after account creation rather than free trial.
  const [fromPricingPage, setFromPricingPage] = useState(false);
  const [pricingCycle, setPricingCycle] = useState<BillingCycle>('monthly');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const existing = readReferralCode();
    if (existing) setReferralInput(existing);
  }, []);

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

    if (!agreed) {
      setError('Please agree to the Terms, Privacy Policy, and auto-renewal notice.');
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

      const referralCode = (referralInput || readReferralCode() || '').trim();
      const data = await authApi.register({
        businessName,
        email,
        password,
        aiUseCase: aiUseCaseForPlan(selectedPlan),
        ...(preselectedVertical ? { vertical: preselectedVertical } : {}),
        ...(referralCode ? { referralCode } : {}),
      });
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_refresh_token', data.refreshToken);

      // Attribute affiliate — best-effort, never blocks signup
      try {
        if (referralCode) {
          await authApi.attributeAffiliate(referralCode);
          clearReferralCode();
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
          // Checkout failed — fall through to the dashboard; they can upgrade from billing
        }
      }

      // Store the plan preference so the billing page can pre-select it
      if (planInfo.paid) {
        try { localStorage.setItem('signup_plan_preference', selectedPlan); } catch { /* ignore */ }
      }

      // Free account → dashboard. Plan purchase is later via billing/upgrade.
      router.replace('/dashboard');
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
            TF
          </div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">{BRAND_NAME}</h1>
          <p className="text-cream-600 mt-1">Create your account</p>
        </div>

        <div className="card p-8">
          <GoogleOAuthButton label="Sign up with Google" />

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

            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-1">
                Referral code <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="referralCode"
                value={referralInput}
                onChange={(e) => {
                  setReferralInput(e.target.value);
                  if (e.target.value.trim()) persistReferralCode(e.target.value, { overwrite: true });
                }}
                className="w-full rounded-lg border-gray-300 text-sm font-mono uppercase"
                placeholder="If someone referred you"
                autoComplete="off"
              />
            </div>

            <label htmlFor="signup-agree" className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed cursor-pointer">
              <input
                id="signup-agree"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                required
              />
              <span>
                I agree to the{' '}
                <Link href="/terms" className="text-brand-700 underline underline-offset-2">Terms of Service</Link>
                {', '}
                <Link href="/privacy" className="text-brand-700 underline underline-offset-2">Privacy Policy</Link>
                {', and '}
                <Link href="/refunds" className="text-brand-700 underline underline-offset-2">Refund Policy</Link>
                . Paid plans <strong>renew automatically</strong> each billing period until I cancel.
                I understand Telfin is an AI receptionist (not a human) and is not HIPAA-certified
                unless we execute a BAA.
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !agreed}
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

        <p className="text-center text-xs text-gray-500 mt-4">
          Also see our{' '}
          <Link href="/cookies" className="underline hover:text-gray-700">Cookie Policy</Link>
          . These legal pages are compliance templates, not formal legal advice.
        </p>
      </div>
    </div>
  );
}
