// ============================================================
// Agent router — dashboard endpoints for the AI suggestion queue.
//
// Routes (all under /api/v1):
//   GET  /agent/suggestions            — list pending (default) or by status
//   POST /agent/suggestions/:id/approve — approve + execute
//   POST /agent/suggestions/:id/skip    — dismiss
//   POST /agent/scan                    — manually run the scanner for this tenant
//   GET  /agent/settings                — current enable / auto-execute flags
//   PUT  /agent/settings                — owner only
// ============================================================
import type { FastifyInstance } from 'fastify';
import {
  scanTenant,
  listSuggestions,
  approveSuggestion,
  skipSuggestion,
  getAgentSettings,
  updateAgentSettings,
} from './agent.service.js';

async function agentRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /agent/suggestions ───────────────────────────────────────────────
  app.get('/agent/suggestions', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { tenantId } = request.authUser;
    const { status, limit } = (request.query ?? {}) as {
      status?: string;
      limit?: string;
    };

    const opts: { status?: string; limit?: number } = {};
    if (status) opts.status = status;
    if (limit) opts.limit = Number(limit);
    const rows = await listSuggestions(tenantId, opts);

    return { data: rows };
  });

  // ── POST /agent/suggestions/:id/approve ──────────────────────────────────
  app.post('/agent/suggestions/:id/approve', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { tenantId, id: userId } = request.authUser;
    const { id } = request.params as { id: string };

    const updated = await approveSuggestion(id, tenantId, userId);
    return { data: updated };
  });

  // ── POST /agent/suggestions/:id/skip ─────────────────────────────────────
  app.post('/agent/suggestions/:id/skip', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { tenantId, id: userId } = request.authUser;
    const { id } = request.params as { id: string };

    const updated = await skipSuggestion(id, tenantId, userId);
    return { data: updated };
  });

  // ── POST /agent/scan ─────────────────────────────────────────────────────
  // Manual trigger for the detectors (useful while testing and as a "Refresh
  // suggestions" button on the dashboard).
  app.post('/agent/scan', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { tenantId } = request.authUser;
    const result = await scanTenant(tenantId);
    return { data: result };
  });

  // ── GET /agent/settings ──────────────────────────────────────────────────
  app.get('/agent/settings', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { tenantId } = request.authUser;
    return await getAgentSettings(tenantId);
  });

  // ── PUT /agent/settings ──────────────────────────────────────────────────
  app.put('/agent/settings', {
    onRequest: [app.requireRole('owner')],
  }, async (request) => {
    const { tenantId } = request.authUser;
    const body = (request.body ?? {}) as {
      agentEnabled?: boolean;
      agentAutoExecute?: boolean;
    };
    await updateAgentSettings(tenantId, body);
    return { ok: true };
  });
}

// NOTE: registered as a plain (encapsulated) plugin so the `/api/v1` prefix in
// main.ts applies. Wrapping in fastify-plugin (fp) de-encapsulates it and drops
// the prefix, which mounts these routes at root and 404s the dashboard.
export const agentPlugin = agentRoutes;
