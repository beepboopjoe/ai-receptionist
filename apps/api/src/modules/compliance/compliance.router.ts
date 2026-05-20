// ============================================================
// Compliance router — HIPAA BAA acceptance, mode toggle, data retention.
//
// Routes:
//   GET  /compliance/status          — current BAA + settings (any auth'd user)
//   POST /compliance/baa/accept      — sign the BAA (owner only)
//   PUT  /compliance/settings        — update hipaaMode / retention (owner only)
//   GET  /compliance/events          — compliance audit trail (owner only)
// ============================================================
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../../db/client.js';
import { tenants, adminUsers, complianceEvents } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';

async function complianceRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /compliance/status ─────────────────────────────────────────────────
  // Returns current BAA status, HIPAA mode flag, and data retention setting.
  // Available to any authenticated user so the dashboard can show the badge.
  app.get('/compliance/status', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const { tenantId } = request.authUser;

    const [tenant] = await db
      .select({
        baaAcceptedAt: tenants.baaAcceptedAt,
        baaAcceptedBy: tenants.baaAcceptedBy,
        hipaaMode: tenants.hipaaMode,
        dataRetentionDays: tenants.dataRetentionDays,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw new NotFoundError('Tenant not found');

    // Look up the signer's email for display purposes
    let baaSignerEmail: string | null = null;
    if (tenant.baaAcceptedBy) {
      const [signer] = await db
        .select({ email: adminUsers.email })
        .from(adminUsers)
        .where(eq(adminUsers.id, tenant.baaAcceptedBy))
        .limit(1);
      baaSignerEmail = signer?.email ?? null;
    }

    return {
      baaAccepted: !!tenant.baaAcceptedAt,
      baaAcceptedAt: tenant.baaAcceptedAt?.toISOString() ?? null,
      baaSignerEmail,
      hipaaMode: tenant.hipaaMode,
      dataRetentionDays: tenant.dataRetentionDays,
    };
  });

  // ── POST /compliance/baa/accept ────────────────────────────────────────────
  // Records the account owner's acceptance of the Business Associate Agreement.
  // Automatically enables HIPAA mode. Idempotent in that re-signing is blocked
  // (409) — the original timestamp is the canonical record.
  app.post('/compliance/baa/accept', {
    onRequest: [app.requireRole('owner')],
  }, async (request) => {
    const { tenantId, id: userId, email } = request.authUser;

    // Check whether BAA is already signed
    const [tenant] = await db
      .select({ baaAcceptedAt: tenants.baaAcceptedAt, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw new NotFoundError('Tenant not found');
    if (tenant.baaAcceptedAt) {
      throw new ConflictError(
        `BAA already accepted on ${tenant.baaAcceptedAt.toISOString()}. Contact support if you need to update it.`
      );
    }

    const now = new Date();

    // Write BAA acceptance and enable HIPAA mode atomically
    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set({
          baaAcceptedAt: now,
          baaAcceptedBy: userId,
          hipaaMode: true,
        })
        .where(eq(tenants.id, tenantId));

      await tx.insert(complianceEvents).values({
        tenantId,
        eventType: 'baa_accepted',
        actorId: userId,
        actorEmail: email,
        metadata: {
          ip: request.ip,
          userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
          tenantName: tenant.name,
        },
      });
    });

    return { ok: true, acceptedAt: now.toISOString() };
  });

  // ── PUT /compliance/settings ───────────────────────────────────────────────
  // Update HIPAA mode and/or data retention window. Owner only.
  app.put('/compliance/settings', {
    onRequest: [app.requireRole('owner')],
  }, async (request) => {
    const { hipaaMode, dataRetentionDays } = (request.body ?? {}) as {
      hipaaMode?: boolean;
      dataRetentionDays?: number;
    };
    const { tenantId, id: userId, email } = request.authUser;

    if (dataRetentionDays !== undefined) {
      if (
        typeof dataRetentionDays !== 'number' ||
        dataRetentionDays < 365 ||
        dataRetentionDays > 3650
      ) {
        throw new ValidationError('dataRetentionDays must be between 365 and 3650');
      }
    }

    if (hipaaMode === undefined && dataRetentionDays === undefined) {
      throw new ValidationError('No settings provided to update');
    }

    const [tenant] = await db
      .select({ hipaaMode: tenants.hipaaMode, dataRetentionDays: tenants.dataRetentionDays })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw new NotFoundError('Tenant not found');

    // Build a typed patch object that Drizzle's .set() can accept
    const patch: { hipaaMode?: boolean; dataRetentionDays?: number } = {};
    if (hipaaMode !== undefined) patch.hipaaMode = hipaaMode;
    if (dataRetentionDays !== undefined) patch.dataRetentionDays = dataRetentionDays;

    const updatesMeta: Record<string, unknown> = { ...patch };

    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set(patch)
        .where(eq(tenants.id, tenantId));

      // Determine the most specific event type for the log
      let eventType = 'settings_changed';
      if (hipaaMode === true && !tenant.hipaaMode) eventType = 'hipaa_mode_enabled';
      if (hipaaMode === false && tenant.hipaaMode) eventType = 'hipaa_mode_disabled';
      if (dataRetentionDays !== undefined && hipaaMode === undefined) eventType = 'retention_changed';

      await tx.insert(complianceEvents).values({
        tenantId,
        eventType,
        actorId: userId,
        actorEmail: email,
        metadata: {
          before: {
            hipaaMode: tenant.hipaaMode,
            dataRetentionDays: tenant.dataRetentionDays,
          },
          after: updatesMeta,
        },
      });
    });

    return { ok: true };
  });

  // ── GET /compliance/events ─────────────────────────────────────────────────
  // Returns the last 50 compliance events for audit export. Owner only.
  app.get('/compliance/events', {
    onRequest: [app.requireRole('owner')],
  }, async (request) => {
    const { tenantId } = request.authUser;

    const events = await db
      .select()
      .from(complianceEvents)
      .where(eq(complianceEvents.tenantId, tenantId))
      .orderBy(desc(complianceEvents.createdAt))
      .limit(50);

    return { data: events };
  });
}

export const compliancePlugin = fp(complianceRoutes, {
  name: 'compliance-plugin',
  dependencies: ['auth-middleware'],
});
