// ============================================================
// Support Router
//
// Tenant-facing:
//  POST /support/tickets  — submit a new ticket (authenticated)
//  GET  /support/tickets  — list my tenant's tickets (authenticated)
//
// Platform-admin:
//  GET  /platform/support/tickets             — list ALL tickets
//  POST /platform/support/tickets/:id/resolve — mark resolved
//  POST /platform/support/tickets/:id/reopen  — reopen a resolved ticket
// ============================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config.js';
import { AuthError, ValidationError } from '../../lib/errors.js';
import {
  createSupportTicket,
  listMyTickets,
  listAllTickets,
  resolveTicket,
  reopenTicket,
  type SupportCategory,
  type SupportStatus,
} from './support.service.js';

const VALID_CATEGORIES: ReadonlySet<SupportCategory> = new Set([
  'bug', 'question', 'billing', 'feature_request',
]);

/** Gate for /platform/support/* endpoints — caller's JWT email must be in ADMIN_EMAILS. */
async function requirePlatformAdmin(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
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

export async function supportPlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant: submit a new ticket ──────────────────────────────────────
  app.post(
    '/support/tickets',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        category?: string;
        subject?: string;
        message?: string;
      };

      if (!body.category || !VALID_CATEGORIES.has(body.category as SupportCategory)) {
        throw new ValidationError(
          `category must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}`
        );
      }
      const subject = (body.subject ?? '').trim();
      const message = (body.message ?? '').trim();
      if (subject.length === 0 || subject.length > 200) {
        throw new ValidationError('subject must be 1-200 characters');
      }
      if (message.length === 0 || message.length > 5000) {
        throw new ValidationError('message must be 1-5000 characters');
      }

      const ticket = await createSupportTicket({
        tenantId: request.authUser.tenantId,
        submittedBy: request.authUser.id,
        submitterEmail: request.authUser.email,
        submitterName: null, // schema.adminUsers.firstName/lastName not on authUser; backend looks up if needed
        category: body.category as SupportCategory,
        subject,
        message,
      });

      return reply.send({ ok: true, ticket });
    }
  );

  // ── Tenant: list own tickets ─────────────────────────────────────────
  app.get(
    '/support/tickets',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const tickets = await listMyTickets(request.authUser.tenantId);
      return reply.send({ data: tickets });
    }
  );

  // ── Platform admin: list all tickets ─────────────────────────────────
  app.get(
    '/platform/support/tickets',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const q = request.query as { status?: string; category?: string };
      const filter: { status?: SupportStatus; category?: SupportCategory } = {};
      if (q.status === 'open' || q.status === 'resolved') {
        filter.status = q.status;
      }
      if (q.category && VALID_CATEGORIES.has(q.category as SupportCategory)) {
        filter.category = q.category as SupportCategory;
      }
      const tickets = await listAllTickets(filter);
      return reply.send({ data: tickets });
    }
  );

  // ── Platform admin: mark resolved ────────────────────────────────────
  app.post(
    '/platform/support/tickets/:id/resolve',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      // request.user is the raw JWT payload (sub = admin_user.id) since this
      // gate uses jwtVerify directly rather than the full authenticate decorator.
      const resolvedBy = (request.user as { sub?: string })?.sub ?? '';
      const ticket = await resolveTicket(id, resolvedBy);
      return reply.send({ ok: true, ticket });
    }
  );

  // ── Platform admin: reopen ───────────────────────────────────────────
  app.post(
    '/platform/support/tickets/:id/reopen',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const ticket = await reopenTicket(id);
      return reply.send({ ok: true, ticket });
    }
  );
}
