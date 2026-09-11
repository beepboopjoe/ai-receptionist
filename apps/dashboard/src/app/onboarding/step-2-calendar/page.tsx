'use client';
import { useRouter } from 'next/navigation';
import { ApiError, integrationsApi, onboardingApi } from '@/lib/api';
import { ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';
import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';

function googleOAuthErrorMessage(code: string): string {
  switch (code) {
    case 'access_denied':
      return 'Google access was denied. You can skip for now and connect later in Settings → Integrations.';
    case 'token_exchange_failed':
      return 'Could not finish Google authorization. Check the Calendar OAuth env vars, then retry.';
    default:
      return `Google Calendar connect failed (${code}). You can skip and connect later.`;
  }
}

export default function Step2CalendarPage() {
  const router = useRouter();
  const vertical = useVertical();
  const { data: status } = useSWR('integrations/google-calendar/status', () =>
    integrationsApi.googleCalendarStatus()
  );
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('google_connected');
    const err = params.get('google_error');
    const rc = params.get('rc');
    if (!ok && !err && !rc) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (ok) {
      setJustConnected(true);
      void mutate('integrations/google-calendar/status');
      void onboardingApi.completeStep(2);
    }
    if (rc === 'connected') {
      void onboardingApi.completeStep(1);
    }
    if (err) setError(googleOAuthErrorMessage(err));
  }, []);

  async function handleSkip() {
    await onboardingApi.completeStep(2);
    router.push('/onboarding/step-3-patients');
  }

  async function handleConnectGoogle() {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await integrationsApi.connectGoogleCalendar('/onboarding/step-2-calendar');
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not start Google Calendar connect. Try again, or skip and set office hours later.'
      );
      setConnecting(false);
    }
  }

  const connected = justConnected || status?.connected;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 2 — Connect Your Calendar</h2>
        <p className="text-sm text-gray-500">
          Connect Google Calendar so the AI can check availability and book {vertical.appointmentNounPlural} in real time.
          You can skip this and go live with office hours only.
        </p>
      </div>

      <div className="space-y-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="text-3xl">📅</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">Google Calendar</p>
              {connected ? (
                <span className="badge badge-green flex items-center gap-1">
                  <CheckCircle size={11} /> Connected
                </span>
              ) : status?.configured === false ? (
                <span className="badge badge-gray">Not configured</span>
              ) : (
                <span className="badge badge-gray">Not connected</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {connected
                ? status?.accountEmail
                  ? `Signed in as ${status.accountEmail}`
                  : 'Connected. The AI will write events when callers book.'
                : 'Connect via Google OAuth (offline refresh token stored per tenant).'}
            </p>
            {error && (
              <p className="text-sm text-red-700 mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {status?.configured === false && !connected && (
              <p className="text-sm text-amber-800 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Calendar OAuth is not set on this server yet. Skip for now — office hours still work — and ask
                the operator to add Google Calendar credentials.
              </p>
            )}
          </div>
          {connected ? (
            <button
              type="button"
              onClick={async () => {
                await onboardingApi.completeStep(2);
                router.push('/onboarding/step-3-patients');
              }}
              className="btn-primary text-sm shrink-0"
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : status?.configured === false ? (
            <button type="button" disabled className="btn-secondary text-sm opacity-60 cursor-not-allowed shrink-0">
              Connect unavailable
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connecting}
              className="btn-primary text-sm shrink-0 flex items-center gap-1.5"
            >
              {connecting ? 'Redirecting…' : 'Connect Google'}
              <ArrowRight size={16} />
            </button>
          )}
        </div>

        <div className="card p-5 flex items-center gap-4 opacity-80">
          <div className="text-3xl">📆</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">Microsoft 365 / Outlook</p>
              <span className="badge badge-gray">Coming soon</span>
            </div>
            <p className="text-sm text-gray-500">Not available yet — use Google Calendar or skip.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={handleSkip} className="text-sm text-gray-400 hover:text-gray-600">
          Skip for now →
        </button>
      </div>
    </div>
  );
}
