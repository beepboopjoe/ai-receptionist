// ============================================================
// Workflow Engine Router — internal endpoints called by voice agent
// Exposes call-state read/update for structured tool-calling during
// Grok Voice conversations. Slot search, booking, and contact
// identification are handled by the scheduler and CRM routers
// respectively — see schedulerPlugin (/internal/slots/search,
// /internal/appointments/book) and crmPlugin (/internal/contacts/identify).
// ============================================================
import type { FastifyInstance } from 'fastify';
import { getCallState, updateCallState } from '../voice-agent/session-manager.js';
import { NotFoundError } from '../../lib/errors.js';

export async function workflowPlugin(app: FastifyInstance) {
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
