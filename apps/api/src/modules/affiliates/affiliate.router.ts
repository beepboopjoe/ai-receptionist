// ============================================================
// Affiliate / reseller endpoints (Affiliate v1 — lean referrals).
//
// Platform-owner only routes for managing affiliates + reading
// commission events. Gated by ADMIN_EMAILS via requirePlatformAdmin.
//
// Public / tenant:
//   POST /auth/attribute-affiliate — signup / Google-complete
//   records ?ref= / cookie / typed code. First-touch wins.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { requirePlatformAdmin } from '../platform/platform.router.js';
import {
  attributeTenant,
  listAffiliatesWithStats,
  listAllPayoutRequests,
  updatePayoutRequest,
  approvePartner,
  createAffiliate,
  getAffiliateDetail,
  markCommissionPaid,
} from './affiliate.service.js';

export async function affiliatePlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant-side: attribute the signed-in tenant to a code ───
  app.post('/auth/attribute-affiliate', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { code } = (request.body ?? {}) as { code?: string };
    if (!code) throw new ValidationError('code is required');
    const result = await attributeTenant({
      tenantId: request.authUser.tenantId,
      code,
    });
    if (!result) {
      return reply.code(404).send({ error: 'Invalid or inactive affiliate code' });
    }
    return reply.send({ ok: true, alreadyAttributed: result.alreadyAttributed });
  });

  // ── Platform admin: list affiliates ─────────────────────────
  app.get('/admin/affiliates', { onRequest: [requirePlatformAdmin] }, async (_req, reply) => {
    const rows = await listAffiliatesWithStats();
    return reply.send({ data: rows });
  });

  // ── Platform admin: create an affiliate ─────────────────────
  app.post('/admin/affiliates', { onRequest: [requirePlatformAdmin] }, async (request, reply) => {
    const { name, email, code, commissionPct, flatBountyCents, commissionMonths } = (request.body ?? {}) as {
      name?: string;
      email?: string;
      code?: string;
      commissionPct?: number;
      flatBountyCents?: number | null;
      commissionMonths?: number;
    };
    if (!name || !email) throw new ValidationError('name and email are required');
    const row = await createAffiliate({
      name,
      email,
      ...(code ? { code } : {}),
      ...(commissionPct !== undefined ? { commissionPct } : {}),
      ...(flatBountyCents !== undefined ? { flatBountyCents } : {}),
      ...(commissionMonths !== undefined ? { commissionMonths } : {}),
    });
    return reply.code(201).send(row);
  });

  // ── Platform admin: affiliate detail (tenants + conversions) ─
  app.get<{ Params: { id: string } }>(
    '/admin/affiliates/:id',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const detail = await getAffiliateDetail(request.params.id);
      if (!detail) throw new NotFoundError('Affiliate', request.params.id);
      return reply.send(detail);
    }
  );

  // ── Platform admin: list commission events for one affiliate ─
  app.get<{ Params: { id: string } }>(
    '/admin/affiliates/:id/commissions',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const detail = await getAffiliateDetail(request.params.id);
      if (!detail) throw new NotFoundError('Affiliate', request.params.id);
      return reply.send({ affiliate: detail.affiliate, events: detail.events });
    }
  );

  // ── Platform admin: mark commission as paid out ─────────────
  app.post<{ Params: { id: string } }>(
    '/admin/commissions/:id/mark-paid',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const row = await markCommissionPaid(request.params.id);
      if (!row) throw new NotFoundError('CommissionEvent', request.params.id);
      return reply.send(row);
    }
  );

  // ── Platform admin: approve a pending partner application ────
  app.post<{ Params: { id: string } }>(
    '/admin/affiliates/:id/approve',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const row = await approvePartner(id);
      if (!row) throw new NotFoundError('Affiliate', id);
      return reply.send(row);
    }
  );

  // ── Platform admin: list all payout requests ─────────────────
  app.get(
    '/admin/payout-requests',
    { onRequest: [requirePlatformAdmin] },
    async (_req, reply) => {
      const rows = await listAllPayoutRequests();
      return reply.send({ data: rows });
    }
  );

  // ── Platform admin: update payout request status ─────────────
  app.patch<{ Params: { id: string } }>(
    '/admin/payout-requests/:id',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const { status, adminNote } = (request.body ?? {}) as {
        status?: 'approved' | 'paid' | 'rejected';
        adminNote?: string;
      };
      if (!status || !['approved', 'paid', 'rejected'].includes(status)) {
        throw new ValidationError('status must be approved | paid | rejected');
      }
      const row = await updatePayoutRequest(id, {
        status,
        ...(adminNote !== undefined ? { adminNote } : {}),
      });
      if (!row) throw new NotFoundError('PayoutRequest', id);
      return reply.send(row);
    }
  );
}
