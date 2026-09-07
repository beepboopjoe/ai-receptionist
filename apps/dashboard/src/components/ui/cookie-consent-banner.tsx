'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import {
  acceptAllCookies,
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_OPEN_EVENT,
  DEFAULT_CONSENT,
  readCookieConsent,
  rejectNonEssentialCookies,
  saveCustomCookies,
  type CookieConsentState,
} from '@/lib/cookie-consent';

type Panel = 'banner' | 'manage' | 'hidden';

export function CookieConsentBanner() {
  const analyticsId = useId();
  const marketingId = useId();
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel>('hidden');
  const [consent, setConsent] = useState<CookieConsentState>(DEFAULT_CONSENT);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });

  useEffect(() => {
    const current = readCookieConsent();
    setConsent(current);
    setDraft({ analytics: current.analytics, marketing: current.marketing });
    setPanel(current.status === 'unknown' ? 'banner' : 'hidden');
    setReady(true);

    function onOpen() {
      const latest = readCookieConsent();
      setConsent(latest);
      setDraft({ analytics: latest.analytics, marketing: latest.marketing });
      setPanel('manage');
    }
    function onChange(e: Event) {
      const next = (e as CustomEvent<CookieConsentState>).detail ?? readCookieConsent();
      setConsent(next);
    }

    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpen);
    window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpen);
      window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
    };
  }, []);

  if (!ready || panel === 'hidden') return null;

  function finish(next: CookieConsentState) {
    setConsent(next);
    setDraft({ analytics: next.analytics, marketing: next.marketing });
    setPanel('hidden');
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed bottom-0 inset-x-0 z-[80] p-4 sm:p-6 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-cream-200 bg-white shadow-xl p-5 sm:p-6">
        <p id="cookie-consent-title" className="font-serif text-lg text-cream-900">
          Cookies &amp; optional analytics
        </p>
        <p className="mt-2 text-sm text-cream-700 leading-relaxed">
          We use essential cookies and local storage to run the site (sign-in, security, and
          remembering this choice). Optional analytics or marketing pixels — if we enable any —
          load only after you accept. See our{' '}
          <Link href="/cookies" className="text-brand-700 underline underline-offset-2">
            Cookie Policy
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-brand-700 underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>

        {panel === 'manage' && (
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">Cookie categories</legend>
            <label className="flex items-start gap-3 rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5">
              <input type="checkbox" checked disabled className="mt-1 rounded border-cream-400" />
              <span>
                <span className="block text-sm font-semibold text-cream-900">Essential</span>
                <span className="block text-xs text-cream-600">
                  Always on. Sign-in, security, and storing this preference.
                </span>
              </span>
            </label>
            <label
              htmlFor={analyticsId}
              className="flex items-start gap-3 rounded-xl border border-cream-200 px-3 py-2.5 cursor-pointer"
            >
              <input
                id={analyticsId}
                type="checkbox"
                checked={draft.analytics}
                onChange={(e) => setDraft((d) => ({ ...d, analytics: e.target.checked }))}
                className="mt-1 rounded border-cream-400 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block text-sm font-semibold text-cream-900">Analytics</span>
                <span className="block text-xs text-cream-600">
                  Helps us understand page usage. Off unless you opt in.
                </span>
              </span>
            </label>
            <label
              htmlFor={marketingId}
              className="flex items-start gap-3 rounded-xl border border-cream-200 px-3 py-2.5 cursor-pointer"
            >
              <input
                id={marketingId}
                type="checkbox"
                checked={draft.marketing}
                onChange={(e) => setDraft((d) => ({ ...d, marketing: e.target.checked }))}
                className="mt-1 rounded border-cream-400 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block text-sm font-semibold text-cream-900">Marketing</span>
                <span className="block text-xs text-cream-600">
                  Advertising pixels (none shipping today). Off unless you opt in.
                </span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => finish(acceptAllCookies())}
            className="inline-flex justify-center rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => finish(rejectNonEssentialCookies())}
            className="inline-flex justify-center rounded-xl border border-cream-300 bg-white hover:bg-cream-50 text-cream-800 text-sm font-semibold px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Reject non-essential
          </button>
          {panel === 'manage' ? (
            <button
              type="button"
              onClick={() => finish(saveCustomCookies(draft))}
              className="inline-flex justify-center rounded-xl border border-cream-300 bg-white hover:bg-cream-50 text-cream-800 text-sm font-semibold px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              Save preferences
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft({ analytics: consent.analytics, marketing: consent.marketing });
                setPanel('manage');
              }}
              className="inline-flex justify-center rounded-xl border border-cream-300 bg-white hover:bg-cream-50 text-cream-800 text-sm font-semibold px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              Manage
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
