// ============================================================
// Notifications Router — admin-facing notification endpoints
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { notifications } from '../../db/schema.js';
import { and, eq, desc } from 'drizzle-orm';
import { queueNotification } from './notification.service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

export async function notificationsPlugin(app: FastifyInstance) {
  // List notifications for tenant (paginated)
  app.get(
    '/notifications',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const query = request.query as Record<string, string>;
      const limit = Math.min(parseInt(query['limit'] ?? '50', 10), 200);
      const offset = parseInt(query['offset'] ?? '0', 10);

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.tenantId, tenantId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({ data: rows, limit, offset });
    }
  );

  // Manually resend a failed notification
  app.post(
    '/notifications/:id/resend',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };

      const [notification] = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.tenantId, tenantId)))
        .limit(1);

      if (!notification) throw new NotFoundError('Notification not found');
      if (notification.status !== 'failed') {
        throw new ValidationError('Can only resend failed notifications');
      }

      // Re-queue
      await queueNotification({
        tenantId,
        type: notification.type as any,
        channel: notification.channel as 'sms' | 'email',
        contactId: notification.contactId ?? undefined,
        appointmentId: notification.appointmentId ?? undefined,
        callId: notification.callId ?? undefined,
        metadata: { resend: true },
      });

      return reply.send({ queued: true });
    }
  );

  // Send a manual reminder
  app.post(
    '/notifications/reminder/send',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { type, channel, contactId, appointmentId, metadata } = request.body as {
        type: string;
        channel: 'sms' | 'email';
        contactId?: string;
        appointmentId?: string;
        metadata?: Record<string, unknown>;
      };

      if (!type || !channel) throw new ValidationError('type and channel are required');

      await queueNotification({
        tenantId,
        type: type as any,
        channel,
        contactId,
        appointmentId,
        metadata: metadata ?? {},
      });

      return reply.status(202).send({ queued: true });
    }
  );
}
