// ============================================================
// DID helpers — normalize US numbers and resolve the owning tenant.
// Inbound voice used to pick the first tenant in the DB; SMS already
// looked up tenant_phone_numbers. This is the shared lookup for both.
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers, tenantSettings } from '../../db/schema.js';
import { and, eq, isNull } from 'drizzle-orm';

/** Placeholder E.164 written when a Telnyx order fails (retryable row). */
export const PENDING_PHONE_E164 = 'pending';

export type ProvisionStatus = 'provisioning' | 'active' | 'failed';

/** True when the stored value is a real E.164 we can dial / route on. */
export function isProvisionedE164(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^\+\d{8,15}$/.test(value);
}

/**
 * Normalize a Telnyx `to` / `from` into +E.164 when it's a US/CA number.
 * Leaves already-E.164 and non-NANP values alone.
 */
export function normalizeUsDid(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (isProvisionedE164(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (trimmed.startsWith('+')) return trimmed;
  return digits ? `+${digits}` : trimmed;
}

export interface ResolvedDidTenant {
  tenantId: string;
  phoneE164: string;
  purpose: string;
}

/**
 * Find the tenant that owns this DID. Checks active tenant_phone_numbers
 * first (inbound + outbound pool — callers may dial back a campaign CID),
 * then the legacy tenant_settings.twilio_number written by older onboarding.
 */
export async function lookupTenantByDid(rawTo: string): Promise<ResolvedDidTenant | null> {
  const toNumber = normalizeUsDid(rawTo);
  if (!toNumber) return null;

  const [owned] = await db
    .select({
      tenantId: tenantPhoneNumbers.tenantId,
      phoneE164: tenantPhoneNumbers.phoneE164,
      purpose: tenantPhoneNumbers.purpose,
    })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.phoneE164, toNumber),
        isNull(tenantPhoneNumbers.releasedAt),
        eq(tenantPhoneNumbers.provisionStatus, 'active')
      )
    )
    .limit(1);

  if (owned) return owned;

  const [legacy] = await db
    .select({
      tenantId: tenantSettings.tenantId,
      phoneE164: tenantSettings.provisionedNumber,
    })
    .from(tenantSettings)
    .where(eq(tenantSettings.provisionedNumber, toNumber))
    .limit(1);

  if (legacy?.tenantId && legacy.phoneE164) {
    return { tenantId: legacy.tenantId, phoneE164: legacy.phoneE164, purpose: 'inbound' };
  }

  return null;
}
