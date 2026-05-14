// ============================================================
// Stripe webhook receiver — POST /webhooks/stripe.
//
// CRITICAL: signature verification needs the EXACT raw bytes
// Stripe sent. We register this plugin BEFORE Fastify's default
// JSON body parser kicks in, and use the application/json
// content-type parser to capture the raw buffer.
//
// Idempotency: every event is recorded in stripe_webhook_events
// before processing. Stripe retries on non-2xx, so the recorded
// event_id PRIMARY KEY guarantees we only process each event once.
// ============================================================
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { db } from '../../db/client.js';
import { stripeWebhookEvents } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { getStripe } from './stripe.client.js';
import { syncSubscription, tenantIdForStripeCustomer } from './billing.service.js';
import { recordCommissionEvent } from '../affiliates/affiliate.service.js';
import { tenants, tenantPhoneNumbers } from '../../db/schema.js';
import { isNull } from 'drizzle-orm';
import { TelnyxAdapter } from '../telephony/adapters/telnyx.adapter.js';

export async function stripeWebhookPlugin(app: FastifyInstance): Promise<void> {
  // Capture the raw body for application/json on this route only.
  // The default JSON parser would consume the buffer before we can
  // hand it to Stripe's signature verifier.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done) => {
      // Only divert raw bytes for the Stripe webhook route — every other
      // route still gets the parsed JSON object via fastify's default.
      if (req.url === '/webhooks/stripe') {
        try {
          (req as FastifyRequest & { rawBody?: Buffer }).rawBody = body;
          done(null, body);
        } catch (err) {
          done(err as Error, undefined);
        }
        return;
      }
      try {
        const json = body.length === 0 ? null : JSON.parse(body.toString('utf8'));
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  app.post('/webhooks/stripe', async (request, reply) => {
    const stripe = getStripe();
    if (!stripe) {
      return reply.code(503).send({ error: 'Stripe not configured' });
    }
    if (!config.STRIPE_WEBHOOK_SECRET) {
      app.log.error('STRIPE_WEBHOOK_SECRET is not set — refusing webhook');
      return reply.code(503).send({ error: 'Stripe webhook secret not configured' });
    }

    const sig = request.headers['stripe-signature'];
    if (typeof sig !== 'string') {
      return reply.code(400).send({ error: 'Missing Stripe-Signature header' });
    }
    const raw = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!raw) {
      app.log.error('Webhook body was not captured as raw buffer');
      return reply.code(400).send({ error: 'Raw body unavailable' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, config.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      app.log.warn({ err }, 'Stripe signature verification failed');
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    // Idempotency — record event id first, skip if already seen.
    try {
      await db.insert(stripeWebhookEvents).values({
        eventId: event.id,
        eventType: event.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: event as any,
      });
    } catch {
      // Unique violation = duplicate delivery; ack and move on.
      app.log.info({ eventId: event.id, type: event.type }, 'Duplicate Stripe event, skipping');
      return reply.code(200).send({ received: true, duplicate: true });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          // Voice clone add-on checkout: activate the addon flag immediately
          // on checkout completion so the tenant doesn't have to wait for the
          // subscription event.
          const session = event.data.object;
          if (session.metadata?.['addonType'] === 'voice_clone' && session.metadata?.['tenantId']) {
            const tenantId = session.metadata['tenantId'];
            const subId = typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription as { id?: string } | null)?.id ?? null;
            await db
              .update(tenants)
              .set({ voiceCloneAddon: true, voiceCloneStripeSub: subId, updatedAt: new Date() })
              .where(eq(tenants.id, tenantId));
            app.log.info({ tenantId, subId }, 'Voice clone add-on activated via checkout');
          } else {
            app.log.info({ sessionId: session.id }, 'Stripe checkout completed');
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          await syncSubscription(event.data.object);

          // If this subscription deletion is for a voice-clone add-on,
          // revoke the flag. We detect it by matching the stored sub ID.
          if (event.type === 'customer.subscription.deleted') {
            const sub = event.data.object;
            const subId = sub.id;
            if (subId) {
              await db
                .update(tenants)
                .set({ voiceCloneAddon: false, voiceCloneStripeSub: null, updatedAt: new Date() })
                .where(eq(tenants.voiceCloneStripeSub, subId));
            }

            // Release any provisioned Telnyx phone numbers for this tenant.
            // Numbers cost money on Telnyx even when unused — release them
            // on cancellation so you're not billed for churned customers.
            const customerId =
              typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
            if (customerId) {
              const tenantId = await tenantIdForStripeCustomer(customerId);
              if (tenantId) {
                const activeNumbers = await db
                  .select({ id: tenantPhoneNumbers.id, telnyxPhoneId: tenantPhoneNumbers.telnyxPhoneId })
                  .from(tenantPhoneNumbers)
                  .where(eq(tenantPhoneNumbers.tenantId, tenantId) && isNull(tenantPhoneNumbers.releasedAt));

                if (activeNumbers.length > 0) {
                  const telnyx = new TelnyxAdapter();
                  for (const num of activeNumbers) {
                    try {
                      if (num.telnyxPhoneId) {
                        await telnyx.releaseNumber(num.telnyxPhoneId);
                      }
                      await db
                        .update(tenantPhoneNumbers)
                        .set({ releasedAt: new Date(), updatedAt: new Date() })
                        .where(eq(tenantPhoneNumbers.id, num.id));
                    } catch (err) {
                      app.log.error({ err, numId: num.id, tenantId }, 'Failed to release Telnyx number on cancellation');
                    }
                  }
                  app.log.info({ tenantId, count: activeNumbers.length }, 'Released Telnyx numbers on subscription cancellation');
                }
              }
            }
          }
          break;
        }
        case 'invoice.paid': {
          // Subscription status sync arrives via customer.subscription.updated.
          // Here we record an affiliate commission event if the tenant
          // was attributed at signup. Idempotent — duplicate webhook
          // deliveries collide on the (invoice, affiliate) unique index.
          const invoice = event.data.object;
          const customerId =
            typeof invoice.customer === 'string'
              ? invoice.customer
              : invoice.customer?.id ?? null;
          if (customerId && invoice.amount_paid && invoice.amount_paid > 0) {
            const tenantId = await tenantIdForStripeCustomer(customerId);
            if (tenantId) {
              try {
                const result = await recordCommissionEvent({
                  tenantId,
                  stripeInvoiceId: invoice.id ?? '',
                  invoiceAmountCents: invoice.amount_paid,
                });
                if (result) {
                  app.log.info(
                    { tenantId, invoiceId: invoice.id, commissionCents: result.commissionCents },
                    'Recorded affiliate commission'
                  );
                }
              } catch (err) {
                app.log.error({ err, tenantId, invoiceId: invoice.id }, 'recordCommissionEvent failed');
              }
            }
          }
          break;
        }
        case 'invoice.payment_failed': {
          app.log.info({ invoiceId: event.data.object.id }, 'Stripe invoice payment failed');
          break;
        }
        default:
          // Ignored event types are still recorded so we know what arrives.
          app.log.debug({ type: event.type }, 'Ignored Stripe event type');
      }

      await db
        .update(stripeWebhookEvents)
        .set({ processedAt: new Date() })
        .where(eq(stripeWebhookEvents.eventId, event.id));

      return reply.code(200).send({ received: true });
    } catch (err) {
      app.log.error({ err, eventId: event.id, type: event.type }, 'Stripe webhook handler failed');
      // Return 500 so Stripe retries. The event row is already inserted
      // but processed_at stays null, so on retry the duplicate-check
      // fires above. To avoid being permanently stuck, an operator can
      // delete the row from stripe_webhook_events to allow reprocessing.
      return reply.code(500).send({ error: 'Webhook handler failed' });
    }
  });
}
