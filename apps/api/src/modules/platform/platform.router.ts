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
import {
  tenants,
  calls,
  adminUsers,
  demoLeads,
  tenantPhoneNumbers,
  tenantSettings,
  phonePortRequests,
} from '../../db/schema.js';
import { and, eq, gte, sql, desc, ilike, or, inArray, isNull } from 'drizzle-orm';
import { config } from '../../config.js';
import { AuthError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { auditLog } from '../../audit/audit-logger.js';
import { getStripe } from '../billing/stripe.client.js';
import { probeTelnyxAuth } from '../../lib/telnyx-auth.js';
import { DEFAULT_PUBLIC_GROK_VOICE, PLANS } from '@ai-receptionist/shared';
import {
  billingKind,
  computeGoLiveBlockers,
  countsTowardMrr,
  planPriceCents,
  resolveIncludedMinutes,
} from './go-live-blockers.js';

const VALID_PROMO_PLANS = PLANS.map((p) => p.key);

/** Gate: caller's JWT email must appear in ADMIN_EMAILS. */
export async function requirePlatformAdmin(
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

  // ── Telnyx credential probe (no dial) ──────────────────────────────
  // GET /v2/balance with the sanitized API key. Platform-admin only.
  // Returns log-safe key diagnostics + httpStatus so ops can confirm a
  // 401 without placing a homepage call-me.
  app.get(
    '/platform/telnyx-auth',
    { onRequest: [requirePlatformAdmin] },
    async (_request, _reply) => {
      return probeTelnyxAuth(process.env['TELNYX_API_KEY'], config.TELNYX_APP_ID);
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

      // MRR = sum of shared-catalog monthly prices for paying tenants.
      // Promo trials are complimentary and must not inflate this number.
      // Usage-ledger detail (per-tenant billed minutes) is owned by a
      // parallel PR — this endpoint stays a rollup until that lands.
      const mrrCents = tenantRows
        .filter((t) => countsTowardMrr({ subscriptionStatus: t.status, promoTrial: t.promoTrial }))
        .reduce((sum, t) => sum + planPriceCents(t.plan), 0);

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
          legacyPricing: tenants.legacyPricing,
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
      const lastCallByTenant = new Map<string, Date>();
      const phoneByTenant = new Map<string, string>();
      const pendingPortByTenant = new Set<string>();
      const settingsByTenant = new Map<
        string,
        { voiceName: string | null; transferNumber: string | null; officeHours: unknown }
      >();
      if (tenantIds.length > 0) {
        const [usageRows, lastCallRows, phoneRows, portRows, settingsRows] = await Promise.all([
          db
            .select({
              tenantId: calls.tenantId,
              totalSeconds: sql<number>`COALESCE(SUM(${calls.durationSeconds}), 0)`,
            })
            .from(calls)
            .where(and(inArray(calls.tenantId, tenantIds), gte(calls.startedAt, monthStart)))
            .groupBy(calls.tenantId),
          db
            .select({
              tenantId: calls.tenantId,
              lastCallAt: sql<Date>`MAX(${calls.startedAt})`,
            })
            .from(calls)
            .where(inArray(calls.tenantId, tenantIds))
            .groupBy(calls.tenantId),
          db
            .select({
              tenantId: tenantPhoneNumbers.tenantId,
              phoneE164: tenantPhoneNumbers.phoneE164,
              isPrimary: tenantPhoneNumbers.isPrimary,
            })
            .from(tenantPhoneNumbers)
            .where(
              and(
                inArray(tenantPhoneNumbers.tenantId, tenantIds),
                isNull(tenantPhoneNumbers.releasedAt),
                eq(tenantPhoneNumbers.purpose, 'inbound'),
                sql`${tenantPhoneNumbers.phoneE164} LIKE '+%'`
              )
            ),
          db
            .select({ tenantId: phonePortRequests.tenantId })
            .from(phonePortRequests)
            .where(
              and(
                inArray(phonePortRequests.tenantId, tenantIds),
                inArray(phonePortRequests.status, ['pending', 'submitted', 'in_progress'])
              )
            ),
          db
            .select({
              tenantId: tenantSettings.tenantId,
              voiceName: tenantSettings.voiceName,
              transferNumber: tenantSettings.transferNumber,
              officeHours: tenantSettings.officeHours,
            })
            .from(tenantSettings)
            .where(inArray(tenantSettings.tenantId, tenantIds)),
        ]);
        usageByTenant = new Map(
          usageRows.map((r) => [r.tenantId, Math.ceil((Number(r.totalSeconds) ?? 0) / 60)])
        );
        for (const row of lastCallRows) {
          if (row.lastCallAt) lastCallByTenant.set(row.tenantId, row.lastCallAt);
        }
        // Prefer the primary inbound number when a tenant has several.
        for (const row of phoneRows) {
          const existing = phoneByTenant.get(row.tenantId);
          if (!existing || row.isPrimary) phoneByTenant.set(row.tenantId, row.phoneE164);
        }
        for (const row of portRows) pendingPortByTenant.add(row.tenantId);
        for (const row of settingsRows) {
          settingsByTenant.set(row.tenantId, {
            voiceName: row.voiceName,
            transferNumber: row.transferNumber,
            officeHours: row.officeHours,
          });
        }
      }

      const enriched = limited.map((t) => {
        const minutesUsed = usageByTenant.get(t.id) ?? 0;
        const { minutesIncluded, unlimited } = resolveIncludedMinutes({
          plan: t.plan,
          minutesOverride: t.minutesOverride,
          legacyPricing: t.legacyPricing,
        });
        const settings = settingsByTenant.get(t.id);
        const goLiveBlockers = computeGoLiveBlockers({
          hasInboundPhone: phoneByTenant.has(t.id),
          hasPendingPort: pendingPortByTenant.has(t.id),
          voiceName: settings?.voiceName ?? DEFAULT_PUBLIC_GROK_VOICE,
          officeHours: settings?.officeHours ?? {},
          transferNumber: settings?.transferNumber ?? '',
        });
        return {
          ...t,
          minutesUsed,
          minutesIncluded,
          minutesUnlimited: unlimited,
          capReached: t.promoTrial && !unlimited && minutesUsed >= minutesIncluded,
          phone: phoneByTenant.get(t.id) ?? null,
          lastCallAt: lastCallByTenant.get(t.id) ?? null,
          goLiveBlockers,
          billing: billingKind({
            plan: t.plan,
            subscriptionStatus: t.subscriptionStatus,
            promoTrial: t.promoTrial,
          }),
        };
      });

      // If sort by minutes was requested, sort enriched.
      if (sort === 'minutes_desc') {
        enriched.sort((a, b) => b.minutesUsed - a.minutesUsed);
      }

      return { data: enriched, total: filtered.length };
    }
  );

  // ── Homepage / call-me leads (every valid phone submit) ────────────
  app.get(
    '/platform/demo-leads',
    { onRequest: [requirePlatformAdmin] },
    async (request, _reply) => {
      const q = request.query as { closed?: string; source?: string; limit?: string };
      const closedFilter =
        q.closed === 'true' ? true : q.closed === 'false' ? false : undefined;
      const sourceFilter =
        q.source === 'call_me' || q.source === 'site_chat' ? q.source : undefined;
      const limit = Math.min(500, Math.max(1, Number(q.limit) || 200));

      const columns = {
        id: demoLeads.id,
        phoneE164: demoLeads.phoneE164,
        email: demoLeads.email,
        source: demoLeads.source,
        emailConsent: demoLeads.emailConsent,
        smsConsent: demoLeads.smsConsent,
        transcript: demoLeads.transcript,
        conversationId: demoLeads.conversationId,
        pagePath: demoLeads.pagePath,
        name: demoLeads.name,
        business: demoLeads.business,
        language: demoLeads.language,
        voice: demoLeads.voice,
        closed: demoLeads.closed,
        callId: demoLeads.callId,
        notes: demoLeads.notes,
        createdAt: demoLeads.createdAt,
        updatedAt: demoLeads.updatedAt,
      } as const;

      const filters = [
        ...(closedFilter === undefined ? [] : [eq(demoLeads.closed, closedFilter)]),
        ...(sourceFilter ? [eq(demoLeads.source, sourceFilter)] : []),
      ];

      const rows =
        filters.length === 0
          ? await db.select(columns).from(demoLeads).orderBy(desc(demoLeads.createdAt)).limit(limit)
          : await db
              .select(columns)
              .from(demoLeads)
              .where(and(...filters))
              .orderBy(desc(demoLeads.createdAt))
              .limit(limit);

      return { data: rows, total: rows.length };
    }
  );

  // Grant / revoke live on /platform so the admin UI does not depend on
  // /admin/tenants/:id/* (those routes are owner-gated for the caller's
  // own tenant and are the wrong auth hop for founder ops).
  app.post(
    '/platform/tenants/:id/grant-promo-trial',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { plan?: string; minutes?: number };

      if (!body.plan || !VALID_PROMO_PLANS.includes(body.plan as (typeof VALID_PROMO_PLANS)[number])) {
        throw new ValidationError(`plan must be one of: ${VALID_PROMO_PLANS.join(', ')}`);
      }
      if (
        typeof body.minutes !== 'number' ||
        !Number.isInteger(body.minutes) ||
        body.minutes < 1 ||
        body.minutes > 10_000
      ) {
        throw new ValidationError('minutes must be an integer between 1 and 10000');
      }

      const [target] = await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);
      if (!target) throw new NotFoundError('Tenant not found');

      await db
        .update(tenants)
        .set({
          plan: body.plan,
          minutesOverride: body.minutes,
          promoTrial: true,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id));

      auditLog({
        tenantId: id,
        actorType: 'admin_user',
        actorId: (request.user as { sub: string }).sub,
        action: 'tenant.promo_trial_granted',
        entityType: 'tenant',
        entityId: id,
        metadata: {
          plan: body.plan,
          minutes: body.minutes,
          targetName: target.name,
          grantedBy: (request.user as { email: string }).email,
        },
      });

      return reply.send({
        ok: true,
        tenantId: id,
        plan: body.plan,
        minutesOverride: body.minutes,
        promoTrial: true,
      });
    }
  );

  app.post(
    '/platform/tenants/:id/revoke-promo-trial',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [target] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);
      if (!target) throw new NotFoundError('Tenant not found');

      await db
        .update(tenants)
        .set({ minutesOverride: null, promoTrial: false, updatedAt: new Date() })
        .where(eq(tenants.id, id));

      auditLog({
        tenantId: id,
        actorType: 'admin_user',
        actorId: (request.user as { sub: string }).sub,
        action: 'tenant.promo_trial_revoked',
        entityType: 'tenant',
        entityId: id,
        metadata: { revokedBy: (request.user as { email: string }).email },
      });

      return reply.send({ ok: true, tenantId: id });
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

  // Platform-admin recording proxy — same bytes as tenant GET /calls/:id/recording.
  app.get<{ Params: { tenantId: string; callId: string } }>(
    '/platform/tenants/:tenantId/calls/:callId/recording',
    { onRequest: [requirePlatformAdmin] },
    async (request, reply) => {
      const { tenantId, callId } = request.params;
      const [call] = await db
        .select({ recordingUrl: calls.recordingUrl })
        .from(calls)
        .where(and(eq(calls.id, callId), eq(calls.tenantId, tenantId)))
        .limit(1);
      if (!call) throw new NotFoundError('Call not found');
      if (!call.recordingUrl) {
        return reply.status(404).send({ error: 'recording_unavailable' });
      }
      const { fetchRecordingBytes } = await import('../telephony/recording.js');
      const audio = await fetchRecordingBytes(call.recordingUrl);
      if (!audio) {
        return reply.status(502).send({ error: 'recording_fetch_failed' });
      }
      return reply
        .header('Content-Type', audio.contentType)
        .header('Cache-Control', 'private, max-age=120')
        .send(audio.body);
    }
  );
}
