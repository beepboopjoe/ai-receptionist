// ============================================================
// Dashboard-chat SMS intent + combined call/text parser.
// ============================================================
import { describe, it, expect } from 'vitest';
import { parseDashboardIntent, parseSmsIntent } from '@ai-receptionist/shared';

describe('parseSmsIntent', () => {
  it('parses E.164 plus a follow-up goal', () => {
    const parsed = parseSmsIntent(
      "Text +15551234567 and tell them I'm following up about the quote",
    );
    expect(parsed).toEqual({
      ok: true,
      to: '+15551234567',
      task: "I'm following up about the quote",
    });
  });

  it('parses send-a-text phrasing, goal-is, and a first name', () => {
    const parsed = parseSmsIntent(
      'Send a text to Maria at (212) 555-0100 / goal is confirm Tuesday afternoon',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.to).toBe('+12125550100');
    expect(parsed.task).toBe('confirm Tuesday afternoon');
    expect(parsed.firstName).toBe('Maria');
  });

  it('parses spoken digit words from dictation', () => {
    const parsed = parseSmsIntent(
      'text plus one two one two five five five zero one zero zero and say we are following up about the estimate',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.to).toBe('+12125550100');
    expect(parsed.task.toLowerCase()).toContain('following up about the estimate');
  });

  it('asks for a number when the text verb is present without NANP', () => {
    const parsed = parseSmsIntent('Text them and tell them I am following up');
    expect(parsed).toMatchObject({ ok: false, reason: 'no_number' });
  });

  it('asks for a goal when only a number is present', () => {
    const parsed = parseSmsIntent('Text +1 212-555-0100');
    expect(parsed).toMatchObject({ ok: false, reason: 'no_task' });
  });

  it('does not treat billing questions as a text', () => {
    const parsed = parseSmsIntent('What is on my billing page?');
    expect(parsed).toMatchObject({ ok: false, reason: 'not_a_text' });
  });
});

describe('parseDashboardIntent', () => {
  it('routes text verbs to SMS even if “call” appears later in the goal', () => {
    const parsed = parseDashboardIntent(
      'Text +1 212-555-0100 and tell them to call the office about the quote',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.kind).toBe('sms');
    expect(parsed.to).toBe('+12125550100');
  });

  it('routes call verbs to a call', () => {
    const parsed = parseDashboardIntent(
      'Call +1 212-555-0100 and tell them I’m following up about the quote',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.kind).toBe('call');
  });

  it('does not treat a billing question as an intent', () => {
    const parsed = parseDashboardIntent('What is on my billing page?');
    expect(parsed).toMatchObject({ ok: false, reason: 'not_an_intent' });
    expect(parsed.ok === false && parsed.message).toMatch(/call or text/i);
  });
});
