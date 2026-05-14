// ============================================================
// Affiliate / reseller endpoints.
//
// Platform-owner only routes for managing affiliates + reading
// commission events. Gated by the ADMIN_EMAILS env var on top
// of the normal JWT auth.
//
// Public endpoint:
//   POST /auth/attribute-affiliate — called from the signup flow
//   to record the ?ref= attribution. Uses the regular JWT auth so
//   the new tenant is attributing themselves.
// ============================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { affiliates, commissionEvents } from '../../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { AuthError, ValidationError, NotFoundError } from '../../lib/errors.js';
import {
  attributeTenant,
  listAffiliatesWithStats,
  generateAffiliateCode,
  listAllPayoutRequests,
  updatePayoutRequest,
  approvePartner,
} from './affiliate.service.js';

/** Allow only emails in ADMIN_EMAILS (comma-separated). */
async function requirePlatformAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  await request.jwtVerify();
  const allowed = config.ADMIN_EMAILS
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    throw new AuthError('Platform admin not configured — set ADMIN_EMAILS on the API');
  }
  const email = (request.user as { email?: string })?.email?.toLowerCase();
  if (!email || !allowed.includes(email)) {
    throw new AuthError('Platform admin only');
  }
}

export async function affiliatePlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant-side: attribute the signed-in tenant to a code ───
  app.post('/auth/attribute-affiliate', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { code } = (request.body ?? {}) as { code?: string };
    if (!code) throw new ValidationError('code is required');
    const result = await attributeTenant({
      tenantId: request.user!.tenantId,
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
    const { name, email, commissionPct } = (request.body ?? {}) as {
      name?: string;
      email?: string;
      commissionPct?: number;
    };
    if (!name || !email) throw new ValidationError('name and email are required');
    if (commissionPct !== undefined && (commissionPct < 0 || commissionPct > 100)) {
      throw new ValidationError('commissionPct must be 0–100');
    }
    // Generate a unique code — retry on the off chance of collision.
    let code = generateAffiliateCode();
    for (let i = 0; i < 5; i++) {
      const [existing] = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.code, code)).limit(1);
      if (!existing) break;
      code = generateAffiliateCode();
    }
    const [row] = await db
      .insert(affiliates)
      .values({
        code,
        name,
        email: email.toLowerCase().trim(),
        commissionPct: commissionPct !== undefined ? commissionPct.toFixed(2) : '20.00',
      })
      .returning();
    return reply.code(201).send(row);
  });

  // ── Platform admin: list commission events for one affiliate ─
  app.get<{ Params: { id: string } }>(
    '/admin/affiliates/:id/commissions',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1);
      if (!affiliate) throw new NotFoundError('Affiliate', id);
      const events = await db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.affiliateId, id))
        .orderBy(desc(commissionEvents.createdAt));
      return reply.send({ affiliate, events });
    }
  );

  // ── Platform admin: mark commission as paid out ─────────────
  app.post<{ Params: { id: string } }>(
    '/admin/commissions/:id/mark-paid',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const [row] = await db
        .update(commissionEvents)
        .set({ payoutStatus: 'paid_out', paidOutAt: new Date() })
        .where(eq(commissionEvents.id, id))
        .returning();
      if (!row) throw new NotFoundError('CommissionEvent', id);
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
      const row = await updatePayoutRequest(id, { status, adminNote });
      if (!row) throw new NotFoundError('PayoutRequest', id);
      return reply.send(row);
    }
  );
}
