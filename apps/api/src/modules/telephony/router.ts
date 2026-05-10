// ============================================================
// Telephony router — webhook ingestion + OAuth integration routes
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { validateRingCentralWebhook } from '../../lib/webhook-validator.js';
import { handleRingCentralEvent } from './handler.js';
import { handleTelnyxWebhook } from './telnyx-webhook.handler.js';
import { handleMediaStream } from './media-stream.handler.js';
import { getRcAuthUrl, exchangeRcCode, getExtensionInfo, registerWebhook } from './ringcentral-client.js';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { encryptCredentials } from '../../lib/encryption.js';
import { config } from '../../config.js';
import { audit } from '../../audit/audit-logger.js';
import type { WebSocket } from 'ws';

async function telephonyRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // ---- Telnyx webhooks (no JWT; all events arrive at one URL) ----

  /**
   * Single entry point for all Telnyx call events.
   * Telnyx signs the request with an Ed25519 key (TELNYX_PUBLIC_KEY).
   * Signature validation is skipped in dev; enable it in production.
   */
  app.post('/webhooks/telnyx', {
    config: { rateLimit: { max: 2000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    return handleTelnyxWebhook(request, reply);
  });

  /**
   * Telnyx media stream WebSocket — Telnyx connects here after stream_start.
   * Call params are decoded from client_state inside the 'start' event message.
   */
  app.get('/webhooks/telnyx/stream', { websocket: true }, (connection, _request) => {
    const socket = connection.socket as unknown as WebSocket;
    let started = false;

    socket.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;

      if (msg['event'] === 'connected') {
        // Telnyx sends a 'connected' handshake first — nothing to do
        return;
      }

      if (msg['event'] === 'start' && !started) {
        started = true;
        const start = msg['start'] as {
          call_control_id?: string;
          stream_id?: string;
          client_state?: string;
        } | undefined;

        // Decode our params from client_state
        let state: Record<string, string> = {};
        if (start?.client_state) {
          try {
            state = JSON.parse(
              Buffer.from(start.client_state, 'base64').toString()
            ) as Record<string, string>;
          } catch { /* malformed client_state — proceed with empty state */ }
        }

        void handleMediaStream(socket, {
          callId: state['callId'] ?? '',
          tenantId: state['tenantId'] ?? '',
          fromNumber: state['fromNumber'] ?? '',
          callSid: state['callSid'] ?? start?.call_control_id ?? '',
          campaignContactId: state['campaignContactId'],
          campaignId: state['campaignId'],
          // No streamSid for Telnyx — it's a Twilio-only requirement
        });
      }
    });
  });

  // ---- RingCentral webhooks (no JWT; HMAC validated) ----

  app.post('/webhooks/ringcentral', {
    config: { rateLimit: { max: 1000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    validateRingCentralWebhook(request);
    return handleRingCentralEvent(request, reply);
  });

  // RingCentral webhook URL validation (GET with validation-token header)
  app.get('/webhooks/ringcentral/validation', async (request, reply) => {
    const token = request.headers['validation-token'];
    if (token) {
      reply.header('Validation-Token', token);
      return reply.status(200).send();
    }
    return reply.status(400).send({ error: 'Missing validation-token header' });
  });

  // ---- OAuth routes (JWT protected — tenant admin) ----

  app.post('/integrations/ringcentral/connect', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64');
    const authUrl = await getRcAuthUrl(state);
    return reply.send({ authUrl });
  });

  app.get('/integrations/ringcentral/callback', async (request, reply) => {
    const { code, state } = request.query as { code: string; state: string };

    let tenantId: string;
    try {
      tenantId = (JSON.parse(Buffer.from(state, 'base64').toString()) as { tenantId: string }).tenantId;
    } catch {
      return reply.status(400).send({ error: 'Invalid state parameter' });
    }

    // Exchange code for tokens
    const tokens = await exchangeRcCode(code);

    // Get extension info (phone numbers)
    const extInfo = await getExtensionInfo(tokens.access_token);
    const phoneNumbers = extInfo.phoneNumbers.map((p) => p.phoneNumber).filter(Boolean);

    // Store encrypted credentials
    const encryptedCreds = encryptCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: String(Date.now() + tokens.expires_in * 1000),
    });

    await db
      .insert(integrations)
      .values({
        tenantId,
        provider: 'ringcentral',
        status: 'connected',
        credentials: encryptedCreds,
        metadata: { phoneNumbers },
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [integrations.tenantId, integrations.provider],
        set: {
          status: 'connected',
          credentials: encryptedCreds,
          metadata: { phoneNumbers },
          lastSyncedAt: new Date(),
          errorMessage: null,
        },
      });

    // Register webhook subscription
    const webhookUrl = `${config.APP_URL}/api/v1/webhooks/ringcentral`;
    try {
      const sub = await registerWebhook(tokens.access_token, webhookUrl);
      await db
        .update(integrations)
        .set({ metadata: { phoneNumbers, webhookSubscriptionId: sub.id } })
        .where(
          and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'ringcentral'))
        );
    } catch (err) {
      app.log.warn({ err }, '[RC] Webhook registration failed but OAuth succeeded');
    }

    audit.integrationConnected(tenantId, 'ringcentral', tenantId);

    return reply.redirect(`${config.DASHBOARD_URL}/onboarding/step-2-calendar?rc=connected`);
  });
}

export const telephonyPlugin = fp(telephonyRoutes, { name: 'telephony' });
