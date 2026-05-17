// ============================================================
// Helper: resolve the SMS "from" number for a tenant.
// Prefers tenant_phone_numbers.isPrimary, falls back to oldest
// non-released number. Returns null when the tenant has no
// provisioned numbers — callers decide whether to skip or 412.
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers } from '../../db/schema.js';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

export async function getTenantFromNumber(tenantId: string): Promise<string | null> {
  const rows = await db
    .select({ phoneE164: tenantPhoneNumbers.phoneE164, isPrimary: tenantPhoneNumbers.isPrimary })
    .from(tenantPhoneNumbers)
    .where(and(eq(tenantPhoneNumbers.tenantId, tenantId), isNull(tenantPhoneNumbers.releasedAt)))
    .orderBy(desc(tenantPhoneNumbers.isPrimary), asc(tenantPhoneNumbers.purchasedAt))
    .limit(1);
  return rows[0]?.phoneE164 ?? null;
}
