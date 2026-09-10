// ============================================================
// Tenant phone-number management.
//
// Search proxies Telnyx. Purchase orders + stores the number in
// tenant_phone_numbers. Numbers within the plan's included allotment
// are $0. Extras get a Stripe subscription item (recurring) when
// Stripe + a subscription are available; otherwise we still provision
// and set charged=false. Release reverses Telnyx + the add-on item.
// Outbound-pool numbers are never sold or billed here.
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers, tenants } from '../../db/schema.js';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import {
  searchAvailableNumbers as telnyxSearch,
  purchaseNumber as telnyxPurchase,
  releaseNumber as telnyxRelease,
  type AvailableNumber,
} from './telnyx.client.js';
import { getStripe } from '../billing/stripe.client.js';
import { config } from '../../config.js';
import { IntegrationError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { getPlan } from '@ai-receptionist/shared';
import { PENDING_PHONE_E164 } from './inbound-did.js';
import {
  resolveMonthlyCostCents as resolveRateCents,
  resolveOwnedNumberMonthlyCostCents,
} from './phone-allotment.js';
import pino from 'pino';

const logger = pino({ name: 'phone-numbers' });

export {
  RETAIL_COST_CENTS,
  isWithinIncludedAllotment,
  resolveOwnedNumberMonthlyCostCents,
  describePhoneAllotment,
} from './phone-allotment.js';

/**
 * Resolve the per-month *extra* cost in cents for a number type, honoring
 * promo-trial at-cost pricing. Promo-trial tenants pay the wholesale
 * Telnyx rate (configurable via TELNYX_WHOLESALE_*_CENTS env vars)
 * instead of the marked-up retail rate. Used by both the purchase
 * flow and the read endpoint that the dashboard calls to render prices.
 *
 * This is the extra-slot rate only — included allotment slots are $0
 * via resolveOwnedNumberMonthlyCostCents / purchaseTenantNumber.
 */
export function resolveMonthlyCostCents(
  numberType: 'local' | 'toll_free',
  promoTrial: boolean
): number {
  return resolveRateCents(numberType, promoTrial, {
    localCents: config.TELNYX_WHOLESALE_LOCAL_CENTS,
    tollFreeCents: config.TELNYX_WHOLESALE_TOLLFREE_CENTS,
  });
}

/**
 * Active tenant-owned numbers that consume the plan allotment.
 * Excludes outbound-pool (auto-managed, not sold) and failed/pending
 * rows that never became a real DID.
 */
export async function countActiveOwnedNumbers(tenantId: string): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        isNull(tenantPhoneNumbers.releasedAt),
        ne(tenantPhoneNumbers.purpose, 'outbound_pool'),
        ne(tenantPhoneNumbers.provisionStatus, 'failed'),
        ne(tenantPhoneNumbers.phoneE164, PENDING_PHONE_E164)
      )
    );
  return Number(rows[0]?.value ?? 0);
}

export interface NumberPricingForTenant {
  localCents: number;
  tollFreeCents: number;
  isPromoPricing: boolean;
  includedPhoneNumbers: number;
  usedCount: number;
  planKey: string;
  planName: string;
}

/**
 * Returns the active extra-slot pricing for a tenant (retail or
 * wholesale) plus plan allotment so the dashboard can render
 * "X of Y included on {plan} · extras $5/$10/mo".
 */
export async function getNumberPricingForTenant(tenantId: string): Promise<NumberPricingForTenant> {
  const [tenant] = await db
    .select({ promoTrial: tenants.promoTrial, plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const isPromo = Boolean(tenant?.promoTrial);
  const plan = getPlan(tenant?.plan ?? '') ?? getPlan('trial')!;
  const usedCount = await countActiveOwnedNumbers(tenantId);
  return {
    localCents: resolveMonthlyCostCents('local', isPromo),
    tollFreeCents: resolveMonthlyCostCents('toll_free', isPromo),
    isPromoPricing: isPromo,
    includedPhoneNumbers: plan.includedPhoneNumbers,
    usedCount,
    planKey: plan.key,
    planName: plan.name,
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
  purpose: string;
  provisionStatus: 'provisioning' | 'active' | 'failed';
  provisionError: string | null;
}

export async function listTenantNumbers(tenantId: string): Promise<OwnedNumber[]> {
  // Excludes auto-managed outbound-pool numbers — those have their own
  // read-only endpoint (/outbound-pool/numbers) and must never appear in
  // the tenant-managed buy/release list.
  const rows = await db
    .select()
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        isNull(tenantPhoneNumbers.releasedAt),
        ne(tenantPhoneNumbers.purpose, 'outbound_pool')
      )
    )
    .orderBy(asc(tenantPhoneNumbers.purchasedAt));
  return rows.map((r) => ({
    id: r.id,
    phoneE164: r.phoneE164,
    numberType: (r.numberType as 'local' | 'toll_free') ?? 'local',
    isPrimary: r.isPrimary,
    monthlyCostCents: r.monthlyCostCents,
    purchasedAt: r.purchasedAt.toISOString(),
    region: r.region,
    purpose: r.purpose,
    provisionStatus: (r.provisionStatus as 'provisioning' | 'active' | 'failed') ?? 'active',
    provisionError: r.provisionError,
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
  /** True if a recurring Stripe subscription item was created. */
  charged: boolean;
  /** True when this number used an included plan slot (monthlyCostCents = 0). */
  included: boolean;
}

export async function purchaseTenantNumber(params: {
  tenantId: string;
  phoneE164: string;
  numberType?: 'local' | 'toll_free';
}): Promise<PurchaseResult> {
  const numberType = params.numberType ?? 'local';

  const [tenant] = await db
    .select({
      promoTrial: tenants.promoTrial,
      plan: tenants.plan,
      stripeCustomerId: tenants.stripeCustomerId,
      stripeSubscriptionId: tenants.stripeSubscriptionId,
    })
    .from(tenants)
    .where(eq(tenants.id, params.tenantId))
    .limit(1);
  const isPromo = Boolean(tenant?.promoTrial);
  const plan = getPlan(tenant?.plan ?? '') ?? getPlan('trial')!;
  const usedCount = await countActiveOwnedNumbers(params.tenantId);
  const monthlyCostCents = resolveOwnedNumberMonthlyCostCents({
    includedPhoneNumbers: plan.includedPhoneNumbers,
    activeOwnedCount: usedCount,
    numberType,
    promoTrial: isPromo,
    wholesale: {
      localCents: config.TELNYX_WHOLESALE_LOCAL_CENTS,
      tollFreeCents: config.TELNYX_WHOLESALE_TOLLFREE_CENTS,
    },
  });
  const included = monthlyCostCents === 0;

  // 1. Buy from Telnyx — attach to the Call Control app so inbound rings us.
  const order = await telnyxPurchase(params.phoneE164, {
    ...(config.TELNYX_APP_ID ? { connectionId: config.TELNYX_APP_ID } : {}),
    tags: [`tenant:${params.tenantId}`, 'purpose:inbound'],
  });

  // 2. First *owned* (non-pool) number is primary.
  const isFirstNumber = usedCount === 0;

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
      purpose: 'inbound',
      provisionStatus: 'active',
    })
    .returning();
  if (!row) throw new Error('Phone-number insert returned no row');

  // 4. Recurring Stripe add-on for extras only. Best-effort: never
  //    roll back the Telnyx purchase if Stripe is missing or fails.
  let charged = false;
  if (included) {
    logger.info(
      {
        tenantId: params.tenantId,
        phoneE164: params.phoneE164,
        usedCount,
        includedPhoneNumbers: plan.includedPhoneNumbers,
        plan: plan.key,
      },
      'Number is within plan allotment — no Stripe charge'
    );
  } else {
    const attached = await attachRecurringPhoneAddon({
      tenantId: params.tenantId,
      phoneNumberId: row.id,
      phoneE164: params.phoneE164,
      numberType,
      monthlyCostCents,
      isPromo,
      stripeCustomerId: tenant?.stripeCustomerId ?? null,
      stripeSubscriptionId: tenant?.stripeSubscriptionId ?? null,
    });
    charged = attached.charged;
    if (attached.subscriptionItemId) {
      await db
        .update(tenantPhoneNumbers)
        .set({ stripeSubscriptionItemId: attached.subscriptionItemId, updatedAt: new Date() })
        .where(eq(tenantPhoneNumbers.id, row.id));
    }
  }

  if (monthlyCostCents > 0) {
    void import('../billing/usage-ledger.service.js').then(({ recordNumberMonthlyUsage }) =>
      recordNumberMonthlyUsage({
        tenantId: params.tenantId,
        monthlyCostCents,
        phoneE164: params.phoneE164,
      })
    );
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
      purpose: row.purpose,
      provisionStatus: 'active',
      provisionError: null,
    },
    charged,
    included,
  };
}

/**
 * Attach a recurring subscription item for an extra number.
 * Never throws — callers treat failure as charged=false.
 */
export async function attachRecurringPhoneAddon(params: {
  tenantId: string;
  phoneNumberId: string;
  phoneE164: string;
  numberType: 'local' | 'toll_free';
  monthlyCostCents: number;
  isPromo: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}): Promise<{ charged: boolean; subscriptionItemId: string | null }> {
  if (params.monthlyCostCents <= 0) {
    return { charged: false, subscriptionItemId: null };
  }

  const stripe = getStripe();
  if (!stripe) {
    logger.warn(
      { tenantId: params.tenantId, phoneE164: params.phoneE164 },
      'Stripe not configured — extra number provisioned, charged=false. Follow-up: Stripe recurring phone add-ons'
    );
    return { charged: false, subscriptionItemId: null };
  }
  if (!params.stripeCustomerId) {
    logger.warn(
      { tenantId: params.tenantId, phoneE164: params.phoneE164 },
      'No stripeCustomerId — extra number provisioned, charged=false. Follow-up: Stripe recurring phone add-ons'
    );
    return { charged: false, subscriptionItemId: null };
  }
  if (!params.stripeSubscriptionId) {
    logger.warn(
      { tenantId: params.tenantId, phoneE164: params.phoneE164, customerId: params.stripeCustomerId },
      'No stripeSubscriptionId — cannot attach subscription item. Extra number provisioned, charged=false. Follow-up: Stripe recurring phone add-ons'
    );
    return { charged: false, subscriptionItemId: null };
  }

  try {
    const catalogPriceId =
      !params.isPromo && params.numberType === 'toll_free'
        ? config.STRIPE_PRICE_TOLL_FREE_NUMBER
        : !params.isPromo && params.numberType === 'local'
          ? config.STRIPE_PRICE_EXTRA_LOCAL_NUMBER
          : '';

    let priceId = catalogPriceId;
    if (!priceId) {
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: params.monthlyCostCents,
        recurring: { interval: 'month' },
        product_data: {
          name: `Extra ${params.numberType === 'toll_free' ? 'toll-free' : 'local'} phone number`,
        },
        metadata: {
          tenantId: params.tenantId,
          phoneNumberId: params.phoneNumberId,
          kind: 'phone_number_monthly',
          pricing: params.isPromo ? 'wholesale_promo' : 'retail',
        },
      });
      priceId = price.id;
    }

    const item = await stripe.subscriptionItems.create({
      subscription: params.stripeSubscriptionId,
      price: priceId,
      metadata: {
        tenantId: params.tenantId,
        phoneNumberId: params.phoneNumberId,
        phoneE164: params.phoneE164,
        kind: 'phone_number_monthly',
        pricing: params.isPromo ? 'wholesale_promo' : 'retail',
      },
    });

    logger.info(
      {
        tenantId: params.tenantId,
        phoneE164: params.phoneE164,
        subscriptionItemId: item.id,
        monthlyCostCents: params.monthlyCostCents,
      },
      'Attached recurring Stripe subscription item for extra phone number'
    );
    return { charged: true, subscriptionItemId: item.id };
  } catch (err) {
    logger.error(
      { err, tenantId: params.tenantId, phoneE164: params.phoneE164, monthlyCostCents: params.monthlyCostCents },
      'Stripe subscription item failed — number provisioned, charged=false. Follow-up: Stripe recurring phone add-ons'
    );
    return { charged: false, subscriptionItemId: null };
  }
}

async function detachRecurringPhoneAddon(subscriptionItemId: string | null, context: {
  tenantId: string;
  phoneE164: string;
}): Promise<void> {
  if (!subscriptionItemId) return;
  const stripe = getStripe();
  if (!stripe) {
    logger.warn(
      { ...context, subscriptionItemId },
      'Stripe not configured — could not detach phone add-on item. Follow-up: Stripe recurring phone add-ons'
    );
    return;
  }
  try {
    await stripe.subscriptionItems.del(subscriptionItemId);
    logger.info({ ...context, subscriptionItemId }, 'Detached Stripe subscription item for released number');
  } catch (err) {
    logger.error(
      { err, ...context, subscriptionItemId },
      'Stripe subscription item delete failed. Follow-up: Stripe recurring phone add-ons'
    );
  }
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
  if (row.poolAutoManaged) {
    throw new ValidationError(
      'This number is part of your auto-managed outbound pool and cannot be released manually'
    );
  }
  if (row.releasedAt) throw new ValidationError('Number already released');
  if (row.telnyxPhoneId) {
    await telnyxRelease(row.telnyxPhoneId);
  } else if (row.provisionStatus !== 'failed' && row.phoneE164 !== 'pending') {
    throw new IntegrationError('carrier', `Number ${row.phoneE164} has no carrier phone id — release manually`);
  }

  await detachRecurringPhoneAddon(row.stripeSubscriptionItemId, {
    tenantId: params.tenantId,
    phoneE164: row.phoneE164,
  });

  await db
    .update(tenantPhoneNumbers)
    .set({ releasedAt: new Date(), isPrimary: false, updatedAt: new Date() })
    .where(eq(tenantPhoneNumbers.id, params.numberId));
}
