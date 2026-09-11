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
import { ConflictError, ValidationError } from '../../lib/errors.js';
import { config } from '../../config.js';
import {
  DEFAULT_COMMISSION_MONTHS,
  DEFAULT_COMMISSION_PCT,
  decideAttribution,
  evaluateCommission,
  generateAffiliateCode,
  isDuplicateCommissionError,
  isValidAffiliateCode,
  normalizeAffiliateCode,
} from './affiliate.helpers.js';

const SALT_ROUNDS = 10;

export { generateAffiliateCode, normalizeAffiliateCode, isValidAffiliateCode };

export function referralUrls(code: string): { refUrl: string; shortUrl: string } {
  const base = (config.DASHBOARD_URL || 'https://telfin.ai').replace(/\/$/, '');
  const encoded = encodeURIComponent(code);
  return {
    refUrl: `${base}/?ref=${encoded}`,
    shortUrl: `${base}/r/${encoded}`,
  };
}

async function allocateUniqueCode(preferred?: string): Promise<string> {
  if (preferred) {
    const code = normalizeAffiliateCode(preferred);
    if (!isValidAffiliateCode(code)) {
      throw new ValidationError('Referral code must be 3–32 characters (A–Z, 0–9, _ or -)');
    }
    const [existing] = await db
      .select({ id: affiliates.id })
      .from(affiliates)
      .where(eq(affiliates.code, code))
      .limit(1);
    if (existing) throw new ConflictError('Referral code already in use');
    return code;
  }
  for (let i = 0; i < 8; i++) {
    const code = generateAffiliateCode();
    const [existing] = await db
      .select({ id: affiliates.id })
      .from(affiliates)
      .where(eq(affiliates.code, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new ConflictError('Could not allocate a unique referral code');
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
  const normalized = normalizeAffiliateCode(params.code);
  if (!normalized) return null;

  const [affiliate] = await db
    .select({ id: affiliates.id, isActive: affiliates.isActive })
    .from(affiliates)
    .where(eq(affiliates.code, normalized))
    .limit(1);

  const [tenant] = await db
    .select({ id: tenants.id, existingAffiliate: tenants.affiliateId })
    .from(tenants)
    .where(eq(tenants.id, params.tenantId))
    .limit(1);
  if (!tenant) return null;

  const decision = decideAttribution({
    existingAffiliateId: tenant.existingAffiliate,
    lookedUpAffiliateId: affiliate?.id,
    affiliateActive: Boolean(affiliate?.isActive),
  });
  if (decision.action === 'reject') return null;
  if (decision.action === 'keep') {
    return { affiliateId: decision.affiliateId, alreadyAttributed: true };
  }

  await db
    .update(tenants)
    .set({ affiliateId: decision.affiliateId, attributionSignedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenants.id, params.tenantId));

  return { affiliateId: decision.affiliateId, alreadyAttributed: false };
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
  invoicePaidAt?: Date;
}): Promise<{ commissionCents: number } | null> {
  // Find the affiliate via the tenant row.
  const [row] = await db
    .select({
      affiliateId: tenants.affiliateId,
      attributionSignedAt: tenants.attributionSignedAt,
      commissionPct: affiliates.commissionPct,
      affiliateActive: affiliates.isActive,
      flatBountyCents: affiliates.flatBountyCents,
      commissionMonths: affiliates.commissionMonths,
    })
    .from(tenants)
    .leftJoin(affiliates, eq(tenants.affiliateId, affiliates.id))
    .where(eq(tenants.id, params.tenantId))
    .limit(1);

  let priorPaidConversions = 0;
  if (row?.affiliateId) {
    const [prior] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.tenantId, params.tenantId),
          eq(commissionEvents.affiliateId, row.affiliateId)
        )
      );
    priorPaidConversions = Number(prior?.n ?? 0);
  }

  const eligibility = evaluateCommission({
    invoiceAmountCents: params.invoiceAmountCents,
    hasAffiliate: Boolean(row?.affiliateId),
    affiliateActive: Boolean(row?.affiliateActive),
    attributionSignedAt: row?.attributionSignedAt,
    commissionMonths: row?.commissionMonths ?? DEFAULT_COMMISSION_MONTHS,
    commissionPct: Number(row?.commissionPct ?? DEFAULT_COMMISSION_PCT),
    flatBountyCents: row?.flatBountyCents,
    priorPaidConversions,
    invoicePaidAt: params.invoicePaidAt ?? new Date(),
  });
  if (!eligibility.eligible || !row?.affiliateId) return null;

  const pct = Number(row.commissionPct ?? DEFAULT_COMMISSION_PCT);

  try {
    await db.insert(commissionEvents).values({
      affiliateId: row.affiliateId,
      tenantId: params.tenantId,
      stripeInvoiceId: params.stripeInvoiceId,
      invoiceAmountCents: params.invoiceAmountCents,
      commissionCents: eligibility.commissionCents,
      commissionPct: pct.toFixed(2),
    });
    return { commissionCents: eligibility.commissionCents };
  } catch (err) {
    // Unique-constraint violation = duplicate webhook delivery. Ignore.
    if (isDuplicateCommissionError(err)) return null;
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
      ...(params.note !== undefined ? { note: params.note } : {}),
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
      processedAt: new Date(),
      ...(params.adminNote !== undefined ? { adminNote: params.adminNote } : {}),
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

export interface CreateAffiliateInput {
  name: string;
  email: string;
  code?: string;
  commissionPct?: number;
  flatBountyCents?: number | null;
  commissionMonths?: number;
}

export async function createAffiliate(params: CreateAffiliateInput) {
  const name = params.name.trim();
  const email = params.email.toLowerCase().trim();
  if (!name) throw new ValidationError('name is required');
  if (!email || !email.includes('@')) throw new ValidationError('valid email is required');

  const commissionPct =
    params.commissionPct === undefined ? DEFAULT_COMMISSION_PCT : params.commissionPct;
  if (commissionPct < 0 || commissionPct > 100) {
    throw new ValidationError('commissionPct must be 0–100');
  }

  const commissionMonths =
    params.commissionMonths === undefined ? DEFAULT_COMMISSION_MONTHS : params.commissionMonths;
  if (!Number.isInteger(commissionMonths) || commissionMonths < 0 || commissionMonths > 120) {
    throw new ValidationError('commissionMonths must be 0–120 (0 = lifetime)');
  }

  const flatBountyCents =
    params.flatBountyCents === undefined || params.flatBountyCents === null
      ? null
      : Math.floor(params.flatBountyCents);
  if (flatBountyCents !== null && (flatBountyCents < 0 || flatBountyCents > 1_000_000_00)) {
    throw new ValidationError('flatBountyCents must be 0–100000000');
  }

  const [emailTaken] = await db
    .select({ id: affiliates.id })
    .from(affiliates)
    .where(eq(affiliates.email, email))
    .limit(1);
  if (emailTaken) throw new ConflictError('An affiliate with this email already exists');

  const code = await allocateUniqueCode(params.code);

  const [row] = await db
    .insert(affiliates)
    .values({
      code,
      name,
      email,
      commissionPct: commissionPct.toFixed(2),
      flatBountyCents,
      commissionMonths,
      isActive: true,
      status: 'active',
    })
    .returning();

  if (!row) throw new Error('Affiliate insert returned no row');
  return serializeAffiliate(row);
}

function serializeAffiliate(row: typeof affiliates.$inferSelect) {
  const urls = referralUrls(row.code);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    commissionPct: Number(row.commissionPct),
    flatBountyCents: row.flatBountyCents,
    commissionMonths: row.commissionMonths,
    isActive: row.isActive,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    ...urls,
  };
}

export async function getAffiliateDetail(id: string) {
  const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1);
  if (!affiliate) return null;

  const referred = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      plan: tenants.plan,
      createdAt: tenants.createdAt,
      attributionSignedAt: tenants.attributionSignedAt,
      ownerEmail: sql<string | null>`(
        SELECT email FROM admin_users
        WHERE tenant_id = ${tenants.id} AND role = 'owner'
        ORDER BY created_at ASC
        LIMIT 1
      )`,
    })
    .from(tenants)
    .where(eq(tenants.affiliateId, id))
    .orderBy(desc(tenants.createdAt));

  const events = await db
    .select()
    .from(commissionEvents)
    .where(eq(commissionEvents.affiliateId, id))
    .orderBy(desc(commissionEvents.createdAt));

  const pendingCommissionCents = events
    .filter((e) => e.payoutStatus === 'pending')
    .reduce((sum, e) => sum + e.commissionCents, 0);
  const paidOutCommissionCents = events
    .filter((e) => e.payoutStatus === 'paid_out')
    .reduce((sum, e) => sum + e.commissionCents, 0);

  return {
    affiliate: serializeAffiliate(affiliate),
    referredTenants: referred.map((t) => ({
      id: t.id,
      name: t.name,
      plan: t.plan,
      ownerEmail: t.ownerEmail,
      createdAt: t.createdAt.toISOString(),
      attributionSignedAt: t.attributionSignedAt?.toISOString() ?? null,
    })),
    events: events.map((e) => ({
      ...e,
      commissionPct: String(e.commissionPct),
      createdAt: e.createdAt.toISOString(),
      paidOutAt: e.paidOutAt?.toISOString() ?? null,
    })),
    stats: {
      referredTenants: referred.length,
      conversions: events.length,
      totalCommissionCents: pendingCommissionCents + paidOutCommissionCents,
      pendingCommissionCents,
      paidOutCommissionCents,
    },
  };
}

export async function markCommissionPaid(id: string) {
  const [row] = await db
    .update(commissionEvents)
    .set({ payoutStatus: 'paid_out', paidOutAt: new Date() })
    .where(eq(commissionEvents.id, id))
    .returning();
  return row ?? null;
}

/** Aggregate stats for the admin affiliates list page. */
export async function listAffiliatesWithStats(): Promise<
  Array<{
    id: string;
    code: string;
    name: string;
    email: string;
    commissionPct: number;
    flatBountyCents: number | null;
    commissionMonths: number;
    isActive: boolean;
    status: string;
    createdAt: string;
    referredTenants: number;
    totalCommissionCents: number;
    pendingCommissionCents: number;
    paidOutCommissionCents: number;
    refUrl: string;
    shortUrl: string;
  }>
> {
  const rows = await db
    .select({
      id: affiliates.id,
      code: affiliates.code,
      name: affiliates.name,
      email: affiliates.email,
      commissionPct: affiliates.commissionPct,
      flatBountyCents: affiliates.flatBountyCents,
      commissionMonths: affiliates.commissionMonths,
      isActive: affiliates.isActive,
      status: affiliates.status,
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
      paidOutCommissionCents: sql<number>`COALESCE((
        SELECT SUM(commission_cents)::int FROM ${commissionEvents}
        WHERE ${commissionEvents.affiliateId} = ${affiliates.id}
          AND ${commissionEvents.payoutStatus} = 'paid_out'
      ), 0)`,
    })
    .from(affiliates)
    .orderBy(desc(affiliates.createdAt));

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    email: r.email,
    commissionPct: Number(r.commissionPct),
    flatBountyCents: r.flatBountyCents,
    commissionMonths: r.commissionMonths,
    isActive: r.isActive,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    referredTenants: Number(r.referredTenants),
    totalCommissionCents: Number(r.totalCommissionCents),
    pendingCommissionCents: Number(r.pendingCommissionCents),
    paidOutCommissionCents: Number(r.paidOutCommissionCents),
    ...referralUrls(r.code),
  }));
}
