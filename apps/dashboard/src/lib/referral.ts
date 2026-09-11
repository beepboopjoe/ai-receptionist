// ============================================================
// First-party referral attribution (Affiliate v1).
//
// Cookie + localStorage, first-touch wins. Essential/functional —
// credits the affiliate who sent the visitor; not a third-party pixel.
// ============================================================

export const REFERRAL_COOKIE = 'telfin_ref';
export const REFERRAL_STORAGE_KEY = 'referral_code';
export const REFERRAL_MAX_AGE_DAYS = 90;

export function normalizeReferralCode(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return rest.join('=');
      }
    }
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeDays: number): void {
  if (!isBrowser()) return;
  const maxAge = Math.max(0, Math.floor(maxAgeDays * 24 * 60 * 60));
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function clearCookie(name: string): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** Cookie first, then localStorage. */
export function readReferralCode(): string | null {
  const fromCookie = normalizeReferralCode(readCookie(REFERRAL_COOKIE));
  if (fromCookie) return fromCookie;
  if (!isBrowser()) return null;
  try {
    const fromStorage = normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY));
    return fromStorage || null;
  } catch {
    return null;
  }
}

/**
 * Persist a referral code. First-touch: an existing code is kept unless
 * `overwrite` is true (used when the visitor types a code on signup).
 */
export function persistReferralCode(
  raw: string,
  opts?: { overwrite?: boolean }
): string | null {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  const existing = readReferralCode();
  if (existing && !opts?.overwrite) return existing;
  writeCookie(REFERRAL_COOKIE, code, REFERRAL_MAX_AGE_DAYS);
  if (isBrowser()) {
    try {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
    } catch {
      /* quota / private mode */
    }
  }
  return code;
}

export function clearReferralCode(): void {
  clearCookie(REFERRAL_COOKIE);
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function googleAuthUrl(apiBase: string, hint?: string | null): string {
  const base = `${apiBase.replace(/\/$/, '')}/auth/google`;
  const code = readReferralCode() || normalizeReferralCode(hint);
  if (!code) return base;
  return `${base}?ref=${encodeURIComponent(code)}`;
}
