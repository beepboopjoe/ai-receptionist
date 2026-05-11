'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';

type AiUseCase = 'inbound' | 'outbound' | 'both';

interface PlanInfo {
  name: string;
  price: string;
}

const PLANS: Record<AiUseCase, PlanInfo> = {
  inbound:  { name: 'Starter', price: '$199/mo' },
  outbound: { name: 'Growth',  price: '$399/mo' },
  both:     { name: 'Growth',  price: '$399/mo' },
};

const USE_CASE_OPTIONS: { value: AiUseCase; label: string; description: string; icon: string; recommended?: boolean }[] = [
  { value: 'inbound', label: 'Answer my calls', description: 'Inbound', icon: '📞' },
  { value: 'outbound', label: 'Call my leads', description: 'Outbound', icon: '📣' },
  { value: 'both', label: 'Both', description: 'Inbound & Outbound', icon: '⚡', recommended: true },
];

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [aiUseCase, setAiUseCase] = useState<AiUseCase>('inbound');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedPlan = PLANS[aiUseCase];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      // If the visitor already picked a vertical on the landing page demo, pass
      // it to register so the tenant is created with the right defaults.
      let preselectedVertical: string | undefined;
      try {
        const v = localStorage.getItem('onboarding_vertical');
        if (v) preselectedVertical = v;
      } catch { /* ignore */ }

      const data = await authApi.register({
        businessName,
        email,
        password,
        aiUseCase,
        ...(preselectedVertical ? { vertical: preselectedVertical } : {}),
      });
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_refresh_token', data.refreshToken);
      router.replace('/onboarding/step-0-industry');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-4 text-white font-serif text-2xl">
            ar
          </div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">{BRAND_NAME}</h1>
          <p className="text-cream-600 mt-1">Create your account</p>
        </div>

        {/* Form */}
        <div className="card p-8">
          {/* Google sign-up */}
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
          <div className="flex items-center gap-3 mb-4">
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

            {/* Business Name */}
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

            {/* Confirm Password */}
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

            {/* AI Use Case selector */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                What do you want AI to do?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {USE_CASE_OPTIONS.map((option) => {
                  const isSelected = aiUseCase === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAiUseCase(option.value)}
                      className={[
                        'relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                        isSelected
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {option.recommended && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Recommended
                        </span>
                      )}
                      <span className="text-2xl">{option.icon}</span>
                      <span className="text-xs font-medium leading-tight">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recommended plan */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Recommended plan</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selectedPlan.name}</p>
              </div>
              <p className="text-lg font-bold text-brand-600">{selectedPlan.price}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center"
            >
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
