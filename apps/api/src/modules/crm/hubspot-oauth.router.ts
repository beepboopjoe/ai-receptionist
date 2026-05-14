// ============================================================
// HubSpot OAuth routes
// GET  /integrations/hubspot/connect   → redirect to HubSpot consent
// GET  /integrations/hubspot/callback  → exchange code, save tokens
// POST /integrations/hubspot/sync      → enqueue contact sync job
// ============================================================
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { config } from '../../config.js';
import { encryptCredentials, decryptCredentials } from '../../lib/encryption.js';
import {
  buildAuthUrl,
  exchangeCode,
} from './adapters/hubspot.adapter.js';
import { hubspotSyncQueue } from '../../queue/queues.js';

// Redis key prefix for CSRF nonces (expires in 10 min)
const NONCE_PREFIX = 'hs_nonce:';
const NONCE_TTL_SEC = 600;

export async function hubspotOAuthPlugin(app: FastifyInstance): Promise<void> {
  // ── Connect — redirect to HubSpot OAuth consent page ──────
  app.get(
    '/integrations/hubspot/connect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      if (!config.HUBSPOT_CLIENT_ID) {
        return reply.code(503).send({
          error: 'HubSpot not configured',
          message: 'HUBSPOT_CLIENT_ID is not set on this server. Contact support.',
        });
      }

      const { tenantId } = request.authUser;
      const nonce = randomBytes(16).toString('hex');
      const state = Buffer.from(JSON.stringify({ tenantId, nonce })).toString('base64url');

      // Store nonce in Redis so the callback can verify it
      const { redis } = await import('../../db/redis.js');
      await redis.set(`${NONCE_PREFIX}${nonce}`, tenantId, 'EX', NONCE_TTL_SEC);

      return reply.redirect(buildAuthUrl(state));
    }
  );

  // ── Callback — exchange code, store encrypted tokens ──────
  app.get(
    '/integrations/hubspot/callback',
    async (request, reply) => {
      const { code, state, error } = request.query as {
        code?: string;
        state?: string;
        error?: string;
      };

      const dashboardUrl = config.DASHBOARD_URL;

      if (error || !code || !state) {
        return reply.redirect(
          `${dashboardUrl}/settings/integrations?hubspot_error=${encodeURIComponent(error ?? 'missing_code')}`
        );
      }

      // Decode + verify state
      let tenantId: string;
      let nonce: string;
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        tenantId = decoded.tenantId;
        nonce = decoded.nonce;
      } catch {
        return reply.redirect(`${dashboardUrl}/settings/integrations?hubspot_error=invalid_state`);
      }

      // Verify nonce in Redis
      const { redis } = await import('../../db/redis.js');
      const stored = await redis.get(`${NONCE_PREFIX}${nonce}`);
      if (stored !== tenantId) {
        return reply.redirect(`${dashboardUrl}/settings/integrations?hubspot_error=invalid_nonce`);
      }
      await redis.del(`${NONCE_PREFIX}${nonce}`);

      // Exchange auth code for tokens
      let tokens;
      try {
        tokens = await exchangeCode(code);
      } catch (err) {
        console.error('[hubspot-oauth] token exchange failed:', err);
        return reply.redirect(`${dashboardUrl}/settings/integrations?hubspot_error=token_exchange_failed`);
      }

      // Persist encrypted credentials
      const encrypted = encryptCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: String(tokens.expires_at),
      });

      await db
        .insert(integrations)
        .values({
          tenantId,
          provider: 'hubspot',
          status: 'connected',
          credentials: encrypted,
          metadata: {},
        })
        .onConflictDoUpdate({
          target: [integrations.tenantId, integrations.provider],
          set: {
            credentials: encrypted,
            status: 'connected',
            errorMessage: null,
            updatedAt: new Date(),
          },
        });

      // Kick off initial sync in the background
      const [row] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'hubspot')))
        .limit(1);

      if (row) {
        await hubspotSyncQueue.add('hubspot-sync', { tenantId, integrationId: row.id });
      }

      return reply.redirect(`${dashboardUrl}/settings/integrations?hubspot_connected=1`);
    }
  );

  // ── Manual sync trigger ────────────────────────────────────
  app.post(
    '/integrations/hubspot/sync',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;

      const [row] = await db
        .select({ id: integrations.id, status: integrations.status })
        .from(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'hubspot')))
        .limit(1);

      if (!row) {
        return reply.code(404).send({ error: 'HubSpot not connected' });
      }
      if (row.status !== 'connected') {
        return reply.code(400).send({ error: 'HubSpot integration is not active' });
      }

      const job = await hubspotSyncQueue.add('hubspot-sync', {
        tenantId,
        integrationId: row.id,
      });

      return reply.code(202).send({ jobId: job.id, message: 'Sync enqueued' });
    }
  );
}
