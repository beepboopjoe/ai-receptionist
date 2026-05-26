// ============================================================
// Lead Discovery service — Phase 12.7.
//
// Orchestrates the Apify scrape → review → import flow:
//   1. estimateCost     — preview pricing before the customer commits
//   2. startDiscovery   — create job row + start Apify run + enqueue poll
//   3. pollAndIngest    — BullMQ worker, re-checks Apify until settled
//   4. importToContacts — copies selected results into a draft campaign,
//                         records the Stripe metered usage event
//
// All four are pure functions of (tenantId, params) — no global state.
// The BullMQ poll worker re-enqueues itself with a 15-second delay
// until the Apify run reaches a terminal status.
// ============================================================
import { db } from '../../db/client.js';
import {
  leadDiscoveryJobs,
  outboundCampaigns,
  campaignContacts,
  tenantPhoneNumbers,
} from '../../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { config } from '../../config.js';
import {
  startRun,
  getRunStatus,
  getRunResults,
  isRunSettled,
  type GoogleMapsRecord,
} from './apify.client.js';
import { IntegrationError, NotFoundError, ValidationError } from '../../lib/errors.js';
import pino from 'pino';

const logger = pino({ name: 'lead-discovery' });

export interface DiscoverySearchParams {
  /** Free-text query: "dentists", "coffee shops", etc. */
  query: string;
  /** Apify expects something like "Chicago, IL" or "10001". */
  locationQuery: string;
  /** 5 | 10 | 25 | 50 miles — used only for display; Apify infers radius from locationQuery. */
  radiusMiles?: number;
  minRating?: number;
  requirePhone?: boolean;
  /** Max records to request from Apify. Bounds cost. */
  maxResults: number;
}

export interface CostEstimate {
  estimatedLeads: number;
  costCents: number;
  perLeadCents: number;
}

export function estimateCost(params: DiscoverySearchParams): CostEstimate {
  const perLeadCents = config.LEAD_DISCOVERY_PRICE_CENTS;
  // We bill on the records we actually deliver, but the preview shows the
  // upper bound based on maxResults so the customer sees the worst case
  // before pressing "Start discovery."
  const estimatedLeads = params.maxResults;
  return {
    estimatedLeads,
    costCents: estimatedLeads * perLeadCents,
    perLeadCents,
  };
}

/**
 * Map our friendly search params to the Apify actor's input shape.
 * See: https://apify.com/compass/crawler-google-places/input-schema
 */
function buildApifyInput(params: DiscoverySearchParams): Record<string, unknown> {
  return {
    searchStringsArray: [params.query],
    locationQuery: params.locationQuery,
    maxCrawledPlacesPerSearch: params.maxResults,
    language: 'en',
    // Skip image scraping — we don't need it and it doubles the Apify cost.
    scrapePlaceDetailPage: true,
    skipClosedPlaces: true,
  };
}

export async function startDiscovery(
  tenantId: string,
  params: DiscoverySearchParams
): Promise<{ jobId: string; apifyRunId: string }> {
  if (!config.APIFY_API_TOKEN) {
    throw new IntegrationError('apify', 'Lead discovery is not configured on this environment');
  }
  if (!params.query?.trim() || !params.locationQuery?.trim()) {
    throw new ValidationError('query and locationQuery are required');
  }
  if (params.maxResults < 1 || params.maxResults > 500) {
    throw new ValidationError('maxResults must be between 1 and 500');
  }

  const [job] = await db
    .insert(leadDiscoveryJobs)
    .values({
      tenantId,
      actorId: config.APIFY_GOOGLE_MAPS_ACTOR_ID,
      status: 'pending',
      searchParams: params as unknown as Record<string, unknown>,
    })
    .returning({ id: leadDiscoveryJobs.id });

  if (!job) throw new Error('Failed to create lead_discovery_jobs row');

  // Fire the Apify run. If this throws, mark the job failed and bubble up.
  let runId: string;
  try {
    const run = await startRun(config.APIFY_GOOGLE_MAPS_ACTOR_ID, buildApifyInput(params));
    runId = run.id;
    await db
      .update(leadDiscoveryJobs)
      .set({ apifyRunId: runId, status: 'running' })
      .where(eq(leadDiscoveryJobs.id, job.id));
  } catch (err) {
    await db
      .update(leadDiscoveryJobs)
      .set({
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(leadDiscoveryJobs.id, job.id));
    throw err;
  }

  // Enqueue the poll worker. Done inside startDiscovery (not the endpoint)
  // so re-running this service from a worker context works the same way.
  const { leadDiscoveryQueue } = await import('../../queue/queues.js');
  await leadDiscoveryQueue.add('poll', { jobId: job.id }, { delay: 5_000 });

  return { jobId: job.id, apifyRunId: runId };
}

/**
 * Worker handler — polls Apify, ingests results when settled, re-enqueues
 * itself if still running. Returns 'settled' | 'still_running' so the
 * worker can decide whether to re-enqueue.
 */
export async function pollAndIngest(jobId: string): Promise<'settled' | 'still_running'> {
  const [job] = await db
    .select()
    .from(leadDiscoveryJobs)
    .where(eq(leadDiscoveryJobs.id, jobId))
    .limit(1);

  if (!job) throw new NotFoundError(`lead_discovery_jobs ${jobId} not found`);
  if (!job.apifyRunId) {
    logger.warn({ jobId }, 'No apifyRunId on job — marking failed');
    await db
      .update(leadDiscoveryJobs)
      .set({ status: 'failed', errorMessage: 'No Apify run id', completedAt: new Date() })
      .where(eq(leadDiscoveryJobs.id, jobId));
    return 'settled';
  }

  let runStatus;
  try {
    runStatus = await getRunStatus(job.apifyRunId);
  } catch (err) {
    logger.warn({ err, jobId }, 'Apify status check failed — will retry');
    return 'still_running';
  }

  if (!isRunSettled(runStatus.status)) {
    return 'still_running';
  }

  if (runStatus.status !== 'SUCCEEDED') {
    await db
      .update(leadDiscoveryJobs)
      .set({
        status: 'failed',
        errorMessage: `Apify run ${runStatus.status}`,
        completedAt: new Date(),
      })
      .where(eq(leadDiscoveryJobs.id, jobId));
    return 'settled';
  }

  // Pull results
  let records: GoogleMapsRecord[];
  try {
    records = await getRunResults<GoogleMapsRecord>(runStatus.defaultDatasetId, {
      limit: (job.searchParams as DiscoverySearchParams).maxResults,
    });
  } catch (err) {
    await db
      .update(leadDiscoveryJobs)
      .set({
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Failed to fetch results',
        completedAt: new Date(),
      })
      .where(eq(leadDiscoveryJobs.id, jobId));
    return 'settled';
  }

  // Post-hoc filter: require phone, min rating.
  const sp = job.searchParams as DiscoverySearchParams;
  const filtered = records.filter((r) => {
    if (sp.requirePhone && !r.phoneUnformatted && !r.phone) return false;
    if (sp.minRating && (r.totalScore ?? 0) < sp.minRating) return false;
    return true;
  });

  const apifyCostUsd = runStatus.usageTotalUsd ?? 0;
  const apifyCostCents = Math.round(apifyCostUsd * 100);

  await db
    .update(leadDiscoveryJobs)
    .set({
      status: 'succeeded',
      rawResults: filtered as unknown as Record<string, unknown>[],
      leadsFound: filtered.length,
      apifyCostCents,
      completedAt: new Date(),
    })
    .where(eq(leadDiscoveryJobs.id, jobId));

  logger.info({ jobId, leadsFound: filtered.length, apifyCostCents }, 'Discovery job ingested');
  return 'settled';
}

export interface ImportParams {
  /** Indices into job.rawResults; undefined = import all. */
  selectedIndices?: number[];
  /** Append to an existing draft campaign, or null to create a new one. */
  campaignId?: string;
}

export interface ImportResult {
  campaignId: string;
  leadsImported: number;
  costCents: number;
}

export async function importToContacts(
  tenantId: string,
  jobId: string,
  params: ImportParams
): Promise<ImportResult> {
  const [job] = await db
    .select()
    .from(leadDiscoveryJobs)
    .where(
      and(eq(leadDiscoveryJobs.id, jobId), eq(leadDiscoveryJobs.tenantId, tenantId))
    )
    .limit(1);
  if (!job) throw new NotFoundError('lead_discovery_jobs row not found');
  if (job.status !== 'succeeded' && job.status !== 'imported') {
    throw new ValidationError(`Cannot import while status is ${job.status}`);
  }

  const records = (job.rawResults ?? []) as GoogleMapsRecord[];
  const indices = params.selectedIndices ?? records.map((_, i) => i);
  const selected = indices
    .map((i) => records[i])
    .filter((r): r is GoogleMapsRecord => !!r && !!(r.phoneUnformatted ?? r.phone));

  if (selected.length === 0) {
    throw new ValidationError('No selected records have phone numbers');
  }

  // Resolve campaign — append to existing or create a new draft.
  let campaignId = params.campaignId;
  if (!campaignId) {
    const [primary] = await db
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
    if (!primary) {
      throw new ValidationError(
        'Provision a phone number in Settings → Phone Numbers before importing leads'
      );
    }

    const sp = job.searchParams as DiscoverySearchParams;
    const date = new Date().toISOString().slice(0, 10);
    const [campaign] = await db
      .insert(outboundCampaigns)
      .values({
        tenantId,
        name: `Discovery · ${sp.query} (${date})`,
        fromNumber: primary.phoneE164,
        status: 'draft',
        totalLeads: selected.length,
        goalSource: 'template',
        goal: 'lead_discovery',
      })
      .returning({ id: outboundCampaigns.id });
    if (!campaign) throw new Error('Failed to create campaign');
    campaignId = campaign.id;
  }

  // Bulk-insert campaign_contacts. Phone normalization is best-effort —
  // Apify returns either phoneUnformatted (raw digits) or phone (formatted).
  await db.insert(campaignContacts).values(
    selected.map((r) => {
      const raw = (r.phoneUnformatted ?? r.phone ?? '').toString();
      // Strip non-digits, then prepend +1 if it's a 10-digit US/CA number.
      const digits = raw.replace(/\D/g, '');
      const phoneE164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
      const title = (r.title ?? 'Unknown').trim();
      // Apify only gives us business name, so first name = the whole title.
      return {
        campaignId: campaignId!,
        tenantId,
        phoneE164,
        firstName: title.slice(0, 80),
        lastName: '',
        email: null,
        status: 'pending' as const,
        csvRowData: {
          source: 'lead_discovery',
          jobId,
          title: r.title,
          address: r.address,
          website: r.website,
          rating: r.totalScore,
          reviewsCount: r.reviewsCount,
          category: r.categoryName,
          googleUrl: r.url,
        },
      };
    })
  );

  // Update the discovery job row.
  const costCents = selected.length * config.LEAD_DISCOVERY_PRICE_CENTS;
  await db
    .update(leadDiscoveryJobs)
    .set({
      status: 'imported',
      leadsImported: selected.length,
      costCents,
      importedCampaignId: campaignId,
      importedAt: new Date(),
    })
    .where(eq(leadDiscoveryJobs.id, jobId));

  // Report metered usage to Stripe (no-op when STRIPE not configured).
  try {
    const { reportLeadsDiscoveredUsage } = await import('../billing/lead-billing.service.js');
    await reportLeadsDiscoveredUsage(tenantId, selected.length);
  } catch (err) {
    logger.warn({ err, jobId, tenantId }, 'Stripe usage report failed (non-blocking)');
  }

  return { campaignId, leadsImported: selected.length, costCents };
}
