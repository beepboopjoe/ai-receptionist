// ============================================================
// Dashboard-chat call-intent parser — typed + spoken NANP.
// ============================================================
import { describe, it, expect } from 'vitest';
import { formatNanpDisplay, normalizeNanp, parseCallIntent } from '@ai-receptionist/shared';

describe('normalizeNanp', () => {
  it('accepts 10-digit, 11-digit, and E.164 US/CA numbers', () => {
    expect(normalizeNanp('5551234567')).toBe('+15551234567');
    expect(normalizeNanp('15551234567')).toBe('+15551234567');
    expect(normalizeNanp('+15551234567')).toBe('+15551234567');
    expect(normalizeNanp('(555) 123-4567')).toBe('+15551234567');
    expect(normalizeNanp('212-555-0100')).toBe('+12125550100');
    expect(normalizeNanp('123')).toBeNull();
    expect(normalizeNanp('05551234567')).toBeNull();
  });
});

describe('parseCallIntent', () => {
  it('parses E.164 plus a follow-up goal', () => {
    const parsed = parseCallIntent(
      "Call +15551234567 and tell them I'm following up about the quote",
    );
    expect(parsed).toEqual({
      ok: true,
      to: '+15551234567',
      task: "I'm following up about the quote",
    });
  });

  it('parses formatted numbers, goal-is phrasing, and a contact first name', () => {
    const parsed = parseCallIntent(
      'Call Maria at (212) 555-0100 / goal is confirm Tuesday afternoon',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.to).toBe('+12125550100');
    expect(parsed.task).toBe('confirm Tuesday afternoon');
    expect(parsed.firstName).toBe('Maria');
  });

  it('parses spoken digit words from dictation', () => {
    const parsed = parseCallIntent(
      'call plus one two one two five five five zero one zero zero and say we are following up about the estimate',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.to).toBe('+12125550100');
    expect(parsed.task.toLowerCase()).toContain('following up about the estimate');
  });

  it('asks for a number when the call verb is present without NANP', () => {
    const parsed = parseCallIntent('Call them and tell them I am following up');
    expect(parsed).toMatchObject({ ok: false, reason: 'no_number' });
  });

  it('asks for a goal when only a number is present', () => {
    const parsed = parseCallIntent('Call +1 212-555-0100');
    expect(parsed).toMatchObject({ ok: false, reason: 'no_task' });
  });

  it('does not treat billing questions as a call', () => {
    const parsed = parseCallIntent('What is on my billing page?');
    expect(parsed).toMatchObject({ ok: false, reason: 'not_a_call' });
    expect(parsed.ok === false && parsed.message).toMatch(/place a call/i);
  });

  it('formats E.164 for confirmation copy', () => {
    expect(formatNanpDisplay('+12125550100')).toBe('+1 212-555-0100');
  });
});
