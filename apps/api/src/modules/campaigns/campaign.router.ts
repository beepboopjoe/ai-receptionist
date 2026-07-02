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
import { GOAL_CATALOG, goalsForVertical, findGoal } from './campaign-goals.service.js';
import {
  markCampaignRecurring,
  clearRecurrence,
  type RecurrenceFrequency,
} from './recurring-campaign.service.js';
import { db } from '../../db/client.js';
import {
  outboundCampaigns,
  campaignContacts,
  tenants,
  tenantPhoneNumbers,
} from '../../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { cacheGet, cacheSet, cacheDel } from '../../db/redis.js';
import type { Vertical } from '../voice-agent/prompt-builder.js';
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

  // ============================================================
  // GOAL-DRIVEN TEMPLATES — Phase 12.4
  // ============================================================

  // ---- List campaign goal suggestions for this tenant ----
  // Returns the subset of GOAL_CATALOG that matches the tenant's vertical
  // (plus generic goals), each with a live candidateCount. Cached per-tenant
  // for 5 minutes via Redis since the candidate-count queries scan tables.
  app.get('/campaigns/suggestions', {
    preHandler: [app.requireRole('staff')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;

      const cacheKey = `campaigns:suggestions:${tenantId}`;
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return reply.send(JSON.parse(cached));
      }

      // Resolve tenant's vertical to scope the goals list.
      const [tenant] = await db
        .select({ vertical: tenants.vertical })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      const vertical = (tenant?.vertical ?? 'generic') as Vertical;
      const goals = goalsForVertical(vertical);

      // Run findCandidates for each. Failures are isolated — one buggy goal
      // doesn't take down the whole response. count is 0 on failure.
      const results = await Promise.all(
        goals.map(async (g) => {
          try {
            const candidates = await g.findCandidates(tenantId);
            return {
              slug: g.slug,
              vertical: g.vertical,
              title: g.title,
              description: g.description,
              candidateCount: candidates.length,
            };
          } catch (err) {
            request.log.warn({ err, slug: g.slug, tenantId }, 'Goal findCandidates failed');
            return {
              slug: g.slug,
              vertical: g.vertical,
              title: g.title,
              description: g.description,
              candidateCount: 0,
            };
          }
        })
      );

      const payload = { suggestions: results };
      // Cache 5 minutes; the underlying contact/appointment data doesn't churn fast.
      await cacheSet(cacheKey, JSON.stringify(payload), 300);
      return reply.send(payload);
    },
  });

  // ---- Create a campaign from a goal template ----
  // One-click endpoint. Builds the contact list from the goal's SQL filter,
  // creates a draft campaign with goal-specific defaults, and bulk-inserts
  // campaign_contacts. Customer reviews the draft and clicks Start manually.
  app.post('/campaigns/from-goal', {
    preHandler: [app.requireRole('admin')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const body = request.body as { goal?: string };
      if (!body.goal) {
        throw new ValidationError('goal is required');
      }

      const goal = findGoal(body.goal);
      if (!goal) {
        throw new NotFoundError(`Unknown goal: ${body.goal}`);
      }

      // Build the candidate list. Refuse if empty so we don't create an
      // empty draft campaign the customer can't do anything with.
      const candidates = await goal.findCandidates(tenantId);
      if (candidates.length === 0) {
        return reply.status(400).send({
          error: 'no_candidates',
          message: 'No contacts currently match this goal. Try again later or pick another goal.',
        });
      }

      // Resolve the tenant's primary phone number — same pattern test-call uses.
      const [primaryNumber] = await db
        .select({ phoneE164: tenantPhoneNumbers.phoneE164 })
        .from(tenantPhoneNumbers)
        .where(
          and(
            eq(tenantPhoneNumbers.tenantId, tenantId),
            eq(tenantPhoneNumbers.isPrimary, true),
            isNull(tenantPhoneNumbers.releasedAt)
          )
        )
        .limit(1);

      if (!primaryNumber) {
        return reply.status(400).send({
          error: 'no_primary_number',
          message: 'Provision a phone number in Settings → Phone Numbers before launching campaigns.',
        });
      }

      const now = new Date();
      const [campaign] = await db
        .insert(outboundCampaigns)
        .values({
          tenantId,
          name: goal.defaultName(now),
          fromNumber: primaryNumber.phoneE164,
          status: 'draft',
          dialWindowStart: goal.defaultDialWindow.start,
          dialWindowEnd: goal.defaultDialWindow.end,
          voicemailMessage: goal.defaultVoicemail,
          goal: goal.slug,
          goalSource: 'template',
          totalLeads: candidates.length,
        })
        .returning();

      if (!campaign) {
        return reply.status(500).send({ error: 'create_failed', message: 'Could not create campaign' });
      }

      // Bulk-insert campaign_contacts. contactId may be empty string for
      // unlinked missed-call rows (generic_missed_call_callback); store NULL.
      await db.insert(campaignContacts).values(
        candidates.map((c) => ({
          campaignId: campaign.id,
          tenantId,
          contactId: c.contactId && c.contactId.length > 0 ? c.contactId : null,
          phoneE164: c.phoneE164,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          status: 'pending' as const,
        }))
      );

      // Invalidate the suggestions cache so the gallery refreshes its count.
      await cacheDel(`campaigns:suggestions:${tenantId}`);

      return reply.status(201).send({
        campaignId: campaign.id,
        goal: goal.slug,
        candidateCount: candidates.length,
      });
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

  // ---- Recurring schedule (Phase 18) ----
  app.post('/campaigns/:id/recurring', {
    preHandler: [app.requireRole('admin')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const body = request.body as {
        frequency?: string;
        dayOfWeek?: number;
        dayOfMonth?: number;
        time?: string;
        timezone?: string;
      };

      if (!body.frequency || !['daily', 'weekly', 'monthly'].includes(body.frequency)) {
        throw new ValidationError('frequency must be one of: daily, weekly, monthly');
      }
      if (!body.time) throw new ValidationError('time (HH:MM) is required');
      if (!body.timezone) throw new ValidationError('timezone (IANA) is required');

      const params = {
        frequency: body.frequency as RecurrenceFrequency,
        ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek } : {}),
        ...(body.dayOfMonth !== undefined ? { dayOfMonth: body.dayOfMonth } : {}),
        time: body.time,
        timezone: body.timezone,
      };

      const result = await markCampaignRecurring(tenantId, id, params);
      if (!result.ok) {
        const status = result.reason === 'not_found' ? 404 : 400;
        return reply.status(status).send({ error: result.reason });
      }
      return reply.send({ ok: true, nextRunAt: result.nextRunAt });
    },
  });

  app.delete('/campaigns/:id/recurring', {
    preHandler: [app.requireRole('admin')],
    async handler(request, reply) {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      await clearRecurrence(tenantId, id);
      return reply.send({ ok: true });
    },
  });
}
