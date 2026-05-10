// ============================================================
// CRM router — contacts CRUD + CSV import + caller identification
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../../db/client.js';
import { contacts, calls, appointments } from '../../db/schema.js';
import { eq, and, desc, count, or, ilike } from 'drizzle-orm';
import { identifyCaller, createContact, updateContact, searchContacts } from './crm.service.js';
import { importContactsCsv, getImportJobStatus } from './adapters/csv-import.adapter.js';
import { parsePagination, paginationToOffset, buildPaginatedResponse } from '../../lib/pagination.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { randomUUID } from 'crypto';

async function crmRoutes(app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  // ---- Internal: identify caller (used by voice agent) ----
  app.post('/internal/contacts/identify', async (request) => {
    const { tenantId, phone } = request.body as { tenantId: string; phone: string };
    const contact = await identifyCaller(phone, tenantId);
    return { contact, isNew: !contact };
  });

  // ---- Admin: list contacts ----
  app.get('/contacts', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const query = request.query as { q?: string };
    const pagination = parsePagination(request.query as Record<string, unknown>);
    const { limit, offset } = paginationToOffset(pagination);

    let whereClause = and(eq(contacts.tenantId, tenantId));
    if (query.q) {
      const term = `%${query.q}%`;
      whereClause = and(
        eq(contacts.tenantId, tenantId),
        or(ilike(contacts.firstName, term), ilike(contacts.lastName, term), ilike(contacts.phoneE164, term))
      );
    }

    const [rows, [{ value: total }]] = await Promise.all([
      db.select().from(contacts).where(whereClause).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset),
      db.select({ value: count() }).from(contacts).where(whereClause),
    ]);

    return buildPaginatedResponse(rows, Number(total), pagination);
  });

  // ---- Admin: get contact ----
  app.get('/contacts/:id', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const { id } = request.params as { id: string };

    const [contact] = await db.select().from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId))).limit(1);

    if (!contact) throw new NotFoundError('Contact', id);
    return contact;
  });

  // ---- Admin: contact call history ----
  app.get('/contacts/:id/calls', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const { id } = request.params as { id: string };
    const pagination = parsePagination(request.query as Record<string, unknown>);
    const { limit, offset } = paginationToOffset(pagination);

    const rows = await db.select().from(calls)
      .where(and(eq(calls.contactId, id), eq(calls.tenantId, tenantId)))
      .orderBy(desc(calls.startedAt)).limit(limit).offset(offset);

    return { data: rows };
  });

  // ---- Admin: contact appointment history ----
  app.get('/contacts/:id/appointments', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const { id } = request.params as { id: string };

    const rows = await db.select().from(appointments)
      .where(and(eq(appointments.contactId, id), eq(appointments.tenantId, tenantId)))
      .orderBy(desc(appointments.startsAt));

    return { data: rows };
  });

  // ---- Admin: create contact ----
  app.post('/contacts', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const body = request.body as Parameters<typeof createContact>[0];

    if (!body.firstName || !body.lastName || !body.phoneE164) {
      throw new ValidationError('firstName, lastName, and phoneE164 are required');
    }

    const contact = await createContact({ ...body, source: 'manual' }, tenantId);
    return reply.status(201).send(contact);
  });

  // ---- Admin: update contact ----
  app.patch('/contacts/:id', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const { id } = request.params as { id: string };
    const body = request.body as Parameters<typeof updateContact>[1];

    return updateContact(id, body, tenantId);
  });

  // ---- CSV Import ----
  app.post('/contacts/import/csv', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request.user as { tenantId: string }).tenantId;
    const data = await request.file();

    if (!data) throw new ValidationError('CSV file is required');
    if (!data.filename.endsWith('.csv') && data.mimetype !== 'text/csv') {
      throw new ValidationError('Only CSV files are accepted');
    }

    const csvBuffer = await data.toBuffer();
    const jobId = randomUUID();

    // Process asynchronously
    void importContactsCsv({ tenantId, jobId, csvBuffer });

    return reply.status(202).send({ jobId, status: 'pending' });
  });

  app.get('/contacts/import/:jobId', { preHandler: [app.authenticate] }, async (request) => {
    const { jobId } = request.params as { jobId: string };
    const status = await getImportJobStatus(jobId);
    if (!status) throw new NotFoundError('Import job', jobId);
    return status;
  });
}

export const crmPlugin = fp(crmRoutes, { name: 'crm' });
