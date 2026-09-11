// ============================================================
// Knowledge Base plan gate — Business (+ enterprise) only.
//
// Pure helpers so upload/reprocess/quota stay consistent and
// unit-testable without DB. Voice retrieval is NOT gated here:
// retrieveRelevantChunks already returns [] when empty.
// ============================================================
import { planAllowsKb, KB_PLAN_REQUIRED_MESSAGE } from '@ai-receptionist/shared';
import { ForbiddenError } from '../../lib/errors.js';
import { config } from '../../config.js';

export { planAllowsKb, KB_PLAN_REQUIRED_MESSAGE };

export interface KbQuota {
  docs: number;
  bytes: number;
}

/** Scale-tier defaults kept for Business / enterprise (config can override). */
export const KB_BUSINESS_DEFAULT_QUOTA: KbQuota = {
  docs: 500,
  bytes: 2_147_483_648, // 2 GB
};

export function assertKbAllowed(plan: string): void {
  if (!planAllowsKb(plan)) {
    throw new ForbiddenError(KB_PLAN_REQUIRED_MESSAGE);
  }
}

/**
 * Lower plans (trial, growth, scale, starter, unknown) get 0/0 so
 * uploadDocument's quota check is a second fence even if the 403
 * gate is skipped. Business + enterprise keep Scale-tier quotas.
 */
export function getQuotaForPlan(plan: string): KbQuota {
  if (!planAllowsKb(plan)) {
    return { docs: 0, bytes: 0 };
  }
  const docs = Number(config.KB_DOC_LIMIT_SCALE);
  const bytes = Number(config.KB_BYTES_LIMIT_SCALE);
  return {
    docs: Number.isFinite(docs) && docs > 0 ? docs : KB_BUSINESS_DEFAULT_QUOTA.docs,
    bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : KB_BUSINESS_DEFAULT_QUOTA.bytes,
  };
}
