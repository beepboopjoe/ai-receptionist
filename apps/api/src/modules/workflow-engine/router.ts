// ============================================================
// Workflow Engine Router — internal endpoints called by voice agent
// Exposes slot search, booking, and contact identification for
// structured tool-calling during Grok Voice conversations.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { getAvailableSlots, bookAppointment } from '../scheduler/scheduler.service.js';
import { identifyCaller, createContact } from '../crm/crm.service.js';
import { getCallState, updateCallState } from '../voice-agent/session-manager.js';
import { ValidationError, NotFoundError } from '../../lib/errors.js';

export async function workflowPlugin(app: FastifyInstance) {
  // Search available slots (called during AI conversation)
  app.post('/internal/slots/search', async (request, reply) => {
    const {
      tenantId,
      date,
      durationMinutes,
      provider,
    } = request.body as {
      tenantId: string;
      date: string; // YYYY-MM-DD
      durationMinutes: number;
      provider?: string;
    };

    if (!tenantId || !date || !durationMinutes) {
      throw new ValidationError('tenantId, date, and durationMinutes are required');
    }

    const slots = await getAvailableSlots({ tenantId, date, durationMinutes, provider });
    return reply.send({ slots });
  });

  // Book an appointment (called after caller confirms slot)
  app.post('/internal/appointments/book', async (request, reply) => {
    const body = request.body as {
      tenantId: string;
      contactId: string;
      callId?: string;
      appointmentType: string;
      startAt: string;
      endAt: string;
      durationMinutes: number;
      attendeeEmail?: string;
      timezone: string;
    };

    if (!body.tenantId || !body.contactId || !body.startAt) {
      throw new ValidationError('tenantId, contactId, and startAt are required');
    }

    const appointment = await bookAppointment({
      ...body,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
    });

    return reply.status(201).send(appointment);
  });

  // Identify a caller by phone number
  app.post('/internal/contacts/identify', async (request, reply) => {
    const { phone, tenantId } = request.body as { phone: string; tenantId: string };
    if (!phone || !tenantId) throw new ValidationError('phone and tenantId are required');

    const contact = await identifyCaller(phone, tenantId);
    return reply.send({ contact });
  });

  // Update call state (e.g., after AI collects data mid-conversation)
  app.patch('/internal/call-state/:rcCallId', async (request, reply) => {
    const { rcCallId } = request.params as { rcCallId: string };
    const patch = request.body as Record<string, unknown>;

    const updated = await updateCallState(rcCallId, patch as any);
    if (!updated) throw new NotFoundError('Call state not found');

    return reply.send({ updated: true });
  });

  // Read current call state
  app.get('/internal/call-state/:rcCallId', async (request, reply) => {
    const { rcCallId } = request.params as { rcCallId: string };
    const state = await getCallState(rcCallId);
    if (!state) throw new NotFoundError('Call state not found');
    return reply.send(state);
  });
}
