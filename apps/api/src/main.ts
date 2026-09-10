// ============================================================
// API Entry Point — Fastify server bootstrap
// ============================================================
// Telemetry MUST be imported first so OpenTelemetry can patch
// Node's modules before anything else loads them. When OTEL_ENABLED
// is unset this is a no-op.
import './telemetry.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { config, configValid, configMissing } from './config.js';
import { localhostAppUrlWarning } from './lib/public-url.js';
import { closeDb, db } from './db/client.js';
import { redis } from './db/redis.js';
import { isTruthyEnv, maybeClearDemoCallMeCooldownsOnBoot } from './modules/public-api/public-demo.helpers.js';
import { maybeEnsureDemoTenantOnBoot } from './modules/public-api/ensure-demo-tenant.js';
import { createDrizzleDemoTenantStore } from './modules/public-api/ensure-demo-tenant.db.js';
import { sql } from 'drizzle-orm';
import { AppError } from './lib/errors.js';
import { livenessBody, probe, probeRedis } from './lib/health.js';

// Auth middleware (must be registered before any protected plugin)
import { authMiddleware } from './modules/admin/auth.middleware.js';
// Module routers
import { telephonyPlugin } from './modules/telephony/router.js';
import { voiceAgentPlugin } from './modules/voice-agent/router.js';
import { schedulerPlugin } from './modules/scheduler/router.js';
import { crmPlugin } from './modules/crm/router.js';
import { workflowPlugin } from './modules/workflow-engine/router.js';
import { notificationsPlugin } from './modules/notifications/router.js';
import { adminPlugin } from './modules/admin/router.js';
import { teamPlugin } from './modules/admin/team.router.js';
import { googleAuthPlugin } from './modules/admin/auth-google.router.js';
import { makeResolveGoogleUser } from './modules/admin/google-auth.service.js';
import { billingPlugin } from './modules/billing/billing.router.js';
import { stripeWebhookPlugin } from './modules/billing/stripe.webhook.js';
import { phoneNumbersPlugin } from './modules/phone-numbers/phone.router.js';
import { affiliatePlugin } from './modules/affiliates/affiliate.router.js';
import { partnerPlugin } from './modules/affiliates/partner.router.js';
import { hubspotOAuthPlugin } from './modules/crm/hubspot-oauth.router.js';
import { googleCalendarOAuthPlugin } from './modules/scheduler/google-calendar-oauth.router.js';
import { campaignsPlugin } from './modules/campaigns/campaign.router.js';
import { demoPlugin } from './modules/voice-agent/demo.router.js';
import { webhookPlugin } from './modules/webhooks/webhook.router.js';
import { activityGatewayPlugin } from './modules/activity/activity.gateway.js';
import { startWebhookDrainWorker, stopWebhookDrainWorker } from './workers/webhook-drain.worker.js';
import apiKeyMiddleware from './modules/public-api/api-key.middleware.js';
import { apiKeyAdminPlugin } from './modules/public-api/api-key.router.js';
import { publicApiPlugin } from './modules/public-api/public.router.js';
import { publicDemoPlugin } from './modules/public-api/public-demo.router.js';
import { publicSiteChatPlugin } from './modules/public-api/site-chat.router.js';
import { sectionsPlugin } from './modules/sections/section.router.js';
import { analyticsPlugin } from './modules/analytics/analytics.router.js';
import { leadDiscoveryPlugin } from './modules/lead-discovery/lead-discovery.router.js';
import { kbPlugin } from './modules/knowledge-base/kb.router.js';
import { emailTemplatesPlugin } from './modules/email-templates/email-templates.router.js';
import { salesforceOAuthPlugin } from './modules/crm/salesforce-oauth.router.js';
import { clioOAuthPlugin } from './modules/crm/clio-oauth.router.js';
import { filevineCredentialsPlugin } from './modules/crm/filevine-credentials.router.js';
import { zohoOAuthPlugin } from './modules/crm/zoho-oauth.router.js';
import { outboundPoolPlugin } from './modules/outbound-pool/pool.router.js';
import { openapiPlugin } from './modules/public-api/openapi.plugin.js';
import { smsPlugin } from './modules/sms/sms.router.js';
import { compliancePlugin } from './modules/compliance/compliance.router.js';
import { agentPlugin } from './modules/agent/agent.router.js';
import { platformPlugin } from './modules/platform/platform.router.js';
import { supportPlugin } from './modules/support/support.router.js';
import { startAgentScannerWorker, stopAgentScannerWorker } from './workers/agent-scanner.worker.js';
import { runMigrations } from './db/run-migrations.js';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'debug' : 'info',
      transport:
        config.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // ---- Core plugins ----
  // Helmet first — sets security headers on every response. CSP is left
  // intentionally permissive for now because the dashboard talks to this
  // API across origins; a proper CSP belongs at the dashboard origin.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: config.NODE_ENV === 'production'
      ? { maxAge: 15552000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'sameorigin' },
    noSniff: true,
  });

  await app.register(cors, {
    origin: config.DASHBOARD_URL,
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
  });

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for CSV imports
  });

  await app.register(websocket);

  // ---- OpenAPI / Swagger UI ----
  // Registered before routers so it can introspect their schemas.
  await app.register(openapiPlugin);

  // ---- Auth middleware (adds app.authenticate decorator) ----
  await app.register(authMiddleware);
  // ---- API key middleware (adds app.requireApiKey decorator) ----
  await app.register(apiKeyMiddleware);

  // ---- Health checks (no auth, not rate-limited) ----
  // Liveness: process is up. Cheap, no I/O. Railway healthcheckPath
  // points here so a Redis/DB blip cannot fail a deploy.
  const healthOpts = { config: { rateLimit: false } };
  app.get('/health', healthOpts, async () => livenessBody());

  // Readiness: backing services reachable. Returns 503 + per-check
  // reasons when DB or Redis is down. Every check is timed so a
  // Redis offline-queue hang can never stall the probe.
  app.get('/health/ready', healthOpts, async (_request, reply) => {
    const checks: Record<string, 'ok' | string> = {};

    checks['config'] = configValid ? 'ok' : `missing: ${configMissing.join(', ') || 'required env'}`;
    checks['db'] = await probe('db', () => db.execute(sql`SELECT 1`));
    checks['redis'] = await probeRedis(redis);

    const appUrlWarning = localhostAppUrlWarning(config.APP_URL, config.NODE_ENV);
    const warnings = appUrlWarning ? [appUrlWarning] : undefined;

    const healthy = configValid && checks['db'] === 'ok' && checks['redis'] === 'ok';
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks,
      ...(warnings ? { warnings } : {}),
      timestamp: new Date().toISOString(),
    });
  });

  // ---- Register module plugins under /api/v1 ----
  await app.register(telephonyPlugin, { prefix: '/api/v1' });
  await app.register(voiceAgentPlugin, { prefix: '/api/v1' });
  await app.register(schedulerPlugin, { prefix: '/api/v1' });
  await app.register(crmPlugin, { prefix: '/api/v1' });
  await app.register(workflowPlugin, { prefix: '/api/v1' });
  await app.register(notificationsPlugin, { prefix: '/api/v1' });
  await app.register(adminPlugin, { prefix: '/api/v1' });
  // Google sign-in routes (/auth/google + /auth/google/callback) under
  // /api/v1. Plugin returns 501 with setup instructions when GOOGLE_AUTH_*
  // env vars are absent, so it's safe to register unconditionally.
  await app.register(googleAuthPlugin({ resolveUser: makeResolveGoogleUser(app) }), { prefix: '/api/v1' });
  await app.register(teamPlugin, { prefix: '/api/v1' });
  await app.register(campaignsPlugin, { prefix: '/api/v1' });
  await app.register(demoPlugin, { prefix: '/api/v1' });
  await app.register(webhookPlugin, { prefix: '/api/v1' });
  await app.register(apiKeyAdminPlugin, { prefix: '/api/v1' });
  await app.register(publicApiPlugin, { prefix: '/api/v1' });
  await app.register(publicDemoPlugin, { prefix: '/api/v1' });
  await app.register(publicSiteChatPlugin, { prefix: '/api/v1' });
  await app.register(sectionsPlugin, { prefix: '/api/v1' });
  await app.register(analyticsPlugin, { prefix: '/api/v1' });
  await app.register(leadDiscoveryPlugin, { prefix: '/api/v1' });
  await app.register(kbPlugin, { prefix: '/api/v1' });
  console.log('[boot] kbPlugin registered (Phase 12.8 KB routes under /api/v1/kb/*)');
  await app.register(emailTemplatesPlugin, { prefix: '/api/v1' });
  console.log('[boot] emailTemplatesPlugin registered (Phase 26c routes under /api/v1/email-templates/*)');
  await app.register(salesforceOAuthPlugin, { prefix: '/api/v1' });
  await app.register(clioOAuthPlugin, { prefix: '/api/v1' });
  await app.register(filevineCredentialsPlugin, { prefix: '/api/v1' });
  await app.register(zohoOAuthPlugin, { prefix: '/api/v1' });
  await app.register(billingPlugin, { prefix: '/api/v1' });
  await app.register(phoneNumbersPlugin, { prefix: '/api/v1' });
  await app.register(outboundPoolPlugin, { prefix: '/api/v1' });
  await app.register(affiliatePlugin, { prefix: '/api/v1' });
  await app.register(partnerPlugin, { prefix: '/api/v1' });
  await app.register(hubspotOAuthPlugin, { prefix: '/api/v1' });
  await app.register(googleCalendarOAuthPlugin, { prefix: '/api/v1' });
  console.log('[boot] googleCalendarOAuthPlugin registered (/api/v1/integrations/google-calendar/*)');
  await app.register(smsPlugin, { prefix: '/api/v1' });
  await app.register(compliancePlugin, { prefix: '/api/v1' });
  await app.register(agentPlugin, { prefix: '/api/v1' });
  await app.register(platformPlugin, { prefix: '/api/v1' });
  await app.register(supportPlugin, { prefix: '/api/v1' });
  // Stripe webhook lives at the root (no /api/v1) so the URL the
  // customer enters in the Stripe dashboard is short and stable.
  // It also needs raw-body capture which the plugin sets up itself.
  await app.register(stripeWebhookPlugin);
  // Activity gateway is mounted at the root (no /api/v1 prefix) so
  // the dashboard's `useActivityFeed` hook can connect to /ws/activity.
  await app.register(activityGatewayPlugin);

  // ---- Global error handler ----
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
        details: error.details,
      });
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'ValidationError',
        message: 'Request validation failed',
        details: error.validation,
      });
    }

    app.log.error(error, 'Unhandled error');
    return reply.status(500).send({
      statusCode: 500,
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    });
  });

  return app;
}

async function main() {
  const app = await buildApp();
  let queueWorker: ChildProcess | undefined;

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully`);
    stopWebhookDrainWorker();
    stopAgentScannerWorker();
    if (queueWorker && !queueWorker.killed) {
      queueWorker.kill('SIGTERM');
    }
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  // Bind first so Railway's /health probe can succeed while migrations run.
  // The previous CMD (`migrate.js && …`) left the port closed until every
  // SQL file applied — a failed or slow migrate made the deploy 502.
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`🚀 Telfin API running at http://localhost:${config.PORT}`);
    app.log.info({ appUrl: config.APP_URL }, 'Public API origin (carrier webhooks + media streams)');
    const appUrlWarning = localhostAppUrlWarning(config.APP_URL, config.NODE_ENV);
    if (appUrlWarning) {
      app.log.warn(appUrlWarning);
    }
    await maybeClearDemoCallMeCooldownsOnBoot(
      isTruthyEnv(config.DEMO_CLEAR_COOLDOWNS_ON_BOOT),
      redis,
      app.log,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  try {
    app.log.info('Running database migrations');
    const result = await runMigrations();
    if (result.ok) {
      app.log.info({ applied: result.applied }, 'Migrations complete');
    } else {
      app.log.error({ reason: result.reason }, 'Migrations skipped');
    }
  } catch (err) {
    app.log.error({ err }, 'Migration failed — process staying up for /health');
  }

  await maybeEnsureDemoTenantOnBoot(
    {
      tenantId: config.DEMO_TENANT_ID,
      ensureFlag: config.DEMO_ENSURE_TENANT,
      nodeEnv: config.NODE_ENV,
    },
    createDrizzleDemoTenantStore(db),
    app.log,
  );

  if (config.NODE_ENV !== 'test') {
    startWebhookDrainWorker();
    startAgentScannerWorker();
    const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'worker.js');
    if (existsSync(workerPath)) {
      queueWorker = spawn(process.execPath, [workerPath], {
        stdio: 'inherit',
        env: process.env,
      });
      queueWorker.on('exit', (code, signal) => {
        app.log.error({ code, signal }, 'Queue worker process exited');
      });
    } else {
      app.log.info('Queue worker not spawned (no dist/worker.js). In dev run `pnpm --filter @ai-receptionist/api dev:worker`.');
    }
  }
}

void main();
