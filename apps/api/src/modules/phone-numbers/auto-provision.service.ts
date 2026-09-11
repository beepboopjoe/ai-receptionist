// ============================================================
// Auto-provision a tenant's inbound US DID via Telnyx.
//
// Called on go-live (POST /onboarding/activate) and when a paid
// subscription starts. Idempotent: if the tenant already has an
// active inbound number, we return it. Trial plans
// (includedPhoneNumbers = 0) are skipped — a dedicated DID is
// assigned after subscribe. `forceRetry` re-runs a failed order
// but never bypasses the plan gate.
//
// Failed Telnyx orders leave a retryable row (phone_e164='pending',
// provision_status='failed') so the dashboard can Retry.
// ============================================================
import { db } from '../../db/client.js';
import { tenantPhoneNumbers, tenants } from '../../db/schema.js';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import {
  searchAvailableNumbers as telnyxSearch,
  purchaseNumber as telnyxPurchase,
} from './telnyx.client.js';
import { config } from '../../config.js';
import { IntegrationError } from '../../lib/errors.js';
import { updateSettings } from '../admin/settings.service.js';
import { planIncludesInboundDid } from '../outbound-pool/pool-size.js';
import { PENDING_PHONE_E164, isProvisionedE164, type ProvisionStatus } from './inbound-did.js';

export interface InboundDidResult {
  status: ProvisionStatus | 'skipped';
  reason?: string;
  number?: {
    id: string;
    phoneE164: string;
    provisionStatus: ProvisionStatus;
    provisionError: string | null;
  };
}

function connectionId(): string | undefined {
  return config.TELNYX_APP_ID || undefined;
}

async function countActiveInbound(tenantId: string): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        eq(tenantPhoneNumbers.purpose, 'inbound'),
        isNull(tenantPhoneNumbers.releasedAt),
        eq(tenantPhoneNumbers.provisionStatus, 'active'),
        ne(tenantPhoneNumbers.phoneE164, PENDING_PHONE_E164)
      )
    );
  return Number(rows[0]?.value ?? 0);
}

async function findRetryableInbound(tenantId: string) {
  const [row] = await db
    .select()
    .from(tenantPhoneNumbers)
    .where(
      and(
        eq(tenantPhoneNumbers.tenantId, tenantId),
        eq(tenantPhoneNumbers.purpose, 'inbound'),
        isNull(tenantPhoneNumbers.releasedAt),
        eq(tenantPhoneNumbers.provisionStatus, 'failed')
      )
    )
    .orderBy(asc(tenantPhoneNumbers.purchasedAt))
    .limit(1);
  return row ?? null;
}

async function markFailed(params: {
  tenantId: string;
  existingId?: string;
  error: string;
}): Promise<InboundDidResult> {
  const provisionError = params.error.slice(0, 500);
  if (params.existingId) {
    const [row] = await db
      .update(tenantPhoneNumbers)
      .set({
        provisionStatus: 'failed',
        provisionError,
        updatedAt: new Date(),
      })
      .where(eq(tenantPhoneNumbers.id, params.existingId))
      .returning();
    return {
      status: 'failed',
      reason: provisionError,
      number: row
        ? {
            id: row.id,
            phoneE164: row.phoneE164,
            provisionStatus: 'failed',
            provisionError: row.provisionError,
          }
        : undefined,
    };
  }

  const [row] = await db
    .insert(tenantPhoneNumbers)
    .values({
      tenantId: params.tenantId,
      phoneE164: PENDING_PHONE_E164,
      country: 'US',
      numberType: 'local',
      monthlyCostCents: 0,
      isPrimary: false,
      purpose: 'inbound',
      poolAutoManaged: false,
      provisionStatus: 'failed',
      provisionError,
    })
    .returning();

  return {
    status: 'failed',
    reason: provisionError,
    number: row
      ? {
          id: row.id,
          phoneE164: row.phoneE164,
          provisionStatus: 'failed',
          provisionError: row.provisionError,
        }
      : undefined,
  };
}

async function orderLocalDid(tenantId: string, areaCode?: string) {
  let candidates = await telnyxSearch({
    type: 'local',
    limit: 5,
    ...(areaCode && /^\d{3}$/.test(areaCode) ? { areaCode } : {}),
  });
  if (candidates.length === 0 && areaCode) {
    candidates = await telnyxSearch({ type: 'local', limit: 5 });
  }
  const pick = candidates[0];
  if (!pick) {
    throw new IntegrationError('telnyx', 'No local US numbers available to provision');
  }
  const order = await telnyxPurchase(pick.phoneE164, {
    ...(connectionId() ? { connectionId: connectionId() } : {}),
    tags: [`tenant:${tenantId}`, 'purpose:inbound'],
  });
  return { pick, order };
}

/**
 * Idempotent inbound DID assignment. `forceRetry` re-runs a failed row.
 */
export async function ensureInboundDid(
  tenantId: string,
  opts?: { areaCode?: string; forceRetry?: boolean }
): Promise<InboundDidResult> {
  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!planIncludesInboundDid(tenant?.plan)) {
    return { status: 'skipped', reason: 'plan_has_no_included_number' };
  }

  const activeCount = await countActiveInbound(tenantId);
  if (activeCount > 0) {
    const [existing] = await db
      .select()
      .from(tenantPhoneNumbers)
      .where(
        and(
          eq(tenantPhoneNumbers.tenantId, tenantId),
          eq(tenantPhoneNumbers.purpose, 'inbound'),
          isNull(tenantPhoneNumbers.releasedAt),
          eq(tenantPhoneNumbers.provisionStatus, 'active'),
          ne(tenantPhoneNumbers.phoneE164, PENDING_PHONE_E164)
        )
      )
      .orderBy(asc(tenantPhoneNumbers.purchasedAt))
      .limit(1);
    if (existing) {
      return {
        status: 'active',
        number: {
          id: existing.id,
          phoneE164: existing.phoneE164,
          provisionStatus: 'active',
          provisionError: null,
        },
      };
    }
  }

  const retryable = await findRetryableInbound(tenantId);
  if (retryable && !opts?.forceRetry) {
    return {
      status: 'failed',
      reason: retryable.provisionError ?? 'previous_order_failed',
      number: {
        id: retryable.id,
        phoneE164: retryable.phoneE164,
        provisionStatus: 'failed',
        provisionError: retryable.provisionError,
      },
    };
  }

  if (!config.TELNYX_API_KEY) {
    return markFailed({
      tenantId,
      existingId: retryable?.id,
      error: 'TELNYX_API_KEY is not set on the API',
    });
  }

  try {
    const { pick, order } = await orderLocalDid(tenantId, opts?.areaCode);
    const isFirst = activeCount === 0;

    let row;
    if (retryable) {
      [row] = await db
        .update(tenantPhoneNumbers)
        .set({
          phoneE164: pick.phoneE164,
          telnyxPhoneId: order.telnyxPhoneId,
          telnyxOrderId: order.orderId,
          region: pick.region,
          numberType: 'local',
          monthlyCostCents: 0,
          isPrimary: isFirst,
          provisionStatus: 'active',
          provisionError: null,
          updatedAt: new Date(),
        })
        .where(eq(tenantPhoneNumbers.id, retryable.id))
        .returning();
    } else {
      [row] = await db
        .insert(tenantPhoneNumbers)
        .values({
          tenantId,
          phoneE164: pick.phoneE164,
          telnyxPhoneId: order.telnyxPhoneId,
          telnyxOrderId: order.orderId,
          country: 'US',
          region: pick.region,
          numberType: 'local',
          monthlyCostCents: 0,
          isPrimary: isFirst,
          purpose: 'inbound',
          poolAutoManaged: false,
          provisionStatus: 'active',
        })
        .returning();
    }
    if (!row) throw new Error('Inbound DID insert returned no row');

    // Keep the legacy settings columns in sync so older UI / SMS helpers
    // that still read provisionedNumber keep working.
    await updateSettings(tenantId, {
      telephonyProvider: 'telnyx',
      provisionedNumber: row.phoneE164,
      provisionedNumberSid: row.telnyxPhoneId ?? undefined,
    }).catch(() => undefined);

    return {
      status: 'active',
      number: {
        id: row.id,
        phoneE164: row.phoneE164,
        provisionStatus: 'active',
        provisionError: null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return markFailed({ tenantId, existingId: retryable?.id, error: message });
  }
}

export async function retryInboundDid(
  tenantId: string,
  numberId?: string,
  areaCode?: string
): Promise<InboundDidResult> {
  if (numberId) {
    const [row] = await db
      .select()
      .from(tenantPhoneNumbers)
      .where(and(eq(tenantPhoneNumbers.id, numberId), eq(tenantPhoneNumbers.tenantId, tenantId)))
      .limit(1);
    if (row && row.provisionStatus !== 'failed' && isProvisionedE164(row.phoneE164)) {
      return {
        status: 'active',
        number: {
          id: row.id,
          phoneE164: row.phoneE164,
          provisionStatus: (row.provisionStatus as ProvisionStatus) ?? 'active',
          provisionError: row.provisionError,
        },
      };
    }
  }
  return ensureInboundDid(tenantId, { areaCode, forceRetry: true });
}
