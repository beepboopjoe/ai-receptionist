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
import { and, eq, gte, sql, desc, ilike, or, inArray } from 'drizzle-orm';
import { config } from '../../config.js';
import { AuthError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { auditLog } from '../../audit/audit-logger.js';
import { getStripe } from '../billing/stripe.client.js';

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
          .where(and(inArray(calls.tenantId, tenantIds), gte(calls.startedAt, monthStart)))
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

  // ────────────────────────────────────────────────────────────────────
  // SUSPEND a tenant — soft action. Blocks dashboard login + incoming
  // calls without destroying any data. Cancels Stripe subscription at
  // period end (so the customer isn't billed again). Reversible via
  // /platform/tenants/:id/reactivate. Refuses to suspend a tenant the
  // caller's own account belongs to — admins must use a different
  // tool to delete their own org.
  // ────────────────────────────────────────────────────────────────────
  app.post(
    '/platform/tenants/:id/suspend',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { reason?: string };

      const [target] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          isActive: tenants.isActive,
          stripeSubscriptionId: tenants.stripeSubscriptionId,
        })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);
      if (!target) throw new NotFoundError('Tenant not found');

      const callerTenantId = (request.user as { tenantId?: string }).tenantId;
      if (callerTenantId === id) {
        throw new ValidationError('You cannot suspend your own tenant from this panel.');
      }

      // Cancel the Stripe subscription at period end — keeps service
      // running through the paid period, no immediate refund.
      let stripeCanceled = false;
      let stripeError: string | null = null;
      if (target.stripeSubscriptionId) {
        try {
          const stripe = getStripe();
          if (stripe) {
            await stripe.subscriptions.update(target.stripeSubscriptionId, {
              cancel_at_period_end: true,
            });
            stripeCanceled = true;
          }
        } catch (err) {
          stripeError = err instanceof Error ? err.message : 'Stripe call failed';
          console.error(`[platform] Suspend ${id}: stripe cancel failed:`, err);
        }
      }

      await db
        .update(tenants)
        .set({
          isActive: false,
          subscriptionStatus: 'suspended',
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id));

      auditLog({
        tenantId: id,
        actorType: 'admin_user',
        actorId: (request.user as { sub: string }).sub,
        action: 'tenant.suspended',
        entityType: 'tenant',
        entityId: id,
        metadata: {
          targetName: target.name,
          suspendedBy: (request.user as { email: string }).email,
          reason: body.reason ?? null,
          stripeCanceled,
          stripeError,
        },
      });

      return reply.send({
        ok: true,
        tenantId: id,
        suspended: true,
        stripeCanceledAtPeriodEnd: stripeCanceled,
        stripeError,
      });
    }
  );

  // ────────────────────────────────────────────────────────────────────
  // REACTIVATE a previously suspended tenant. Flips is_active back on
  // and clears the suspended status. Does NOT auto-resubscribe Stripe —
  // the customer must complete checkout again if their sub was canceled.
  // ────────────────────────────────────────────────────────────────────
  app.post(
    '/platform/tenants/:id/reactivate',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [target] = await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);
      if (!target) throw new NotFoundError('Tenant not found');

      await db
        .update(tenants)
        .set({
          isActive: true,
          // Clear our own "suspended" marker. We deliberately don't
          // touch Stripe — if cancel_at_period_end was set, the admin
          // can ask the user to re-checkout, or undo via Stripe Dashboard.
          subscriptionStatus: null,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id));

      auditLog({
        tenantId: id,
        actorType: 'admin_user',
        actorId: (request.user as { sub: string }).sub,
        action: 'tenant.reactivated',
        entityType: 'tenant',
        entityId: id,
        metadata: {
          targetName: target.name,
          reactivatedBy: (request.user as { email: string }).email,
        },
      });

      return reply.send({ ok: true, tenantId: id, suspended: false });
    }
  );

  // ────────────────────────────────────────────────────────────────────
  // DELETE a tenant — hard, irreversible. Cascades via FK constraints
  // (every tenant-scoped table has ON DELETE CASCADE on tenant_id).
  // Requires the caller to type the tenant name exactly as a typed
  // confirmation guard. Cancels the Stripe subscription IMMEDIATELY
  // (not period-end) since the account is going away. Stripe failures
  // are logged but don't block the delete — better to have an orphan
  // Stripe sub than a stuck delete request.
  //
  // Audit log is written BEFORE the delete; the audit row goes away
  // with the tenant (cascade) but is captured in the response payload
  // and console output for forensic recovery.
  // ────────────────────────────────────────────────────────────────────
  app.delete(
    '/platform/tenants/:id',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { confirmName?: string };

      const [target] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          plan: tenants.plan,
          stripeSubscriptionId: tenants.stripeSubscriptionId,
          stripeCustomerId: tenants.stripeCustomerId,
        })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);
      if (!target) throw new NotFoundError('Tenant not found');

      const callerTenantId = (request.user as { tenantId?: string }).tenantId;
      if (callerTenantId === id) {
        throw new ValidationError('You cannot delete your own tenant from this panel.');
      }

      if (!body.confirmName || body.confirmName.trim() !== target.name) {
        throw new ValidationError(
          `Typed confirmation does not match tenant name. Type "${target.name}" exactly to confirm deletion.`
        );
      }

      // Cancel the Stripe subscription NOW (not at period end). Failures
      // are logged and surfaced in the response, but don't abort the delete.
      let stripeCanceled = false;
      let stripeError: string | null = null;
      if (target.stripeSubscriptionId) {
        try {
          const stripe = getStripe();
          if (stripe) {
            await stripe.subscriptions.cancel(target.stripeSubscriptionId);
            stripeCanceled = true;
          }
        } catch (err) {
          stripeError = err instanceof Error ? err.message : 'Stripe call failed';
          console.error(`[platform] Delete ${id}: stripe cancel failed:`, err);
        }
      }

      // Forensic snapshot for the audit log — the tenant row + its
      // children all disappear in the next statement, so emit before.
      const snapshot = {
        targetId: target.id,
        targetName: target.name,
        targetSlug: target.slug,
        targetPlan: target.plan,
        stripeSubscriptionId: target.stripeSubscriptionId,
        stripeCustomerId: target.stripeCustomerId,
        deletedBy: (request.user as { email: string }).email,
        stripeCanceled,
        stripeError,
        at: new Date().toISOString(),
      };
      console.warn(`[platform] DELETE tenant ${id}`, snapshot);

      // The audit_log row is itself FK'd to tenants — it will be cascaded
      // away. We still call auditLog() to flush to whatever sinks the
      // logger has wired up (file, observability) before the delete fires.
      auditLog({
        tenantId: id,
        actorType: 'admin_user',
        actorId: (request.user as { sub: string }).sub,
        action: 'tenant.deleted',
        entityType: 'tenant',
        entityId: id,
        metadata: snapshot,
      });

      // CASCADE delete — every tenant-scoped table has ON DELETE CASCADE.
      await db.delete(tenants).where(eq(tenants.id, id));

      return reply.send({
        ok: true,
        tenantId: id,
        deleted: true,
        stripeCanceled,
        stripeError,
        snapshot,
      });
    }
  );
}
