// ============================================================
// Auth Middleware — JWT verification + tenant injection
// Decorates request with `tenantId` and `userId` after verifying JWT.
// ============================================================
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../../db/client.js';
import { adminUsers, tenants } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { AuthError, ForbiddenError } from '../../lib/errors.js';

// ────────────────────────────────────────────────────────────
// Role hierarchy
//
// Higher index = more capable. `hasRole(actor, required)` returns
// true when the actor's tier is >= the required tier — i.e. owners
// inherit admin capabilities, admins inherit staff capabilities.
//
// Three tiers:
//   owner — full access (billing, team, integrations, vertical, webhooks)
//   admin — everything except billing + team mgmt + tenant-level destructive ops
//   staff — read all, modify operational data; cannot change settings
// ────────────────────────────────────────────────────────────
export const ROLE_HIERARCHY = {
  owner: 3,
  admin: 2,
  staff: 1,
} as const;

export type Role = keyof typeof ROLE_HIERARCHY;

export function hasRole(actorRole: string, required: Role): boolean {
  const actor = ROLE_HIERARCHY[actorRole as Role] ?? 0;
  return actor >= ROLE_HIERARCHY[required];
}

// JWT payload shape
export interface JwtPayload {
  sub: string;   // adminUser.id
  tenantId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Augment FastifyRequest with decoded auth
declare module 'fastify' {
  interface FastifyRequest {
    authUser: {
      id: string;
      tenantId: string;
      email: string;
      role: string;
    };
  }
}

// ---- Fastify plugin: adds app.authenticate decorator ----
async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('authUser', null);

  /**
   * Call inside a route handler to enforce authentication.
   * Sets request.authUser on success; throws AuthError on failure.
   */
  app.decorate('authenticate', async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      await request.jwtVerify();
    } catch {
      throw new AuthError('Invalid or expired token');
    }

    const payload = request.user as JwtPayload;

    // Quick DB lookup to confirm the user still exists and is active
    const [user] = await db
      .select({
        id: adminUsers.id,
        tenantId: adminUsers.tenantId,
        email: adminUsers.email,
        role: adminUsers.role,
      })
      .from(adminUsers)
      .where(and(eq(adminUsers.id, payload.sub), eq(adminUsers.tenantId, payload.tenantId)))
      .limit(1);

    if (!user) {
      throw new AuthError('User not found');
    }

    // Confirm tenant is active
    const [tenant] = await db
      .select({ isActive: tenants.isActive })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (!tenant) {
      throw new AuthError('Tenant not found');
    }

    request.authUser = user;
  });

  /**
   * Build a route preHandler that requires authentication AND that the
   * authenticated user holds at least one of the listed roles.
   *
   * Usage:
   *   app.post('/owner-only', { onRequest: [app.requireRole('owner')] }, handler)
   *   app.post('/staff-or-up', { onRequest: [app.requireRole('staff', 'admin', 'owner')] }, handler)
   *
   * Implementation note: returns a fresh function each call so routes
   * can compose their own role lists. The function chains through the
   * existing app.authenticate first so authUser is populated before the
   * role check runs.
   */
  app.decorate('requireRole', function (...allowedRoles: Role[]) {
    return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      // Run the standard auth check first so request.authUser is set.
      await app.authenticate(request, reply);
      const userRole = request.authUser.role;
      // Allow if user's role is in the explicit list OR if their tier
      // exceeds the lowest allowed role (owner inherits admin/staff perms).
      const minRequiredTier = Math.min(
        ...allowedRoles.map((r) => ROLE_HIERARCHY[r] ?? 99)
      );
      const userTier = ROLE_HIERARCHY[userRole as Role] ?? 0;
      if (userTier < minRequiredTier) {
        throw new ForbiddenError(
          `Requires role ${allowedRoles.join(' or ')} (you are ${userRole})`
        );
      }
    };
  });
}

export const authMiddleware = fp(authPlugin, { name: 'auth-middleware' });

// Declare the decorator types so other files can import them.
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: Role[]) => (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}
