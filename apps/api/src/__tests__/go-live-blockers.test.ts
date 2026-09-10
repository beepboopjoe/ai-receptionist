import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  billingKind,
  computeGoLiveBlockers,
  countsTowardMrr,
  hasOpenOfficeHours,
  planPriceCents,
  resolveIncludedMinutes,
} from '../modules/platform/go-live-blockers.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../modules');

describe('hasOpenOfficeHours', () => {
  it('rejects empty and holiday-only maps', () => {
    expect(hasOpenOfficeHours({})).toBe(false);
    expect(hasOpenOfficeHours({ holidays: ['2026-12-25'] })).toBe(false);
  });

  it('accepts media-stream and dashboard hour shapes', () => {
    expect(hasOpenOfficeHours({ mon: { open: '08:00', close: '17:00' } })).toBe(true);
    expect(hasOpenOfficeHours({ monday: { open: true, start: '09:00', end: '17:00' } })).toBe(true);
    expect(hasOpenOfficeHours({ saturday: { open: false, start: '09:00', end: '13:00' } })).toBe(false);
  });
});

describe('computeGoLiveBlockers', () => {
  it('returns all four blockers on a blank tenant', () => {
    expect(
      computeGoLiveBlockers({
        hasInboundPhone: false,
        hasPendingPort: false,
        voiceName: '',
        officeHours: {},
        transferNumber: '',
      }),
    ).toEqual(['phone', 'voice', 'hours', 'transfer']);
  });

  it('does not treat a pending port as a day-one phone — port is later / optional', () => {
    expect(
      computeGoLiveBlockers({
        hasInboundPhone: false,
        hasPendingPort: true,
        voiceName: 'aurora',
        officeHours: {},
        transferNumber: null,
      }),
    ).toEqual(['phone', 'hours', 'transfer']);
  });

  it('is empty when hard prerequisites are met', () => {
    expect(
      computeGoLiveBlockers({
        hasInboundPhone: true,
        hasPendingPort: false,
        voiceName: 'zenith',
        officeHours: { tue: { open: '09:00', close: '17:00' } },
        transferNumber: '+15551234567',
      }),
    ).toEqual([]);
  });
});

describe('billingKind', () => {
  it('prefers suspended/canceled, then promo, then trial vs paid', () => {
    expect(billingKind({ plan: 'scale', subscriptionStatus: 'suspended', promoTrial: true })).toBe(
      'suspended',
    );
    expect(billingKind({ plan: 'growth', subscriptionStatus: 'canceled', promoTrial: false })).toBe(
      'canceled',
    );
    expect(billingKind({ plan: 'trial', subscriptionStatus: null, promoTrial: false })).toBe('trial');
    expect(billingKind({ plan: 'growth', subscriptionStatus: 'trialing', promoTrial: false })).toBe(
      'trial',
    );
    expect(billingKind({ plan: 'growth', subscriptionStatus: 'active', promoTrial: true })).toBe(
      'promo',
    );
    expect(billingKind({ plan: 'growth', subscriptionStatus: 'active', promoTrial: false })).toBe(
      'paid',
    );
  });
});

describe('plan catalog helpers (shared PLANS, not a stale copy)', () => {
  it('prices current paid tiers and treats unknown / trial as $0', () => {
    expect(planPriceCents('growth')).toBe(19900);
    expect(planPriceCents('scale')).toBe(39900);
    expect(planPriceCents('business')).toBe(59900);
    expect(planPriceCents('trial')).toBe(0);
    expect(planPriceCents('starter')).toBe(0);
  });

  it('resolves included minutes from the live catalog + override', () => {
    expect(resolveIncludedMinutes({ plan: 'growth', minutesOverride: null })).toEqual({
      minutesIncluded: 380,
      unlimited: false,
    });
    expect(resolveIncludedMinutes({ plan: 'scale', minutesOverride: null })).toEqual({
      minutesIncluded: 780,
      unlimited: false,
    });
    expect(resolveIncludedMinutes({ plan: 'enterprise', minutesOverride: null })).toEqual({
      minutesIncluded: 0,
      unlimited: true,
    });
    expect(resolveIncludedMinutes({ plan: 'growth', minutesOverride: 60 })).toEqual({
      minutesIncluded: 60,
      unlimited: false,
    });
  });

  it('keeps promo trials out of MRR', () => {
    expect(countsTowardMrr({ subscriptionStatus: 'active', promoTrial: true })).toBe(false);
    expect(countsTowardMrr({ subscriptionStatus: 'active', promoTrial: false })).toBe(true);
    expect(countsTowardMrr({ subscriptionStatus: 'trialing', promoTrial: false })).toBe(true);
    expect(countsTowardMrr({ subscriptionStatus: 'canceled', promoTrial: false })).toBe(false);
  });
});

describe('platform tenants list exposes beta client fields', () => {
  it('enriches /platform/tenants with phone, last call, blockers, billing', () => {
    const src = readFileSync(join(srcRoot, 'platform/platform.router.ts'), 'utf8');
    expect(src).toContain('lastCallAt');
    expect(src).toContain('goLiveBlockers');
    expect(src).toContain('billingKind');
    expect(src).toContain('usageLedger');
    expect(src).toContain('tenantPhoneNumbers');
    expect(src).toContain('DEFAULT_PUBLIC_GROK_VOICE');
    expect(src).toContain('resolveIncludedMinutes');
    expect(src).toContain('countsTowardMrr');
    expect(src).toContain('/platform/tenants/:id/grant-promo-trial');
    expect(src).not.toContain('starter: 79');
    expect(src).not.toContain('growth: 750');
  });
});
