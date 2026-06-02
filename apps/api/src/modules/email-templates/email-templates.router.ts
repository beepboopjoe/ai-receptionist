// ============================================================
// Email Templates router (Phase 26c-1).
//
// All endpoints tenant-scoped via the JWT. Mirrors the kb.router
// pattern: plain async-function plugin exported under a
// `…Plugin` alias (avoiding fastify-plugin wrappers — those caused
// route-registration silent-fails in Phase 12.8, fixed in 3e6b3c9).
//
// Endpoints:
//   GET    /email-templates                     — list tenant's templates
//   GET    /email-templates/:id                 — single template
//   POST   /email-templates                     — create
//   PATCH  /email-templates/:id                 — update
//   DELETE /email-templates/:id                 — delete
//   POST   /email-templates/:id/test-send       — render + email to address
//   POST   /email-templates/seed-defaults       — load vertical defaults
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { db } from '../../db/client.js';
import { tenants } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  testSend,
  seedDefaults,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from './email-templates.service.js';
import { ValidationError } from '../../lib/errors.js';

export async function emailTemplatesRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // ---- List ----
  app.get(
    '/email-templates',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      const templates = await listTemplates(tenantId);
      return { templates };
    }
  );

  // ---- Single ----
  app.get<{ Params: { id: string } }>(
    '/email-templates/:id',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      const t = await getTemplate(tenantId, request.params.id);
      return t;
    }
  );

  // ---- Create ----
  app.post(
    '/email-templates',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string };
      const body = request.body as CreateTemplateInput;
      const created = await createTemplate(tenantId, body);
      return reply.code(201).send(created);
    }
  );

  // ---- Update ----
  app.patch<{ Params: { id: string } }>(
    '/email-templates/:id',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      const patch = request.body as UpdateTemplateInput;
      return await updateTemplate(tenantId, request.params.id, patch);
    }
  );

  // ---- Delete ----
  app.delete<{ Params: { id: string } }>(
    '/email-templates/:id',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string };
      await deleteTemplate(tenantId, request.params.id);
      return reply.code(204).send();
    }
  );

  // ---- Test send ----
  app.post<{ Params: { id: string }; Body: { to: string; vars?: Record<string, unknown> } }>(
    '/email-templates/:id/test-send',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      const { to, vars } = request.body;
      if (!to) throw new ValidationError('Recipient email (to) is required');
      await testSend(tenantId, request.params.id, to, vars ?? {});
      return { ok: true, sentTo: to };
    }
  );

  // ---- Seed defaults ----
  app.post(
    '/email-templates/seed-defaults',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      const [tenant] = await db
        .select({ vertical: tenants.vertical })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      const result = await seedDefaults(tenantId, tenant?.vertical ?? null);
      return result;
    }
  );
}

// Plain async-function plugin alias — see kb.router.ts comment for the
// fastify-plugin gotcha we avoid here.
export const emailTemplatesPlugin = emailTemplatesRoutes;
