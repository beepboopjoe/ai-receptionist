import type { FastifyInstance } from 'fastify';
import {
  createCampaign,
  listCampaigns,
  getCampaign,
  getCampaignStats,
  upsertLeadsFromCsv,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  listCampaignContacts,
  updateCampaignContact,
} from './campaign.service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

export async function campaignsPlugin(app: FastifyInstance) {
  // ---- List campaigns ----
  app.get('/campaigns', {
    preHandler: [app.requireRole("staff")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { status } = request.query as { status?: string };
      const campaigns = await listCampaigns(tenantId, status);
      reply.send({ data: campaigns });
    },
  });

  // ---- Create campaign ----
  app.post('/campaigns', {
    preHandler: [app.requireRole("admin")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const body = request.body as {
        name: string;
        fromNumber: string;
        dialWindowStart?: string;
        dialWindowEnd?: string;
        maxRetries?: number;
        retryDelayMinutes?: number;
        maxConcurrentCalls?: number;
        voicemailMessage?: string;
      };

      if (!body.name || !body.fromNumber) {
        throw new ValidationError('name and fromNumber are required');
      }

      const campaign = await createCampaign({ tenantId, ...body });
      reply.code(201).send(campaign);
    },
  });

  // ---- Get campaign ----
  app.get('/campaigns/:id', {
    preHandler: [app.requireRole("staff")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const campaign = await getCampaign(id, tenantId);
      if (!campaign) throw new NotFoundError('Campaign not found');
      reply.send(campaign);
    },
  });

  // ---- Upload leads CSV ----
  app.post('/campaigns/:id/leads/upload', {
    preHandler: [app.requireRole("admin")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };

      const campaign = await getCampaign(id, tenantId);
      if (!campaign) throw new NotFoundError('Campaign not found');

      // Read multipart file
      const data = await request.file();
      if (!data) throw new ValidationError('No file uploaded');

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const result = await upsertLeadsFromCsv(id, tenantId, buffer);
      reply.send(result);
    },
  });

  // ---- Start campaign ----
  app.post('/campaigns/:id/start', {
    preHandler: [app.requireRole("admin")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      try {
        const campaign = await startCampaign(id, tenantId);
        reply.send(campaign);
      } catch (err: any) {
        throw new ValidationError(err.message);
      }
    },
  });

  // ---- Pause campaign ----
  app.post('/campaigns/:id/pause', {
    preHandler: [app.requireRole("admin")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const campaign = await pauseCampaign(id, tenantId);
      reply.send(campaign);
    },
  });

  // ---- Cancel campaign ----
  app.post('/campaigns/:id/cancel', {
    preHandler: [app.requireRole("admin")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const campaign = await cancelCampaign(id, tenantId);
      reply.send(campaign);
    },
  });

  // ---- Get campaign stats ----
  app.get('/campaigns/:id/stats', {
    preHandler: [app.requireRole("staff")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const stats = await getCampaignStats(id, tenantId);
      if (!stats) throw new NotFoundError('Campaign not found');
      reply.send(stats);
    },
  });

  // ---- List campaign contacts ----
  app.get('/campaigns/:id/contacts', {
    preHandler: [app.requireRole("staff")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const query = request.query as { status?: string; limit?: string; offset?: string };
      const result = await listCampaignContacts(id, tenantId, {
        status: query.status,
        limit: query.limit ? parseInt(query.limit) : 50,
        offset: query.offset ? parseInt(query.offset) : 0,
      });
      reply.send(result);
    },
  });

  // ---- Update campaign contact (manual override) ----
  app.patch('/campaigns/:id/contacts/:contactId', {
    preHandler: [app.requireRole("staff")],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id, contactId } = request.params as { id: string; contactId: string };
      const body = request.body as {
        status?: string;
        outcome?: string;
        qualificationNotes?: string;
      };
      const updated = await updateCampaignContact(contactId, id, tenantId, body as any);
      if (!updated) throw new NotFoundError('Campaign contact not found');
      reply.send(updated);
    },
  });
}
