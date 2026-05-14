// ============================================================
// Billing routes — JWT-gated. Lets the dashboard:
//   - POST /billing/checkout — start a Stripe Checkout session
//   - POST /billing/portal   — open the Stripe Customer Portal
//   - GET  /billing/subscription — current plan + status + period
//
// The webhook endpoint (/webhooks/stripe) lives in stripe.webhook.ts
// because it needs raw-body parsing for signature verification.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { tenants } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { createCheckoutSession, createPortalSession, ensureStripeCustomer } from './billing.service.js';
import { getCurrentUsage } from './usage.service.js';
import { getStripe } from './stripe.client.js';
import { PLANS, getPlan, type PlanKey, type BillingCycle } from '@ai-receptionist/shared';
import { config } from '../../config.js';

export async function billingPlugin(app: FastifyInstance): Promise<void> {
  // Public — used by the pricing page / billing page to render plan data
  // without relying on the dashboard having its own duplicate copy.
  app.get('/billing/plans', async (_req, reply) => {
    return reply.send({ plans: PLANS });
  });

  // ── Start Checkout (owner/admin only) ───────────────────────
  app.post('/billing/checkout', { onRequest: [app.requireRole('admin')] }, async (request, reply) => {
    if (!getStripe()) {
      return reply.code(503).send({
        error: 'Stripe not configured',
        message: 'STRIPE_SECRET_KEY is not set on the API. See docs/STRIPE_SETUP.md.',
      });
    }

    const { planKey, cycle } = (request.body ?? {}) as { planKey?: string; cycle?: string };
    if (!planKey || !getPlan(planKey)) {
      throw new ValidationError(`Invalid planKey. Valid: ${PLANS.map((p) => p.key).join(', ')}`);
    }
    if (cycle !== 'monthly' && cycle !== 'annual') {
      throw new ValidationError('cycle must be "monthly" or "annual"');
    }

    const session = await createCheckoutSession({
      tenantId: request.user!.tenantId,
      planKey: planKey as PlanKey,
      cycle: cycle as BillingCycle,
    });
    return reply.send(session);
  });

  // ── Open Customer Portal (owner/admin only) ─────────────────
  app.post('/billing/portal', { onRequest: [app.requireRole('admin')] }, async (request, reply) => {
    if (!getStripe()) {
      return reply.code(503).send({
        error: 'Stripe not configured',
        message: 'STRIPE_SECRET_KEY is not set on the API. See docs/STRIPE_SETUP.md.',
      });
    }
    const session = await createPortalSession(request.user!.tenantId);
    return reply.send(session);
  });

  // ── Current period usage ────────────────────────────────────
  // Returns minutes used vs included for the active billing window,
  // with overage and pct_used precomputed so the dashboard can
  // render the progress bar without doing math.
  app.get('/billing/usage', { onRequest: [app.requireRole('staff')] }, async (request, reply) => {
    const usage = await getCurrentUsage(request.user!.tenantId);
    if (!usage) throw new NotFoundError('Tenant', request.user!.tenantId);
    return reply.send(usage);
  });

  // ── Voice Clone Add-on Checkout ($49/mo) ───────────────────
  // Creates a Stripe Checkout session for the voice clone add-on.
  // On success Stripe fires customer.subscription.updated → webhook
  // sets tenants.voice_clone_addon = true.
  app.post('/billing/voice-clone/checkout', { onRequest: [app.requireRole('admin')] }, async (request, reply) => {
    const stripe = getStripe();
    if (!stripe) {
      return reply.code(503).send({
        error: 'Stripe not configured',
        message: 'STRIPE_SECRET_KEY is not set on the API.',
      });
    }

    const priceId = config.STRIPE_PRICE_VOICE_CLONE_MONTHLY;
    if (!priceId) {
      return reply.code(503).send({
        error: 'Voice clone add-on not configured',
        message: 'STRIPE_PRICE_VOICE_CLONE_MONTHLY is not set on the API. Create the product in Stripe and add the price_id.',
      });
    }

    // Check if already subscribed
    const [tenant] = await db
      .select({ voiceCloneAddon: tenants.voiceCloneAddon })
      .from(tenants)
      .where(eq(tenants.id, request.user!.tenantId))
      .limit(1);
    if (!tenant) throw new NotFoundError('Tenant', request.user!.tenantId);
    if (tenant.voiceCloneAddon) {
      return reply.code(409).send({ error: 'already_subscribed', message: 'Voice clone add-on is already active on this account.' });
    }

    const customerId = await ensureStripeCustomer(request.user!.tenantId);
    const dashboardUrl = config.DASHBOARD_URL;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${dashboardUrl}/settings/voice-agent?addon=activated`,
      cancel_url:  `${dashboardUrl}/settings/voice-agent?addon=cancelled`,
      metadata: { tenantId: request.user!.tenantId, addonType: 'voice_clone' },
    });

    return reply.send({ url: session.url });
  });

  // ── Cancel Voice Clone Add-on ──────────────────────────────
  // Opens the Stripe Customer Portal so the tenant can cancel.
  app.post('/billing/voice-clone/cancel', { onRequest: [app.requireRole('admin')] }, async (request, reply) => {
    if (!getStripe()) return reply.code(503).send({ error: 'Stripe not configured' });
    const session = await createPortalSession(request.user!.tenantId);
    return reply.send(session);
  });

  // ── Voice Clone Add-on status ──────────────────────────────
  app.get('/billing/voice-clone', { onRequest: [app.requireRole('staff')] }, async (request, reply) => {
    const [tenant] = await db
      .select({ voiceCloneAddon: tenants.voiceCloneAddon })
      .from(tenants)
      .where(eq(tenants.id, request.user!.tenantId))
      .limit(1);
    if (!tenant) throw new NotFoundError('Tenant', request.user!.tenantId);
    return reply.send({ active: tenant.voiceCloneAddon });
  });

  // ── Current subscription ────────────────────────────────────
  app.get('/billing/subscription', { onRequest: [app.requireRole('staff')] }, async (request, reply) => {
    const [tenant] = await db
      .select({
        plan: tenants.plan,
        subscriptionStatus: tenants.subscriptionStatus,
        currentPeriodEnd: tenants.currentPeriodEnd,
        trialEnd: tenants.trialEnd,
        billingCycle: tenants.billingCycle,
        hasStripeCustomer: tenants.stripeCustomerId,
      })
      .from(tenants)
      .where(eq(tenants.id, request.user!.tenantId))
      .limit(1);
    if (!tenant) throw new NotFoundError('Tenant', request.user!.tenantId);

    const plan = getPlan(tenant.plan);
    return reply.send({
      planKey: tenant.plan,
      plan,
      status: tenant.subscriptionStatus,
      currentPeriodEnd: tenant.currentPeriodEnd,
      trialEnd: tenant.trialEnd,
      billingCycle: tenant.billingCycle,
      isStripeCustomer: Boolean(tenant.hasStripeCustomer),
    });
  });
}
