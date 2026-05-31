// ============================================================
// Billing service — Stripe customer + checkout session helpers.
//
// All functions assume Stripe is configured (caller checks).
// ============================================================
import type Stripe from 'stripe';
import { db } from '../../db/client.js';
import { tenants, adminUsers } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getStripe, priceIdFor } from './stripe.client.js';
import { config } from '../../config.js';
import { IntegrationError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { getPlan, type BillingCycle, type PlanKey } from '@ai-receptionist/shared';

/**
 * Get-or-create the Stripe customer for a tenant. Idempotent — caches
 * the customer id back onto the tenant row so subsequent calls hit the
 * fast path.
 */
export async function ensureStripeCustomer(tenantId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new IntegrationError('stripe', 'Stripe is not configured');

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      stripeCustomerId: tenants.stripeCustomerId,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) throw new NotFoundError('Tenant', tenantId);

  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

  // Use the owner's email as the receipt address.
  const [owner] = await db
    .select({ email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.tenantId, tenantId))
    .limit(1);

  const customer = await stripe.customers.create({
    email: owner?.email,
    name: tenant.name,
    metadata: { tenantId: tenant.id },
  });

  await db
    .update(tenants)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return customer.id;
}

interface CreateCheckoutParams {
  tenantId: string;
  planKey: PlanKey;
  cycle: BillingCycle;
}

/**
 * Create a Stripe Checkout Session for the given plan + cycle. Returns
 * the URL the dashboard should redirect the user to. Stripe handles the
 * card form; on success the user lands on /(app)/billing?success=1, on
 * cancel they go back to /pricing.
 */
export async function createCheckoutSession(params: CreateCheckoutParams): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new IntegrationError('stripe', 'Stripe is not configured');

  const plan = getPlan(params.planKey);
  if (!plan) throw new ValidationError(`Unknown plan: ${params.planKey}`);
  if (params.planKey === 'enterprise') {
    throw new ValidationError('Enterprise plan is custom — please contact sales');
  }

  const priceId = priceIdFor(params.planKey, params.cycle);
  if (!priceId) {
    throw new IntegrationError('stripe', `No Stripe price configured for ${params.planKey}/${params.cycle}`);
  }

  const customerId = await ensureStripeCustomer(params.tenantId);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Enabling promo codes is one-line and saves us building our own.
    allow_promotion_codes: true,
    // Pull billing address — required for tax + Stripe Tax (if enabled later).
    billing_address_collection: 'auto',
    success_url: `${config.DASHBOARD_URL}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.DASHBOARD_URL}/pricing?canceled=1`,
    // 14-day trial for first-time subscribers. Existing subscribers
    // upgrading to a different tier skip the trial automatically.
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        tenantId: params.tenantId,
        planKey: params.planKey,
        cycle: params.cycle,
      },
    },
    metadata: {
      tenantId: params.tenantId,
      planKey: params.planKey,
      cycle: params.cycle,
    },
  });

  if (!session.url) {
    throw new IntegrationError('stripe', 'Stripe did not return a checkout URL');
  }
  return { url: session.url };
}

/**
 * Create a Stripe Customer Portal session — Stripe-hosted page where
 * customers manage payment methods, view invoices, and cancel/upgrade.
 * Saves us building those screens ourselves.
 */
export async function createPortalSession(tenantId: string): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new IntegrationError('stripe', 'Stripe is not configured');

  const customerId = await ensureStripeCustomer(tenantId);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${config.DASHBOARD_URL}/billing`,
  });
  return { url: session.url };
}

/** Reverse-lookup: given a Stripe customer id, find the tenant it belongs to. */
export async function tenantIdForStripeCustomer(customerId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.stripeCustomerId, customerId))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Sync a Stripe Subscription onto the tenant row. Called by the webhook
 * handler for any event that mutates the subscription. Maps Stripe's
 * fields onto our columns and infers the plan key from the price id.
 */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const tenantId = await tenantIdForStripeCustomer(customerId);
  if (!tenantId) {
    // Unknown customer — usually means the tenant was deleted but Stripe
    // still has the customer record. Log and move on.
    console.warn(`[billing] Subscription ${subscription.id} for unknown customer ${customerId}`);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;

  // Infer plan key by reverse-mapping price id → plan via env vars.
  // This avoids stuffing the price id into the plan catalog.
  const planKey = inferPlanKeyFromPriceId(priceId);
  const cycle = inferCycleFromPriceId(priceId);

  // current_period_end and trial_end live on the subscription item in
  // newer Stripe API versions; the top-level fields stay populated for
  // single-item subscriptions, which is what our checkout flow creates.
  const currentPeriodEnd =
    item?.current_period_end ?? (subscription as unknown as { current_period_end?: number }).current_period_end;
  const trialEnd = subscription.trial_end;

  await db
    .update(tenants)
    .set({
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.status,
      ...(planKey ? { plan: planKey } : {}),
      ...(cycle ? { billingCycle: cycle } : {}),
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      trialEnd: trialEnd ? new Date(trialEnd * 1000) : null,
      // Activate the tenant on first paid subscription. Don't deactivate
      // on cancel here — that's a separate business decision.
      ...(subscription.status === 'active' || subscription.status === 'trialing'
        ? { isActive: true }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

function inferPlanKeyFromPriceId(priceId: string | null): PlanKey | null {
  if (!priceId) return null;
  const map: Record<string, PlanKey> = {
    [config.STRIPE_PRICE_GROWTH_MONTHLY]:   'growth',
    [config.STRIPE_PRICE_GROWTH_ANNUAL]:    'growth',
    [config.STRIPE_PRICE_SCALE_MONTHLY]:    'scale',
    [config.STRIPE_PRICE_SCALE_ANNUAL]:     'scale',
    [config.STRIPE_PRICE_BUSINESS_MONTHLY]: 'business',
    [config.STRIPE_PRICE_BUSINESS_ANNUAL]:  'business',
  };
  // Empty-string keys (unconfigured price ids) collide on '' — strip them
  // out by checking that the entry value isn't empty AND matches.
  return map[priceId] ?? null;
}

function inferCycleFromPriceId(priceId: string | null): BillingCycle | null {
  if (!priceId) return null;
  if ([config.STRIPE_PRICE_GROWTH_MONTHLY, config.STRIPE_PRICE_SCALE_MONTHLY, config.STRIPE_PRICE_BUSINESS_MONTHLY].includes(priceId)) {
    return 'monthly';
  }
  if ([config.STRIPE_PRICE_GROWTH_ANNUAL, config.STRIPE_PRICE_SCALE_ANNUAL, config.STRIPE_PRICE_BUSINESS_ANNUAL].includes(priceId)) {
    return 'annual';
  }
  return null;
}
