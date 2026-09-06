// ============================================================
// Scheduler router — availability + cancel
// List / get / patch live on adminPlugin. Internal book/search
// live on workflowPlugin. Duplicating those here crashes Fastify
// after the /api/v1 unwrap (FST_ERR_DUPLICATED_ROUTE).
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getAvailableSlots, cancelAppointment } from './scheduler.service.js';
import { ValidationError } from '../../lib/errors.js';

async function schedulerRoutes(app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  app.get('/appointments/availability', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const query = request.query as { date: string; appointmentType: string; timezone?: string };

    if (!query.date || !query.appointmentType) {
      throw new ValidationError('date and appointmentType are required');
    }

    const slots = await getAvailableSlots({
      tenantId,
      date: new Date(query.date),
      appointmentType: query.appointmentType,
      timezone: query.timezone ?? 'America/New_York',
    });

    return { slots };
  });

  // Admin has no DELETE — cancel stays here.
  app.delete('/appointments/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const { id } = request.params as { id: string };

    await cancelAppointment({ tenantId, appointmentId: id });
    return reply.status(204).send();
  });
}

// Plain plugin so the `/api/v1` prefix in main.ts applies.
// fp() dropped the prefix — `/api/v1/appointments/availability` 404'd.
export const schedulerPlugin = schedulerRoutes;
