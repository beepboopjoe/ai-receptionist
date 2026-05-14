// ============================================================
// Voice agent router — session management + voice clone endpoints
// ============================================================
import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { getCallState } from './session-manager.js';
import { db } from '../../db/client.js';
import { calls, tenants } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import {
  uploadVoiceClone,
  deleteVoiceClone,
  getVoiceCloneStatus,
  type VoiceCloneFile,
} from './voice-clone.service.js';

// ---- Add-on gate ----
// Voice cloning requires the Voice Clone add-on subscription ($49/mo).
// The flag is set by the Stripe webhook on checkout.session.completed.
async function assertVoiceCloneAddon(tenantId: string): Promise<void> {
  const [tenant] = await db
    .select({ voiceCloneAddon: tenants.voiceCloneAddon })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) throw new NotFoundError('Tenant', tenantId);
  if (!tenant.voiceCloneAddon) {
    throw new ValidationError(
      'Voice cloning requires the Voice Clone add-on ($49/mo). Subscribe at Settings → Voice Agent.'
    );
  }
}

async function voiceAgentRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // ── Existing session endpoints ──────────────────────────────────────────

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

    return { message: 'Transcript fetch queued', callId };
  });

  // ── Voice Clone endpoints ───────────────────────────────────────────────

  /**
   * GET /settings/voice/clone
   * Returns the current voice clone status for the authenticated tenant.
   */
  app.get('/settings/voice/clone', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string };
    const status = await getVoiceCloneStatus(tenantId);
    return reply.send(status);
  });

  /**
   * POST /settings/voice/clone
   * Upload 1–5 audio files (multipart) to create an Instant Voice Clone.
   * Requires growth or scale plan.
   *
   * Form fields:
   *   name  — string (voice display name, max 80 chars)
   *   files — up to 5 audio files (mp3/wav/m4a/ogg/flac/webm)
   */
  app.post('/settings/voice/clone', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string };
    await assertVoiceCloneAddon(tenantId);

    // Collect multipart parts
    const parts = request.parts();
    let name = 'My Custom Voice';
    const files: VoiceCloneFile[] = [];

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'name') {
        name = String(part.value).trim() || name;
      } else if (part.type === 'file') {
        // Buffer the entire file into memory. Capped by @fastify/multipart's
        // fileSize limit (10 MB set in main.ts) so this is bounded.
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        files.push({
          buffer: Buffer.concat(chunks),
          filename: part.filename ?? `sample-${files.length + 1}.mp3`,
          mimetype: part.mimetype,
        });
      }
    }

    const result = await uploadVoiceClone(tenantId, files, name);
    return reply.code(201).send(result);
  });

  /**
   * DELETE /settings/voice/clone
   * Remove the tenant's voice clone from ElevenLabs and clear the DB record.
   */
  app.delete('/settings/voice/clone', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { tenantId } = request.user as { tenantId: string };
    await deleteVoiceClone(tenantId);
    return reply.send({ ok: true });
  });
}

export const voiceAgentPlugin = fp(voiceAgentRoutes, { name: 'voice-agent' });
