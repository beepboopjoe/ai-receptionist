import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  billingKind,
  computeGoLiveBlockers,
  hasOpenOfficeHours,
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

  it('treats a pending port and default aurora as ready except hours/transfer', () => {
    expect(
      computeGoLiveBlockers({
        hasInboundPhone: false,
        hasPendingPort: true,
        voiceName: 'aurora',
        officeHours: {},
        transferNumber: null,
      }),
    ).toEqual(['hours', 'transfer']);
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

describe('platform tenants list exposes beta client fields', () => {
  it('enriches /platform/tenants with phone, last call, blockers, billing', () => {
    const src = readFileSync(join(srcRoot, 'platform/platform.router.ts'), 'utf8');
    expect(src).toContain('lastCallAt');
    expect(src).toContain('goLiveBlockers');
    expect(src).toContain('billingKind');
    expect(src).toContain('tenantPhoneNumbers');
    expect(src).toContain('DEFAULT_PUBLIC_GROK_VOICE');
  });
});
