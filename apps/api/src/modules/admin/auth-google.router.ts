// ============================================================
// Google OAuth sign-in/sign-up routes.
//
// Flow:
//   1. GET  /auth/google          → redirects user to Google consent
//   2. GET  /auth/google/callback → exchanges code, verifies ID token,
//                                   issues our JWT, redirects to dashboard
//
// Configuration:
//   GOOGLE_AUTH_CLIENT_ID     — OAuth client ID (separate from Calendar creds)
//   GOOGLE_AUTH_CLIENT_SECRET — OAuth client secret
//   DASHBOARD_URL             — frontend origin (e.g. http://localhost:3000)
//   API_PUBLIC_URL            — API origin used as the redirect_uri host
//
// If credentials are absent, every endpoint responds 501 with setup
// instructions so the dev server keeps working without Google creds.
// ============================================================
import type { FastifyPluginAsync } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';

const SCOPES = ['openid', 'email', 'profile'];

interface PluginOpts {
  /**
   * Called with the verified Google identity. Return the tokens + user
   * shape we hand back to the dashboard. Swap this out for the real
   * DB-backed implementation once Postgres is wired up.
   */
  resolveUser: (profile: { googleId: string; email: string; name?: string; picture?: string }) => Promise<{
    token: string;
    refreshToken: string;
    isNewUser: boolean;
    user: { id: string; email: string; role: string; firstName?: string; lastName?: string };
    tenant: { id: string; name: string; slug: string; plan: string };
  }>;
}

export const googleAuthPlugin: (opts: PluginOpts) => FastifyPluginAsync =
  ({ resolveUser }) =>
  async (app) => {
    const clientId = process.env['GOOGLE_AUTH_CLIENT_ID'] ?? '';
    const clientSecret = process.env['GOOGLE_AUTH_CLIENT_SECRET'] ?? '';
    const apiUrl = process.env['API_PUBLIC_URL'] ?? 'http://localhost:3001';
    const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000';
    const redirectUri = `${apiUrl}/api/v1/auth/google/callback`;

    const configured = clientId && clientSecret;

    if (!configured) {
      app.log.warn(
        '⚠️  Google sign-in not configured. Set GOOGLE_AUTH_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET in apps/api/.env — see GOOGLE_OAUTH_SETUP.md'
      );
    }

    // In-memory state store (CSRF protection). For prod use Redis.
    const stateStore = new Map<string, number>();
    const STATE_TTL_MS = 10 * 60 * 1000;

    // ── Step 1: start the flow ──────────────────────────────
    app.get('/auth/google', async (_req, reply) => {
      if (!configured) {
        return reply.code(501).send({
          error: 'Google sign-in not configured',
          instructions:
            'Add GOOGLE_AUTH_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET to apps/api/.env — see apps/api/GOOGLE_OAUTH_SETUP.md for setup steps.',
        });
      }

      const state = randomBytes(16).toString('hex');
      stateStore.set(state, Date.now());
      // Clean expired state entries opportunistically
      for (const [k, ts] of stateStore) {
        if (Date.now() - ts > STATE_TTL_MS) stateStore.delete(k);
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'online',
        prompt: 'select_account',
        state,
      });
      return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    });

    // ── Step 2: OAuth callback ──────────────────────────────
    app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
      '/auth/google/callback',
      async (req, reply) => {
        if (!configured) {
          return reply.code(501).send({ error: 'Google sign-in not configured' });
        }

        const { code, state, error } = req.query;
        if (error) {
          return reply.redirect(`${dashboardUrl}/login?error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) {
          return reply.code(400).send({ error: 'Missing code or state' });
        }

        const issuedAt = stateStore.get(state);
        if (!issuedAt || Date.now() - issuedAt > STATE_TTL_MS) {
          return reply.code(400).send({ error: 'Invalid or expired state' });
        }
        stateStore.delete(state);

        const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
        try {
          const { tokens } = await client.getToken(code);
          if (!tokens.id_token) {
            return reply.code(400).send({ error: 'No ID token returned from Google' });
          }

          const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
          const payload = ticket.getPayload();
          if (!payload?.sub || !payload.email) {
            return reply.code(400).send({ error: 'Invalid Google identity' });
          }

          const resolved = await resolveUser({
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
          });

          const target = new URL(`${dashboardUrl}/auth/google-complete`);
          target.searchParams.set('token', resolved.token);
          target.searchParams.set('refresh', resolved.refreshToken);
          if (resolved.isNewUser) target.searchParams.set('new', '1');
          return reply.redirect(target.toString());
        } catch (err) {
          app.log.error({ err }, 'Google OAuth callback failed');
          return reply.redirect(`${dashboardUrl}/login?error=google_oauth_failed`);
        }
      }
    );
  };
