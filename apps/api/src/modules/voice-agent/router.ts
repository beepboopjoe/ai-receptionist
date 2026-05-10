// ============================================================
// Voice agent router — session management endpoints
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { getCallState } from './session-manager.js';
import { getConversationTranscript, getConversationSummary } from './elevenlabs-client.js';
import { db } from '../../db/client.js';
import { calls } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../../lib/errors.js';

async function voiceAgentRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // Get active call state (for debugging / admin monitoring)
  app.get('/voice/sessions/:rcCallId', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { rcCallId } = request.params as { rcCallId: string };
    const state = await getCallState(rcCallId);
    if (!state) throw new NotFoundError('Call session', rcCallId);
    return state;
  });

  // Manually trigger transcript fetch after a call ends
  app.post('/voice/calls/:callId/fetch-transcript', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { callId } = request.params as { callId: string };
    const tenantId = (request.user as { tenantId: string }).tenantId;

    const [call] = await db
      .select({ id: calls.id, rcCallId: calls.rcCallId })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (!call) throw new NotFoundError('Call', callId);

    // In production, the elevenLabsSessionId would be stored on the call
    // Here we return a placeholder
    return { message: 'Transcript fetch queued', callId };
  });
}

// Extend FastifyInstance with authenticate decorator (registered in admin plugin)
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// Needed for TypeScript to be happy with the imports above
import type { FastifyRequest, FastifyReply } from 'fastify';

export const voiceAgentPlugin = fp(voiceAgentRoutes, { name: 'voice-agent' });
