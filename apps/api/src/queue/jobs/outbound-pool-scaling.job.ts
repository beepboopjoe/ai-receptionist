// ============================================================
// Outbound pool scaling sweep — repeatable job (every 6h).
//
// Evaluates each tenant's rotating dialer pool against the
// prorated daily volume thresholds and grows pools that are
// concentrating too many dials per number. See
// modules/outbound-pool/pool.constants.ts for the thresholds.
// ============================================================
import type { Job } from 'bullmq';
import { runPoolScalingSweep } from '../../modules/outbound-pool/pool.service.js';

export async function processPoolScalingSweep(_job: Job): Promise<void> {
  const result = await runPoolScalingSweep();
  if (result.numbersAdded > 0) {
    console.log(
      `[outbound-pool-scaling] Grew ${result.tenantsScaled} tenant pool(s), +${result.numbersAdded} number(s)`
    );
  }
}
