// ============================================================
// Webhook management router
//
// CRUD for webhook endpoints + read access to delivery history,
// plus a `/test` endpoint that fires a synthetic event so customers
// can verify their receiver is wired up before going live.
//
// Mount under /api/v1 in app.ts.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { webhookEndpoints, webhookDeliveries } from '../../db/schema.js';
import { and, desc, eq } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { auditLog } from '../../audit/audit-logger.js';
import { emitWebhook, generateWebhookSecret, deliverPending } from './webhook.service.js';
import { WEBHOOK_EVENT_TYPES } from '@ai-receptionist/shared';

const VALID_EVENTS = [...WEBHOOK_EVENT_TYPES, '*'];

function validateEvents(events: string): string {
  const list = events.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return '*';
  for (const ev of list) {
    if (!VALID_EVENTS.includes(ev)) {
      throw new ValidationError(`Unknown event "${ev}". Allowed: ${VALID_EVENTS.join(', ')}`);
    }
  }
  return list.join(',');
}

export async function webhookPlugin(app: FastifyInstance): Promise<void> {
  // List endpoints
  app.get(
    '/webhooks/endpoints',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const rows = await db
        .select({
          id: webhookEndpoints.id,
          url: webhookEndpoints.url,
          events: webhookEndpoints.events,
          isActive: webhookEndpoints.isActive,
          description: webhookEndpoints.description,
          lastDeliveredAt: webhookEndpoints.lastDeliveredAt,
          lastFailedAt: webhookEndpoints.lastFailedAt,
          failureCount: webhookEndpoints.failureCount,
          createdAt: webhookEndpoints.createdAt,
        })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.tenantId, tenantId))
        .orderBy(desc(webhookEndpoints.createdAt));
      return reply.send({ data: rows });
    }
  );

  // Create endpoint — secret returned exactly once.
  app.post(
    '/webhooks/endpoints',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { url, events, description } = request.body as {
        url: string;
        events?: string;
        description?: string;
      };

      if (!url || !/^https?:\/\//.test(url)) {
        throw new ValidationError('url must start with http:// or https://');
      }

      const validatedEvents = validateEvents(events ?? '*');
      const secret = generateWebhookSecret();

      const [created] = await db
        .insert(webhookEndpoints)
        .values({ tenantId, url, secret, events: validatedEvents, description })
        .returning();

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'webhook.endpoint_created',
        entityType: 'webhook_endpoint',
        entityId: created.id,
        metadata: { url, events: validatedEvents },
      });

      // Secret returned once at create time — clients must save it.
      return reply.status(201).send({
        ...created,
        secret,
        message: 'Save this signing secret now — it will not be shown again.',
      });
    }
  );

  // Update (everything except secret — rotate via /rotate)
  app.patch(
    '/webhooks/endpoints/:id',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const body = request.body as {
        url?: string;
        events?: string;
        description?: string;
        isActive?: boolean;
      };

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.url !== undefined) {
        if (!/^https?:\/\//.test(body.url)) throw new ValidationError('url must start with http:// or https://');
        patch['url'] = body.url;
      }
      if (body.events !== undefined) patch['events'] = validateEvents(body.events);
      if (body.description !== undefined) patch['description'] = body.description;
      if (body.isActive !== undefined) patch['isActive'] = body.isActive;

      const [updated] = await db
        .update(webhookEndpoints)
        .set(patch)
        .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)))
        .returning();

      if (!updated) throw new NotFoundError('Webhook endpoint not found');
      return reply.send(updated);
    }
  );

  // Rotate secret — old secret stops working immediately.
  app.post(
    '/webhooks/endpoints/:id/rotate',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };

      const newSecret = generateWebhookSecret();
      const [updated] = await db
        .update(webhookEndpoints)
        .set({ secret: newSecret, updatedAt: new Date() })
        .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)))
        .returning();

      if (!updated) throw new NotFoundError('Webhook endpoint not found');

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'webhook.secret_rotated',
        entityType: 'webhook_endpoint',
        entityId: id,
      });

      return reply.send({ id, secret: newSecret, message: 'Save this — old secret no longer valid.' });
    }
  );

  // Delete
  app.delete(
    '/webhooks/endpoints/:id',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };
      const result = await db
        .delete(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)))
        .returning({ id: webhookEndpoints.id });
      if (result.length === 0) throw new NotFoundError('Webhook endpoint not found');

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'webhook.endpoint_deleted',
        entityType: 'webhook_endpoint',
        entityId: id,
      });

      return reply.status(204).send();
    }
  );

  // Send a test event — useful for "verify your receiver works" UX.
  app.post(
    '/webhooks/endpoints/:id/test',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.tenantId, tenantId)))
        .limit(1);
      if (!endpoint) throw new NotFoundError('Webhook endpoint not found');

      // Use 'call.completed' as the test event because it's the most common.
      await emitWebhook(tenantId, 'call.completed', {
        test: true,
        message: 'This is a test webhook delivery. If you see this, your receiver is wired up correctly.',
      });

      return reply.send({ ok: true, message: 'Test event queued for delivery.' });
    }
  );

  // Recent delivery history (debugging)
  app.get(
    '/webhooks/deliveries',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const query = request.query as Record<string, string>;
      const limit = Math.min(parseInt(query['limit'] ?? '50', 10), 200);

      const rows = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.tenantId, tenantId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit);

      return reply.send({ data: rows });
    }
  );

  // Manual drain trigger — useful in dev. In prod a cron should hit this.
  app.post(
    '/webhooks/_drain',
    { onRequest: [app.requireRole("owner")] },
    async (_request, reply) => {
      const result = await deliverPending();
      return reply.send(result);
    }
  );
}
