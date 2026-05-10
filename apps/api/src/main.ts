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
import { config } from './config.js';
import { closeDb, db } from './db/client.js';
import { redis } from './db/redis.js';
import { sql } from 'drizzle-orm';
import { AppError } from './lib/errors.js';

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
import { campaignsPlugin } from './modules/campaigns/campaign.router.js';
import { demoPlugin } from './modules/voice-agent/demo.router.js';
import { webhookPlugin } from './modules/webhooks/webhook.router.js';
import { activityGatewayPlugin } from './modules/activity/activity.gateway.js';
import { startWebhookDrainWorker, stopWebhookDrainWorker } from './workers/webhook-drain.worker.js';
import apiKeyMiddleware from './modules/public-api/api-key.middleware.js';
import { apiKeyAdminPlugin } from './modules/public-api/api-key.router.js';
import { publicApiPlugin } from './modules/public-api/public.router.js';
import { openapiPlugin } from './modules/public-api/openapi.plugin.js';

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

  // ---- Health checks (no auth) ----
  // Liveness: process is up. Cheap, no I/O. Used by k8s livenessProbe.
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // Readiness: all backing services reachable. Used by load-balancer
  // readiness probes — when this fails, drop the pod from rotation.
  app.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | string> = {};
    let healthy = true;

    try {
      await db.execute(sql`SELECT 1`);
      checks['db'] = 'ok';
    } catch (err) {
      checks['db'] = err instanceof Error ? err.message : 'fail';
      healthy = false;
    }

    try {
      // ioredis returns 'PONG' on success.
      const pong = await redis.ping();
      checks['redis'] = pong === 'PONG' ? 'ok' : `unexpected: ${pong}`;
      if (pong !== 'PONG') healthy = false;
    } catch (err) {
      checks['redis'] = err instanceof Error ? err.message : 'fail';
      healthy = false;
    }

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks,
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
  await app.register(teamPlugin, { prefix: '/api/v1' });
  await app.register(campaignsPlugin, { prefix: '/api/v1' });
  await app.register(demoPlugin, { prefix: '/api/v1' });
  await app.register(webhookPlugin, { prefix: '/api/v1' });
  await app.register(apiKeyAdminPlugin, { prefix: '/api/v1' });
  await app.register(publicApiPlugin, { prefix: '/api/v1' });
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

  // Start the webhook delivery worker — drains the deliveries queue every
  // 15s, retrying with exponential backoff. Skipped in test mode.
  if (config.NODE_ENV !== 'test') {
    startWebhookDrainWorker();
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully`);
    stopWebhookDrainWorker();
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`🚀 AI Receptionist API running at http://localhost:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
