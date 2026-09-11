'use client';
// Onboarding hub title. Free / demo accounts are not pushed to go live.
import Link from 'next/link';
import { BRAND_ICON_INITIALS } from '@/lib/brand';
import { usePlan } from '@/lib/usePlan';

export function OnboardingHubHeader() {
  const { isDemoAccount, loading } = usePlan();
  const demo = !loading && isDemoAccount;

  return (
    <div className="text-center mb-10">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 mb-4 text-white font-serif text-2xl">
        {BRAND_ICON_INITIALS}
      </div>
      <h1 className="text-2xl font-bold text-gray-900">
        {demo ? 'Explore Telfin' : 'Set Up Your Telfin'}
      </h1>
      <p className="text-gray-500 mt-1">
        {demo
          ? 'Optional preview of setup. Upgrade when you are ready to go live.'
          : 'Complete these 6 steps to go live'}
      </p>
      {demo && (
        <p className="mt-3 flex items-center justify-center gap-3">
          <Link href="/dashboard" className="text-sm font-semibold text-cream-700 hover:underline">
            Back to dashboard
          </Link>
          <Link href="/billing" className="text-sm font-semibold text-brand-700 hover:underline">
            See plans to go live →
          </Link>
        </p>
      )}
    </div>
  );
}
