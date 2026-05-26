// ============================================================
// Lead discovery poll job — Phase 12.7.
//
// Re-checks an in-flight Apify run every 15s until it settles
// (SUCCEEDED / FAILED / ABORTED / TIMED_OUT). On success the
// ingest path persists results to lead_discovery_jobs.raw_results
// so the dashboard can render them for selection.
//
// Re-enqueues itself on still-running. Capped at 40 attempts
// (= 10 minutes total runtime) to prevent stuck rows.
// ============================================================
import type { Job } from 'bullmq';
import { pollAndIngest } from '../../modules/lead-discovery/lead-discovery.service.js';
import { leadDiscoveryQueue } from '../queues.js';
import pino from 'pino';

const logger = pino({ name: 'lead-discovery-poll' });

const POLL_INTERVAL_MS = 15_000;
const MAX_ATTEMPTS = 40; // ~10 minutes

export interface LeadDiscoveryPollData {
  jobId: string;
  attempt?: number;
}

export async function processLeadDiscoveryPoll(
  job: Job<LeadDiscoveryPollData>
): Promise<void> {
  const { jobId } = job.data;
  const attempt = job.data.attempt ?? 1;

  try {
    const result = await pollAndIngest(jobId);
    if (result === 'settled') {
      logger.info({ jobId, attempt }, 'Lead discovery job settled');
      return;
    }
    // Still running — re-enqueue if we have attempts left.
    if (attempt >= MAX_ATTEMPTS) {
      logger.warn({ jobId, attempt }, 'Lead discovery exhausted poll attempts — leaving as-is');
      // We don't force-fail — the customer can manually retry; another
      // worker run might still pick it up if Apify catches up.
      return;
    }
    await leadDiscoveryQueue.add(
      'poll',
      { jobId, attempt: attempt + 1 } satisfies LeadDiscoveryPollData,
      { delay: POLL_INTERVAL_MS }
    );
  } catch (err) {
    logger.error({ err, jobId, attempt }, 'Lead discovery poll errored');
    // Retry once on transient error.
    if (attempt < MAX_ATTEMPTS) {
      await leadDiscoveryQueue.add(
        'poll',
        { jobId, attempt: attempt + 1 } satisfies LeadDiscoveryPollData,
        { delay: POLL_INTERVAL_MS }
      );
    }
  }
}
