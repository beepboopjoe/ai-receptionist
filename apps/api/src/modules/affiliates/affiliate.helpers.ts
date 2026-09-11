// ============================================================
// Pure affiliate / referral helpers.
//
// Kept DB-free so attribution, commission math, and Stripe
// idempotency can be unit-tested without Postgres.
// ============================================================

export const DEFAULT_COMMISSION_PCT = 20;
export const DEFAULT_COMMISSION_MONTHS = 12;

/** URL-safe 8-character code. No I/O/0/1 so operators can read it aloud. */
export function generateAffiliateCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Trim, uppercase, strip interior whitespace. */
export function normalizeAffiliateCode(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Custom slugs: 3–32 chars, start with alphanumeric, then A–Z / 0–9 / _ / -.
 * Auto-generated 8-char codes always pass.
 */
export function isValidAffiliateCode(code: string): boolean {
  const normalized = normalizeAffiliateCode(code);
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalized);
}

export function addUtcMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 *  commissionMonths === 0  → lifetime (every paid invoice)
 *  commissionMonths  >  0  → window from attribution timestamp
 *  missing attribution     → treat as eligible (don't silently drop)
 */
export function isWithinCommissionWindow(params: {
  attributionSignedAt: Date | null | undefined;
  commissionMonths: number;
  invoicePaidAt: Date;
}): boolean {
  if (params.commissionMonths <= 0) return true;
  if (!params.attributionSignedAt) return true;
  return params.invoicePaidAt.getTime() <= addUtcMonths(params.attributionSignedAt, params.commissionMonths).getTime();
}

/**
 * Paid conversion only: amount_paid must be > 0 (skips $0 Stripe trial
 * invoices). First paid invoice may use a flat bounty; later invoices
 * in the window use commissionPct.
 */
export function computeCommissionCents(params: {
  invoiceAmountCents: number;
  commissionPct: number;
  flatBountyCents: number | null | undefined;
  priorPaidConversions: number;
}): number {
  if (params.invoiceAmountCents <= 0) return 0;
  const bounty = params.flatBountyCents ?? 0;
  if (params.priorPaidConversions <= 0 && bounty > 0) {
    return bounty;
  }
  return Math.round(params.invoiceAmountCents * (params.commissionPct / 100));
}

export function isDuplicateCommissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('commission_events_invoice_uniq') ||
    msg.includes('duplicate key') ||
    msg.includes('unique constraint')
  );
}

export type AttributionDecision =
  | { action: 'reject' }
  | { action: 'keep'; affiliateId: string }
  | { action: 'set'; affiliateId: string };

/**
 * First-touch wins. Unknown / inactive codes are rejected. A second
 * call with any code on an already-attributed tenant is a no-op keep.
 */
export function decideAttribution(params: {
  existingAffiliateId: string | null | undefined;
  lookedUpAffiliateId: string | null | undefined;
  affiliateActive: boolean;
}): AttributionDecision {
  if (!params.lookedUpAffiliateId || !params.affiliateActive) {
    return { action: 'reject' };
  }
  if (params.existingAffiliateId) {
    return { action: 'keep', affiliateId: params.existingAffiliateId };
  }
  return { action: 'set', affiliateId: params.lookedUpAffiliateId };
}

export type CommissionEligibility =
  | { eligible: false; reason: 'unpaid' | 'inactive' | 'unattributed' | 'outside_window' | 'zero_commission' }
  | { eligible: true; commissionCents: number };

export function evaluateCommission(params: {
  invoiceAmountCents: number;
  hasAffiliate: boolean;
  affiliateActive: boolean;
  attributionSignedAt: Date | null | undefined;
  commissionMonths: number;
  commissionPct: number;
  flatBountyCents: number | null | undefined;
  priorPaidConversions: number;
  invoicePaidAt: Date;
}): CommissionEligibility {
  if (params.invoiceAmountCents <= 0) return { eligible: false, reason: 'unpaid' };
  if (!params.hasAffiliate) return { eligible: false, reason: 'unattributed' };
  if (!params.affiliateActive) return { eligible: false, reason: 'inactive' };
  if (
    !isWithinCommissionWindow({
      attributionSignedAt: params.attributionSignedAt,
      commissionMonths: params.commissionMonths,
      invoicePaidAt: params.invoicePaidAt,
    })
  ) {
    return { eligible: false, reason: 'outside_window' };
  }
  const commissionCents = computeCommissionCents({
    invoiceAmountCents: params.invoiceAmountCents,
    commissionPct: params.commissionPct,
    flatBountyCents: params.flatBountyCents,
    priorPaidConversions: params.priorPaidConversions,
  });
  if (commissionCents <= 0) return { eligible: false, reason: 'zero_commission' };
  return { eligible: true, commissionCents };
}
