// ============================================================
// Public API router — /api/v1/public/*
//
// All routes are scoped to the API key's tenant (no cross-tenant
// access). Read-only by default; mutation routes call
// `requireApiKey('write')` instead.
//
// Per-key rate limit: 60 req/min (env-tunable). Customers who need
// more can email support.
//
// The shape of every response is stable — adding fields is fine,
// removing or renaming is a breaking change. Versioning lives in
// the URL (`/v1`) so we can introduce `/v2` later without breaking
// existing integrations.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { calls, appointments, contacts, escalations } from '../../db/schema.js';
import { and, eq, desc, asc, count, gte } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '../../lib/errors.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(value: unknown): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(value: unknown): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function publicApiPlugin(app: FastifyInstance): Promise<void> {
  // ── List calls ──────────────────────────────────────────────
  app.get(
    '/public/calls',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Calls'],
        summary: 'List calls',
        description: 'Returns calls handled by the AI receptionist, newest first.',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 50, maximum: 200 },
            offset: { type: 'integer', default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const query = request.query as Record<string, string | undefined>;
      const limit = parseLimit(query['limit']);
      const offset = parseOffset(query['offset']);

      const rows = await db
        .select({
          id: calls.id,
          direction: calls.direction,
          fromNumber: calls.fromNumber,
          toNumber: calls.toNumber,
          status: calls.status,
          startedAt: calls.startedAt,
          endedAt: calls.endedAt,
          durationSeconds: calls.durationSeconds,
          outcome: calls.outcome,
          summary: calls.summary,
        })
        .from(calls)
        .where(eq(calls.tenantId, tenantId))
        .orderBy(desc(calls.startedAt))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(calls)
        .where(eq(calls.tenantId, tenantId));

      return reply.send({ data: rows, total: Number(total), limit, offset });
    }
  );

  // ── Get one call ────────────────────────────────────────────
  app.get(
    '/public/calls/:id',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Calls'],
        summary: 'Get one call by ID',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { id } = request.params as { id: string };
      const [row] = await db
        .select()
        .from(calls)
        .where(and(eq(calls.id, id), eq(calls.tenantId, tenantId)))
        .limit(1);
      if (!row) throw new NotFoundError('Call', id);
      return reply.send(row);
    }
  );

  // ── List appointments ──────────────────────────────────────
  app.get(
    '/public/appointments',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Appointments'],
        summary: 'List appointments',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 50, maximum: 200 },
            offset: { type: 'integer', default: 0 },
            upcoming: { type: 'boolean', description: 'When true, returns only future appointments' },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const query = request.query as Record<string, string | undefined>;
      const limit = parseLimit(query['limit']);
      const offset = parseOffset(query['offset']);
      const upcoming = query['upcoming'] === 'true';

      const conditions = [eq(appointments.tenantId, tenantId)];
      if (upcoming) conditions.push(gte(appointments.startsAt, new Date()));

      const rows = await db
        .select()
        .from(appointments)
        .where(and(...conditions))
        .orderBy(asc(appointments.startsAt))
        .limit(limit)
        .offset(offset);

      return reply.send({ data: rows, limit, offset });
    }
  );

  // ── Get one appointment ────────────────────────────────────
  app.get(
    '/public/appointments/:id',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { tags: ['Appointments'], summary: 'Get one appointment by ID' },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { id } = request.params as { id: string };
      const [row] = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
        .limit(1);
      if (!row) throw new NotFoundError('Appointment', id);
      return reply.send(row);
    }
  );

  // ── List contacts ──────────────────────────────────────────
  app.get(
    '/public/contacts',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { tags: ['Contacts'], summary: 'List contacts' },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const query = request.query as Record<string, string | undefined>;
      const limit = parseLimit(query['limit']);
      const offset = parseOffset(query['offset']);

      const rows = await db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          phoneE164: contacts.phoneE164,
          email: contacts.email,
          patientType: contacts.patientType, // legacy column name; consumers can alias
          createdAt: contacts.createdAt,
        })
        .from(contacts)
        .where(eq(contacts.tenantId, tenantId))
        .orderBy(asc(contacts.lastName), asc(contacts.firstName))
        .limit(limit)
        .offset(offset);

      return reply.send({ data: rows, limit, offset });
    }
  );

  // ── Get one contact ────────────────────────────────────────
  app.get(
    '/public/contacts/:id',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { tags: ['Contacts'], summary: 'Get one contact by ID' },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { id } = request.params as { id: string };
      const [row] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
        .limit(1);
      if (!row) throw new NotFoundError('Contact', id);
      return reply.send(row);
    }
  );

  // ── Lookup contact by phone (handy for CRM enrichment) ────
  app.get(
    '/public/contacts/by-phone/:phone',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['Contacts'],
        summary: 'Look up a contact by E.164 phone number',
        params: {
          type: 'object',
          properties: { phone: { type: 'string', pattern: '^\\+\\d{8,15}$' } },
          required: ['phone'],
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { phone } = request.params as { phone: string };
      if (!/^\+\d{8,15}$/.test(phone)) {
        throw new ValidationError('phone must be E.164 (e.g. +14155551234)');
      }
      const [row] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, phone)))
        .limit(1);
      if (!row) throw new NotFoundError('Contact');
      return reply.send(row);
    }
  );

  // ── List escalations ──────────────────────────────────────
  app.get(
    '/public/escalations',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Escalations'],
        summary: 'List escalations',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 50, maximum: 200 },
            offset: { type: 'integer', default: 0 },
            open: { type: 'boolean', description: 'When true, only open escalations' },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const query = request.query as Record<string, string | undefined>;
      const limit = parseLimit(query['limit']);
      const offset = parseOffset(query['offset']);
      const openOnly = query['open'] === 'true';

      const conditions = [eq(escalations.tenantId, tenantId)];
      if (openOnly) conditions.push(eq(escalations.status, 'open'));

      const rows = await db
        .select()
        .from(escalations)
        .where(and(...conditions))
        .orderBy(desc(escalations.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({ data: rows, limit, offset });
    }
  );

  // ── Whoami — useful for customer integration tests ────────
  app.get(
    '/public/whoami',
    {
      onRequest: [app.requireApiKey('read')],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Echo back the authenticated tenant + scope',
        description: 'Use this to verify your API key is correctly configured in your integration.',
      },
    },
    async (request, reply) => {
      const { tenantId, scope, keyId } = request.apiKey!;
      return reply.send({
        tenantId,
        scope,
        keyId,
        message: 'Authentication successful. Welcome to the Public API.',
      });
    }
  );
}
