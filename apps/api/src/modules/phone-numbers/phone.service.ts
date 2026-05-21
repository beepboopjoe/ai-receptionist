// ============================================================
// Tenant phone-number management.
//
// Search proxies Telnyx, purchase orders + stores the number in
// tenant_phone_numbers and adds a recurring Stripe invoice item
// for the monthly cost. Release reverses both.
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers, tenants } from '../../db/schema.js';
import { and, asc, eq, isNull } from 'drizzle-orm';
import {
  searchAvailableNumbers as telnyxSearch,
  purchaseNumber as telnyxPurchase,
  releaseNumber as telnyxRelease,
  type AvailableNumber,
} from './telnyx.client.js';
import { getStripe } from '../billing/stripe.client.js';
import { config } from '../../config.js';
import { IntegrationError, NotFoundError, ValidationError } from '../../lib/errors.js';

/** Public retail rate per number type, in cents. Mirrors the marketing pricing add-ons. */
const RETAIL_COST_CENTS: Record<'local' | 'toll_free', number> = {
  local: 500,
  toll_free: 1000,
};

/**
 * Resolve the per-month cost in cents for a number type, honoring
 * promo-trial at-cost pricing. Promo-trial tenants pay the wholesale
 * Telnyx rate (configurable via TELNYX_WHOLESALE_*_CENTS env vars)
 * instead of the marked-up retail rate. Used by both the purchase
 * flow and the read endpoint that the dashboard calls to render prices.
 */
export function resolveMonthlyCostCents(
  numberType: 'local' | 'toll_free',
  promoTrial: boolean
): number {
  if (!promoTrial) return RETAIL_COST_CENTS[numberType];
  return numberType === 'toll_free'
    ? config.TELNYX_WHOLESALE_TOLLFREE_CENTS
    : config.TELNYX_WHOLESALE_LOCAL_CENTS;
}

/**
 * Returns the active pricing for a tenant (retail or wholesale) so the
 * dashboard can render correct prices in the buy/release UI.
 */
export async function getNumberPricingForTenant(tenantId: string): Promise<{
  localCents: number;
  tollFreeCents: number;
  isPromoPricing: boolean;
}> {
  const [tenant] = await db
    .select({ promoTrial: tenants.promoTrial })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const isPromo = Boolean(tenant?.promoTrial);
  return {
    localCents: resolveMonthlyCostCents('local', isPromo),
    tollFreeCents: resolveMonthlyCostCents('toll_free', isPromo),
    isPromoPricing: isPromo,
  };
}

export interface OwnedNumber {
  id: string;
  phoneE164: string;
  numberType: 'local' | 'toll_free';
  isPrimary: boolean;
  monthlyCostCents: number;
  purchasedAt: string;
  region: string | null;
}

export async function listTenantNumbers(tenantId: string): Promise<OwnedNumber[]> {
  const rows = await db
    .select()
    .from(tenantPhoneNumbers)
    .where(and(eq(tenantPhoneNumbers.tenantId, tenantId), isNull(tenantPhoneNumbers.releasedAt)))
    .orderBy(asc(tenantPhoneNumbers.purchasedAt));
  return rows.map((r) => ({
    id: r.id,
    phoneE164: r.phoneE164,
    numberType: (r.numberType as 'local' | 'toll_free') ?? 'local',
    isPrimary: r.isPrimary,
    monthlyCostCents: r.monthlyCostCents,
    purchasedAt: r.purchasedAt.toISOString(),
    region: r.region,
  }));
}

export async function searchNumbers(params: {
  areaCode?: string;
  locality?: string;
  type?: 'local' | 'toll_free';
}): Promise<AvailableNumber[]> {
  return telnyxSearch(params);
}

interface PurchaseResult {
  number: OwnedNumber;
  /** True if a Stripe invoice item was created. False if Stripe isn't set up. */
  charged: boolean;
}

export async function purchaseTenantNumber(params: {
  tenantId: string;
  phoneE164: string;
  numberType?: 'local' | 'toll_free';
}): Promise<PurchaseResult> {
  const numberType = params.numberType ?? 'local';

  // Promo-trial tenants pay the wholesale Telnyx rate; everyone else
  // pays the public retail rate.
  const [tenantPricing] = await db
    .select({ promoTrial: tenants.promoTrial })
    .from(tenants)
    .where(eq(tenants.id, params.tenantId))
    .limit(1);
  const isPromo = Boolean(tenantPricing?.promoTrial);
  const monthlyCostCents = resolveMonthlyCostCents(numberType, isPromo);

  // 1. Buy from Telnyx
  const order = await telnyxPurchase(params.phoneE164);

  // 2. Determine if this should be primary (first number a tenant buys = primary)
  const existing = await db
    .select({ id: tenantPhoneNumbers.id })
    .from(tenantPhoneNumbers)
    .where(and(eq(tenantPhoneNumbers.tenantId, params.tenantId), isNull(tenantPhoneNumbers.releasedAt)))
    .limit(1);
  const isFirstNumber = existing.length === 0;

  // 3. Store
  const [row] = await db
    .insert(tenantPhoneNumbers)
    .values({
      tenantId: params.tenantId,
      phoneE164: params.phoneE164,
      telnyxPhoneId: order.telnyxPhoneId,
      country: 'US',
      numberType,
      monthlyCostCents,
      isPrimary: isFirstNumber,
    })
    .returning();
  if (!row) throw new Error('Phone-number insert returned no row');

  // 4. Create the Stripe invoice item so the next subscription invoice
  //    bills $5 (local) or $10 (toll-free) per month. Best-effort:
  //    if Stripe isn't configured or the tenant has no customer id,
  //    skip and let an operator sort it manually.
  let charged = false;
  const [tenant] = await db
    .select({ stripeCustomerId: tenants.stripeCustomerId })
    .from(tenants)
    .where(eq(tenants.id, params.tenantId))
    .limit(1);

  if (tenant?.stripeCustomerId) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.invoiceItems.create({
          customer: tenant.stripeCustomerId,
          amount: monthlyCostCents,
          currency: 'usd',
          description: `Phone number ${params.phoneE164} (${numberType === 'toll_free' ? 'toll-free' : 'local'}) — monthly${isPromo ? ' (promo trial · at cost)' : ''}`,
          metadata: {
            tenantId: params.tenantId,
            phoneNumberId: row.id,
            kind: 'phone_number_monthly',
            pricing: isPromo ? 'wholesale_promo' : 'retail',
          },
        });
        charged = true;
      } catch (err) {
        // Don't roll back the Telnyx purchase — flag for ops attention.
        console.error('[phone-numbers] Stripe invoice item failed:', err);
      }
    }
  }

  return {
    number: {
      id: row.id,
      phoneE164: row.phoneE164,
      numberType: (row.numberType as 'local' | 'toll_free') ?? 'local',
      isPrimary: row.isPrimary,
      monthlyCostCents: row.monthlyCostCents,
      purchasedAt: row.purchasedAt.toISOString(),
      region: row.region,
    },
    charged,
  };
}

export async function releaseTenantNumber(params: {
  tenantId: string;
  numberId: string;
}): Promise<void> {
  const [row] = await db
    .select()
    .from(tenantPhoneNumbers)
    .where(and(eq(tenantPhoneNumbers.id, params.numberId), eq(tenantPhoneNumbers.tenantId, params.tenantId)))
    .limit(1);
  if (!row) throw new NotFoundError('PhoneNumber', params.numberId);
  if (row.releasedAt) throw new ValidationError('Number already released');
  if (!row.telnyxPhoneId) {
    throw new IntegrationError('telnyx', `Number ${row.phoneE164} has no Telnyx phone id — release manually`);
  }

  // 1. Telnyx delete
  await telnyxRelease(row.telnyxPhoneId);

  // 2. Soft-delete locally. Stripe stops billing automatically because
  //    invoice items are one-shots; the next month's invoice won't have
  //    a corresponding line item.
  await db
    .update(tenantPhoneNumbers)
    .set({ releasedAt: new Date(), isPrimary: false, updatedAt: new Date() })
    .where(eq(tenantPhoneNumbers.id, params.numberId));
}
