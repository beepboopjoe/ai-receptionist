// ============================================================
// Affiliate / reseller service.
//
// Responsibilities:
//   1. Attribute a tenant to an affiliate at signup time (called
//      from auth flows when ?ref= is present).
//   2. Record a commission_events row whenever Stripe sends an
//      invoice.paid for an affiliated tenant. Idempotent via the
//      unique (stripe_invoice_id, affiliate_id) constraint.
//   3. V2 partner portal: self-registration, login, stats, payout
//      request creation.
// ============================================================
import bcrypt from 'bcryptjs';
import { db } from '../../db/client.js';
import { affiliates, tenants, commissionEvents, payoutRequests } from '../../db/schema.js';
import { and, eq, sql, desc } from 'drizzle-orm';

const SALT_ROUNDS = 10;

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

// ── V2 Partner Portal ─────────────────────────────────────────────────────────

/**
 * Self-register as a partner. Creates an affiliate row with
 * status='pending_review'. Admin must approve before the partner is active.
 * Returns null if the email already has an account.
 */
export async function applyAsPartner(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ id: string; code: string; status: string } | null> {
  const email = params.email.toLowerCase().trim();

  // Check for duplicate email
  const [existing] = await db
    .select({ id: affiliates.id })
    .from(affiliates)
    .where(eq(affiliates.email, email))
    .limit(1);
  if (existing) return null;

  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);

  // Generate unique code
  let code = generateAffiliateCode();
  for (let i = 0; i < 5; i++) {
    const [dupe] = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.code, code)).limit(1);
    if (!dupe) break;
    code = generateAffiliateCode();
  }

  const [row] = await db
    .insert(affiliates)
    .values({
      code,
      name: params.name.trim(),
      email,
      passwordHash,
      status: 'pending_review',
      isActive: false, // activated when admin approves
    })
    .returning({ id: affiliates.id, code: affiliates.code, status: affiliates.status });

  return row ?? null;
}

/**
 * Authenticate a partner by email + password.
 * Returns the affiliate row on success, null on bad credentials.
 */
export async function loginPartner(params: {
  email: string;
  password: string;
}): Promise<{ id: string; name: string; email: string; code: string; status: string; commissionPct: string } | null> {
  const email = params.email.toLowerCase().trim();
  const [affiliate] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.email, email))
    .limit(1);

  if (!affiliate?.passwordHash) return null;

  const valid = await bcrypt.compare(params.password, affiliate.passwordHash);
  if (!valid) return null;

  return {
    id: affiliate.id,
    name: affiliate.name,
    email: affiliate.email,
    code: affiliate.code,
    status: affiliate.status,
    commissionPct: String(affiliate.commissionPct),
  };
}

/**
 * Get aggregate stats + profile for a partner's own dashboard.
 */
export async function getPartnerProfile(affiliateId: string): Promise<{
  id: string;
  name: string;
  email: string;
  code: string;
  status: string;
  commissionPct: string;
  payoutEmail: string | null;
  payoutMethod: string;
  referredTenants: number;
  totalCommissionCents: number;
  pendingCommissionCents: number;
  paidOutCommissionCents: number;
} | null> {
  const [row] = await db
    .select({
      id: affiliates.id,
      name: affiliates.name,
      email: affiliates.email,
      code: affiliates.code,
      status: affiliates.status,
      commissionPct: affiliates.commissionPct,
      payoutEmail: affiliates.payoutEmail,
      payoutMethod: affiliates.payoutMethod,
      referredTenants: sql<number>`(
        SELECT COUNT(*)::int FROM ${tenants} WHERE ${tenants.affiliateId} = ${affiliates.id}
      )`,
      totalCommissionCents: sql<number>`COALESCE((
        SELECT SUM(commission_cents)::int FROM ${commissionEvents}
        WHERE ${commissionEvents.affiliateId} = ${affiliates.id}
      ), 0)`,
      pendingCommissionCents: sql<number>`COALESCE((
        SELECT SUM(commission_cents)::int FROM ${commissionEvents}
        WHERE ${commissionEvents.affiliateId} = ${affiliates.id}
          AND ${commissionEvents.payoutStatus} = 'pending'
      ), 0)`,
      paidOutCommissionCents: sql<number>`COALESCE((
        SELECT SUM(commission_cents)::int FROM ${commissionEvents}
        WHERE ${commissionEvents.affiliateId} = ${affiliates.id}
          AND ${commissionEvents.payoutStatus} = 'paid_out'
      ), 0)`,
    })
    .from(affiliates)
    .where(eq(affiliates.id, affiliateId))
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    commissionPct: String(row.commissionPct),
    referredTenants: Number(row.referredTenants),
    totalCommissionCents: Number(row.totalCommissionCents),
    pendingCommissionCents: Number(row.pendingCommissionCents),
    paidOutCommissionCents: Number(row.paidOutCommissionCents),
  };
}

/**
 * List a partner's own commission events (newest first).
 */
export async function getPartnerCommissions(affiliateId: string): Promise<Array<{
  id: string;
  tenantId: string;
  invoiceAmountCents: number;
  commissionCents: number;
  commissionPct: string;
  payoutStatus: string;
  createdAt: string;
}>> {
  const rows = await db
    .select({
      id: commissionEvents.id,
      tenantId: commissionEvents.tenantId,
      invoiceAmountCents: commissionEvents.invoiceAmountCents,
      commissionCents: commissionEvents.commissionCents,
      commissionPct: commissionEvents.commissionPct,
      payoutStatus: commissionEvents.payoutStatus,
      createdAt: commissionEvents.createdAt,
    })
    .from(commissionEvents)
    .where(eq(commissionEvents.affiliateId, affiliateId))
    .orderBy(desc(commissionEvents.createdAt));

  return rows.map((r) => ({
    ...r,
    commissionPct: String(r.commissionPct),
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Create a payout request for a partner.
 * Validates that requestedAmountCents ≤ their pending balance.
 */
export async function createPayoutRequest(params: {
  affiliateId: string;
  requestedAmountCents: number;
  payoutEmail: string;
  payoutMethod: string;
  note?: string;
}): Promise<{ id: string; status: string; requestedAmountCents: number } | { error: string }> {
  // Validate amount > 0
  if (params.requestedAmountCents <= 0) {
    return { error: 'Amount must be greater than 0' };
  }

  // Check pending balance
  const [balanceRow] = await db
    .select({
      pendingCents: sql<number>`COALESCE(SUM(commission_cents)::int, 0)`,
    })
    .from(commissionEvents)
    .where(and(
      eq(commissionEvents.affiliateId, params.affiliateId),
      eq(commissionEvents.payoutStatus, 'pending')
    ));

  const pendingCents = Number(balanceRow?.pendingCents ?? 0);
  if (params.requestedAmountCents > pendingCents) {
    return { error: `Requested amount exceeds pending balance ($${(pendingCents / 100).toFixed(2)})` };
  }

  // Update payout contact info on the affiliate row
  await db
    .update(affiliates)
    .set({ payoutEmail: params.payoutEmail, payoutMethod: params.payoutMethod })
    .where(eq(affiliates.id, params.affiliateId));

  const [row] = await db
    .insert(payoutRequests)
    .values({
      affiliateId: params.affiliateId,
      requestedAmountCents: params.requestedAmountCents,
      note: params.note,
    })
    .returning({ id: payoutRequests.id, status: payoutRequests.status, requestedAmountCents: payoutRequests.requestedAmountCents });

  return row!;
}

/**
 * List a partner's own payout requests.
 */
export async function getPartnerPayoutRequests(affiliateId: string) {
  const rows = await db
    .select()
    .from(payoutRequests)
    .where(eq(payoutRequests.affiliateId, affiliateId))
    .orderBy(desc(payoutRequests.createdAt));
  return rows;
}

// ── Admin helpers ─────────────────────────────────────────────────────────────

/**
 * List all payout requests (admin view).
 */
export async function listAllPayoutRequests() {
  return db
    .select({
      id: payoutRequests.id,
      affiliateId: payoutRequests.affiliateId,
      affiliateName: affiliates.name,
      affiliateEmail: affiliates.email,
      requestedAmountCents: payoutRequests.requestedAmountCents,
      status: payoutRequests.status,
      note: payoutRequests.note,
      adminNote: payoutRequests.adminNote,
      createdAt: payoutRequests.createdAt,
      processedAt: payoutRequests.processedAt,
    })
    .from(payoutRequests)
    .leftJoin(affiliates, eq(payoutRequests.affiliateId, affiliates.id))
    .orderBy(desc(payoutRequests.createdAt));
}

/**
 * Update a payout request status (admin: approve / reject / mark paid).
 */
export async function updatePayoutRequest(id: string, params: {
  status: 'approved' | 'paid' | 'rejected';
  adminNote?: string;
}) {
  const [row] = await db
    .update(payoutRequests)
    .set({
      status: params.status,
      adminNote: params.adminNote,
      processedAt: new Date(),
    })
    .where(eq(payoutRequests.id, id))
    .returning();
  return row ?? null;
}

/**
 * Approve a pending partner (admin sets isActive=true + status='active').
 */
export async function approvePartner(affiliateId: string) {
  const [row] = await db
    .update(affiliates)
    .set({ isActive: true, status: 'active' })
    .where(eq(affiliates.id, affiliateId))
    .returning();
  return row ?? null;
}

// ── Admin aggregate stats ─────────────────────────────────────────────────────

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
