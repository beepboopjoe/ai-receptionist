// ============================================================
// Clio OAuth routes — Phase 13.
// Mirrors the salesforce-oauth.router pattern.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { encryptCredentials } from '../../lib/encryption.js';
import { buildAuthUrl, exchangeCode } from './adapters/clio.adapter.js';

const NONCE_PREFIX = 'clio_nonce:';
const NONCE_TTL_SEC = 600;

export async function clioOAuthPlugin(app: FastifyInstance): Promise<void> {
  app.get(
    '/integrations/clio/connect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      if (!config.CLIO_CLIENT_ID) {
        return reply.code(503).send({
          error: 'Clio not configured',
          message: 'CLIO_CLIENT_ID is not set on this server. Contact support.',
        });
      }
      const { tenantId } = request.authUser;
      const nonce = randomBytes(16).toString('hex');
      const state = Buffer.from(JSON.stringify({ tenantId, nonce })).toString('base64url');
      const { redis } = await import('../../db/redis.js');
      await redis.set(`${NONCE_PREFIX}${nonce}`, tenantId, 'EX', NONCE_TTL_SEC);
      return reply.redirect(buildAuthUrl(state));
    }
  );

  app.get('/integrations/clio/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string; state?: string; error?: string;
    };
    const dashboardUrl = config.DASHBOARD_URL;

    if (error || !code || !state) {
      return reply.redirect(
        `${dashboardUrl}/settings/integrations?clio_error=${encodeURIComponent(error ?? 'missing_code')}`
      );
    }

    let tenantId: string; let nonce: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      tenantId = decoded.tenantId; nonce = decoded.nonce;
    } catch {
      return reply.redirect(`${dashboardUrl}/settings/integrations?clio_error=invalid_state`);
    }

    const { redis } = await import('../../db/redis.js');
    const stored = await redis.get(`${NONCE_PREFIX}${nonce}`);
    if (stored !== tenantId) {
      return reply.redirect(`${dashboardUrl}/settings/integrations?clio_error=invalid_nonce`);
    }
    await redis.del(`${NONCE_PREFIX}${nonce}`);

    let tokens;
    try {
      tokens = await exchangeCode(code);
    } catch (err) {
      console.error('[clio-oauth] token exchange failed:', err);
      return reply.redirect(`${dashboardUrl}/settings/integrations?clio_error=token_exchange_failed`);
    }

    const encrypted = encryptCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: String(tokens.expires_at),
    });

    await db
      .insert(integrations)
      .values({
        tenantId,
        provider: 'clio',
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

    return reply.redirect(`${dashboardUrl}/settings/integrations?clio_connected=1`);
  });

  app.post(
    '/integrations/clio/disconnect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      await db
        .delete(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'clio')));
      return reply.send({ ok: true });
    }
  );
}
