// ============================================================
// CRM router — contact create, related records, CSV import
// List / get / patch live on adminPlugin. Identify lives on
// workflowPlugin. Duplicating those crashes Fastify after the
// /api/v1 unwrap (FST_ERR_DUPLICATED_ROUTE).
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { db } from '../../db/client.js';
import { calls, appointments } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { createContact } from './crm.service.js';
import { importContactsCsv, getImportJobStatus } from './adapters/csv-import.adapter.js';
import { parsePagination, paginationToOffset } from '../../lib/pagination.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { randomUUID } from 'crypto';

async function crmRoutes(app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  // List / get / patch live on adminPlugin. Internal identify lives
  // on workflowPlugin. Duplicating those here crashes Fastify after
  // the /api/v1 unwrap (FST_ERR_DUPLICATED_ROUTE).

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

// Plain plugin so the `/api/v1` prefix in main.ts applies.
// fastify-plugin (fp) de-encapsulates and mounts these at the ROOT
// instead — dashboard calls `/api/v1/contacts` (create, CSV import,
// history) 404'd while list/get/patch happened to work via adminPlugin.
export const crmPlugin = crmRoutes;
