// ============================================================
// Webhook drain worker
//
// Polls the webhook_deliveries table on a fixed interval and POSTs
// any pending rows whose `next_attempt_at` is due. Failures are
// rescheduled by the service with exponential backoff; after the
// max attempts they go to dead_letter.
//
// Tunable via env:
//   WEBHOOK_DRAIN_INTERVAL_MS — default 15000 (15s)
// ============================================================
import pino from 'pino';
import { deliverPending } from '../modules/webhooks/webhook.service.js';

const logger = pino({ name: 'webhook-drain' });

const DEFAULT_INTERVAL_MS = 15_000;

let timer: ReturnType<typeof setInterval> | null = null;

export function startWebhookDrainWorker(): void {
  if (timer) {
    logger.warn('Webhook drain worker already running');
    return;
  }

  const interval = Number(process.env['WEBHOOK_DRAIN_INTERVAL_MS']) || DEFAULT_INTERVAL_MS;

  // Wrap deliverPending so a single bad batch doesn't crash the worker.
  const tick = async (): Promise<void> => {
    try {
      const result = await deliverPending();
      if (result.delivered > 0 || result.failed > 0) {
        logger.info(result, 'Webhook drain batch');
      }
    } catch (err) {
      logger.error({ err }, 'Webhook drain tick failed');
    }
  };

  // Run once immediately, then on every interval.
  void tick();
  timer = setInterval(() => { void tick(); }, interval);

  logger.info({ intervalMs: interval }, 'Webhook drain worker started');
}

export function stopWebhookDrainWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  logger.info('Webhook drain worker stopped');
}
