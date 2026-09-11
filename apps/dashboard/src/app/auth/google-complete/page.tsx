'use client';
// ============================================================
// Google OAuth completion page.
// Backend redirects here with ?token=…&refresh=…&new=1 after a
// successful Google sign-in. We persist the tokens then route
// the user into the dashboard (or industry onboarding for new accounts).
// ============================================================
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BRAND_ICON_INITIALS } from '@/lib/brand';
import { authApi } from '@/lib/api';
import { clearReferralCode, persistReferralCode, readReferralCode } from '@/lib/referral';

export const dynamic = 'force-dynamic';

function GoogleCompleteInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    const refresh = params.get('refresh');
    const isNew = params.get('new') === '1';
    const error = params.get('error');

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }
    if (!token || !refresh) {
      router.replace('/login?error=missing_token');
      return;
    }
    try {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_refresh_token', refresh);
    } catch {
      // ignore
    }

    const fromUrl = params.get('ref');
    if (fromUrl) persistReferralCode(fromUrl);
    const referralCode = fromUrl || readReferralCode();

    void (async () => {
      if (isNew && referralCode) {
        try {
          await authApi.attributeAffiliate(referralCode);
          clearReferralCode();
        } catch {
          /* best-effort — Google signup already attributed server-side when state carried ref */
        }
      }
      router.replace(isNew ? '/onboarding/step-0-industry' : '/dashboard');
    })();
  }, [params, router]);

  return null;
}

export default function GoogleCompletePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-600 mb-4 animate-pulse text-white font-serif text-lg">
          {BRAND_ICON_INITIALS}
        </div>
        <p className="text-sm text-gray-600">Signing you in with Google…</p>
      </div>
      <Suspense fallback={null}>
        <GoogleCompleteInner />
      </Suspense>
    </div>
  );
}
