// ============================================================
// Admin Router — auth, settings, calls, appointments, escalations,
//               contacts (admin view), notifications, onboarding, audit
// ============================================================
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { db } from '../../db/client.js';
import {
  adminUsers,
  calls,
  appointments,
  contacts,
  escalations,
  auditLogs,
  tenantSettings,
  integrations,
  tenants,
  passwordResetTokens,
} from '../../db/schema.js';
import crypto from 'node:crypto';
import { eq, and, desc, asc, count, gte, ilike, or, sql, inArray } from 'drizzle-orm';
import { config } from '../../config.js';
import {
  getSettings,
  updateSettings,
  updateOfficeHours,
  updateAppointmentTypes,
  advanceOnboardingStep,
  activateTenant,
  getOnboardingStatus,
  getTenantInfo,
  updateVertical,
} from './settings.service.js';
import { createTelephonyAdapter } from '../telephony/adapters/telephony.factory.js';
import { AuthError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { auditLog } from '../../audit/audit-logger.js';
import type { JwtPayload } from './auth.middleware.js';
import { encryptCredentials, decryptCredentials } from '../../lib/encryption.js';
import { emitWebhook } from '../webhooks/webhook.service.js';
import { pushActivity } from '../activity/activity.service.js';

const SALT_ROUNDS = 12;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

/** SHA-256 hex digest. We store the hash, never the token. */
function hashResetToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Plan tier config — must stay in sync with packages/shared/src/types/billing.types.ts
const PLAN_TIERS: Record<string, { minutesIncluded: number; price: number; outbound: boolean; overagePerMin: number }> = {
  trial:      { minutesIncluded: 10,    price: 0,    outbound: true,  overagePerMin: 0 },
  starter:    { minutesIncluded: 200,   price: 79,   outbound: true,  overagePerMin: 0.29 },
  growth:     { minutesIncluded: 750,   price: 199,  outbound: true,  overagePerMin: 0.25 },
  scale:      { minutesIncluded: 1500,  price: 399,  outbound: true,  overagePerMin: 0.19 },
  enterprise: { minutesIncluded: 99999, price: 0,    outbound: true,  overagePerMin: 0 },
};

// Per-vertical default appointment types seeded at signup. The dashboard
// UI lets owners customize these afterwards in Settings → Appointment Types.
// Exported so the Google sign-up flow (google-auth.service.ts) seeds the
// same defaults a password sign-up gets.
export const DEFAULT_APPT_TYPES_BY_VERTICAL: Record<string, Array<{ id: string; name: string; duration_min: number; buffer_min: number }>> = {
  dental: [
    { id: 'cleaning',   name: 'Cleaning / Hygiene',           duration_min: 60,  buffer_min: 10 },
    { id: 'checkup',    name: 'Checkup / Exam',               duration_min: 30,  buffer_min: 10 },
    { id: 'filling',    name: 'Filling',                      duration_min: 60,  buffer_min: 15 },
    { id: 'extraction', name: 'Extraction',                   duration_min: 90,  buffer_min: 20 },
    { id: 'root_canal', name: 'Root Canal',                   duration_min: 120, buffer_min: 20 },
    { id: 'crown',      name: 'Crown / Bridge',               duration_min: 90,  buffer_min: 20 },
    { id: 'consult',    name: 'New Patient Consultation',     duration_min: 45,  buffer_min: 10 },
  ],
  insurance: [
    { id: 'quote_consult',   name: 'Quote Consultation',      duration_min: 30, buffer_min: 5 },
    { id: 'policy_review',   name: 'Policy Review',           duration_min: 45, buffer_min: 10 },
    { id: 'renewal',         name: 'Renewal Meeting',         duration_min: 30, buffer_min: 5 },
    { id: 'claim_followup',  name: 'Claim Follow-Up',         duration_min: 30, buffer_min: 5 },
    { id: 'new_client',      name: 'New Client Intake',       duration_min: 45, buffer_min: 10 },
  ],
  legal: [
    { id: 'initial_consult', name: 'Initial Consultation',    duration_min: 60, buffer_min: 15 },
    { id: 'case_review',     name: 'Case Review',             duration_min: 60, buffer_min: 15 },
    { id: 'document_signing',name: 'Document Signing',        duration_min: 30, buffer_min: 10 },
    { id: 'deposition_prep', name: 'Deposition Prep',         duration_min: 90, buffer_min: 15 },
    { id: 'follow_up',       name: 'Client Follow-Up',        duration_min: 30, buffer_min: 5 },
  ],
  real_estate: [
    { id: 'showing',         name: 'Property Showing',        duration_min: 30, buffer_min: 15 },
    { id: 'open_house',      name: 'Open House',              duration_min: 90, buffer_min: 15 },
    { id: 'listing_consult', name: 'Listing Consultation',    duration_min: 60, buffer_min: 15 },
    { id: 'buyer_consult',   name: 'Buyer Consultation',      duration_min: 60, buffer_min: 15 },
    { id: 'closing',         name: 'Closing Meeting',         duration_min: 60, buffer_min: 15 },
  ],
  home_services: [
    { id: 'estimate',        name: 'Free Estimate',           duration_min: 30, buffer_min: 15 },
    { id: 'service_call',    name: 'Service Call',            duration_min: 60, buffer_min: 30 },
    { id: 'install',         name: 'Installation',            duration_min: 240, buffer_min: 30 },
    { id: 'maintenance',     name: 'Routine Maintenance',     duration_min: 60, buffer_min: 15 },
    { id: 'emergency',       name: 'Emergency Dispatch',      duration_min: 90, buffer_min: 30 },
  ],
  generic: [
    { id: 'consultation',    name: 'Consultation',            duration_min: 30, buffer_min: 10 },
    { id: 'follow_up',       name: 'Follow-Up',               duration_min: 30, buffer_min: 5 },
    { id: 'intake',          name: 'New Client Intake',       duration_min: 45, buffer_min: 10 },
    { id: 'review',          name: 'Review Meeting',          duration_min: 30, buffer_min: 5 },
  ],
};

// Vertical list lives in @ai-receptionist/shared. Imported via settings.service re-export
// so we have one source of truth.
import { VERTICAL_VALUES as VALID_VERTICALS, isVertical } from '@ai-receptionist/shared';

export async function adminPlugin(app: FastifyInstance) {
  // ================================================================
  // AUTH
  // ================================================================
  app.post('/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    if (!email || !password) throw new ValidationError('email and password required');

    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.passwordHash) throw new AuthError('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AuthError('Invalid credentials');

    // Update last login
    await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const token = app.jwt.sign(payload);
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    );

    return reply.send({ token, refreshToken, user: { id: user.id, email: user.email, role: user.role } });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) throw new ValidationError('refreshToken required');

    let decoded: { sub: string; type: string };
    try {
      decoded = app.jwt.verify(refreshToken) as { sub: string; type: string };
    } catch {
      throw new AuthError('Invalid refresh token');
    }

    if (decoded.type !== 'refresh') throw new AuthError('Invalid token type');

    const [user] = await db
      .select({ id: adminUsers.id, tenantId: adminUsers.tenantId, email: adminUsers.email, role: adminUsers.role })
      .from(adminUsers)
      .where(eq(adminUsers.id, decoded.sub))
      .limit(1);

    if (!user) throw new AuthError('User not found');

    const token = app.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });

    return reply.send({ token });
  });

  app.post('/auth/logout', async (_request, reply) => {
    // Stateless JWT — client discards token
    return reply.status(204).send();
  });

  app.post('/auth/register', {
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { businessName, email, password, aiUseCase, vertical } = request.body as {
      businessName: string;
      email: string;
      password: string;
      aiUseCase?: 'inbound' | 'outbound' | 'both';
      vertical?: string;
    };

    if (!businessName || !email || !password) {
      throw new ValidationError('businessName, email, and password are required');
    }
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    // Validate vertical if provided; default to 'generic' otherwise.
    const resolvedVertical: string = isVertical(vertical) ? vertical : 'generic';

    const normalizedEmail = email.toLowerCase().trim();

    // Check email uniqueness
    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, normalizedEmail))
      .limit(1);
    if (existing) throw new ValidationError('An account with this email already exists');

    // Build slug from business name
    const baseSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const uniqueSuffix = Math.random().toString(36).slice(2, 7);
    const slug = `${baseSlug}-${uniqueSuffix}`;

    // Determine starting plan from aiUseCase
    const plan = aiUseCase === 'outbound' || aiUseCase === 'both' ? 'trial' : 'trial';

    // Create tenant — vertical baked in at create-time so default appointment
    // types and prompts pick it up without a follow-up PATCH.
    const [tenant] = await db
      .insert(tenants)
      .values({ name: businessName, slug, plan, vertical: resolvedVertical, timezone: 'America/New_York', isActive: false, onboardingStep: 1 })
      .returning();

    // Create admin user (owner)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [user] = await db
      .insert(adminUsers)
      .values({ tenantId: tenant.id, email: normalizedEmail, passwordHash, role: 'owner' })
      .returning();

    // Create tenant settings with vertical-aware defaults.
    const defaultApptTypes = DEFAULT_APPT_TYPES_BY_VERTICAL[resolvedVertical] ?? DEFAULT_APPT_TYPES_BY_VERTICAL['generic'];
    await db.insert(tenantSettings).values({
      tenantId: tenant.id,
      appointmentTypes: defaultApptTypes,
      officeHours: {
        monday:    { open: true,  start: '09:00', end: '17:00' },
        tuesday:   { open: true,  start: '09:00', end: '17:00' },
        wednesday: { open: true,  start: '09:00', end: '17:00' },
        thursday:  { open: true,  start: '09:00', end: '17:00' },
        friday:    { open: true,  start: '09:00', end: '17:00' },
        saturday:  { open: false, start: '09:00', end: '13:00' },
        sunday:    { open: false, start: '09:00', end: '13:00' },
      },
    });

    auditLog({
      tenantId: tenant.id,
      actorType: 'admin',
      actorId: user.id,
      action: 'tenant.registered',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: { aiUseCase },
    });

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role,
    };
    const token = app.jwt.sign(payload);
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

    return reply.status(201).send({
      token,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
    });
  });

  app.post('/auth/forgot-password', {
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { email } = request.body as { email: string };
    if (!email) throw new ValidationError('email is required');

    const [user] = await db
      .select({ id: adminUsers.id, email: adminUsers.email })
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return 204 to avoid email enumeration. Only mint a token if
    // the user actually exists; otherwise we silently no-op.
    if (user) {
      // 32 bytes of randomness. The raw token is the only thing the user sees;
      // we persist only its SHA-256 hash so a DB leak doesn't reveal active links.
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const resetUrl = `${config.DASHBOARD_URL}/reset-password/${rawToken}`;
      // In development, log the URL; in production, send via Resend
      app.log.info({ resetUrl, userId: user.id }, 'Password reset link generated');
      // TODO: send via Resend when RESEND_API_KEY is configured
    }

    return reply.status(204).send();
  });

  app.post('/auth/reset-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };
    if (!token || !newPassword) throw new ValidationError('token and newPassword are required');
    if (newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters');

    const tokenHash = hashResetToken(token);
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new ValidationError('Reset token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    // Atomically: rewrite the password AND mark the token used. We do these
    // sequentially because there's no transaction wrapper here, but the
    // single-use check above + UNIQUE on tokenHash makes a race benign.
    await db.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, row.userId));
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id));

    return reply.status(204).send();
  });

  // ================================================================
  // BILLING (authenticated)
  // ================================================================
  app.get(
    '/billing',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;

      // Get tenant plan + promo-trial fields
      const [tenant] = await db
        .select({
          plan: tenants.plan,
          createdAt: tenants.createdAt,
          minutesOverride: tenants.minutesOverride,
          promoTrial: tenants.promoTrial,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) throw new NotFoundError('Tenant not found');

      const plan = tenant.plan as keyof typeof PLAN_TIERS;
      const tier = PLAN_TIERS[plan] ?? PLAN_TIERS['trial'];

      // Effective cap: promo-trial override wins over the plan default.
      const minutesIncluded = tenant.minutesOverride ?? tier.minutesIncluded;

      // Calculate this month's usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [usageRow] = await db
        .select({
          totalSeconds: sql<number>`COALESCE(SUM(${calls.durationSeconds}), 0)`,
          callCount: count(),
        })
        .from(calls)
        .where(and(eq(calls.tenantId, tenantId), gte(calls.startedAt, monthStart)));

      const [apptRow] = await db
        .select({ apptCount: count() })
        .from(appointments)
        .where(and(eq(appointments.tenantId, tenantId), gte(appointments.createdAt, monthStart)));

      const minutesUsed = Math.ceil((Number(usageRow?.totalSeconds) ?? 0) / 60);

      // Renewal date = 1st of next month
      const renewalDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

      return reply.send({
        plan,
        minutesUsed,
        minutesIncluded,
        usagePercent: Math.min(100, Math.round((minutesUsed / Math.max(1, minutesIncluded)) * 100)),
        callsThisMonth: Number(usageRow?.callCount) ?? 0,
        appointmentsThisMonth: Number(apptRow?.apptCount) ?? 0,
        renewalDate,
        monthlyPrice: tier.price,
        outboundEnabled: tier.outbound,
        promoTrial: tenant.promoTrial,
        capReached: tenant.promoTrial && minutesUsed >= minutesIncluded,
      });
    }
  );

  // ================================================================
  // GRANT PROMO TRIAL (owner-only) — manually grant a tenant
  // full-tier feature access with a custom minute cap. Used to give
  // friends/testers a hands-on trial without billing them.
  // ================================================================
  app.post(
    '/admin/tenants/:id/grant-promo-trial',
    { onRequest: [app.requireRole('owner')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { plan?: string; minutes?: number };

      if (!body.plan || !PLAN_TIERS[body.plan]) {
        throw new ValidationError(
          `plan must be one of: ${Object.keys(PLAN_TIERS).join(', ')}`
        );
      }
      if (
        typeof body.minutes !== 'number' ||
        !Number.isInteger(body.minutes) ||
        body.minutes < 1 ||
        body.minutes > 10_000
      ) {
        throw new ValidationError('minutes must be an integer between 1 and 10000');
      }

      // Verify the target tenant exists.
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
        actorId: request.authUser.id,
        action: 'tenant.promo_trial_granted',
        entityType: 'tenant',
        entityId: id,
        metadata: {
          plan: body.plan,
          minutes: body.minutes,
          targetName: target.name,
          grantedBy: request.authUser.email,
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

  // ================================================================
  // REVOKE PROMO TRIAL — clears the override + flag. Tenant reverts
  // to whatever their plan default is.
  // ================================================================
  app.post(
    '/admin/tenants/:id/revoke-promo-trial',
    { onRequest: [app.requireRole('owner')] },
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
        actorId: request.authUser.id,
        action: 'tenant.promo_trial_revoked',
        entityType: 'tenant',
        entityId: id,
        metadata: { revokedBy: request.authUser.email },
      });

      return reply.send({ ok: true, tenantId: id });
    }
  );

  // ================================================================
  // CALLS
  // ================================================================
  app.get(
    '/calls',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const query = request.query as Record<string, string>;
      const limit = Math.min(parseInt(query['limit'] ?? '25', 10), 100);
      const offset = parseInt(query['offset'] ?? '0', 10);

      const rows = await db
        .select()
        .from(calls)
        .where(eq(calls.tenantId, tenantId))
        .orderBy(desc(calls.startedAt))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(calls)
        .where(eq(calls.tenantId, tenantId));

      return reply.send({ data: rows, total, limit, offset });
    }
  );

  app.get(
    '/calls/missed',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const rows = await db
        .select()
        .from(calls)
        .where(and(eq(calls.tenantId, tenantId), eq(calls.status, 'missed')))
        .orderBy(desc(calls.startedAt))
        .limit(50);
      return reply.send({ data: rows });
    }
  );

  app.get(
    '/calls/:id',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };

      const [call] = await db
        .select()
        .from(calls)
        .where(and(eq(calls.id, id), eq(calls.tenantId, tenantId)))
        .limit(1);

      if (!call) throw new NotFoundError('Call not found');
      return reply.send(call);
    }
  );

  app.post(
    '/calls/:id/escalate',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };

      const [call] = await db
        .select({ id: calls.id, contactId: calls.contactId })
        .from(calls)
        .where(and(eq(calls.id, id), eq(calls.tenantId, tenantId)))
        .limit(1);

      if (!call) throw new NotFoundError('Call not found');

      const [escalation] = await db
        .insert(escalations)
        .values({
          tenantId,
          callId: call.id,
          contactId: call.contactId ?? undefined,
          reason: reason ?? 'caller_requested',
          priority: 'normal',
          status: 'open',
        })
        .returning();

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'call.manually_escalated',
        entityType: 'call',
        entityId: call.id,
        metadata: { reason },
      });

      void emitWebhook(tenantId, 'escalation.created', {
        escalationId: escalation.id,
        callId: call.id,
        contactId: call.contactId,
        reason: escalation.reason,
        priority: escalation.priority,
      });
      pushActivity(tenantId, 'escalation_created', {
        escalationId: escalation.id,
        reason: escalation.reason,
      });

      return reply.status(201).send(escalation);
    }
  );

  // Manual take-over — bridge the live AI call to the configured staff
  // phone number. Triggered from the dashboard live-call monitor.
  app.post(
    '/calls/:id/takeover',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };

      const [call] = await db
        .select({ id: calls.id, rcCallId: calls.rcCallId, status: calls.status })
        .from(calls)
        .where(and(eq(calls.id, id), eq(calls.tenantId, tenantId)))
        .limit(1);

      if (!call) throw new NotFoundError('Call not found');

      // The call must still be live. Once the Grok WS closes, the row's
      // status flips to 'completed' or 'missed' and the Telnyx call leg
      // is gone — nothing to bridge.
      // Live statuses set by the telephony layer: 'active' on initial insert,
      // 'connected' after pickup. Anything else (completed/missed/failed) means
      // the call leg is gone.
      if (call.status !== 'active' && call.status !== 'connected') {
        return reply.status(409).send({
          error: 'call_not_live',
          message: 'This call has already ended.',
        });
      }

      // CLAUDE.md confirms Telnyx is the production telephony path.
      // The legacy RingCentral handoff lives behind initiateManualTakeover's
      // `provider: 'ringcentral'` branch; we default to telnyx here.
      const { initiateManualTakeover } = await import('../telephony/transfer.js');
      const result = await initiateManualTakeover({
        tenantId,
        callId: call.id,
        rcCallId: call.rcCallId,
        provider: 'telnyx',
        actorId,
      });

      if (!result.success) {
        const status = result.error === 'no_transfer_number_configured' ? 400 : 502;
        return reply.status(status).send({
          error: result.error,
          message:
            result.error === 'no_transfer_number_configured'
              ? 'Set a Staff Transfer Number in Voice Agent settings before taking over a call.'
              : 'Could not transfer the call. Please try again.',
        });
      }

      return reply.send({ ok: true, toNumber: result.toNumber });
    }
  );

  // Test call — the tenant's own AI calls the owner's cell so they can
  // practice before going live. Triggered by the dashboard "Call my AI"
  // button on the onboarding completion page and in voice-agent settings.
  app.post(
    '/calls/test-call',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;

      // 1. Read where the call should ring (owner's cell — same field used
      //    by the AI-initiated handoff and the live-call take-over).
      const [settings] = await db
        .select({ transferNumber: tenantSettings.transferNumber })
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, tenantId))
        .limit(1);

      const transferNumber = settings?.transferNumber;
      if (!transferNumber) {
        return reply.status(400).send({
          error: 'no_transfer_number_configured',
          message: 'Set a Staff Transfer Number in Voice Agent settings before placing a test call.',
        });
      }

      // 2. Find the tenant's primary phone number to dial *from*. Without
      //    a provisioned number we can't place outbound calls.
      const { tenantPhoneNumbers } = await import('../../db/schema.js');
      const { isNull } = await import('drizzle-orm');
      const [primaryNumber] = await db
        .select({ phoneE164: tenantPhoneNumbers.phoneE164 })
        .from(tenantPhoneNumbers)
        .where(
          and(
            eq(tenantPhoneNumbers.tenantId, tenantId),
            eq(tenantPhoneNumbers.isPrimary, true),
            isNull(tenantPhoneNumbers.releasedAt)
          )
        )
        .limit(1);

      if (!primaryNumber) {
        return reply.status(400).send({
          error: 'no_primary_number',
          message: 'Provision a phone number in Settings → Phone Numbers before placing a test call.',
        });
      }

      // 3. Create the call record. direction='test' so this never counts
      //    toward billed-minute usage or appears in customer call stats.
      const [callRecord] = await db
        .insert(calls)
        .values({
          tenantId,
          rcCallId: `pending-test-${Date.now()}`,
          direction: 'test',
          fromNumber: transferNumber, // the owner is the "caller" from the AI's POV
          toNumber: primaryNumber.phoneE164,
          status: 'active',
          startedAt: new Date(),
        })
        .returning({ id: calls.id });

      const callId = callRecord!.id;

      // 4. Place the call via Telnyx.
      const { dialDirect } = await import('../campaigns/telnyx-dialer.service.js');
      let callSid: string;
      try {
        const result = await dialDirect({
          to: transferNumber,
          from: primaryNumber.phoneE164,
          callId,
          tenantId,
          fromNumber: transferNumber,
          mode: 'self_test',
        });
        callSid = result.callSid;
      } catch (err) {
        request.log.error({ err, callId }, 'Test-call Telnyx dial failed');
        await db
          .update(calls)
          .set({ status: 'failed', outcome: 'dial_error', updatedAt: new Date() })
          .where(eq(calls.id, callId));
        return reply.status(502).send({
          error: 'dial_failed',
          message: "Couldn't place the test call. Please try again.",
        });
      }

      await db
        .update(calls)
        .set({ rcCallId: callSid, updatedAt: new Date() })
        .where(eq(calls.id, callId));

      auditLog({
        tenantId,
        actorType: 'admin_user',
        actorId,
        action: 'call.test_call_placed',
        entityType: 'call',
        entityId: callId,
        metadata: { toNumber: transferNumber, fromNumber: primaryNumber.phoneE164, callSid },
      });

      return reply.send({ ok: true, callId, toNumber: transferNumber });
    }
  );

  // ================================================================
  // APPOINTMENTS
  // ================================================================
  app.get(
    '/appointments',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const query = request.query as Record<string, string>;
      const limit = Math.min(parseInt(query['limit'] ?? '50', 10), 200);
      const offset = parseInt(query['offset'] ?? '0', 10);
      const status = query['status'];

      const conditions = [eq(appointments.tenantId, tenantId)];
      if (status) conditions.push(eq(appointments.status, status));

      const rows = await db
        .select()
        .from(appointments)
        .where(and(...conditions))
        .orderBy(asc(appointments.startsAt))
        .limit(limit)
        .offset(offset);

      return reply.send({ data: rows });
    }
  );

  app.get(
    '/appointments/:id',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };

      const [appt] = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
        .limit(1);

      if (!appt) throw new NotFoundError('Appointment not found');
      return reply.send(appt);
    }
  );

  app.patch(
    '/appointments/:id',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const body = request.body as { status?: string; notes?: string };

      const [updated] = await db
        .update(appointments)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
        .returning();

      if (!updated) throw new NotFoundError('Appointment not found');
      return reply.send(updated);
    }
  );

  // ================================================================
  // CONTACTS (admin view — full CRUD)
  // ================================================================
  app.get(
    '/contacts',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const query = request.query as Record<string, string>;
      const q = query['q'] ?? '';
      const limit = Math.min(parseInt(query['limit'] ?? '25', 10), 100);
      const offset = parseInt(query['offset'] ?? '0', 10);

      const conditions = [eq(contacts.tenantId, tenantId)];
      if (q) {
        conditions.push(
          or(
            ilike(contacts.firstName, `%${q}%`),
            ilike(contacts.lastName, `%${q}%`),
            ilike(contacts.phoneE164, `%${q}%`),
            ilike(contacts.email ?? '', `%${q}%`)
          )!
        );
      }

      const rows = await db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(asc(contacts.lastName), asc(contacts.firstName))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(contacts)
        .where(and(...conditions));

      return reply.send({ data: rows, total, limit, offset });
    }
  );

  app.get(
    '/contacts/:id',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };

      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
        .limit(1);

      if (!contact) throw new NotFoundError('Contact not found');
      return reply.send(contact);
    }
  );

  app.patch(
    '/contacts/:id',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      // Disallow tenant crossing
      delete body['tenantId'];

      const [updated] = await db
        .update(contacts)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
        .returning();

      if (!updated) throw new NotFoundError('Contact not found');
      return reply.send(updated);
    }
  );

  // Bulk delete contacts (admin+). Body: { ids: string[] }
  app.post(
    '/contacts/bulk-delete',
    { onRequest: [app.requireRole("admin")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { ids } = request.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new ValidationError('ids must be a non-empty array');
      }
      // Cap the batch size to prevent accidental deletion of the entire tenant.
      if (ids.length > 500) {
        throw new ValidationError('Bulk delete limited to 500 ids per call');
      }
      const result = await db
        .delete(contacts)
        .where(and(eq(contacts.tenantId, tenantId), inArray(contacts.id, ids)))
        .returning({ id: contacts.id });

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'contacts.bulk_deleted',
        entityType: 'contact',
        metadata: { count: result.length, requested: ids.length },
      });

      return reply.send({ deleted: result.length });
    }
  );

  // ================================================================
  // ESCALATIONS
  // ================================================================
  app.get(
    '/escalations',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const rows = await db
        .select()
        .from(escalations)
        .where(eq(escalations.tenantId, tenantId))
        .orderBy(
          sql`CASE priority WHEN 'urgent' THEN 0 ELSE 1 END`,
          desc(escalations.createdAt)
        )
        .limit(100);
      return reply.send({ data: rows });
    }
  );

  app.patch(
    '/escalations/:id',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };
      const { status, resolutionNote, assignedTo } = request.body as {
        status?: string;
        resolutionNote?: string;
        assignedTo?: string;
      };

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (status) patch['status'] = status;
      if (resolutionNote) patch['resolutionNote'] = resolutionNote;
      if (assignedTo) patch['assignedTo'] = assignedTo;
      if (status === 'resolved') patch['resolvedAt'] = new Date();

      const [updated] = await db
        .update(escalations)
        .set(patch)
        .where(and(eq(escalations.id, id), eq(escalations.tenantId, tenantId)))
        .returning();

      if (!updated) throw new NotFoundError('Escalation not found');

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'escalation.updated',
        entityType: 'escalation',
        entityId: id,
        metadata: { status, resolutionNote },
      });

      // Only emit on the resolution transition — partial updates don't fire.
      if (status === 'resolved') {
        void emitWebhook(tenantId, 'escalation.resolved', {
          escalationId: id,
          resolutionNote: resolutionNote ?? null,
          resolvedBy: actorId,
        });
        pushActivity(tenantId, 'escalation_resolved', { escalationId: id });
      }

      return reply.send(updated);
    }
  );

  // ================================================================
  // SETTINGS
  // ================================================================
  app.get(
    '/settings',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const [settings, tenant] = await Promise.all([
        getSettings(tenantId),
        getTenantInfo(tenantId),
      ]);
      return reply.send({ settings, tenant });
    }
  );

  app.patch(
    '/settings',
    { onRequest: [app.requireRole("admin")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const body = request.body as Parameters<typeof updateSettings>[1];
      // businessContext is free-text injected into the AI system prompt on
      // every call. Cap length to keep prompts within reasonable bounds and
      // prevent runaway costs / context bloat.
      if (typeof body.businessContext === 'string' && body.businessContext.length > 4000) {
        throw new ValidationError('businessContext must be 4000 characters or fewer');
      }
      const updated = await updateSettings(tenantId, body);
      return reply.send(updated);
    }
  );

  app.get(
    '/settings/office-hours',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const settings = await getSettings(tenantId);
      return reply.send(settings.officeHours);
    }
  );

  app.put(
    '/settings/office-hours',
    { onRequest: [app.requireRole("admin")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const body = request.body as Parameters<typeof updateOfficeHours>[1];
      const updated = await updateOfficeHours(tenantId, body);
      return reply.send(updated);
    }
  );

  // ================================================================
  // INTEGRATIONS
  // ================================================================
  app.get(
    '/integrations',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const rows = await db
        .select({
          id: integrations.id,
          provider: integrations.provider,
          status: integrations.status,
          metadata: integrations.metadata,
          lastSyncedAt: integrations.lastSyncedAt,
          errorMessage: integrations.errorMessage,
          createdAt: integrations.createdAt,
        })
        .from(integrations)
        .where(eq(integrations.tenantId, tenantId));
      return reply.send({ data: rows });
    }
  );

  app.delete(
    '/integrations/:provider',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { provider } = request.params as { provider: string };
      await db
        .delete(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, provider)));
      return reply.status(204).send();
    }
  );

  // ================================================================
  // SEARCH — unified cross-resource lookup for the dashboard's
  // cmd-K palette. Staff+. Returns up to 5 hits per resource type.
  // ================================================================
  app.get(
    '/search',
    { onRequest: [app.requireRole('staff')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const q = ((request.query as { q?: string }).q ?? '').trim();
      if (q.length < 2) {
        return reply.send({ contacts: [], calls: [], appointments: [], escalations: [] });
      }
      const pattern = `%${q}%`;
      const PER_TYPE = 5;

      const [contactHits, callHits, apptHits, escHits] = await Promise.all([
        db.select({
            id: contacts.id,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            phoneE164: contacts.phoneE164,
            email: contacts.email,
          })
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              or(
                ilike(contacts.firstName, pattern),
                ilike(contacts.lastName, pattern),
                ilike(contacts.phoneE164, pattern),
                ilike(contacts.email ?? '', pattern)
              )!
            )
          )
          .limit(PER_TYPE),
        db.select({
            id: calls.id,
            fromNumber: calls.fromNumber,
            summary: calls.summary,
            startedAt: calls.startedAt,
            status: calls.status,
          })
          .from(calls)
          .where(
            and(
              eq(calls.tenantId, tenantId),
              or(
                ilike(calls.fromNumber, pattern),
                ilike(calls.summary ?? '', pattern)
              )!
            )
          )
          .orderBy(desc(calls.startedAt))
          .limit(PER_TYPE),
        db.select({
            id: appointments.id,
            appointmentType: appointments.appointmentType,
            providerName: appointments.providerName,
            startsAt: appointments.startsAt,
            status: appointments.status,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.tenantId, tenantId),
              or(
                ilike(appointments.appointmentType, pattern),
                ilike(appointments.providerName ?? '', pattern)
              )!
            )
          )
          .orderBy(desc(appointments.startsAt))
          .limit(PER_TYPE),
        db.select({
            id: escalations.id,
            reason: escalations.reason,
            priority: escalations.priority,
            status: escalations.status,
            createdAt: escalations.createdAt,
          })
          .from(escalations)
          .where(
            and(
              eq(escalations.tenantId, tenantId),
              ilike(escalations.reason, pattern)
            )
          )
          .orderBy(desc(escalations.createdAt))
          .limit(PER_TYPE),
      ]);

      return reply.send({
        contacts: contactHits,
        calls: callHits,
        appointments: apptHits,
        escalations: escHits,
      });
    }
  );

  // ================================================================
  // TENANT (current tenant info & vertical/industry update)
  // ================================================================
  app.get(
    '/tenant',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const tenant = await getTenantInfo(tenantId);
      return reply.send(tenant);
    }
  );

  app.patch(
    '/tenant',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const body = request.body as { vertical?: string; name?: string; timezone?: string };

      let updated;
      if (body.vertical) {
        updated = await updateVertical(tenantId, body.vertical);
        auditLog({
          tenantId,
          actorType: 'admin',
          actorId,
          action: 'tenant.vertical_changed',
          entityType: 'tenant',
          entityId: tenantId,
          metadata: { vertical: body.vertical },
        });
      } else {
        updated = await getTenantInfo(tenantId);
      }
      return reply.send(updated);
    }
  );

  // ================================================================
  // ONBOARDING
  // ================================================================
  app.get(
    '/onboarding/status',
    { onRequest: [app.requireRole("staff")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const status = await getOnboardingStatus(tenantId);
      return reply.send(status);
    }
  );

  app.post(
    '/onboarding/step/:step/complete',
    { onRequest: [app.requireRole("admin")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const { step } = request.params as { step: string };
      const stepNum = parseInt(step, 10);
      if (isNaN(stepNum) || stepNum < 1 || stepNum > 5) {
        throw new ValidationError('Invalid step number (1-5)');
      }
      await advanceOnboardingStep(tenantId, stepNum);
      return reply.send({ step: stepNum, completed: true });
    }
  );

  app.post(
    '/onboarding/activate',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;

      // Activate tenant
      await activateTenant(tenantId);

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'tenant.activated',
        entityType: 'tenant',
        entityId: tenantId,
        metadata: {},
      });

      return reply.send({ activated: true });
    }
  );

  // Provision Telnyx number during onboarding step 1
  app.post(
    '/onboarding/provision-number',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { areaCode } = request.body as { areaCode?: string };

      const adapter = createTelephonyAdapter('telnyx', tenantId);
      const provisioned = await adapter.provisionNumber(tenantId, areaCode);

      // Save to tenant_settings
      await updateSettings(tenantId, {
        telephonyProvider: 'telnyx',
        provisionedNumber: provisioned.phoneNumber,
        provisionedNumberSid: provisioned.sid,
      });

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'telephony.number_provisioned',
        entityType: 'tenant',
        entityId: tenantId,
        metadata: { phoneNumber: provisioned.phoneNumber, provider: 'telnyx' },
      });

      return reply.status(201).send(provisioned);
    }
  );

  // ================================================================
  // AUDIT LOG
  // ================================================================
  app.get(
    '/audit',
    { onRequest: [app.requireRole("owner")] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const query = request.query as Record<string, string>;
      const limit = Math.min(parseInt(query['limit'] ?? '50', 10), 200);
      const offset = parseInt(query['offset'] ?? '0', 10);

      const rows = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.tenantId, tenantId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({ data: rows, limit, offset });
    }
  );
}
