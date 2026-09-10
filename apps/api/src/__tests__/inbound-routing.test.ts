import { describe, it, expect } from 'vitest';
import {
  hasStaffDestination,
  isInboundRoutingMode,
  normalizeInboundRoutingMode,
  resolveInboundRoutingAction,
} from '../modules/telephony/inbound-routing.js';

describe('normalizeInboundRoutingMode', () => {
  it('keeps known modes and defaults everything else to ai_always', () => {
    expect(normalizeInboundRoutingMode('after_hours_ai')).toBe('after_hours_ai');
    expect(normalizeInboundRoutingMode('overflow_ai')).toBe('overflow_ai');
    expect(normalizeInboundRoutingMode('ai_always')).toBe('ai_always');
    expect(normalizeInboundRoutingMode('')).toBe('ai_always');
    expect(normalizeInboundRoutingMode(null)).toBe('ai_always');
    expect(normalizeInboundRoutingMode('transfer')).toBe('ai_always');
    expect(isInboundRoutingMode('overflow_ai')).toBe(true);
    expect(isInboundRoutingMode('voicemail')).toBe(false);
  });
});

describe('hasStaffDestination', () => {
  it('accepts E.164 and rejects empty or local formats', () => {
    expect(hasStaffDestination('+15551234567')).toBe(true);
    expect(hasStaffDestination(' +15551234567 ')).toBe(true);
    expect(hasStaffDestination('')).toBe(false);
    expect(hasStaffDestination(null)).toBe(false);
    expect(hasStaffDestination('5551234567')).toBe(false);
    expect(hasStaffDestination('+1')).toBe(false);
  });
});

describe('resolveInboundRoutingAction', () => {
  const staff = '+15551234567';

  it('ai_always always answers with AI', () => {
    expect(resolveInboundRoutingAction({ mode: 'ai_always', isAfterHours: false, staffNumber: staff })).toBe('ai');
    expect(resolveInboundRoutingAction({ mode: 'ai_always', isAfterHours: true, staffNumber: staff })).toBe('ai');
  });

  it('after_hours_ai forwards during hours when a dest exists', () => {
    expect(
      resolveInboundRoutingAction({ mode: 'after_hours_ai', isAfterHours: false, staffNumber: staff }),
    ).toBe('forward_staff');
    expect(
      resolveInboundRoutingAction({ mode: 'after_hours_ai', isAfterHours: true, staffNumber: staff }),
    ).toBe('ai');
  });

  it('after_hours_ai falls back to AI during hours without a dest', () => {
    expect(
      resolveInboundRoutingAction({ mode: 'after_hours_ai', isAfterHours: false, staffNumber: '' }),
    ).toBe('ai');
  });

  it('overflow_ai tries staff when dest exists, otherwise AI', () => {
    expect(
      resolveInboundRoutingAction({ mode: 'overflow_ai', isAfterHours: false, staffNumber: staff }),
    ).toBe('overflow_try_staff');
    expect(
      resolveInboundRoutingAction({ mode: 'overflow_ai', isAfterHours: true, staffNumber: staff }),
    ).toBe('overflow_try_staff');
    expect(
      resolveInboundRoutingAction({ mode: 'overflow_ai', isAfterHours: false, staffNumber: null }),
    ).toBe('ai');
  });
});
