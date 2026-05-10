'use client';
// ============================================================
// Google OAuth completion page.
// Backend redirects here with ?token=…&refresh=…&new=1 after a
// successful Google sign-in. We persist the tokens then route
// the user into the dashboard (or onboarding for new accounts).
// ============================================================
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function GoogleCompletePage() {
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
    router.replace(isNew ? '/onboarding/plan' : '/dashboard');
  }, [params, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-600 mb-4 animate-pulse">
          <span className="text-2xl">🦷</span>
        </div>
        <p className="text-sm text-gray-600">Signing you in with Google…</p>
      </div>
    </div>
  );
}
