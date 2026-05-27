import { db } from '../../db/client.js';
import {
  outboundCampaigns,
  campaignContacts,
  contacts,
  type OutboundCampaign,
  type CampaignContact,
} from '../../db/schema.js';
import { eq, and, sql, count, desc, asc, inArray } from 'drizzle-orm';
import { parseCsvBuffer, type ParsedLead } from './csv-parser.service.js';
import { outboundDialerQueue } from '../../queue/queues.js';
import { emitWebhook } from '../webhooks/webhook.service.js';
import { pushActivity } from '../activity/activity.service.js';
import pino from 'pino';

const logger = pino({ name: 'campaign.service' });

// ---- Create ----

export interface CreateCampaignInput {
  tenantId: string;
  name: string;
  fromNumber: string;
  dialWindowStart?: string;
  dialWindowEnd?: string;
  maxRetries?: number;
  retryDelayMinutes?: number;
  maxConcurrentCalls?: number;
  voicemailMessage?: string;
}

export async function createCampaign(input: CreateCampaignInput): Promise<OutboundCampaign> {
  const [campaign] = await db
    .insert(outboundCampaigns)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      fromNumber: input.fromNumber,
      dialWindowStart: input.dialWindowStart ?? '09:00',
      dialWindowEnd: input.dialWindowEnd ?? '17:00',
      maxRetries: input.maxRetries ?? 3,
      retryDelayMinutes: input.retryDelayMinutes ?? 60,
      maxConcurrentCalls: input.maxConcurrentCalls ?? 3,
      voicemailMessage: input.voicemailMessage ?? null,
      status: 'draft',
    })
    .returning();

  if (!campaign) {
    throw new Error('Campaign insert returned no row');
  }
  logger.info({ campaignId: campaign.id }, 'Campaign created');
  return campaign;
}

// ---- List ----

export async function listCampaigns(
  tenantId: string,
  status?: string
): Promise<OutboundCampaign[]> {
  const conditions = [eq(outboundCampaigns.tenantId, tenantId)];
  if (status) conditions.push(eq(outboundCampaigns.status, status));

  return db
    .select()
    .from(outboundCampaigns)
    .where(and(...conditions))
    .orderBy(desc(outboundCampaigns.createdAt));
}

// ---- Get ----

export async function getCampaign(
  id: string,
  tenantId: string
): Promise<OutboundCampaign | null> {
  const [campaign] = await db
    .select()
    .from(outboundCampaigns)
    .where(and(eq(outboundCampaigns.id, id), eq(outboundCampaigns.tenantId, tenantId)))
    .limit(1);
  return campaign ?? null;
}

// ---- Stats ----

export interface CampaignStats {
  totalLeads: number;
  dialedCount: number;
  connectedCount: number;
  qualifiedCount: number;
  bookedCount: number;
  voicemailCount: number;
  failedCount: number;
  connectRate: string;
  qualifyRate: string;
  bookRate: string;
}

export async function getCampaignStats(
  id: string,
  tenantId: string
): Promise<CampaignStats | null> {
  const campaign = await getCampaign(id, tenantId);
  if (!campaign) return null;

  const connectRate =
    campaign.dialedCount > 0
      ? ((campaign.connectedCount / campaign.dialedCount) * 100).toFixed(1) + '%'
      : '0%';
  const qualifyRate =
    campaign.connectedCount > 0
      ? ((campaign.qualifiedCount / campaign.connectedCount) * 100).toFixed(1) + '%'
      : '0%';
  const bookRate =
    campaign.qualifiedCount > 0
      ? ((campaign.bookedCount / campaign.qualifiedCount) * 100).toFixed(1) + '%'
      : '0%';

  return {
    totalLeads: campaign.totalLeads,
    dialedCount: campaign.dialedCount,
    connectedCount: campaign.connectedCount,
    qualifiedCount: campaign.qualifiedCount,
    bookedCount: campaign.bookedCount,
    voicemailCount: campaign.voicemailCount,
    failedCount: campaign.failedCount,
    connectRate,
    qualifyRate,
    bookRate,
  };
}

// ---- Upsert leads from CSV ----

export interface UpsertLeadsResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export async function upsertLeadsFromCsv(
  campaignId: string,
  tenantId: string,
  buffer: Buffer
): Promise<UpsertLeadsResult> {
  const { rows, errors } = await parseCsvBuffer(buffer);

  if (rows.length === 0) {
    return { inserted: 0, skipped: 0, errors };
  }

  let inserted = 0;
  let skipped = 0;

  for (const lead of rows) {
    // Check if already exists for this campaign + phone
    const [existing] = await db
      .select({ id: campaignContacts.id })
      .from(campaignContacts)
      .where(
        and(
          eq(campaignContacts.campaignId, campaignId),
          eq(campaignContacts.phoneE164, lead.phoneE164)
        )
      )
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    // Try to find matching contact in CRM
    const [existingContact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, lead.phoneE164)))
      .limit(1);

    await db.insert(campaignContacts).values({
      campaignId,
      tenantId,
      contactId: existingContact?.id ?? null,
      phoneE164: lead.phoneE164,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      status: 'pending',
      csvRowData: lead.csvRowData,
    });

    inserted++;
  }

  // Update totalLeads on campaign
  await db
    .update(outboundCampaigns)
    .set({
      totalLeads: sql`${outboundCampaigns.totalLeads} + ${inserted}`,
      updatedAt: new Date(),
    })
    .where(eq(outboundCampaigns.id, campaignId));

  logger.info({ campaignId, inserted, skipped }, 'CSV leads upserted');
  return { inserted, skipped, errors };
}

// ---- Start ----

export async function startCampaign(id: string, tenantId: string): Promise<OutboundCampaign> {
  const campaign = await getCampaign(id, tenantId);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'running') throw new Error('Campaign already running');
  if (campaign.totalLeads === 0) throw new Error('No leads uploaded');

  await db
    .update(outboundCampaigns)
    .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
    .where(eq(outboundCampaigns.id, id));

  // Enqueue dial jobs for all pending leads
  const pendingLeads = await db
    .select({ id: campaignContacts.id })
    .from(campaignContacts)
    .where(
      and(eq(campaignContacts.campaignId, id), eq(campaignContacts.status, 'pending'))
    );

  const jobs = pendingLeads.map((lead) => ({
    name: 'outbound-dial' as const,
    data: { campaignContactId: lead.id, campaignId: id, tenantId },
  }));

  await outboundDialerQueue.addBulk(jobs);
  logger.info({ campaignId: id, jobCount: jobs.length }, 'Campaign started — dial jobs enqueued');

  return (await getCampaign(id, tenantId))!;
}

// ---- Pause ----

export async function pauseCampaign(id: string, tenantId: string): Promise<OutboundCampaign> {
  await db
    .update(outboundCampaigns)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(and(eq(outboundCampaigns.id, id), eq(outboundCampaigns.tenantId, tenantId)));

  return (await getCampaign(id, tenantId))!;
}

// ---- Cancel ----

export async function cancelCampaign(id: string, tenantId: string): Promise<OutboundCampaign> {
  await db
    .update(outboundCampaigns)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(outboundCampaigns.id, id), eq(outboundCampaigns.tenantId, tenantId)));

  // Mark all pending leads as failed
  await db
    .update(campaignContacts)
    .set({ status: 'failed', outcome: 'campaign_cancelled', updatedAt: new Date() })
    .where(
      and(eq(campaignContacts.campaignId, id), eq(campaignContacts.status, 'pending'))
    );

  return (await getCampaign(id, tenantId))!;
}

// ---- List campaign contacts ----

export interface ListCampaignContactsOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listCampaignContacts(
  campaignId: string,
  tenantId: string,
  opts: ListCampaignContactsOptions = {}
): Promise<{ data: CampaignContact[]; total: number }> {
  const { status, limit = 50, offset = 0 } = opts;

  const conditions = [
    eq(campaignContacts.campaignId, campaignId),
    eq(campaignContacts.tenantId, tenantId),
  ];
  if (status) conditions.push(eq(campaignContacts.status, status));

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(campaignContacts)
      .where(and(...conditions))
      .orderBy(desc(campaignContacts.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(campaignContacts)
      .where(and(...conditions)),
  ]);

  return { data, total: Number(total) };
}

// ---- Update single campaign contact (manual override) ----

export async function updateCampaignContact(
  contactId: string,
  campaignId: string,
  tenantId: string,
  update: Partial<Pick<CampaignContact, 'status' | 'outcome' | 'qualificationNotes'>>
): Promise<CampaignContact | null> {
  const [updated] = await db
    .update(campaignContacts)
    .set({ ...update, updatedAt: new Date() })
    .where(
      and(
        eq(campaignContacts.id, contactId),
        eq(campaignContacts.campaignId, campaignId),
        eq(campaignContacts.tenantId, tenantId)
      )
    )
    .returning();

  // Status transition → fire matching webhook + activity event. Both helpers
  // are fire-and-forget (never throw) so the update path stays fast.
  if (updated && update.status) {
    if (update.status === 'qualified') {
      void emitWebhook(tenantId, 'campaign.lead_qualified', {
        campaignId, contactId, outcome: update.outcome ?? null,
      });
      pushActivity(tenantId, 'campaign_lead_qualified', { campaignId, contactId });
    } else if (update.status === 'booked') {
      void emitWebhook(tenantId, 'campaign.lead_booked', {
        campaignId, contactId, outcome: update.outcome ?? null,
      });
      pushActivity(tenantId, 'campaign_lead_booked', { campaignId, contactId });
    } else if (update.status === 'connected') {
      pushActivity(tenantId, 'campaign_lead_connected', { campaignId, contactId });
    }
  }

  return updated ?? null;
}
