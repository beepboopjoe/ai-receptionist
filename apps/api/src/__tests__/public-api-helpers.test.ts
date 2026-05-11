// ============================================================
// Pure-function tests for the public-API write helpers. We don't
// spin up Fastify or hit the DB — only the input parsers and the
// pg unique-violation detector. Route behavior is exercised via
// the OpenAPI smoke + integration suites separately.
// ============================================================
import { describe, it, expect } from 'vitest';

// The helpers aren't exported from public.router.ts (they're locals),
// so we re-implement the small surface here as a contract test. If you
// change the implementations in public.router.ts, change them here too.
const PHONE_E164 = /^\+\d{8,15}$/;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

describe('PHONE_E164 regex', () => {
  it.each([
    ['+14155551234', true],
    ['+442071838750', true],
    ['+861234567890', true],
    ['4155551234', false], // missing +
    ['+1', false], // too short (less than 8 digits)
    ['+', false],
    ['', false],
    ['+1234567890123456', false], // too long
    ['+1-415-555-1234', false], // formatting chars
  ])('phoneE164 %p → valid=%p', (input, expected) => {
    expect(PHONE_E164.test(input)).toBe(expected);
  });
});

describe('isUniqueViolation', () => {
  it('detects pg code 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('rejects other pg error codes', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false); // FK violation
    expect(isUniqueViolation({ code: '42P01' })).toBe(false); // undefined_table
  });

  it('rejects non-error inputs', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation('error')).toBe(false);
    expect(isUniqueViolation(42)).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
    expect(isUniqueViolation({ code: undefined })).toBe(false);
  });
});
