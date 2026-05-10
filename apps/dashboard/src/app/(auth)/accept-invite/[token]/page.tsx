'use client';
// ============================================================
// Accept invitation
//
// /accept-invite/<token> — public page reached from the invite
// email. Looks up the invitation metadata, prompts for a password
// (and optional name), and on success stores the auth tokens and
// lands on the dashboard.
// ============================================================
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { teamApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { BRAND_NAME } from '@/lib/brand';

interface InviteInfo {
  email: string;
  role: string;
  tenantName: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.['token'] as string) ?? '';

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch invitation metadata once on mount. We display tenant name + role
  // so the user has context before setting a password.
  useEffect(() => {
    if (!token) return;
    teamApi.inviteInfo(token).then(setInfo).catch((err) => {
      setLoadError(err instanceof Error ? err.message : 'Invitation not found or expired');
    });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (password !== confirmPassword) {
      setSubmitError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const result = await teamApi.acceptInvite({
        token,
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('auth_refresh_token', result.refreshToken);
      router.replace('/dashboard');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not accept invitation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-4 text-white font-serif text-2xl">
            ar
          </div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">{BRAND_NAME}</h1>
          <p className="text-cream-600 mt-1">Accept your invitation</p>
        </div>

        <div className="card p-8">
          {loadError ? (
            <ErrorView message={loadError} />
          ) : !info ? (
            <LoadingView />
          ) : (
            <>
              <div className="mb-6">
                <p className="text-sm text-gray-700">
                  You&apos;ve been invited to <strong>{info.tenantName}</strong> as a{' '}
                  <strong className="capitalize">{info.role}</strong>.
                </p>
                <p className="text-xs text-gray-500 mt-1">{info.email}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {submitError && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input"
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Set password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
                  {submitting ? 'Accepting…' : 'Accept invitation →'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-cream-600 mt-6">
          Already have an account? <Link href="/login" className="text-brand-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="space-y-4">
      <Skeleton width="w-2/3" height="h-4" />
      <Skeleton width="w-1/2" height="h-3" />
      <Skeleton width="w-full" height="h-10" />
      <Skeleton width="w-full" height="h-10" />
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="text-center space-y-3">
      <p className="font-semibold text-gray-900">Invitation unavailable</p>
      <p className="text-sm text-gray-500">{message}</p>
      <p className="text-xs text-gray-400">Ask the inviter for a fresh link.</p>
      <Link href="/login" className="btn-secondary text-sm inline-flex mt-2">
        Go to sign in
      </Link>
    </div>
  );
}
