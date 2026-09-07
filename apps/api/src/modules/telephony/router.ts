// ============================================================
// Telephony router — webhook ingestion + OAuth integration routes
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
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
import { ringcentralWebhookUrl } from '../../lib/public-url.js';
import { audit } from '../../audit/audit-logger.js';
import pino from 'pino';
import {
  formatMediaStreamHandlerFailureLog,
  formatMediaStreamStartLog,
  formatMediaStreamWsConnectedLog,
  resolveFastifyWebsocket,
} from './telnyx-stream.helpers.js';

const streamLogger = pino({ name: 'telnyx-stream-ws' });

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
   * Telnyx media stream WebSocket — Telnyx connects here after streaming_start.
   * Call params are decoded from client_state inside the 'start' event message.
   *
   * @fastify/websocket v10 passes the WebSocket as the first argument (not
   * `{ socket }`). resolveFastifyWebsocket accepts both shapes.
   */
  app.get('/webhooks/telnyx/stream', { websocket: true }, (connection, _request) => {
    const socket = resolveFastifyWebsocket(connection);
    streamLogger.info(formatMediaStreamWsConnectedLog());
    let started = false;

    socket.on('message', (data: Buffer) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch (err) {
        streamLogger.warn({ err }, 'Telnyx media-stream bad JSON');
        return;
      }

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

        const params = {
          callId: state['callId'] ?? '',
          tenantId: state['tenantId'] ?? '',
          fromNumber: state['fromNumber'] ?? '',
          callSid: state['callSid'] ?? start?.call_control_id ?? '',
          campaignContactId: state['campaignContactId'],
          campaignId: state['campaignId'],
          // Phase 29b — Ask-your-AI plain-English task (single-task calls)
          ...(state['adHocTask'] && { adHocTask: state['adHocTask'] }),
          // No streamSid for Telnyx — it's a Twilio-only requirement
        };

        const missing = (['callId', 'tenantId', 'fromNumber', 'callSid'] as const)
          .filter((k) => !params[k]);
        streamLogger.info(
          { callId: params.callId, tenantId: params.tenantId, callSid: params.callSid },
          formatMediaStreamStartLog({
            callId: params.callId,
            tenantId: params.tenantId,
            callSid: params.callSid,
            missingFields: missing,
          }),
        );

        void handleMediaStream(socket, params).catch((err) => {
          streamLogger.error(
            { err, callSid: params.callSid, tenantId: params.tenantId },
            formatMediaStreamHandlerFailureLog({
              callSid: params.callSid,
              tenantId: params.tenantId,
              err,
            }),
          );
          try { socket.close(1011, 'media stream handler failed'); } catch { /* ignore */ }
        });
      }
    });

    socket.on('error', (err: Error) => {
      streamLogger.error(
        { err },
        `Telnyx media-stream WS error err=${err instanceof Error ? err.message : String(err)}`,
      );
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
    const webhookUrl = ringcentralWebhookUrl(config.APP_URL);
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

// Plain (encapsulated) plugin so the `/api/v1` prefix in main.ts applies.
// fastify-plugin (fp) de-encapsulates and mounts these at the ROOT instead,
// which broke the whole inbound-call path: Telnyx posts to
// /api/v1/webhooks/telnyx (404 under fp), and telnyx-webhook.handler.ts hands
// Telnyx a wss://<host>/api/v1/webhooks/telnyx/stream media-stream URL that
// likewise did not exist. This router registers no decorators/hooks, so
// encapsulation is safe — it inherits app.authenticate from the parent scope.
export const telephonyPlugin = telephonyRoutes;
