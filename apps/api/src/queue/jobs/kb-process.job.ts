// ============================================================
// kb-process job — Phase 12.8.
//
// Parses an uploaded document, chunks it, generates embeddings,
// and persists the chunks. Idempotent on retry (kb.service wipes
// prior chunks before re-inserting). Errors are swallowed by the
// service which sets status='failed' + error_message on the row,
// so BullMQ sees a clean completion either way.
// ============================================================
import type { Job } from 'bullmq';
import { processDocument } from '../../modules/knowledge-base/kb.service.js';
import pino from 'pino';

const logger = pino({ name: 'kb-process-job' });

export interface KbProcessJobData {
  documentId: string;
}

export async function processKbDocument(job: Job<KbProcessJobData>): Promise<void> {
  const { documentId } = job.data;
  try {
    await processDocument(documentId);
    logger.info({ documentId }, 'KB document processing job completed');
  } catch (err) {
    // processDocument itself catches and persists failures; this is a last-resort net.
    logger.error({ err, documentId }, 'KB document job threw — kb.service should have handled');
  }
}
