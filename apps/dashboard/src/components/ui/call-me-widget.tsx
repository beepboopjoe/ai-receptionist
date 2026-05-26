// ============================================================
// CallMeWidget — homepage hero conversion widget.
//
// Visitor enters their phone number → AI calls them within ~5s.
// No signup, no card. Hits POST /api/v1/public/call-me which is
// unauthenticated and rate-limited per IP + globally per day.
//
// States: idle → calling → ringing → error
//   idle    : form visible, accept input
//   calling : POST in flight
//   ringing : success — "Look at your phone"
//   error   : show server message + reset button
// ============================================================
'use client';
import { useState } from 'react';
import { Phone, PhoneCall, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

type Status = 'idle' | 'calling' | 'ringing' | 'error';

/** Format raw user input into +1XXXXXXXXXX as they type. Lenient — accepts
 *  any digit pattern and produces the closest E.164 string we can attempt. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  // If first digit is 1, drop it — we'll re-add as country code
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length === 0) return '';
  if (local.length <= 3) return `(${local}`;
  if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`;
}

/** Turn the user-facing formatted string into E.164 for the API. */
function toE164(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return '';
  return `+1${local}`;
}

export function CallMeWidget() {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const e164 = toE164(phone);
  const validE164 = /^\+1[2-9]\d{9}$/.test(e164);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validE164 || status === 'calling') return;

    setStatus('calling');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/public/call-me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneE164: e164 }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };

      if (res.ok && data.ok) {
        setStatus('ringing');
      } else {
        setStatus('error');
        setErrorMsg(data.message ?? 'Could not place the call. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  }

  function reset() {
    setStatus('idle');
    setErrorMsg('');
  }

  // ── Ringing success state ────────────────────────────────────────
  if (status === 'ringing') {
    return (
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-amber-50 p-6 max-w-md mx-auto text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-brand-600 flex items-center justify-center mb-3 relative">
          <PhoneCall size={26} className="text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        </div>
        <p className="font-serif text-2xl text-cream-900 mb-1">Look at your phone 📞</p>
        <p className="text-sm text-cream-700 mb-4">
          We&apos;re calling you now. Pick up to hear how the AI handles a real conversation.
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-xs font-medium text-brand-700 hover:text-brand-900 underline"
        >
          Try a different number
        </button>
      </div>
    );
  }

  // ── Idle / calling / error states share the form layout ─────────
  return (
    <div className="rounded-2xl border border-brand-200 bg-white shadow-md p-6 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
          <Phone size={15} className="text-brand-600" />
        </div>
        <div className="text-left">
          <p className="font-semibold text-sm text-cream-900">Try it on your phone — free</p>
          <p className="text-[11px] text-cream-500">
            We&apos;ll call you in 5 seconds · No signup · No card
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="(555) 123-4567"
          disabled={status === 'calling'}
          className="flex-1 rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-60"
          aria-label="Your phone number"
        />
        <button
          type="submit"
          disabled={!validE164 || status === 'calling'}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === 'calling' ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Calling…
            </>
          ) : (
            <>
              <PhoneCall size={14} />
              Call me free
            </>
          )}
        </button>
      </form>

      {status === 'error' && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            onClick={reset}
            className="text-red-700 hover:text-red-900 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {status === 'idle' && (
        <p className="mt-3 text-[11px] text-cream-400 flex items-center gap-1.5">
          <CheckCircle size={11} className="text-brand-500" />
          We only call this number once. Your number is not stored or sold.
        </p>
      )}
    </div>
  );
}
