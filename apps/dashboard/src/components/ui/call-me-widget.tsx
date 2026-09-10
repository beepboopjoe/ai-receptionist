'use client';
// ============================================================
// CallMeWidget — public homepage "we'll call you" demo.
//
// POST /api/v1/public/call-me. Idle → calling → ringing | error.
// If DEMO_* env is missing the API returns 503; we show a clear
// fallback that links to /demo instead of breaking the page.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Phone, PhoneCall, AlertCircle } from 'lucide-react';
import { LANG_CODES, LANGUAGES, type LangCode } from '@/lib/voice-samples';

const API_URL = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

type WidgetStatus = 'idle' | 'calling' | 'ringing' | 'error';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

function formatNational(digits: string): string {
  const d = digits.startsWith('1') && digits.length > 10 ? digits.slice(1) : digits;
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  if (d.length <= 3) return a;
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

function messageForStatus(status: number, fallback: string): string {
  if (status === 503) {
    return "Live call-me isn't set up on this site yet. Hear a sample instead — same Grok voices your callers hear.";
  }
  if (status === 429) {
    return 'Hang on a few seconds, then tap Call me now again if you still want another ring.';
  }
  if (status === 400) return fallback || 'Enter a valid US or Canada mobile number.';
  if (status === 502) return fallback || "We couldn't place the call right now. Hear a sample, or try again in a minute.";
  return fallback || 'Something went wrong. Hear a sample on the demo page instead.';
}

export function CallMeWidget({ compact = false }: { compact?: boolean }) {
  const [raw, setRaw] = useState('');
  const [language, setLanguage] = useState<LangCode>('en');
  const [status, setStatus] = useState<WidgetStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);

  const display = useMemo(() => formatNational(digitsOnly(raw)), [raw]);

  const submit = useCallback(async () => {
    if (status === 'calling') return;
    if (!consented) {
      setError('Check the box to confirm we may call this number for a live AI demo.');
      setStatus('error');
      return;
    }
    setError(null);
    setStatus('calling');

    try {
      const res = await fetch(`${API_URL}/public/call-me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: raw, language }),
      });

      let body: { message?: string; error?: string } = {};
      try {
        body = (await res.json()) as { message?: string; error?: string };
      } catch {
        /* non-JSON (proxy / HTML) — treat as unavailable */
      }

      if (res.ok && body && 'ok' in (body as { ok?: boolean })) {
        setStatus('ringing');
        return;
      }

      setStatus('error');
      setError(messageForStatus(res.status, body.message ?? ''));
    } catch {
      setStatus('error');
      setError("We couldn't reach the demo line. Hear a sample instead — the page still works.");
    }
  }, [raw, language, status, consented]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return (
    <div
      className={`mx-auto w-full max-w-md rounded-2xl border bg-white/90 backdrop-blur text-left shadow-sm ${
        compact ? 'border-cream-200 p-4' : 'border-brand-100 p-5 sm:p-6'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
          <PhoneCall size={18} className="text-brand-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-cream-900">Hear it on your phone</p>
          <p className="text-xs text-cream-500 leading-relaxed">
            Pick a language, then we&apos;ll call you as Telfin in Aurora — US &amp; Canada mobiles. No sign-up.
          </p>
        </div>
      </div>

      {status === 'ringing' ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-800">Calling you now</p>
          <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
            Pick up to talk to Telfin in {LANGUAGES[language].label}. If it doesn’t ring in 20 seconds, check spam / unknown callers.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 text-xs font-semibold text-emerald-800 hover:underline"
          >
            Call again
          </button>
        </div>
      ) : (
        <>
          <fieldset className="mb-3">
            <legend className="text-xs font-medium text-cream-700 mb-1.5">Demo language</legend>
            <div className="flex flex-wrap gap-1.5">
              {LANG_CODES.map((code) => {
                const selected = language === code;
                const meta = LANGUAGES[code];
                return (
                  <label
                    key={code}
                    className={`inline-flex items-center gap-1 cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-1 ${
                      selected
                        ? 'border-brand-400 bg-brand-50 text-brand-800'
                        : 'border-cream-200 bg-white text-cream-600 hover:border-cream-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="call-me-language"
                      value={code}
                      checked={selected}
                      onChange={() => setLanguage(code)}
                      disabled={status === 'calling'}
                      className="sr-only"
                      aria-label={meta.label}
                    />
                    <span aria-hidden>{meta.flag}</span>
                    <span className="hidden sm:inline">{meta.label}</span>
                    <span className="sm:hidden">{code.toUpperCase()}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <label className="sr-only" htmlFor="call-me-phone">
              Mobile number
            </label>
            <input
              id="call-me-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(415) 321-1212"
              value={display}
              onChange={(e) => setRaw(e.target.value)}
              disabled={status === 'calling'}
              className="flex-1 rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-sm text-cream-900 placeholder:text-cream-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={
                status === 'calling' ||
                !consented ||
                digitsOnly(raw).replace(/^1/, '').length < 10
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <Phone size={14} aria-hidden />
              {status === 'calling' ? 'Calling…' : 'Call me now'}
            </button>
          </form>

          <label htmlFor="call-me-consent" className="mt-3 flex items-start gap-2.5 text-xs text-cream-700 leading-relaxed cursor-pointer">
            <input
              id="call-me-consent"
              type="checkbox"
              checked={consented}
              onChange={(e) => {
                setConsented(e.target.checked);
                if (e.target.checked && error) setError(null);
              }}
              className="mt-0.5 rounded border-cream-400 text-brand-600 focus:ring-brand-500"
            />
            <span>
              I request that Telfin place an automated / AI voice call to the number I entered
              for a live receptionist demo. I understand the call may be recorded or
              transcribed, that consent is not required to buy anything, and that I should
              only enter my own number.{' '}
              <Link href="/privacy" className="text-brand-700 underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {status === 'error' && error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-900 leading-relaxed">{error}</p>
                <Link href="/demo" className="inline-block mt-1 text-xs font-semibold text-brand-700 hover:underline">
                  Hear a sample instead →
                </Link>
              </div>
            </div>
          )}

          {status === 'idle' && (
            <p className="mt-2 text-[11px] text-cream-400">
              We’ll hang up if you don’t answer. Tap again after a few seconds if you want another call — we won’t auto-redial.
            </p>
          )}
        </>
      )}
    </div>
  );
}
