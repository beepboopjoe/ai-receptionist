// ============================================================
// Setup: paste a website (or type a few facts) → knowledge.
// Does not provision numbers and does not flip demo cooldown.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../lib/errors.js';
import {
  getSetupKnowledgeStatus,
  importWebsiteForTenant,
  saveManualFactsForTenant,
} from './website-import.service.js';

export async function setupPlugin(app: FastifyInstance): Promise<void> {
  app.get(
    '/setup/status',
    { onRequest: [app.requireRole('staff')] },
    async (request) => {
      const { tenantId } = request.authUser;
      return getSetupKnowledgeStatus(tenantId);
    },
  );

  app.post(
    '/setup/website',
    {
      onRequest: [app.requireRole('admin', 'owner')],
      config: { rateLimit: { max: 8, timeWindow: '10 minutes' } },
    },
    async (request, reply) => {
      const { tenantId, id: userId } = request.authUser;
      const body = (request.body ?? {}) as { url?: unknown };
      const result = await importWebsiteForTenant(tenantId, body.url, userId ?? null);
      if (!result.ok && result.reason === 'invalid_url') {
        throw new ValidationError(result.message);
      }
      return reply.code(200).send(result);
    },
  );

  app.post(
    '/setup/facts',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request, reply) => {
      const { tenantId, id: userId } = request.authUser;
      const result = await saveManualFactsForTenant(tenantId, request.body, userId ?? null);
      return reply.code(200).send(result);
    },
  );
}
