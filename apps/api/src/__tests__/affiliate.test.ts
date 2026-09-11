// ============================================================
// Affiliate v1 — attribution, commission math, idempotency.
// Pure helpers + source scans (no DB / Stripe).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeCommissionCents,
  decideAttribution,
  evaluateCommission,
  generateAffiliateCode,
  isDuplicateCommissionError,
  isValidAffiliateCode,
  isWithinCommissionWindow,
  normalizeAffiliateCode,
} from '../modules/affiliates/affiliate.helpers.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashRoot = join(srcRoot, '../../dashboard/src');

describe('normalizeAffiliateCode', () => {
  it('uppercases, trims, and strips interior spaces', () => {
    expect(normalizeAffiliateCode('  joey 20 ')).toBe('JOEY20');
    expect(normalizeAffiliateCode('partner_one')).toBe('PARTNER_ONE');
  });

  it('treats empty as empty', () => {
    expect(normalizeAffiliateCode('')).toBe('');
    expect(normalizeAffiliateCode(null)).toBe('');
  });
});

describe('isValidAffiliateCode', () => {
  it('accepts generated 8-char codes and custom slugs', () => {
    expect(isValidAffiliateCode(generateAffiliateCode())).toBe(true);
    expect(isValidAffiliateCode('JOEY')).toBe(true);
    expect(isValidAffiliateCode('acme-dental')).toBe(true);
  });

  it('rejects short, long, or punctuation-heavy codes', () => {
    expect(isValidAffiliateCode('ab')).toBe(false);
    expect(isValidAffiliateCode('A'.repeat(33))).toBe(false);
    expect(isValidAffiliateCode('bad code!')).toBe(false);
  });
});

describe('first-touch attribution', () => {
  it('sets when the tenant has no affiliate and the code is active', () => {
    expect(
      decideAttribution({
        existingAffiliateId: null,
        lookedUpAffiliateId: 'aff-1',
        affiliateActive: true,
      })
    ).toEqual({ action: 'set', affiliateId: 'aff-1' });
  });

  it('keeps the original affiliate even if a later code is presented', () => {
    expect(
      decideAttribution({
        existingAffiliateId: 'aff-1',
        lookedUpAffiliateId: 'aff-2',
        affiliateActive: true,
      })
    ).toEqual({ action: 'keep', affiliateId: 'aff-1' });
  });

  it('rejects unknown or inactive codes', () => {
    expect(
      decideAttribution({
        existingAffiliateId: null,
        lookedUpAffiliateId: null,
        affiliateActive: false,
      })
    ).toEqual({ action: 'reject' });
    expect(
      decideAttribution({
        existingAffiliateId: null,
        lookedUpAffiliateId: 'aff-1',
        affiliateActive: false,
      })
    ).toEqual({ action: 'reject' });
  });
});

describe('commission math', () => {
  it('takes 20% of a paid invoice by default', () => {
    expect(
      computeCommissionCents({
        invoiceAmountCents: 19900,
        commissionPct: 20,
        flatBountyCents: null,
        priorPaidConversions: 0,
      })
    ).toBe(3980);
  });

  it('pays a flat bounty on the first paid conversion, then percent after', () => {
    expect(
      computeCommissionCents({
        invoiceAmountCents: 19900,
        commissionPct: 20,
        flatBountyCents: 5000,
        priorPaidConversions: 0,
      })
    ).toBe(5000);
    expect(
      computeCommissionCents({
        invoiceAmountCents: 19900,
        commissionPct: 20,
        flatBountyCents: 5000,
        priorPaidConversions: 1,
      })
    ).toBe(3980);
  });

  it('does not commission $0 trial invoices', () => {
    expect(
      computeCommissionCents({
        invoiceAmountCents: 0,
        commissionPct: 20,
        flatBountyCents: 5000,
        priorPaidConversions: 0,
      })
    ).toBe(0);
    expect(
      evaluateCommission({
        invoiceAmountCents: 0,
        hasAffiliate: true,
        affiliateActive: true,
        attributionSignedAt: new Date(),
        commissionMonths: 12,
        commissionPct: 20,
        flatBountyCents: null,
        priorPaidConversions: 0,
        invoicePaidAt: new Date(),
      })
    ).toEqual({ eligible: false, reason: 'unpaid' });
  });

  it('stops percent commissions after the 12-month window', () => {
    const attributed = new Date('2025-01-15T00:00:00.000Z');
    expect(
      isWithinCommissionWindow({
        attributionSignedAt: attributed,
        commissionMonths: 12,
        invoicePaidAt: new Date('2026-01-15T00:00:00.000Z'),
      })
    ).toBe(true);
    expect(
      isWithinCommissionWindow({
        attributionSignedAt: attributed,
        commissionMonths: 12,
        invoicePaidAt: new Date('2026-01-16T00:00:00.000Z'),
      })
    ).toBe(false);
    expect(
      isWithinCommissionWindow({
        attributionSignedAt: attributed,
        commissionMonths: 0,
        invoicePaidAt: new Date('2028-01-01T00:00:00.000Z'),
      })
    ).toBe(true);
  });
});

describe('idempotent conversion errors', () => {
  it('recognizes unique-index collisions from duplicate Stripe deliveries', () => {
    expect(isDuplicateCommissionError(new Error('duplicate key value violates unique constraint "commission_events_invoice_uniq"'))).toBe(true);
    expect(isDuplicateCommissionError(new Error('duplicate key'))).toBe(true);
    expect(isDuplicateCommissionError(new Error('connection refused'))).toBe(false);
  });
});

describe('affiliate v1 wiring', () => {
  it('creates commissions only on invoice.paid with amount_paid > 0', () => {
    const src = readFileSync(join(srcRoot, 'modules/billing/stripe.webhook.ts'), 'utf8');
    expect(src).toContain("case 'invoice.paid'");
    expect(src).toContain('amount_paid > 0');
    expect(src).toContain('recordCommissionEvent');
    expect(src).toContain('Duplicate Stripe event');
  });

  it('keeps the (invoice, affiliate) unique guard in schema + migration', () => {
    const schema = readFileSync(join(srcRoot, 'db/schema.ts'), 'utf8');
    const migration = readFileSync(join(srcRoot, 'db/migrations/0015_affiliates.sql'), 'utf8');
    expect(schema).toContain('stripeInvoiceId');
    expect(schema).toMatch(/invoiceUniq:\s*unique\(\)\.on\(t\.stripeInvoiceId,\s*t\.affiliateId\)/);
    expect(migration).toContain('commission_events_invoice_uniq');
  });

  it('attributes at password signup and Google signup', () => {
    const register = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    const google = readFileSync(join(srcRoot, 'modules/admin/google-auth.service.ts'), 'utf8');
    const oauth = readFileSync(join(srcRoot, 'modules/admin/auth-google.router.ts'), 'utf8');
    expect(register).toContain('referralCode');
    expect(register).toContain('attributeTenant');
    expect(google).toContain('referralCode');
    expect(google).toContain('attributeTenant');
    expect(oauth).toContain('req.query.ref');
  });

  it('exposes platform-admin affiliate CRUD gated by ADMIN_EMAILS', () => {
    const router = readFileSync(join(srcRoot, 'modules/affiliates/affiliate.router.ts'), 'utf8');
    expect(router).toContain("app.get('/admin/affiliates'");
    expect(router).toContain("app.post('/admin/affiliates'");
    expect(router).toContain('/admin/affiliates/:id');
    expect(router).toContain('/admin/commissions/:id/mark-paid');
    expect(router).toContain('requirePlatformAdmin');
  });

  it('ships tracked links, cookie capture, and admin UI', () => {
    const capture = readFileSync(join(dashRoot, 'lib/referral.ts'), 'utf8');
    const layout = readFileSync(join(dashRoot, 'app/layout.tsx'), 'utf8');
    const rPage = readFileSync(join(dashRoot, 'app/r/[code]/page.tsx'), 'utf8');
    const admin = readFileSync(join(dashRoot, 'app/(app)/platform/affiliates/page.tsx'), 'utf8');
    expect(capture).toContain('telfin_ref');
    expect(capture).toContain('first-touch');
    expect(layout).toContain('ReferralCapture');
    expect(rPage).toContain('persistReferralCode');
    expect(admin).toContain('platformApi.listAffiliates');
    expect(admin).toContain('markCommissionPaid');
  });
});
