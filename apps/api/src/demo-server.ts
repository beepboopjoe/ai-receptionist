// ============================================================
// Standalone Dev Server — runs the dashboard backend WITHOUT
// requiring Postgres, Redis, BullMQ, or the main API config.
//
// Mounts:
//   • /api/v1/auth/*          (mock auth + Google OAuth)
//   • /api/v1/billing, /calls, /appointments, /patients, …
//                              (in-memory mock data for every page)
//   • /api/v1/ws/activity     (live activity feed WebSocket)
//   • /api/v1/ws/demo         (landing-page voice demo proxy)
//   • /api/v1/webhooks/telnyx (live Telnyx → xAI Grok bridge)
//
// Required env: XAI_API_KEY (for voice). Telnyx + Google are optional.
// Run with:  pnpm --filter @ai-receptionist/api run demo
// ============================================================
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { demoPlugin } from './modules/voice-agent/demo.router.js';
import { mocksPlugin } from './mocks/index.js';
import { googleAuthPlugin } from './modules/admin/auth-google.router.js';
import { telnyxDevmodePlugin } from './modules/telephony/telnyx-webhook.devmode.handler.js';
import { MOCK_USER, MOCK_TENANT } from './mocks/fixtures.js';

const PORT = Number(process.env['DEMO_PORT'] ?? 3001);
const DASHBOARD_URL = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000';

async function main() {
  const app = Fastify({
    logger: {
      level: 'info',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    },
  });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket);

  app.get('/health', async () => ({ status: 'ok', service: 'dev-server' }));

  // Mock data routes (auth, billing, calls, appointments, patients, …)
  await app.register(mocksPlugin, { prefix: '/api/v1' });

  // Google OAuth — devmode resolver hands back the mock tenant/user
  await app.register(
    googleAuthPlugin({
      resolveUser: async (profile) => ({
        token: 'mock.jwt.google.' + Buffer.from(profile.googleId).toString('base64').slice(0, 12),
        refreshToken: 'mock.refresh.google.' + Math.random().toString(36).slice(2),
        isNewUser: false,
        user: { ...MOCK_USER, email: profile.email, firstName: profile.name?.split(' ')[0] ?? MOCK_USER.firstName },
        tenant: MOCK_TENANT,
      }),
    }),
    { prefix: '/api/v1' }
  );

  // Live Telnyx call → xAI Grok bridge (no DB)
  await app.register(telnyxDevmodePlugin, { prefix: '/api/v1' });

  // Landing-page voice demo (existing)
  await app.register(demoPlugin, { prefix: '/api/v1' });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`🚀 Dev server listening on http://localhost:${PORT}`);
    app.log.info(`   Dashboard origin: ${DASHBOARD_URL}`);
    app.log.info(`   Mock API:         http://localhost:${PORT}/api/v1`);
    app.log.info(`   Activity WS:      ws://localhost:${PORT}/api/v1/ws/activity`);
    app.log.info(`   Telnyx webhook:   http://localhost:${PORT}/api/v1/webhooks/telnyx`);
    app.log.info(`   Voice demo WS:    ws://localhost:${PORT}/api/v1/ws/demo`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
