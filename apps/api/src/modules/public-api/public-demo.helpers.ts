// ============================================================
// Pure helpers for the public homepage call-me widget.
// Kept separate from the Fastify router so tests don't load config/DB.
// ============================================================

/** NANP: +1 then 10 digits, area code cannot start with 0 or 1. */
export const US_CA_E164 = /^\+1[2-9]\d{9}$/;

const JUNK_EXACT = new Set([
  '1234567890',
  '0123456789',
  '9876543210',
  '0000000000',
  '1111111111',
  '5555555555',
]);

/**
 * Strip formatting and accept 10-digit or 11-digit (leading 1) US/CA numbers.
 * Returns E.164 (+1XXXXXXXXXX) or null if the number is not US/CA.
 */
export function normalizeUsCaPhone(input: string): string | null {
  const digits = (input ?? '').replace(/\D/g, '');
  let national = digits;
  if (national.length === 11 && national.startsWith('1')) {
    national = national.slice(1);
  }
  if (national.length !== 10) return null;
  const e164 = `+1${national}`;
  return US_CA_E164.test(e164) ? e164 : null;
}

/** Fictional / obviously-invalid numbers we refuse to dial. */
export function isJunkDemoNumber(e164: string): boolean {
  const national = e164.replace(/^\+1/, '');
  if (JUNK_EXACT.has(national)) return true;
  if (/^(\d)\1{9}$/.test(national)) return true;
  if (national.slice(3, 6) === '555') return true;
  if (national.startsWith('555')) return true;
  return false;
}

/** Successful call-me only — 1 hour. Failed dials must not consume this. */
export const DEMO_CALL_ME_COOLDOWN_TTL_SECONDS = 60 * 60;

export function demoCallMeCooldownKey(e164: string): string {
  return `demo:call-me:num:${e164}`;
}

/**
 * SETNX reserves the number before Telnyx dial so two tabs cannot place two
 * calls. Keep the key only after Telnyx accepts; otherwise DELETE so a 502
 * (or daily-cap 503) does not lock the visitor out for an hour.
 */
export function shouldKeepCallMeCooldown(dialSucceeded: boolean): boolean {
  return dialSucceeded;
}
