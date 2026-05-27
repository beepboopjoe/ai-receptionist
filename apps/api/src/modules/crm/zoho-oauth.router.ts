// ============================================================
// Zoho OAuth routes — Phase 13.
// Includes a `dc` query parameter so the user can pick their data
// center at connect time. Defaults to 'com' (US).
// ============================================================
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { encryptCredentials } from '../../lib/encryption.js';
import { buildAuthUrl, exchangeCode, type ZohoDc } from './adapters/zoho.adapter.js';

const NONCE_PREFIX = 'zoho_nonce:';
const NONCE_TTL_SEC = 600;
const ALLOWED_DCS: ZohoDc[] = ['com', 'eu', 'in', 'com.au', 'jp'];

function parseDc(input: unknown): ZohoDc {
  if (typeof input === 'string' && (ALLOWED_DCS as string[]).includes(input)) {
    return input as ZohoDc;
  }
  return 'com';
}

export async function zohoOAuthPlugin(app: FastifyInstance): Promise<void> {
  app.get(
    '/integrations/zoho/connect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      if (!config.ZOHO_CLIENT_ID) {
        return reply.code(503).send({
          error: 'Zoho not configured',
          message: 'ZOHO_CLIENT_ID is not set on this server. Contact support.',
        });
      }
      const { tenantId } = request.authUser;
      const { dc } = request.query as { dc?: string };
      const resolvedDc = parseDc(dc);

      const nonce = randomBytes(16).toString('hex');
      const state = Buffer.from(JSON.stringify({ tenantId, nonce, dc: resolvedDc })).toString('base64url');

      const { redis } = await import('../../db/redis.js');
      await redis.set(`${NONCE_PREFIX}${nonce}`, tenantId, 'EX', NONCE_TTL_SEC);

      return reply.redirect(buildAuthUrl(state, resolvedDc));
    }
  );

  app.get('/integrations/zoho/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string; state?: string; error?: string;
    };
    const dashboardUrl = config.DASHBOARD_URL;

    if (error || !code || !state) {
      return reply.redirect(
        `${dashboardUrl}/settings/integrations?zoho_error=${encodeURIComponent(error ?? 'missing_code')}`
      );
    }

    let tenantId: string; let nonce: string; let dc: ZohoDc;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      tenantId = decoded.tenantId; nonce = decoded.nonce; dc = parseDc(decoded.dc);
    } catch {
      return reply.redirect(`${dashboardUrl}/settings/integrations?zoho_error=invalid_state`);
    }

    const { redis } = await import('../../db/redis.js');
    const stored = await redis.get(`${NONCE_PREFIX}${nonce}`);
    if (stored !== tenantId) {
      return reply.redirect(`${dashboardUrl}/settings/integrations?zoho_error=invalid_nonce`);
    }
    await redis.del(`${NONCE_PREFIX}${nonce}`);

    let tokens;
    try {
      tokens = await exchangeCode(code, dc);
    } catch (err) {
      console.error('[zoho-oauth] token exchange failed:', err);
      return reply.redirect(`${dashboardUrl}/settings/integrations?zoho_error=token_exchange_failed`);
    }

    const encrypted = encryptCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: String(tokens.expires_at),
      dc: tokens.dc,
    });

    await db
      .insert(integrations)
      .values({
        tenantId,
        provider: 'zoho',
        status: 'connected',
        credentials: encrypted,
        metadata: { dc },
      })
      .onConflictDoUpdate({
        target: [integrations.tenantId, integrations.provider],
        set: {
          credentials: encrypted,
          metadata: { dc },
          status: 'connected',
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

    return reply.redirect(`${dashboardUrl}/settings/integrations?zoho_connected=1`);
  });

  app.post(
    '/integrations/zoho/disconnect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      await db
        .delete(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'zoho')));
      return reply.send({ ok: true });
    }
  );
}
