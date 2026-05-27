// ============================================================
// Salesforce OAuth routes — Phase 13.
// GET    /integrations/salesforce/connect[?sandbox=1]  → redirect to consent
// GET    /integrations/salesforce/callback             → exchange code, save tokens
// POST   /integrations/salesforce/disconnect           → revoke + delete row
// ============================================================
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { encryptCredentials } from '../../lib/encryption.js';
import { buildAuthUrl, exchangeCode } from './adapters/salesforce.adapter.js';

const NONCE_PREFIX = 'sf_nonce:';
const NONCE_TTL_SEC = 600;

export async function salesforceOAuthPlugin(app: FastifyInstance): Promise<void> {
  // ── Connect ──
  app.get(
    '/integrations/salesforce/connect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      if (!config.SALESFORCE_CLIENT_ID) {
        return reply.code(503).send({
          error: 'Salesforce not configured',
          message: 'SALESFORCE_CLIENT_ID is not set on this server. Contact support.',
        });
      }

      const { tenantId } = request.authUser;
      const { sandbox } = request.query as { sandbox?: string };
      const isSandbox = sandbox === '1' || sandbox === 'true';

      const nonce = randomBytes(16).toString('hex');
      const state = Buffer.from(JSON.stringify({ tenantId, nonce, isSandbox })).toString('base64url');

      const { redis } = await import('../../db/redis.js');
      await redis.set(`${NONCE_PREFIX}${nonce}`, tenantId, 'EX', NONCE_TTL_SEC);

      return reply.redirect(buildAuthUrl(state, isSandbox));
    }
  );

  // ── Callback ──
  app.get('/integrations/salesforce/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string; state?: string; error?: string;
    };
    const dashboardUrl = config.DASHBOARD_URL;

    if (error || !code || !state) {
      return reply.redirect(
        `${dashboardUrl}/settings/integrations?salesforce_error=${encodeURIComponent(error ?? 'missing_code')}`
      );
    }

    let tenantId: string; let nonce: string; let isSandbox: boolean;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      tenantId = decoded.tenantId; nonce = decoded.nonce; isSandbox = !!decoded.isSandbox;
    } catch {
      return reply.redirect(`${dashboardUrl}/settings/integrations?salesforce_error=invalid_state`);
    }

    const { redis } = await import('../../db/redis.js');
    const stored = await redis.get(`${NONCE_PREFIX}${nonce}`);
    if (stored !== tenantId) {
      return reply.redirect(`${dashboardUrl}/settings/integrations?salesforce_error=invalid_nonce`);
    }
    await redis.del(`${NONCE_PREFIX}${nonce}`);

    let tokens;
    try {
      tokens = await exchangeCode(code, isSandbox);
    } catch (err) {
      console.error('[salesforce-oauth] token exchange failed:', err);
      return reply.redirect(`${dashboardUrl}/settings/integrations?salesforce_error=token_exchange_failed`);
    }

    const encrypted = encryptCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      instance_url: tokens.instance_url,
    });

    await db
      .insert(integrations)
      .values({
        tenantId,
        provider: 'salesforce',
        status: 'connected',
        credentials: encrypted,
        metadata: { is_sandbox: isSandbox },
      })
      .onConflictDoUpdate({
        target: [integrations.tenantId, integrations.provider],
        set: {
          credentials: encrypted,
          metadata: { is_sandbox: isSandbox },
          status: 'connected',
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

    return reply.redirect(`${dashboardUrl}/settings/integrations?salesforce_connected=1`);
  });

  // ── Disconnect ──
  app.post(
    '/integrations/salesforce/disconnect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      await db
        .delete(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'salesforce')));
      return reply.send({ ok: true });
    }
  );
}
