// ============================================================
// Affiliate / reseller MVP service.
//
// Two responsibilities:
//   1. Attribute a tenant to an affiliate at signup time (called
//      from auth flows when ?ref= is present).
//   2. Record a commission_events row whenever Stripe sends an
//      invoice.paid for an affiliated tenant. Idempotent via the
//      unique (stripe_invoice_id, affiliate_id) constraint.
// ============================================================
import { db } from '../../db/client.js';
import { affiliates, tenants, commissionEvents } from '../../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';

/** Generate a URL-safe 8-character affiliate code. */
export function generateAffiliateCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/O/0/1 ambiguity
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Attribute a tenant to an affiliate by looking up the code. Returns
 * the affiliate row when successful, null on unknown code. Idempotent
 * — a second call for the same tenant with the same code is a no-op.
 * If the tenant is already attributed to a *different* affiliate, we
 * keep the existing attribution (first-touch wins).
 */
export async function attributeTenant(params: {
  tenantId: string;
  code: string;
}): Promise<{ affiliateId: string; alreadyAttributed: boolean } | null> {
  const normalized = params.code.trim().toUpperCase();
  if (!normalized) return null;

  const [affiliate] = await db
    .select({ id: affiliates.id, isActive: affiliates.isActive })
    .from(affiliates)
    .where(eq(affiliates.code, normalized))
    .limit(1);
  if (!affiliate || !affiliate.isActive) return null;

  const [tenant] = await db
    .select({ id: tenants.id, existingAffiliate: tenants.affiliateId })
    .from(tenants)
    .where(eq(tenants.id, params.tenantId))
    .limit(1);
  if (!tenant) return null;

  if (tenant.existingAffiliate) {
    return { affiliateId: tenant.existingAffiliate, alreadyAttributed: true };
  }

  await db
    .update(tenants)
    .set({ affiliateId: affiliate.id, attributionSignedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenants.id, params.tenantId));

  return { affiliateId: affiliate.id, alreadyAttributed: false };
}

/**
 * Record a commission event when Stripe sends an invoice.paid for
 * an affiliated tenant. Called from the Stripe webhook handler.
 *
 * Returns the persisted row or null if:
 *   - the tenant has no affiliate
 *   - the affiliate is inactive
 *   - we've already recorded this invoice (duplicate webhook delivery)
 */
export async function recordCommissionEvent(params: {
  tenantId: string;
  stripeInvoiceId: string;
  invoiceAmountCents: number;
}): Promise<{ commissionCents: number } | null> {
  // Find the affiliate via the tenant row.
  const [row] = await db
    .select({
      affiliateId: tenants.affiliateId,
      commissionPct: affiliates.commissionPct,
      affiliateActive: affiliates.isActive,
    })
    .from(tenants)
    .leftJoin(affiliates, eq(tenants.affiliateId, affiliates.id))
    .where(eq(tenants.id, params.tenantId))
    .limit(1);
  if (!row?.affiliateId || !row.affiliateActive || !row.commissionPct) return null;

  const pct = Number(row.commissionPct);
  const commissionCents = Math.round(params.invoiceAmountCents * (pct / 100));

  try {
    await db.insert(commissionEvents).values({
      affiliateId: row.affiliateId,
      tenantId: params.tenantId,
      stripeInvoiceId: params.stripeInvoiceId,
      invoiceAmountCents: params.invoiceAmountCents,
      commissionCents,
      commissionPct: pct.toFixed(2),
    });
    return { commissionCents };
  } catch (err) {
    // Unique-constraint violation = duplicate webhook delivery. Ignore.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('commission_events_invoice_uniq') || msg.includes('duplicate key')) {
      return null;
    }
    throw err;
  }
}

/** Aggregate stats for the admin affiliates list page. */
export async function listAffiliatesWithStats(): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    email: string;
    commissionPct: number;
    isActive: boolean;
    createdAt: string;
    referredTenants: number;
    totalCommissionCents: number;
    pendingCommissionCents: number;
  }>
> {
  const rows = await db
    .select({
      id: affiliates.id,
      code: affiliates.code,
      name: affiliates.name,
      email: affiliates.email,
      commissionPct: affiliates.commissionPct,
      isActive: affiliates.isActive,
      createdAt: affiliates.createdAt,
      referredTenants: sql<number>`(
        SELECT COUNT(*)::int FROM ${tenants} WHERE ${tenants.affiliateId} = ${affiliates.id}
      )`,
      totalCommissionCents: sql<number>`COALESCE((
        SELECT SUM(commission_cents)::int FROM ${commissionEvents} WHERE ${commissionEvents.affiliateId} = ${affiliates.id}
      ), 0)`,
      pendingCommissionCents: sql<number>`COALESCE((
        SELECT SUM(commission_cents)::int FROM ${commissionEvents}
        WHERE ${commissionEvents.affiliateId} = ${affiliates.id}
          AND ${commissionEvents.payoutStatus} = 'pending'
      ), 0)`,
    })
    .from(affiliates);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    email: r.email,
    commissionPct: Number(r.commissionPct),
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    referredTenants: Number(r.referredTenants),
    totalCommissionCents: Number(r.totalCommissionCents),
    pendingCommissionCents: Number(r.pendingCommissionCents),
  }));
}
