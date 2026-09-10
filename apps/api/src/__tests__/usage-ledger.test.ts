import { describe, it, expect } from 'vitest';
import {
  DEFAULT_USAGE_RATES,
  buildCallUsageEvents,
  buildNumberMonthlyEvent,
  buildSmsUsageEvent,
  estimateGrokCents,
  estimateTelnyxCallCents,
  shouldRecordCallUsage,
  summarizeUsageEvents,
} from '../modules/billing/usage-ledger.js';

const rates = DEFAULT_USAGE_RATES;

describe('shouldRecordCallUsage', () => {
  it('skips zero minutes, demo, and test calls', () => {
    expect(shouldRecordCallUsage({ minutes: 2 })).toBe(true);
    expect(shouldRecordCallUsage({ minutes: 0 })).toBe(false);
    expect(shouldRecordCallUsage({ minutes: 1, isDemo: true })).toBe(false);
    expect(shouldRecordCallUsage({ minutes: 1, direction: 'test' })).toBe(false);
    expect(shouldRecordCallUsage({ minutes: 1, mode: 'self_test' })).toBe(false);
    expect(shouldRecordCallUsage({ minutes: 1, mode: 'demo' })).toBe(false);
  });
});

describe('estimate helpers', () => {
  it('uses inbound vs outbound Telnyx rates and documents Grok as an estimate', () => {
    expect(estimateTelnyxCallCents('inbound', 10, rates)).toBe(3.5);
    expect(estimateTelnyxCallCents('outbound', 10, rates)).toBe(7);
    expect(estimateGrokCents(10, rates)).toBe(60);
    expect(estimateTelnyxCallCents('inbound', 0, rates)).toBe(0);
  });
});

describe('buildCallUsageEvents (write path)', () => {
  it('writes AI minutes + Telnyx + Grok for an AI-handled inbound call', () => {
    const events = buildCallUsageEvents({
      minutes: 2,
      direction: 'inbound',
      callId: 'call-1',
      rates,
    });
    expect(events).not.toBeNull();
    expect(events!.map((e) => e.eventType)).toEqual([
      'ai_minutes',
      'telnyx_inbound',
      'grok_estimate',
    ]);
    expect(events!.find((e) => e.eventType === 'ai_minutes')?.quantity).toBe(2);
    expect(events!.find((e) => e.eventType === 'telnyx_inbound')?.estimatedCents).toBe(0.7);
    expect(events!.find((e) => e.eventType === 'grok_estimate')?.estimatedCents).toBe(12);
    expect(events!.find((e) => e.eventType === 'grok_estimate')?.metadata).toMatchObject({
      estimate: true,
    });
  });

  it('writes Telnyx-only when staff handled the call (forward / overflow connect)', () => {
    const events = buildCallUsageEvents({
      minutes: 3,
      direction: 'inbound',
      callId: 'call-2',
      rates,
      aiHandled: false,
    });
    expect(events!.map((e) => e.eventType)).toEqual(['telnyx_inbound']);
    expect(events![0]?.estimatedCents).toBe(1.05);
  });

  it('returns null for demo / test so the write path is a no-op', () => {
    expect(
      buildCallUsageEvents({
        minutes: 5,
        direction: 'inbound',
        callId: 'demo',
        rates,
        isDemo: true,
      }),
    ).toBeNull();
    expect(
      buildCallUsageEvents({
        minutes: 5,
        direction: 'inbound',
        callId: 'test',
        rates,
        callDirection: 'test',
      }),
    ).toBeNull();
  });

  it('tags outbound minutes as telnyx_outbound', () => {
    const events = buildCallUsageEvents({
      minutes: 1,
      direction: 'outbound',
      callId: 'out-1',
      rates,
    });
    expect(events!.some((e) => e.eventType === 'telnyx_outbound')).toBe(true);
    expect(events!.some((e) => e.eventType === 'telnyx_inbound')).toBe(false);
  });
});

describe('buildSmsUsageEvent / buildNumberMonthlyEvent', () => {
  it('records one SMS at the configured estimate', () => {
    expect(buildSmsUsageEvent('inbound', rates)).toMatchObject({
      eventType: 'telnyx_sms',
      quantity: 1,
      estimatedCents: 0.4,
      direction: 'inbound',
    });
  });

  it('skips $0 included numbers and records extras', () => {
    expect(buildNumberMonthlyEvent(0, '+15551234567')).toBeNull();
    expect(buildNumberMonthlyEvent(500, '+15551234567')).toMatchObject({
      eventType: 'number_monthly',
      estimatedCents: 500,
      metadata: { phoneE164: '+15551234567' },
    });
  });
});

describe('summarizeUsageEvents', () => {
  it('sums persisted events and adds current number monthly — no invented rows', () => {
    const summary = summarizeUsageEvents(
      [
        { eventType: 'ai_minutes', quantity: 12.5, estimatedCents: 0 },
        { eventType: 'telnyx_inbound', quantity: 10, estimatedCents: 3.5 },
        { eventType: 'telnyx_outbound', quantity: 2.5, estimatedCents: 1.75 },
        { eventType: 'telnyx_sms', quantity: 3, estimatedCents: 1.2 },
        { eventType: 'grok_estimate', quantity: 12.5, estimatedCents: 75 },
      ],
      500,
    );
    expect(summary.aiMinutes).toBe(12.5);
    expect(summary.telnyxInboundCents).toBe(3.5);
    expect(summary.telnyxOutboundCents).toBe(1.75);
    expect(summary.telnyxSmsCents).toBe(1.2);
    expect(summary.telnyxSmsCount).toBe(3);
    expect(summary.grokEstimateCents).toBe(75);
    expect(summary.numberMonthlyCents).toBe(500);
    expect(summary.estimatedCogsCents).toBe(581.45);
  });
});
