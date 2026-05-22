// ============================================================
// Google Sign-In user resolution.
//
// Plugged into googleAuthPlugin via main.ts. The OAuth callback
// hands us the verified Google identity (sub + email + name +
// picture) and we either:
//   1. Find the user by google_id   (returning user, fastest path)
//   2. Find the user by email       (link existing email account
//                                    to this Google identity)
//   3. Create a new tenant + user   (brand new sign-up)
//
// Returns the JWT pair the dashboard expects, plus an isNewUser
// flag so the dashboard can route fresh accounts into onboarding.
// ============================================================
import { db } from '../../db/client.js';
import { adminUsers, tenants, tenantSettings } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { auditLog } from '../../audit/audit-logger.js';
import { DEFAULT_APPT_TYPES_BY_VERTICAL } from './router.js';
import type { JwtPayload } from './auth.middleware.js';
import type { FastifyInstance } from 'fastify';

interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string | undefined;
  picture?: string | undefined;
}

interface ResolvedUser {
  token: string;
  refreshToken: string;
  isNewUser: boolean;
  user: { id: string; email: string; role: string; firstName?: string | undefined; lastName?: string | undefined };
  tenant: { id: string; name: string; slug: string; plan: string };
}

/** Split "First Last" into firstName + lastName halves. Best-effort. */
function splitName(full?: string): { firstName: string | null; lastName: string | null } {
  if (!full) return { firstName: null, lastName: null };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export function makeResolveGoogleUser(app: FastifyInstance) {
  function issueTokens(user: { id: string; tenantId: string; email: string; role: string }) {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };
    const token = app.jwt.sign(payload);
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });
    return { token, refreshToken };
  }

  async function loadTenant(tenantId: string) {
    const [t] = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!t) throw new Error(`Tenant ${tenantId} not found`);
    return t;
  }

  return async function resolveGoogleUser(profile: GoogleProfile): Promise<ResolvedUser> {
    const normalizedEmail = profile.email.toLowerCase().trim();

    // 1. Returning user: matched by google_id
    {
      const [existing] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.googleId, profile.googleId))
        .limit(1);
      if (existing) {
        await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, existing.id));
        const tokens = issueTokens(existing);
        const tenant = await loadTenant(existing.tenantId);
        return {
          ...tokens,
          isNewUser: false,
          user: {
            id: existing.id,
            email: existing.email,
            role: existing.role,
            firstName: existing.firstName ?? undefined,
            lastName: existing.lastName ?? undefined,
          },
          tenant,
        };
      }
    }

    // 2. Existing email account: link Google identity to it
    {
      const [byEmail] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, normalizedEmail))
        .limit(1);
      if (byEmail) {
        const { firstName, lastName } = splitName(profile.name);
        await db
          .update(adminUsers)
          .set({
            googleId: profile.googleId,
            lastLoginAt: new Date(),
            // Backfill name fields if we don't have them yet.
            firstName: byEmail.firstName ?? firstName,
            lastName: byEmail.lastName ?? lastName,
          })
          .where(eq(adminUsers.id, byEmail.id));
        auditLog({
          tenantId: byEmail.tenantId,
          actorType: 'admin_user',
          actorId: byEmail.id,
          action: 'auth.google_linked',
          entityType: 'admin_user',
          entityId: byEmail.id,
          metadata: { email: normalizedEmail },
        });
        const tokens = issueTokens(byEmail);
        const tenant = await loadTenant(byEmail.tenantId);
        return {
          ...tokens,
          isNewUser: false,
          user: {
            id: byEmail.id,
            email: byEmail.email,
            role: byEmail.role,
            firstName: (byEmail.firstName ?? firstName) ?? undefined,
            lastName: (byEmail.lastName ?? lastName) ?? undefined,
          },
          tenant,
        };
      }
    }

    // 3. Brand-new account: create tenant + owner user, kick off onboarding
    const { firstName, lastName } = splitName(profile.name);
    // Best-effort tenant name from the user's name; they'll change it during onboarding.
    const tenantName = profile.name?.trim() || normalizedEmail.split('@')[0] || 'My Business';
    const baseSlug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'business';
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: tenantName,
        slug,
        plan: 'trial',
        vertical: 'generic',
        timezone: 'America/New_York',
        isActive: false,
        onboardingStep: 1,
      })
      .returning();
    if (!tenant) throw new Error('Tenant insert returned no row');

    const [user] = await db
      .insert(adminUsers)
      .values({
        tenantId: tenant.id,
        email: normalizedEmail,
        passwordHash: null,
        googleId: profile.googleId,
        role: 'owner',
        firstName,
        lastName,
        lastLoginAt: new Date(),
      })
      .returning();
    if (!user) throw new Error('User insert returned no row');

    const defaultApptTypes =
      DEFAULT_APPT_TYPES_BY_VERTICAL['generic'] ?? DEFAULT_APPT_TYPES_BY_VERTICAL['dental'];
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
      actorType: 'admin_user',
      actorId: user.id,
      action: 'tenant.registered',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: { signupMethod: 'google' },
    });

    const tokens = issueTokens(user);
    return {
      ...tokens,
      isNewUser: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
      },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
    };
  };
}
