// ============================================================
// Smoke tests for webhook HMAC signing + verification.
//
// These guard against a class of bug that's silent in development
// (signatures still get sent) but fatal in production (the
// receiver rejects every delivery). The replay-window check is
// also tested because it's the most common implementation mistake.
// ============================================================
import { describe, it, expect } from 'vitest';
import { signPayload, verifySignature } from '../modules/webhooks/webhook.service.js';

const SECRET = 'a'.repeat(64);
const ANOTHER_SECRET = 'b'.repeat(64);

describe('signPayload + verifySignature', () => {
  it('round-trips a typical JSON body', () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ event: 'call.completed', tenantId: 'tnt_x' });
    const header = signPayload(SECRET, ts, body);
    expect(verifySignature(SECRET, body, header)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ event: 'call.completed', tenantId: 'tnt_x' });
    const header = signPayload(SECRET, ts, body);
    const tampered = JSON.stringify({ event: 'call.completed', tenantId: 'tnt_attacker' });
    expect(verifySignature(SECRET, tampered, header)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ event: 'call.completed' });
    const header = signPayload(ANOTHER_SECRET, ts, body);
    expect(verifySignature(SECRET, body, header)).toBe(false);
  });

  it('rejects a stale (replay) signature beyond the maxAge window', () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const body = JSON.stringify({ event: 'call.completed' });
    const header = signPayload(SECRET, tenMinutesAgo, body);
    expect(verifySignature(SECRET, body, header)).toBe(false); // default maxAge = 300s
  });

  it('accepts within the replay window', () => {
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    const body = JSON.stringify({ event: 'call.completed' });
    const header = signPayload(SECRET, oneMinuteAgo, body);
    expect(verifySignature(SECRET, body, header)).toBe(true);
  });

  it('rejects garbage headers without throwing', () => {
    expect(verifySignature(SECRET, 'body', '')).toBe(false);
    expect(verifySignature(SECRET, 'body', 'completely-bogus')).toBe(false);
    expect(verifySignature(SECRET, 'body', 't=abc,v1=def')).toBe(false);
  });
});
