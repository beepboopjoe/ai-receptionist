// ============================================================
// Recurring campaign scanner — Phase 18.
// BullMQ repeatable job that fires every minute. Delegates to
// recurring-campaign.service.runDueRecurringCampaigns().
// ============================================================
import type { Job } from 'bullmq';
import { runDueRecurringCampaigns } from '../../modules/campaigns/recurring-campaign.service.js';
import pino from 'pino';

const logger = pino({ name: 'recurring-campaign-scan' });

export async function processRecurringCampaignScan(_job: Job): Promise<void> {
  const result = await runDueRecurringCampaigns();
  if (result.scanned > 0) {
    logger.info(result, 'Recurring scan complete');
  }
}
