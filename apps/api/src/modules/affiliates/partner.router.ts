// ============================================================
// Partner Portal Router — V2 self-serve partner endpoints
//
// Public (no auth):
//   POST /partners/apply   — self-register as a partner
//   POST /partners/login   — email + password → JWT
//
// Partner-authenticated (requirePartner middleware):
//   GET  /partners/me                — own profile + aggregate stats
//   GET  /partners/commissions       — own commission event list
//   GET  /partners/payout-requests   — own payout request history
//   POST /partners/payout-requests   — request a payout
//   PATCH /partners/profile          — update payout email / method
//
// Partner JWTs carry { affiliateId, role: 'partner', email }.
// The requirePartner helper checks for role === 'partner'.
// ============================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthError, ValidationError, NotFoundError } from '../../lib/errors.js';
import {
  applyAsPartner,
  loginPartner,
  getPartnerProfile,
  getPartnerCommissions,
  createPayoutRequest,
  getPartnerPayoutRequests,
} from './affiliate.service.js';
import { db } from '../../db/client.js';
import { affiliates } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

// ── Auth middleware ───────────────────────────────────────────────────────────

async function requirePartner(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  await request.jwtVerify();
  const user = request.user as { affiliateId?: string; role?: string };
  if (user.role !== 'partner' || !user.affiliateId) {
    throw new AuthError('Partner access required');
  }
}

function getPartnerId(request: FastifyRequest): string {
  return (request.user as { affiliateId: string }).affiliateId;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export async function partnerPlugin(app: FastifyInstance): Promise<void> {

  // ── POST /partners/apply ──────────────────────────────────────────────────
  app.post('/partners/apply', async (request, reply) => {
    const { name, email, password } = (request.body ?? {}) as {
      name?: string;
      email?: string;
      password?: string;
    };
    if (!name?.trim()) throw new ValidationError('name is required');
    if (!email?.trim()) throw new ValidationError('email is required');
    if (!password || password.length < 8) {
      throw new ValidationError('password must be at least 8 characters');
    }

    const result = await applyAsPartner({ name, email, password });
    if (!result) {
      return reply.code(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'An account with this email already exists',
      });
    }

    return reply.code(201).send({
      ok: true,
      status: result.status,
      message: "Application received! We'll review and activate your account within 24 hours.",
    });
  });

  // ── POST /partners/login ──────────────────────────────────────────────────
  app.post('/partners/login', async (request, reply) => {
    const { email, password } = (request.body ?? {}) as {
      email?: string;
      password?: string;
    };
    if (!email || !password) throw new ValidationError('email and password are required');

    const affiliate = await loginPartner({ email, password });
    if (!affiliate) throw new AuthError('Invalid email or password');

    // Issue a partner-scoped JWT (same secret as tenant JWTs)
    const token = app.jwt.sign(
      { affiliateId: affiliate.id, role: 'partner', email: affiliate.email },
      { expiresIn: '7d' }
    );

    return reply.send({
      token,
      partner: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        code: affiliate.code,
        status: affiliate.status,
        commissionPct: affiliate.commissionPct,
      },
    });
  });

  // ── GET /partners/me ──────────────────────────────────────────────────────
  app.get('/partners/me', { onRequest: [requirePartner] }, async (request, reply) => {
    const profile = await getPartnerProfile(getPartnerId(request));
    if (!profile) throw new NotFoundError('Partner', getPartnerId(request));
    return reply.send(profile);
  });

  // ── GET /partners/commissions ─────────────────────────────────────────────
  app.get('/partners/commissions', { onRequest: [requirePartner] }, async (request, reply) => {
    const events = await getPartnerCommissions(getPartnerId(request));
    return reply.send({ data: events });
  });

  // ── GET /partners/payout-requests ─────────────────────────────────────────
  app.get('/partners/payout-requests', { onRequest: [requirePartner] }, async (request, reply) => {
    const requests = await getPartnerPayoutRequests(getPartnerId(request));
    return reply.send({ data: requests });
  });

  // ── POST /partners/payout-requests ────────────────────────────────────────
  app.post('/partners/payout-requests', { onRequest: [requirePartner] }, async (request, reply) => {
    const { amountCents, payoutEmail, payoutMethod, note } = (request.body ?? {}) as {
      amountCents?: number;
      payoutEmail?: string;
      payoutMethod?: string;
      note?: string;
    };
    if (!amountCents || amountCents <= 0) {
      throw new ValidationError('amountCents must be a positive integer');
    }
    if (!payoutEmail?.trim()) throw new ValidationError('payoutEmail is required');

    const result = await createPayoutRequest({
      affiliateId: getPartnerId(request),
      requestedAmountCents: Math.floor(amountCents),
      payoutEmail: payoutEmail.trim(),
      payoutMethod: payoutMethod ?? 'paypal',
      note,
    });

    if ('error' in result) {
      return reply.code(400).send({ statusCode: 400, error: 'BadRequest', message: result.error });
    }

    return reply.code(201).send(result);
  });

  // ── PATCH /partners/profile ───────────────────────────────────────────────
  app.patch('/partners/profile', { onRequest: [requirePartner] }, async (request, reply) => {
    const { payoutEmail, payoutMethod } = (request.body ?? {}) as {
      payoutEmail?: string;
      payoutMethod?: string;
    };

    if (!payoutEmail && !payoutMethod) {
      throw new ValidationError('No updatable fields provided');
    }

    const [row] = await db
      .update(affiliates)
      .set({
        ...(payoutEmail !== undefined && { payoutEmail: payoutEmail.trim() }),
        ...(payoutMethod !== undefined && { payoutMethod }),
      })
      .where(eq(affiliates.id, getPartnerId(request)))
      .returning({ id: affiliates.id, payoutEmail: affiliates.payoutEmail, payoutMethod: affiliates.payoutMethod });

    return reply.send(row);
  });
}
