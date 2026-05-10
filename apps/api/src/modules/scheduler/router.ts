// ============================================================
// Scheduler router — appointment CRUD + availability
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../../db/client.js';
import { appointments } from '../../db/schema.js';
import { eq, and, desc, count } from 'drizzle-orm';
import { getAvailableSlots, bookAppointment, rescheduleAppointment, cancelAppointment } from './scheduler.service.js';
import { parsePagination, paginationToOffset, buildPaginatedResponse } from '../../lib/pagination.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

async function schedulerRoutes(app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  // ---- Availability ----
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

  // ---- Internal endpoints (called by voice agent, no user auth) ----
  app.post('/internal/slots/search', async (request) => {
    const { tenantId, date, appointmentType, timezone } = request.body as {
      tenantId: string;
      date: string;
      appointmentType: string;
      timezone: string;
    };

    const slots = await getAvailableSlots({
      tenantId,
      date: new Date(date),
      appointmentType,
      timezone,
    });

    // Return only the first 3 available slots (max offered to caller)
    return { slots: slots.slice(0, 3) };
  });

  app.post('/internal/appointments/book', async (request) => {
    const body = request.body as {
      tenantId: string;
      contactId: string;
      callId?: string;
      appointmentType: string;
      providerName?: string;
      startAt: string;
      endAt: string;
      durationMinutes: number;
      notes?: string;
      attendeeEmail?: string;
      timezone: string;
    };

    const appointment = await bookAppointment({
      ...body,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
    });

    return { appointment };
  });

  // ---- Admin CRUD ----
  app.get('/appointments', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const pagination = parsePagination(request.query as Record<string, unknown>);
    const { limit, offset } = paginationToOffset(pagination);

    const [rows, [{ value: total }]] = await Promise.all([
      db.select().from(appointments).where(eq(appointments.tenantId, tenantId))
        .orderBy(desc(appointments.startsAt)).limit(limit).offset(offset),
      db.select({ value: count() }).from(appointments).where(eq(appointments.tenantId, tenantId)),
    ]);

    return buildPaginatedResponse(rows, Number(total), pagination);
  });

  app.get('/appointments/:id', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const { id } = request.params as { id: string };

    const [appt] = await db.select().from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
      .limit(1);

    if (!appt) throw new NotFoundError('Appointment', id);
    return appt;
  });

  app.patch('/appointments/:id', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const { id } = request.params as { id: string };
    const body = request.body as { newStartAt?: string; newEndAt?: string; timezone?: string; status?: string };

    if (body.newStartAt && body.newEndAt) {
      return rescheduleAppointment({
        tenantId,
        appointmentId: id,
        newStartAt: new Date(body.newStartAt),
        newEndAt: new Date(body.newEndAt),
        timezone: body.timezone ?? 'America/New_York',
      });
    }

    // Simple status update
    const [updated] = await db.update(appointments)
      .set({ status: body.status ?? 'confirmed', updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
      .returning();

    if (!updated) throw new NotFoundError('Appointment', id);
    return updated;
  });

  app.delete('/appointments/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const { id } = request.params as { id: string };

    await cancelAppointment({ tenantId, appointmentId: id });
    return reply.status(204).send();
  });
}

export const schedulerPlugin = fp(schedulerRoutes, { name: 'scheduler' });
