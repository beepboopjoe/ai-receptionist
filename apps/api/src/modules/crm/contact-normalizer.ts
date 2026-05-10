// ============================================================
// Contact data normalization utilities
// ============================================================
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Normalize a phone number to E.164 format (e.g., "+15555550123").
 * Returns null if the number is invalid.
 */
export function normalizePhone(
  raw: string,
  defaultCountry: 'US' | 'CA' | 'GB' = 'US'
): string | null {
  try {
    if (!raw) return null;
    const cleaned = raw.replace(/[^\d+]/g, '');
    if (!isValidPhoneNumber(cleaned, defaultCountry)) return null;
    const parsed = parsePhoneNumber(cleaned, defaultCountry);
    return parsed.format('E.164');
  } catch {
    return null;
  }
}

/**
 * Normalize name casing: "JOHN DOE" → "John Doe"
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize email to lowercase.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Parse a date string into ISO date format YYYY-MM-DD.
 * Accepts many common formats.
 */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // MM/DD/YYYY
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned);
  if (mdy) {
    const [, month, day, year] = mdy;
    return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
  }

  // MM-DD-YYYY
  const mdy2 = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(cleaned);
  if (mdy2) {
    const [, month, day, year] = mdy2;
    return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
  }

  return null;
}
