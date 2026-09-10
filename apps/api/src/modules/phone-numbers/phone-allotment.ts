// ============================================================
// Plan allotment math for tenant-owned (inbound) phone numbers.
//
// Pure helpers — no DB, Stripe, or Telnyx. Owned numbers within
// plan.includedPhoneNumbers are $0. Extras use retail $5/$10 or
// promo wholesale. Outbound-pool numbers are never part of this
// count (callers must exclude them before passing activeOwnedCount).
// ============================================================

/** Public retail rate per extra number type, in cents. */
export const RETAIL_COST_CENTS: Record<'local' | 'toll_free', number> = {
  local: 500,
  toll_free: 1000,
};

/** Default Telnyx wholesale rates (cents) — mirrors config defaults. */
export const DEFAULT_WHOLESALE_CENTS = {
  localCents: 100,
  tollFreeCents: 200,
} as const;

export function isWithinIncludedAllotment(
  includedPhoneNumbers: number,
  activeOwnedCount: number
): boolean {
  if (includedPhoneNumbers < 0) return true; // Enterprise unlimited
  return activeOwnedCount < includedPhoneNumbers;
}

/**
 * Per-month cost for a number type, honoring promo-trial at-cost
 * pricing. Does NOT apply the included allotment — use
 * resolveOwnedNumberMonthlyCostCents for purchase-time pricing.
 */
export function resolveMonthlyCostCents(
  numberType: 'local' | 'toll_free',
  promoTrial: boolean,
  wholesale: { localCents: number; tollFreeCents: number } = DEFAULT_WHOLESALE_CENTS
): number {
  if (!promoTrial) return RETAIL_COST_CENTS[numberType];
  return numberType === 'toll_free' ? wholesale.tollFreeCents : wholesale.localCents;
}

/** Cost of the *next* owned number given current usage vs plan allotment. */
export function resolveOwnedNumberMonthlyCostCents(params: {
  includedPhoneNumbers: number;
  activeOwnedCount: number;
  numberType: 'local' | 'toll_free';
  promoTrial: boolean;
  wholesale?: { localCents: number; tollFreeCents: number };
}): number {
  if (isWithinIncludedAllotment(params.includedPhoneNumbers, params.activeOwnedCount)) {
    return 0;
  }
  return resolveMonthlyCostCents(params.numberType, params.promoTrial, params.wholesale);
}

function dollarsShort(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** Customer-facing allotment line: "X of Y included on Growth · extras $5/$10/mo". */
export function describePhoneAllotment(params: {
  usedCount: number;
  includedPhoneNumbers: number;
  planName: string;
  extraLocalCents: number;
  extraTollFreeCents: number;
}): string {
  const extras = `extras ${dollarsShort(params.extraLocalCents)}/${dollarsShort(params.extraTollFreeCents)}/mo`;
  if (params.includedPhoneNumbers < 0) {
    return `Unlimited included on ${params.planName} · ${extras}`;
  }
  return `${params.usedCount} of ${params.includedPhoneNumbers} included on ${params.planName} · ${extras}`;
}
