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
import { emitWebhook } from '../webhooks/webhook.service.js';
import { pushActivity } from '../activity/activity.service.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const PHONE_E164 = /^\+\d{8,15}$/;

function parseLimit(value: unknown): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(value: unknown): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Parse an ISO 8601 timestamp; throws ValidationError on bad input. */
function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be an ISO 8601 string`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ValidationError(`${field} is not a valid ISO 8601 date`);
  return d;
}

/** True when an error came back from pg as a unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
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

  // ─────────────────────────────────────────────────────────────────────────
  //  WRITE ENDPOINTS — require an API key with `write` scope.
  // ─────────────────────────────────────────────────────────────────────────

  // ── Create contact ─────────────────────────────────────────
  // POST behaves as upsert-on-phone: if a contact already exists for this
  // tenant + phoneE164, we return the existing row (HTTP 200) instead of
  // erroring. That keeps CRM-sync clients idempotent without an explicit
  // Idempotency-Key header.
  app.post(
    '/public/contacts',
    {
      onRequest: [app.requireApiKey('write')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Contacts'],
        summary: 'Create a contact',
        description:
          'Creates a contact. If a contact with the same phone already exists for this tenant, returns the existing record (idempotent). Returns 201 on create, 200 on dedupe.',
        body: {
          type: 'object',
          required: ['firstName', 'lastName', 'phoneE164'],
          properties: {
            firstName: { type: 'string', minLength: 1, maxLength: 80 },
            lastName: { type: 'string', minLength: 1, maxLength: 80 },
            phoneE164: { type: 'string', pattern: '^\\+\\d{8,15}$' },
            email: { type: 'string', format: 'email', nullable: true },
            dateOfBirth: { type: 'string', format: 'date', nullable: true },
            patientType: { type: 'string', maxLength: 40, nullable: true },
            insuranceProvider: { type: 'string', maxLength: 120, nullable: true },
            insuranceId: { type: 'string', maxLength: 80, nullable: true },
            preferredProvider: { type: 'string', maxLength: 120, nullable: true },
            notes: { type: 'string', maxLength: 4000, nullable: true },
            externalCrmId: { type: 'string', maxLength: 120, nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const body = request.body as Record<string, unknown>;
      const phoneE164 = String(body['phoneE164']);
      if (!PHONE_E164.test(phoneE164)) {
        throw new ValidationError('phoneE164 must be E.164 (e.g. +14155551234)');
      }
      const values = {
        tenantId,
        firstName: String(body['firstName']),
        lastName: String(body['lastName']),
        phoneE164,
        email: (body['email'] as string | null | undefined) ?? null,
        dateOfBirth: (body['dateOfBirth'] as string | null | undefined) ?? null,
        patientType: (body['patientType'] as string | undefined) ?? 'existing',
        insuranceProvider: (body['insuranceProvider'] as string | null | undefined) ?? null,
        insuranceId: (body['insuranceId'] as string | null | undefined) ?? null,
        preferredProvider: (body['preferredProvider'] as string | null | undefined) ?? null,
        notes: (body['notes'] as string | null | undefined) ?? null,
        externalCrmId: (body['externalCrmId'] as string | null | undefined) ?? null,
        source: 'api',
      };

      try {
        const [created] = await db.insert(contacts).values(values).returning();
        return reply.code(201).send(created);
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Phone already exists for this tenant — return the existing row.
        const [existing] = await db
          .select()
          .from(contacts)
          .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, phoneE164)))
          .limit(1);
        if (!existing) throw err; // shouldn't happen; bubble original error
        return reply.code(200).send(existing);
      }
    }
  );

  // ── Update contact ─────────────────────────────────────────
  app.patch(
    '/public/contacts/:id',
    {
      onRequest: [app.requireApiKey('write')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Contacts'],
        summary: 'Update a contact',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            firstName: { type: 'string', minLength: 1, maxLength: 80 },
            lastName: { type: 'string', minLength: 1, maxLength: 80 },
            phoneE164: { type: 'string', pattern: '^\\+\\d{8,15}$' },
            email: { type: ['string', 'null'], format: 'email' },
            dateOfBirth: { type: ['string', 'null'], format: 'date' },
            patientType: { type: 'string', maxLength: 40 },
            insuranceProvider: { type: ['string', 'null'], maxLength: 120 },
            insuranceId: { type: ['string', 'null'], maxLength: 80 },
            preferredProvider: { type: ['string', 'null'], maxLength: 120 },
            notes: { type: ['string', 'null'], maxLength: 4000 },
            externalCrmId: { type: ['string', 'null'], maxLength: 120 },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { id } = request.params as { id: string };
      const patch = request.body as Record<string, unknown>;
      if (Object.keys(patch).length === 0) {
        throw new ValidationError('Request body must include at least one field to update');
      }
      try {
        const [updated] = await db
          .update(contacts)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
          .returning();
        if (!updated) throw new NotFoundError('Contact', id);
        return reply.send(updated);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ValidationError('A contact with that phone number already exists for this tenant');
        }
        throw err;
      }
    }
  );

  // ── Delete contact ─────────────────────────────────────────
  app.delete(
    '/public/contacts/:id',
    {
      onRequest: [app.requireApiKey('write')],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Contacts'],
        summary: 'Delete a contact',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { id } = request.params as { id: string };
      const result = await db
        .delete(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
        .returning({ id: contacts.id });
      if (result.length === 0) throw new NotFoundError('Contact', id);
      return reply.code(204).send();
    }
  );

  // ── Create appointment ─────────────────────────────────────
  // Direct DB insert with `calendarProvider: 'external'` — this endpoint
  // does NOT push to Google/Outlook. Callers that want a calendar event
  // should create one in their own system and pass `externalCalendarEventId`
  // (stored in `calendarEventId`) so future reconciliation can find it.
  app.post(
    '/public/appointments',
    {
      onRequest: [app.requireApiKey('write')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Appointments'],
        summary: 'Create an appointment',
        description:
          'Creates an appointment record. Does NOT create a calendar event in Google/Outlook — pass the external event id if your calendar holds the source of truth.',
        body: {
          type: 'object',
          required: ['contactId', 'appointmentType', 'startsAt', 'endsAt'],
          properties: {
            contactId: { type: 'string', format: 'uuid' },
            appointmentType: { type: 'string', minLength: 1, maxLength: 80 },
            startsAt: { type: 'string', format: 'date-time' },
            endsAt: { type: 'string', format: 'date-time' },
            providerName: { type: 'string', maxLength: 120, nullable: true },
            notes: { type: 'string', maxLength: 4000, nullable: true },
            externalCalendarEventId: { type: 'string', maxLength: 240, nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const body = request.body as Record<string, unknown>;

      const contactId = String(body['contactId']);
      // Verify contact belongs to this tenant — prevents cross-tenant FK insertion
      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
        .limit(1);
      if (!contact) throw new NotFoundError('Contact', contactId);

      const startsAt = parseDate(body['startsAt'], 'startsAt');
      const endsAt = parseDate(body['endsAt'], 'endsAt');
      if (endsAt <= startsAt) throw new ValidationError('endsAt must be after startsAt');
      const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
      const appointmentType = String(body['appointmentType']);

      const [created] = await db
        .insert(appointments)
        .values({
          tenantId,
          contactId,
          calendarProvider: 'external',
          calendarEventId: (body['externalCalendarEventId'] as string | null | undefined) ?? null,
          appointmentType,
          providerName: (body['providerName'] as string | null | undefined) ?? null,
          startsAt,
          endsAt,
          durationMinutes,
          status: 'confirmed',
          notes: (body['notes'] as string | null | undefined) ?? null,
        })
        .returning();
      if (!created) throw new Error('Failed to create appointment');

      void emitWebhook(tenantId, 'appointment.booked', {
        appointmentId: created.id,
        contactId,
        appointmentType,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        providerName: created.providerName,
        source: 'public_api',
      });
      pushActivity(tenantId, 'appointment_booked', {
        appointmentId: created.id,
        appointmentType,
        startsAt: startsAt.toISOString(),
      });

      return reply.code(201).send(created);
    }
  );

  // ── Update appointment ─────────────────────────────────────
  app.patch(
    '/public/appointments/:id',
    {
      onRequest: [app.requireApiKey('write')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Appointments'],
        summary: 'Update an appointment',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            appointmentType: { type: 'string', minLength: 1, maxLength: 80 },
            startsAt: { type: 'string', format: 'date-time' },
            endsAt: { type: 'string', format: 'date-time' },
            providerName: { type: ['string', 'null'], maxLength: 120 },
            notes: { type: ['string', 'null'], maxLength: 4000 },
            status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'no_show'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      if (Object.keys(body).length === 0) {
        throw new ValidationError('Request body must include at least one field to update');
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      let newStartsAt: Date | undefined;
      let newEndsAt: Date | undefined;

      if (body['appointmentType'] !== undefined) patch['appointmentType'] = body['appointmentType'];
      if (body['providerName'] !== undefined) patch['providerName'] = body['providerName'];
      if (body['notes'] !== undefined) patch['notes'] = body['notes'];
      if (body['status'] !== undefined) patch['status'] = body['status'];
      if (body['startsAt'] !== undefined) {
        newStartsAt = parseDate(body['startsAt'], 'startsAt');
        patch['startsAt'] = newStartsAt;
      }
      if (body['endsAt'] !== undefined) {
        newEndsAt = parseDate(body['endsAt'], 'endsAt');
        patch['endsAt'] = newEndsAt;
      }
      if (newStartsAt && newEndsAt && newEndsAt <= newStartsAt) {
        throw new ValidationError('endsAt must be after startsAt');
      }
      if (newStartsAt && newEndsAt) {
        patch['durationMinutes'] = Math.round((newEndsAt.getTime() - newStartsAt.getTime()) / 60_000);
      }

      const [updated] = await db
        .update(appointments)
        .set(patch)
        .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
        .returning();
      if (!updated) throw new NotFoundError('Appointment', id);

      if (body['status'] === 'cancelled') {
        void emitWebhook(tenantId, 'appointment.cancelled', {
          appointmentId: updated.id,
          contactId: updated.contactId,
          appointmentType: updated.appointmentType,
          source: 'public_api',
        });
        pushActivity(tenantId, 'appointment_cancelled', {
          appointmentId: updated.id,
          appointmentType: updated.appointmentType,
        });
      }

      return reply.send(updated);
    }
  );

  // ── Cancel appointment (DELETE = soft-cancel, sets status='cancelled') ──
  app.delete(
    '/public/appointments/:id',
    {
      onRequest: [app.requireApiKey('write')],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Appointments'],
        summary: 'Cancel an appointment',
        description: 'Soft-cancels the appointment by setting status to "cancelled". Emits appointment.cancelled.',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { id } = request.params as { id: string };
      const [updated] = await db
        .update(appointments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
        .returning();
      if (!updated) throw new NotFoundError('Appointment', id);

      void emitWebhook(tenantId, 'appointment.cancelled', {
        appointmentId: updated.id,
        contactId: updated.contactId,
        appointmentType: updated.appointmentType,
        source: 'public_api',
      });
      pushActivity(tenantId, 'appointment_cancelled', {
        appointmentId: updated.id,
        appointmentType: updated.appointmentType,
      });

      return reply.code(204).send();
    }
  );

  // ── Update escalation (typically: open → resolved) ─────────
  app.patch(
    '/public/escalations/:id',
    {
      onRequest: [app.requireApiKey('write')],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Escalations'],
        summary: 'Update an escalation',
        description: 'Update status, priority, or resolution note. Emits escalation.resolved when transitioning to status="resolved".',
        params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'dismissed'] },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
            resolutionNote: { type: ['string', 'null'], maxLength: 4000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.apiKey!;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      if (Object.keys(body).length === 0) {
        throw new ValidationError('Request body must include at least one field to update');
      }

      const [before] = await db
        .select({ status: escalations.status })
        .from(escalations)
        .where(and(eq(escalations.id, id), eq(escalations.tenantId, tenantId)))
        .limit(1);
      if (!before) throw new NotFoundError('Escalation', id);

      const patch: Record<string, unknown> = { ...body, updatedAt: new Date() };
      if (body['status'] === 'resolved' && before.status !== 'resolved') {
        patch['resolvedAt'] = new Date();
      }

      const [updated] = await db
        .update(escalations)
        .set(patch)
        .where(and(eq(escalations.id, id), eq(escalations.tenantId, tenantId)))
        .returning();
      if (!updated) throw new NotFoundError('Escalation', id);

      if (body['status'] === 'resolved' && before.status !== 'resolved') {
        void emitWebhook(tenantId, 'escalation.resolved', {
          escalationId: updated.id,
          callId: updated.callId,
          contactId: updated.contactId,
          source: 'public_api',
        });
        pushActivity(tenantId, 'escalation_resolved', {
          escalationId: updated.id,
        });
      }

      return reply.send(updated);
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
