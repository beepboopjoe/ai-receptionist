// ============================================================
// First-party cookie / tracker consent.
// Essential storage (auth, cookie preference) is always on.
// Analytics + marketing scripts must wait for an explicit grant.
// ============================================================

export const COOKIE_CONSENT_STORAGE_KEY = 'telfin_cookie_consent_v1';
export const COOKIE_CONSENT_EVENT = 'telfin:cookie-consent';
export const COOKIE_CONSENT_OPEN_EVENT = 'telfin:open-cookie-settings';

export type ConsentStatus = 'unknown' | 'accepted' | 'rejected' | 'custom';

export interface CookieConsentState {
  status: ConsentStatus;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string | null;
}

export const DEFAULT_CONSENT: CookieConsentState = {
  status: 'unknown',
  essential: true,
  analytics: false,
  marketing: false,
  updatedAt: null,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function readCookieConsent(): CookieConsentState {
  if (!isBrowser()) return DEFAULT_CONSENT;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return DEFAULT_CONSENT;
    const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
    return {
      status: parsed.status === 'accepted' || parsed.status === 'rejected' || parsed.status === 'custom'
        ? parsed.status
        : 'unknown',
      essential: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}

export function writeCookieConsent(next: Omit<CookieConsentState, 'essential' | 'updatedAt'>): CookieConsentState {
  const state: CookieConsentState = {
    ...next,
    essential: true,
    updatedAt: new Date().toISOString(),
  };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: state }));
  }
  return state;
}

export function acceptAllCookies(): CookieConsentState {
  return writeCookieConsent({ status: 'accepted', analytics: true, marketing: true });
}

export function rejectNonEssentialCookies(): CookieConsentState {
  return writeCookieConsent({ status: 'rejected', analytics: false, marketing: false });
}

export function saveCustomCookies(partial: { analytics: boolean; marketing: boolean }): CookieConsentState {
  return writeCookieConsent({
    status: 'custom',
    analytics: partial.analytics,
    marketing: partial.marketing,
  });
}

export function openCookieSettings(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
}

export function hasAnalyticsConsent(state: CookieConsentState = readCookieConsent()): boolean {
  return state.analytics === true;
}
