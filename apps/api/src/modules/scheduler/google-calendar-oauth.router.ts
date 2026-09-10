// ============================================================
// Google Calendar OAuth routes
//
// GET    /integrations/google-calendar/connect   → 302 to Google (JWT required)
// POST   /integrations/google-calendar/connect   → { url } for dashboard (JWT)
// GET    /integrations/google-calendar/callback  → exchange code, store tokens
// GET    /integrations/google-calendar/status    → connected vs configured
// POST   /integrations/google-calendar/disconnect
//
// Dashboard stores JWT in localStorage, so Connect MUST use POST +
// window.location = url (an <a href> cannot send Authorization). GET
// still exists so the previously-404 path is registered.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { config } from '../../config.js';
import {
  GOOGLE_CALENDAR_PROVIDER,
  buildGoogleCalendarAuthUrl,
  dashboardIntegrationsUrl,
  decodeOAuthState,
  encodeOAuthState,
  exchangeGoogleCalendarCode,
  fetchGoogleAccountEmail,
  getGoogleCalendarOAuthConfig,
  persistGoogleCalendarTokens,
  safeReturnTo,
} from './google-calendar-oauth.js';

const NONCE_PREFIX = 'gcal_nonce:';
const NONCE_TTL_SEC = 600;

const NOT_CONFIGURED = {
  error: 'Google Calendar not configured',
  message:
    'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the API (Railway), and add the redirect URI in Google Cloud Console. See docs/GOOGLE_CALENDAR_SETUP.md.',
};

async function startConnect(
  tenantId: string,
  returnTo: string | undefined
): Promise<{ url: string } | { error: string; message: string }> {
  const oauth = getGoogleCalendarOAuthConfig();
  if (!oauth.configured) {
    return NOT_CONFIGURED;
  }

  const nonce = randomBytes(16).toString('hex');
  const state = encodeOAuthState({
    tenantId,
    nonce,
    ...(returnTo ? { returnTo } : {}),
  });

  const { redis } = await import('../../db/redis.js');
  await redis.set(`${NONCE_PREFIX}${nonce}`, tenantId, 'EX', NONCE_TTL_SEC);

  return {
    url: buildGoogleCalendarAuthUrl({
      clientId: oauth.clientId,
      redirectUri: oauth.redirectUri,
      state,
    }),
  };
}

export async function googleCalendarOAuthPlugin(app: FastifyInstance): Promise<void> {
  // ── Status — configured on the server? connected for this tenant? ──
  app.get(
    '/integrations/google-calendar/status',
    { onRequest: [app.requireRole('staff')] },
    async (request) => {
      const { tenantId } = request.authUser;
      const oauth = getGoogleCalendarOAuthConfig();
      const [row] = await db
        .select({
          status: integrations.status,
          metadata: integrations.metadata,
          errorMessage: integrations.errorMessage,
        })
        .from(integrations)
        .where(
          and(
            eq(integrations.tenantId, tenantId),
            eq(integrations.provider, GOOGLE_CALENDAR_PROVIDER)
          )
        )
        .limit(1);

      const meta = (row?.metadata ?? {}) as Record<string, string | null>;
      return {
        configured: oauth.configured,
        connected: row?.status === 'connected',
        accountEmail: meta['account_email'] ?? null,
        calendarId: meta['calendar_id'] ?? (row?.status === 'connected' ? 'primary' : null),
        errorMessage: row?.errorMessage ?? null,
        redirectUri: oauth.redirectUri,
      };
    }
  );

  // ── Connect (GET) — 302 to Google when the browser can send a JWT.
  // Also returns JSON if the client asks for it (fetch with Authorization).
  app.get(
    '/integrations/google-calendar/connect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const query = request.query as { returnTo?: string; format?: string };
      const result = await startConnect(tenantId, safeReturnTo(query.returnTo));
      if ('error' in result) {
        return reply.code(503).send(result);
      }
      const wantsJson =
        query.format === 'json' ||
        String(request.headers.accept ?? '').includes('application/json');
      if (wantsJson) {
        return reply.send(result);
      }
      return reply.redirect(result.url);
    }
  );

  // ── Connect (POST) — dashboard path. JWT in Authorization, JSON { url }.
  app.post(
    '/integrations/google-calendar/connect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const body = (request.body ?? {}) as { returnTo?: string };
      const result = await startConnect(tenantId, safeReturnTo(body.returnTo));
      if ('error' in result) {
        return reply.code(503).send(result);
      }
      return reply.send(result);
    }
  );

  // ── Callback — Google redirects here. No JWT. ──
  app.get('/integrations/google-calendar/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };
    const dashboardUrl = config.DASHBOARD_URL;
    const parsed = state ? decodeOAuthState(state) : null;
    const returnTo = parsed?.returnTo;

    const fail = (reason: string) =>
      reply.redirect(
        dashboardIntegrationsUrl(dashboardUrl, {
          google_error: reason,
          ...(returnTo ? { returnTo } : {}),
        })
      );

    if (error || !code || !state) {
      return fail(error ?? 'missing_code');
    }
    if (!parsed) {
      return fail('invalid_state');
    }

    const { redis } = await import('../../db/redis.js');
    const stored = await redis.get(`${NONCE_PREFIX}${parsed.nonce}`);
    if (stored !== parsed.tenantId) {
      return fail('invalid_nonce');
    }
    await redis.del(`${NONCE_PREFIX}${parsed.nonce}`);

    let tokens;
    try {
      tokens = await exchangeGoogleCalendarCode(code);
    } catch (err) {
      request.log.error({ err }, '[google-calendar-oauth] token exchange failed');
      return fail('token_exchange_failed');
    }

    if (!tokens.refresh_token) {
      request.log.warn('[google-calendar-oauth] no refresh_token — user may need to re-consent');
    }

    let accountEmail: string | null = null;
    try {
      accountEmail = await fetchGoogleAccountEmail(tokens);
    } catch (err) {
      request.log.warn({ err }, '[google-calendar-oauth] could not read account email');
    }

    try {
      await persistGoogleCalendarTokens({
        tenantId: parsed.tenantId,
        tokens,
        metadata: {
          calendar_id: 'primary',
          account_email: accountEmail,
        },
      });
    } catch (err) {
      request.log.error({ err }, '[google-calendar-oauth] persist failed');
      return fail('persist_failed');
    }

    return reply.redirect(
      dashboardIntegrationsUrl(dashboardUrl, {
        google_connected: '1',
        ...(returnTo ? { returnTo } : {}),
      })
    );
  });

  // ── Disconnect ──
  app.post(
    '/integrations/google-calendar/disconnect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      await db
        .delete(integrations)
        .where(
          and(
            eq(integrations.tenantId, tenantId),
            eq(integrations.provider, GOOGLE_CALENDAR_PROVIDER)
          )
        );
      return reply.send({ ok: true });
    }
  );
}
