// ============================================================
// Lead billing — Phase 12.7.
//
// Reports leads_discovered usage to Stripe for metered billing.
// Same pattern the existing minute-usage meter uses.
//
// Graceful no-op when:
//   - STRIPE_SECRET_KEY is unset (dev / CI)
//   - STRIPE_PRICE_LEADS_DISCOVERED is unset (Stripe configured but
//     metered item not provisioned in the customer's subscription)
//   - The tenant has no Stripe subscription
//   - We can't find a matching subscription_item for the metered price
// ============================================================
import { db } from '../../db/client.js';
import { tenants } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { getStripe } from './stripe.client.js';
import pino from 'pino';

const logger = pino({ name: 'lead-billing' });

/**
 * Report N leads as a metered usage event against the tenant's
 * Stripe subscription. Idempotency is naturally handled by Stripe
 * — repeated calls with the same timestamp are collapsed by Stripe.
 */
export async function reportLeadsDiscoveredUsage(
  tenantId: string,
  leadsCount: number
): Promise<{ ok: boolean; reason?: string }> {
  if (leadsCount <= 0) return { ok: true };

  const stripe = getStripe();
  if (!stripe) {
    logger.debug({ tenantId, leadsCount }, 'Stripe not configured — skipping usage report');
    return { ok: false, reason: 'stripe_not_configured' };
  }

  const priceId = config.STRIPE_PRICE_LEADS_DISCOVERED;
  if (!priceId) {
    logger.debug({ tenantId }, 'STRIPE_PRICE_LEADS_DISCOVERED unset — skipping usage report');
    return { ok: false, reason: 'price_not_configured' };
  }

  const [tenant] = await db
    .select({ subscriptionId: tenants.stripeSubscriptionId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant?.subscriptionId) {
    return { ok: false, reason: 'no_subscription' };
  }

  try {
    // Find the subscription item that points at our metered price.
    const items = await stripe.subscriptionItems.list({
      subscription: tenant.subscriptionId,
      limit: 100,
    });
    const meteredItem = items.data.find((it) => it.price.id === priceId);
    if (!meteredItem) {
      logger.warn(
        { tenantId, subscriptionId: tenant.subscriptionId, priceId },
        'Subscription has no leads_discovered item — usage not reported'
      );
      return { ok: false, reason: 'no_metered_item' };
    }

    await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
      quantity: leadsCount,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    });

    logger.info(
      { tenantId, leadsCount, subscriptionItemId: meteredItem.id },
      'Reported leads_discovered usage to Stripe'
    );
    return { ok: true };
  } catch (err) {
    logger.error({ err, tenantId, leadsCount }, 'Stripe usage report failed');
    return { ok: false, reason: 'stripe_api_error' };
  }
}
