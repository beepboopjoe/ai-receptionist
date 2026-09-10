// ============================================================
// Plan allotment for owned phone numbers — pure helpers +
// source scans. No Telnyx / Stripe / DB.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlan } from '@ai-receptionist/shared';
import {
  RETAIL_COST_CENTS,
  DEFAULT_WHOLESALE_CENTS,
  isWithinIncludedAllotment,
  resolveMonthlyCostCents,
  resolveOwnedNumberMonthlyCostCents,
  describePhoneAllotment,
} from '../modules/phone-numbers/phone-allotment.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('isWithinIncludedAllotment', () => {
  it('treats the next slot as included until the plan count is reached', () => {
    expect(isWithinIncludedAllotment(2, 0)).toBe(true);
    expect(isWithinIncludedAllotment(2, 1)).toBe(true);
    expect(isWithinIncludedAllotment(2, 2)).toBe(false);
  });

  it('treats trial (0 included) as always extra', () => {
    expect(isWithinIncludedAllotment(0, 0)).toBe(false);
  });

  it('treats enterprise (-1) as unlimited', () => {
    expect(isWithinIncludedAllotment(-1, 0)).toBe(true);
    expect(isWithinIncludedAllotment(-1, 99)).toBe(true);
  });
});

describe('resolveOwnedNumberMonthlyCostCents', () => {
  it('is $0 while inside the Growth allotment of 2', () => {
    const growth = getPlan('growth')!.includedPhoneNumbers;
    expect(growth).toBe(2);
    expect(
      resolveOwnedNumberMonthlyCostCents({
        includedPhoneNumbers: growth,
        activeOwnedCount: 0,
        numberType: 'local',
        promoTrial: false,
      })
    ).toBe(0);
    expect(
      resolveOwnedNumberMonthlyCostCents({
        includedPhoneNumbers: growth,
        activeOwnedCount: 1,
        numberType: 'toll_free',
        promoTrial: false,
      })
    ).toBe(0);
  });

  it('charges retail $5/$10 only for extras', () => {
    expect(
      resolveOwnedNumberMonthlyCostCents({
        includedPhoneNumbers: 2,
        activeOwnedCount: 2,
        numberType: 'local',
        promoTrial: false,
      })
    ).toBe(RETAIL_COST_CENTS.local);
    expect(
      resolveOwnedNumberMonthlyCostCents({
        includedPhoneNumbers: 2,
        activeOwnedCount: 2,
        numberType: 'toll_free',
        promoTrial: false,
      })
    ).toBe(RETAIL_COST_CENTS.toll_free);
  });

  it('keeps promo wholesale on extras and $0 on included slots', () => {
    expect(
      resolveOwnedNumberMonthlyCostCents({
        includedPhoneNumbers: 5,
        activeOwnedCount: 1,
        numberType: 'local',
        promoTrial: true,
      })
    ).toBe(0);
    expect(
      resolveOwnedNumberMonthlyCostCents({
        includedPhoneNumbers: 5,
        activeOwnedCount: 5,
        numberType: 'local',
        promoTrial: true,
      })
    ).toBe(DEFAULT_WHOLESALE_CENTS.localCents);
    expect(
      resolveOwnedNumberMonthlyCostCents({
        includedPhoneNumbers: 5,
        activeOwnedCount: 5,
        numberType: 'toll_free',
        promoTrial: true,
      })
    ).toBe(DEFAULT_WHOLESALE_CENTS.tollFreeCents);
  });

  it('does not change list extra rates', () => {
    expect(resolveMonthlyCostCents('local', false)).toBe(500);
    expect(resolveMonthlyCostCents('toll_free', false)).toBe(1000);
  });
});

describe('describePhoneAllotment', () => {
  it('matches the customer-facing "X of Y included on {plan}" line', () => {
    expect(
      describePhoneAllotment({
        usedCount: 1,
        includedPhoneNumbers: 2,
        planName: 'Growth',
        extraLocalCents: 500,
        extraTollFreeCents: 1000,
      })
    ).toBe('1 of 2 included on Growth · extras $5/$10/mo');
  });

  it('labels enterprise as unlimited', () => {
    expect(
      describePhoneAllotment({
        usedCount: 3,
        includedPhoneNumbers: -1,
        planName: 'Enterprise',
        extraLocalCents: 500,
        extraTollFreeCents: 1000,
      })
    ).toBe('Unlimited included on Enterprise · extras $5/$10/mo');
  });
});

describe('phone billing wiring (source)', () => {
  it('does not one-shot invoice extras on purchase', () => {
    const src = readFileSync(join(srcRoot, 'modules/phone-numbers/phone.service.ts'), 'utf8');
    expect(src).not.toContain('invoiceItems.create');
    expect(src).toContain('subscriptionItems.create');
    expect(src).toContain('countActiveOwnedNumbers');
    expect(src).toContain('charged=false');
    expect(src).toContain('Follow-up: Stripe recurring phone add-ons');
  });

  it('auto-provisions inbound DIDs at $0 and excludes the outbound pool from allotment', () => {
    const auto = readFileSync(join(srcRoot, 'modules/phone-numbers/auto-provision.service.ts'), 'utf8');
    expect(auto).toContain('monthlyCostCents: 0');
    const purchase = readFileSync(join(srcRoot, 'modules/phone-numbers/phone.service.ts'), 'utf8');
    expect(purchase).toContain("ne(tenantPhoneNumbers.purpose, 'outbound_pool')");
    const pool = readFileSync(join(srcRoot, 'modules/outbound-pool/pool.service.ts'), 'utf8');
    expect(pool).toContain("purpose: 'outbound_pool'");
    expect(pool).toContain('purchaseTenantNumber');
  });

  it('does not enable DEMO_SKIP_COOLDOWN', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
