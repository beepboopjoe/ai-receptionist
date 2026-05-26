// ============================================================
// Lead Discovery router — Phase 12.7.
//
// Endpoints:
//   POST /leads/discover/preview      — cost estimate
//   POST /leads/discover/jobs         — start a scrape
//   GET  /leads/discover/jobs         — list past jobs
//   GET  /leads/discover/jobs/:id     — poll status / fetch results
//   POST /leads/discover/jobs/:id/import — import selected leads
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { leadDiscoveryJobs } from '../../db/schema.js';
import { and, eq, desc } from 'drizzle-orm';
import { config } from '../../config.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import {
  estimateCost,
  startDiscovery,
  importToContacts,
  type DiscoverySearchParams,
  type ImportParams,
} from './lead-discovery.service.js';

export async function leadDiscoveryPlugin(app: FastifyInstance): Promise<void> {
  // Single setup-check guard — every endpoint depends on Apify being configured.
  function requireApifyConfigured(reply: any): boolean {
    if (!config.APIFY_API_TOKEN) {
      reply.status(503).send({
        error: 'apify_unavailable',
        message:
          'Lead Discovery is not enabled on this environment. Set APIFY_API_TOKEN to activate.',
      });
      return false;
    }
    return true;
  }

  // ── POST /leads/discover/preview ──────────────────────────────────────────
  app.post('/leads/discover/preview', {
    preHandler: [app.requireRole('admin')],
    async handler(request, reply) {
      if (!requireApifyConfigured(reply)) return;
      const body = request.body as Partial<DiscoverySearchParams>;
      if (!body.query || !body.locationQuery || !body.maxResults) {
        throw new ValidationError('query, locationQuery, and maxResults are required');
      }
      const estimate = estimateCost(body as DiscoverySearchParams);
      return reply.send(estimate);
    },
  });

  // ── POST /leads/discover/jobs — start a scrape ────────────────────────────
  app.post('/leads/discover/jobs', {
    preHandler: [app.requireRole('admin')],
    async handler(request, reply) {
      if (!requireApifyConfigured(reply)) return;
      const { tenantId } = request.authUser;
      const body = request.body as DiscoverySearchParams;
      const result = await startDiscovery(tenantId, body);
      return reply.status(201).send({ ...result, status: 'running' });
    },
  });

  // ── GET /leads/discover/jobs — list past jobs ─────────────────────────────
  app.get('/leads/discover/jobs', {
    preHandler: [app.requireRole('staff')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const rows = await db
        .select()
        .from(leadDiscoveryJobs)
        .where(eq(leadDiscoveryJobs.tenantId, tenantId))
        .orderBy(desc(leadDiscoveryJobs.createdAt))
        .limit(30);
      return reply.send({ data: rows });
    },
  });

  // ── GET /leads/discover/jobs/:id — poll status, fetch results ─────────────
  app.get('/leads/discover/jobs/:id', {
    preHandler: [app.requireRole('staff')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const [job] = await db
        .select()
        .from(leadDiscoveryJobs)
        .where(
          and(eq(leadDiscoveryJobs.id, id), eq(leadDiscoveryJobs.tenantId, tenantId))
        )
        .limit(1);
      if (!job) throw new NotFoundError('Lead discovery job not found');
      return reply.send(job);
    },
  });

  // ── POST /leads/discover/jobs/:id/import — import selected leads ──────────
  app.post('/leads/discover/jobs/:id/import', {
    preHandler: [app.requireRole('admin')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const body = request.body as ImportParams;
      const result = await importToContacts(tenantId, id, body ?? {});
      return reply.status(201).send(result);
    },
  });
}
