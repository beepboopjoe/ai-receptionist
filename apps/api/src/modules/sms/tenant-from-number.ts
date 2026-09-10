// ============================================================
// Helper: resolve the SMS "from" number for a tenant.
// Prefers tenant_phone_numbers.isPrimary inbound DID, falls back
// to oldest active inbound, then any active non-placeholder number.
// Returns null when the tenant has no provisioned numbers.
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers } from '../../db/schema.js';
import { and, asc, desc, eq, isNull, ne, or } from 'drizzle-orm';
import { PENDING_PHONE_E164 } from '../phone-numbers/inbound-did.js';

export async function getTenantFromNumber(tenantId: string): Promise<string | null> {
  const inbound = await db
    .select({ phoneE164: tenantPhoneNumbers.phoneE164, isPrimary: tenantPhoneNumbers.isPrimary })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        isNull(tenantPhoneNumbers.releasedAt),
        eq(tenantPhoneNumbers.purpose, 'inbound'),
        eq(tenantPhoneNumbers.provisionStatus, 'active'),
        ne(tenantPhoneNumbers.phoneE164, PENDING_PHONE_E164)
      )
    )
    .orderBy(desc(tenantPhoneNumbers.isPrimary), asc(tenantPhoneNumbers.purchasedAt))
    .limit(1);
  if (inbound[0]?.phoneE164) return inbound[0].phoneE164;

  const any = await db
    .select({ phoneE164: tenantPhoneNumbers.phoneE164 })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        isNull(tenantPhoneNumbers.releasedAt),
        eq(tenantPhoneNumbers.provisionStatus, 'active'),
        ne(tenantPhoneNumbers.phoneE164, PENDING_PHONE_E164),
        or(
          eq(tenantPhoneNumbers.purpose, 'inbound'),
          eq(tenantPhoneNumbers.purpose, 'outbound_pool')
        )
      )
    )
    .orderBy(desc(tenantPhoneNumbers.isPrimary), asc(tenantPhoneNumbers.purchasedAt))
    .limit(1);
  return any[0]?.phoneE164 ?? null;
}
