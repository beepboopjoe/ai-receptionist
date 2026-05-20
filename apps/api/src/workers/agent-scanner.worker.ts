// ============================================================
// Agent scanner worker
//
// Runs the suggestion detectors for every active tenant on a schedule.
// Default cadence is once per hour; tunable via AGENT_SCAN_INTERVAL_MS.
// Also expires pending suggestions older than 48h.
// ============================================================
import pino from 'pino';
import { db } from '../db/client.js';
import { tenants } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { scanTenant, expireOldSuggestions } from '../modules/agent/agent.service.js';

const logger = pino({ name: 'agent-scanner' });

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runOnce(): Promise<void> {
  if (running) {
    logger.warn('Previous scan still running; skipping this tick');
    return;
  }
  running = true;

  try {
    // Expire stale suggestions first so the inserts that follow don't dedupe
    // against rows that have been pending for days.
    const expired = await expireOldSuggestions();
    if (expired > 0) logger.info({ expired }, 'Expired stale agent suggestions');

    // Pull every active, agent-enabled tenant. We scan them serially to keep
    // DB load predictable; with 4 detectors per tenant and small queries this
    // is comfortably bounded.
    const active = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.isActive, true));

    let totalInserted = 0;
    for (const t of active) {
      try {
        const res = await scanTenant(t.id);
        totalInserted += res.inserted;
      } catch (err) {
        logger.error({ err, tenantId: t.id }, 'scanTenant failed; continuing');
      }
    }

    if (totalInserted > 0) {
      logger.info({ tenantCount: active.length, totalInserted }, 'Agent scan batch complete');
    }
  } catch (err) {
    logger.error({ err }, 'Agent scanner tick failed');
  } finally {
    running = false;
  }
}

export function startAgentScannerWorker(): void {
  if (timer) {
    logger.warn('Agent scanner already running');
    return;
  }

  const interval = Number(process.env['AGENT_SCAN_INTERVAL_MS']) || DEFAULT_INTERVAL_MS;
  logger.info({ intervalMs: interval }, 'Starting agent scanner worker');

  // Kick off the first run after a 30s delay so we don't compete with startup.
  setTimeout(() => {
    void runOnce();
  }, 30_000);

  timer = setInterval(() => {
    void runOnce();
  }, interval);
}

export function stopAgentScannerWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Agent scanner stopped');
  }
}
