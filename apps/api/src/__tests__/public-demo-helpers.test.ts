// ============================================================
// Pure-function tests for the public call-me phone helpers.
// No Fastify / DB — route behavior is env-gated in production.
// ============================================================
import { describe, it, expect } from 'vitest';
import { normalizeUsCaPhone, isJunkDemoNumber, US_CA_E164 } from '../modules/public-api/public-demo.helpers.js';

describe('normalizeUsCaPhone', () => {
  it.each([
    ['4155551234', '+14155551234'],
    ['14155551234', '+14155551234'],
    ['+1 (415) 555-1234', '+14155551234'],
    ['415-555-1234', '+14155551234'],
    ['(604) 555-0199', '+16045550199'],
  ])('accepts %p → %p', (input, expected) => {
    expect(normalizeUsCaPhone(input)).toBe(expected);
  });

  it.each([
    [''],
    ['5551234'],
    ['+442071838750'],
    ['+1'],
    ['0115551234'], // area code cannot start with 0 or 1
    ['1155551234'],
  ])('rejects %p', (input) => {
    expect(normalizeUsCaPhone(input)).toBeNull();
  });
});

describe('US_CA_E164', () => {
  it('matches normalized E.164', () => {
    expect(US_CA_E164.test('+14155551234')).toBe(true);
    expect(US_CA_E164.test('+10155551234')).toBe(false);
    expect(US_CA_E164.test('14155551234')).toBe(false);
  });
});

describe('isJunkDemoNumber', () => {
  it('flags fictional and sequential numbers', () => {
    expect(isJunkDemoNumber('+15555551234')).toBe(true);
    expect(isJunkDemoNumber('+14155551234')).toBe(true); // 555 exchange
    expect(isJunkDemoNumber('+11234567890')).toBe(true);
    expect(isJunkDemoNumber('+10000000000')).toBe(true);
    expect(isJunkDemoNumber('+11111111111')).toBe(true);
  });

  it('allows a plausible NANP mobile', () => {
    expect(isJunkDemoNumber('+14155551212')).toBe(true); // still 555
    expect(isJunkDemoNumber('+14153211212')).toBe(false);
    expect(isJunkDemoNumber('+16043211212')).toBe(false);
  });
});
