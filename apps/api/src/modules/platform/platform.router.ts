// ============================================================
// Platform Admin Router
//
// Endpoints reserved for the platform owner (you, the founder).
// Unlike `requireRole('owner')` which means "owner of YOUR tenant,"
// these endpoints let you reach across ALL tenants:
//   - List every tenant in the system + their plan + minute usage
//   - Look at platform-wide stats (MRR, signups, churn)
//
// Gated by ADMIN_EMAILS (comma-separated) on the API config —
// matches the existing affiliate-admin pattern.
// ============================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { tenants, calls, adminUsers } from '../../db/schema.js';
import { and, eq, gte, sql, desc, ilike, or } from 'drizzle-orm';
import { config } from '../../config.js';
import { AuthError } from '../../lib/errors.js';

/** Gate: caller's JWT email must appear in ADMIN_EMAILS. */
async function requirePlatformAdmin(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  await request.jwtVerify();
  const allowed = config.ADMIN_EMAILS
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    throw new AuthError('Platform admin not configured — set ADMIN_EMAILS on the API');
  }
  const email = (request.user as { email?: string })?.email?.toLowerCase();
  if (!email || !allowed.includes(email)) {
    throw new AuthError('Platform admin only');
  }
}

// Same source of truth as admin/router.ts (kept in sync manually for now).
const PLAN_PRICE: Record<string, number> = {
  trial: 0,
  starter: 79,
  growth: 199,
  scale: 399,
  enterprise: 0,
  pro: 0,
};
const PLAN_MINUTES: Record<string, number> = {
  trial: 10,
  starter: 200,
  growth: 750,
  scale: 1500,
  enterprise: 99999,
  pro: 1500,
};

export async function platformPlugin(app: FastifyInstance): Promise<void> {
  // ── Self-check — used by the sidebar to decide whether to render the
  // Platform Admin link. ALWAYS returns 200 (even for non-admins) so the
  // dashboard's global 401-interceptor doesn't bounce non-admins back to
  // /login. Non-admins get { ok: false } and the sidebar hides the link.
  app.get(
    '/platform/whoami',
    { onRequest: [app.authenticate] },
    async (request, _reply) => {
      const allowed = config.ADMIN_EMAILS
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const email = request.authUser.email.toLowerCase();
      const isPlatformAdmin = allowed.length > 0 && allowed.includes(email);
      return { ok: isPlatformAdmin, email };
    }
  );

  // ── Platform-wide stats ────────────────────────────────────────────
  app.get(
    '/platform/stats',
    { onRequest: [requirePlatformAdmin] },
    async (_request, _reply) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // All tenant counts at once via a single grouped query.
      const tenantRows = await db
        .select({
          plan: tenants.plan,
          status: tenants.subscriptionStatus,
          isActive: tenants.isActive,
          promoTrial: tenants.promoTrial,
          createdAt: tenants.createdAt,
        })
        .from(tenants);

      const totalTenants = tenantRows.length;
      const activeTenants = tenantRows.filter((t) => t.isActive).length;
      const promoTenants = tenantRows.filter((t) => t.promoTrial).length;
      const signups7d = tenantRows.filter((t) => t.createdAt >= sevenDaysAgo).length;
      const signups30d = tenantRows.filter((t) => t.createdAt >= thirtyDaysAgo).length;

      // MRR = sum of monthly plan price for tenants whose Stripe sub status is
      // active or trialing. Annual plans are normalised to monthly.
      const mrrCents = tenantRows
        .filter((t) => t.status === 'active' || t.status === 'trialing')
        .reduce((sum, t) => sum + (PLAN_PRICE[t.plan] ?? 0) * 100, 0);

      // Churn proxy: count of tenants whose subscription is canceled or past_due
      const churnedRecently = tenantRows.filter(
        (t) => t.status === 'canceled' || t.status === 'past_due'
      ).length;

      // Total platform minutes consumed this calendar month
      const [usageRow] = await db
        .select({
          totalSeconds: sql<number>`COALESCE(SUM(${calls.durationSeconds}), 0)`,
          callCount: sql<number>`COUNT(*)`,
        })
        .from(calls)
        .where(gte(calls.startedAt, monthStart));

      const platformMinutesThisMonth = Math.round(
        (Number(usageRow?.totalSeconds) ?? 0) / 60
      );
      const platformCallsThisMonth = Number(usageRow?.callCount) ?? 0;

      return {
        totalTenants,
        activeTenants,
        promoTenants,
        signups7d,
        signups30d,
        mrrCents,
        churnedRecently,
        platformMinutesThisMonth,
        platformCallsThisMonth,
      };
    }
  );

  // ── Tenant list with per-tenant stats ──────────────────────────────
  // Returns up to 200 tenants. Supports ?search= (name/slug ilike) and
  // ?sort= ('created_desc' | 'minutes_desc' | 'name_asc').
  app.get(
    '/platform/tenants',
    { onRequest: [requirePlatformAdmin] },
    async (request, _reply) => {
      const q = request.query as { search?: string; sort?: string };
      const search = (q.search ?? '').trim();
      const sort = q.sort ?? 'created_desc';

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Pull tenants with their owner email (joined on adminUsers role='owner').
      const baseQuery = db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          plan: tenants.plan,
          vertical: tenants.vertical,
          isActive: tenants.isActive,
          subscriptionStatus: tenants.subscriptionStatus,
          promoTrial: tenants.promoTrial,
          minutesOverride: tenants.minutesOverride,
          createdAt: tenants.createdAt,
          ownerEmail: adminUsers.email,
        })
        .from(tenants)
        .leftJoin(
          adminUsers,
          and(eq(adminUsers.tenantId, tenants.id), eq(adminUsers.role, 'owner'))
        );

      const filtered = search
        ? await baseQuery.where(
            or(
              ilike(tenants.name, `%${search}%`),
              ilike(tenants.slug, `%${search}%`),
              ilike(adminUsers.email, `%${search}%`)
            )
          )
        : await baseQuery;

      // Sort
      const sorted = [...filtered].sort((a, b) => {
        if (sort === 'name_asc') return a.name.localeCompare(b.name);
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const limited = sorted.slice(0, 200);

      // Compute minutes used per tenant for this month in one query.
      const tenantIds = limited.map((t) => t.id);
      let usageByTenant = new Map<string, number>();
      if (tenantIds.length > 0) {
        const rows = await db
          .select({
            tenantId: calls.tenantId,
            totalSeconds: sql<number>`COALESCE(SUM(${calls.durationSeconds}), 0)`,
          })
          .from(calls)
          .where(
            and(
              sql`${calls.tenantId} = ANY(${tenantIds})`,
              gte(calls.startedAt, monthStart)
            )
          )
          .groupBy(calls.tenantId);
        usageByTenant = new Map(
          rows.map((r) => [r.tenantId, Math.ceil((Number(r.totalSeconds) ?? 0) / 60)])
        );
      }

      const enriched = limited.map((t) => {
        const minutesUsed = usageByTenant.get(t.id) ?? 0;
        const minutesIncluded = t.minutesOverride ?? PLAN_MINUTES[t.plan] ?? 0;
        return {
          ...t,
          minutesUsed,
          minutesIncluded,
          capReached: t.promoTrial && minutesUsed >= minutesIncluded,
        };
      });

      // If sort by minutes was requested, sort enriched.
      if (sort === 'minutes_desc') {
        enriched.sort((a, b) => b.minutesUsed - a.minutesUsed);
      }

      return { data: enriched, total: filtered.length };
    }
  );
}
