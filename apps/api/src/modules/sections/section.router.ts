// ============================================================
// Section router — powers the SectionAgent header on each
// dashboard section page. One endpoint per request, cached
// per (tenant, section) for 60 seconds via Redis.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { redis } from '../../db/redis.js';
import { NotFoundError } from '../../lib/errors.js';
import { getSectionSuggestions, isValidSection } from './sections.service.js';

export async function sectionsPlugin(app: FastifyInstance): Promise<void> {
  app.get('/sections/:section/suggestions', {
    preHandler: [app.requireRole('staff')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { section } = request.params as { section: string };

      if (!isValidSection(section)) {
        throw new NotFoundError(`Unknown section: ${section}`);
      }

      // 60-second cache. Section pages re-fetch on focus + every 30s; this
      // bounds DB load when a customer flips between sections rapidly.
      const cacheKey = `sections:${section}:${tenantId}`;
      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) {
        return reply.send(JSON.parse(cached));
      }

      const payload = await getSectionSuggestions(tenantId, section);
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', 60).catch(() => null);
      return reply.send(payload);
    },
  });
}
