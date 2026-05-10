// ============================================================
// Team management router
//
// Endpoints under /team for invite, list, role-change, and remove
// of admin_users on the current tenant. Plus the public
// POST /auth/accept-invite that redeems an invitation token.
//
// Role rules:
//   - Inviting + role-change + remove: owner only
//   - Listing members + invitations: admin or owner
//   - Accepting an invite: public (the token is the auth)
// ============================================================
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../../db/client.js';
import { adminUsers, userInvitations, tenants } from '../../db/schema.js';
import { and, eq, isNull, count } from 'drizzle-orm';
import { ValidationError, NotFoundError, ConflictError, AuthError } from '../../lib/errors.js';
import { auditLog } from '../../audit/audit-logger.js';
import type { JwtPayload, Role } from './auth.middleware.js';
import { ROLE_HIERARCHY } from './auth.middleware.js';
import { config } from '../../config.js';

const SALT_ROUNDS = 12;
const INVITE_TTL_DAYS = 7;
const VALID_ROLES = ['owner', 'admin', 'staff'] as const satisfies readonly Role[];

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value);
}

export async function teamPlugin(app: FastifyInstance): Promise<void> {
  // ── Public — accept invite (the token is the auth) ──────────
  app.post('/auth/accept-invite', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { token, password, firstName, lastName } = request.body as {
      token: string;
      password: string;
      firstName?: string;
      lastName?: string;
    };
    if (!token || !password) throw new ValidationError('token and password are required');
    if (password.length < 8) throw new ValidationError('Password must be at least 8 characters');

    const [invite] = await db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.token, token))
      .limit(1);

    if (!invite) throw new AuthError('Invitation not found or already used');
    if (invite.acceptedAt) throw new AuthError('Invitation already accepted');
    if (invite.expiresAt < new Date()) throw new AuthError('Invitation expired — ask for a new one');

    // Don't double-create if a user already has this email on this tenant.
    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(and(eq(adminUsers.email, invite.email), eq(adminUsers.tenantId, invite.tenantId)))
      .limit(1);

    if (existing) {
      // Mark invite consumed; the user can just log in.
      await db.update(userInvitations).set({ acceptedAt: new Date() }).where(eq(userInvitations.id, invite.id));
      throw new ConflictError('A user with that email already exists on this tenant. Try logging in instead.');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [user] = await db
      .insert(adminUsers)
      .values({
        tenantId: invite.tenantId,
        email: invite.email,
        passwordHash,
        role: invite.role,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
      })
      .returning();

    await db.update(userInvitations).set({ acceptedAt: new Date() }).where(eq(userInvitations.id, invite.id));

    auditLog({
      tenantId: invite.tenantId,
      actorType: 'admin',
      actorId: user.id,
      action: 'team.invite_accepted',
      entityType: 'admin_user',
      entityId: user.id,
      metadata: { invitedBy: invite.invitedBy, role: invite.role },
    });

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };
    const accessToken = app.jwt.sign(payload);
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

    return reply.status(201).send({
      token: accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  });

  // ── Public — fetch invitation metadata for the accept page ──
  // No PII exposed beyond email + role + tenant name. Token in URL is the auth.
  app.get('/auth/invite/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const [row] = await db
      .select({
        email: userInvitations.email,
        role: userInvitations.role,
        expiresAt: userInvitations.expiresAt,
        acceptedAt: userInvitations.acceptedAt,
        tenantName: tenants.name,
      })
      .from(userInvitations)
      .innerJoin(tenants, eq(tenants.id, userInvitations.tenantId))
      .where(eq(userInvitations.token, token))
      .limit(1);

    if (!row) throw new NotFoundError('Invitation');
    if (row.acceptedAt) throw new ConflictError('Invitation already accepted');
    if (row.expiresAt < new Date()) throw new ConflictError('Invitation expired');

    return reply.send({
      email: row.email,
      role: row.role,
      tenantName: row.tenantName,
      expiresAt: row.expiresAt,
    });
  });

  // ── Members list (admin+) ───────────────────────────────────
  app.get(
    '/team/members',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const rows = await db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          role: adminUsers.role,
          lastLoginAt: adminUsers.lastLoginAt,
          createdAt: adminUsers.createdAt,
        })
        .from(adminUsers)
        .where(eq(adminUsers.tenantId, tenantId))
        .orderBy(adminUsers.createdAt);
      return reply.send({ data: rows });
    }
  );

  // ── Pending invitations list (admin+) ───────────────────────
  app.get(
    '/team/invitations',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const rows = await db
        .select()
        .from(userInvitations)
        .where(and(eq(userInvitations.tenantId, tenantId), isNull(userInvitations.acceptedAt)))
        .orderBy(userInvitations.createdAt);
      return reply.send({ data: rows });
    }
  );

  // ── Invite (owner only) ─────────────────────────────────────
  app.post(
    '/team/invitations',
    { onRequest: [app.requireRole('owner')] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { email, role } = request.body as { email: string; role: string };

      if (!email) throw new ValidationError('email is required');
      const normalizedEmail = email.toLowerCase().trim();
      if (!isValidRole(role)) throw new ValidationError(`Invalid role "${role}"`);

      // Block re-inviting an already-active member.
      const [existingUser] = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(and(eq(adminUsers.tenantId, tenantId), eq(adminUsers.email, normalizedEmail)))
        .limit(1);
      if (existingUser) {
        throw new ConflictError('A user with that email already exists on this tenant');
      }

      // Block duplicate pending invites — owner can revoke first.
      const [pending] = await db
        .select({ id: userInvitations.id })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.tenantId, tenantId),
            eq(userInvitations.email, normalizedEmail),
            isNull(userInvitations.acceptedAt)
          )
        )
        .limit(1);
      if (pending) {
        throw new ConflictError('A pending invitation for that email already exists. Revoke it first.');
      }

      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
      const [created] = await db
        .insert(userInvitations)
        .values({ tenantId, email: normalizedEmail, role: role, token, expiresAt, invitedBy: actorId })
        .returning();

      const inviteUrl = `${config.DASHBOARD_URL}/accept-invite/${token}`;
      // Dev: surface the URL in logs. Prod: send via SendGrid (left as TODO until template exists).
      app.log.info({ inviteUrl, email: normalizedEmail, role }, 'Team invitation created');

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'team.member_invited',
        entityType: 'invitation',
        entityId: created.id,
        metadata: { email: normalizedEmail, role },
      });

      return reply.status(201).send({
        id: created.id,
        email: created.email,
        role: created.role,
        expiresAt: created.expiresAt,
        inviteUrl,
        message: 'Invitation sent. Share this link if email delivery is delayed.',
      });
    }
  );

  // ── Revoke pending invite (owner only) ──────────────────────
  app.delete(
    '/team/invitations/:id',
    { onRequest: [app.requireRole('owner')] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };

      const result = await db
        .delete(userInvitations)
        .where(and(eq(userInvitations.id, id), eq(userInvitations.tenantId, tenantId)))
        .returning({ id: userInvitations.id });

      if (result.length === 0) throw new NotFoundError('Invitation', id);

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'team.invite_revoked',
        entityType: 'invitation',
        entityId: id,
      });

      return reply.status(204).send();
    }
  );

  // ── Change member role (owner only) ─────────────────────────
  app.patch(
    '/team/members/:id',
    { onRequest: [app.requireRole('owner')] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };
      const { role } = request.body as { role: string };

      if (!isValidRole(role)) throw new ValidationError(`Invalid role "${role}"`);

      // Don't let an owner demote themselves if they're the last owner standing.
      if (id === actorId && role !== 'owner') {
        const [{ owners }] = await db
          .select({ owners: count() })
          .from(adminUsers)
          .where(and(eq(adminUsers.tenantId, tenantId), eq(adminUsers.role, 'owner')));
        if (Number(owners) <= 1) {
          throw new ValidationError('Cannot demote the last owner. Promote another user first.');
        }
      }

      const [updated] = await db
        .update(adminUsers)
        .set({ role })
        .where(and(eq(adminUsers.id, id), eq(adminUsers.tenantId, tenantId)))
        .returning();

      if (!updated) throw new NotFoundError('Member', id);

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'team.role_changed',
        entityType: 'admin_user',
        entityId: id,
        metadata: { newRole: role },
      });

      return reply.send({ id: updated.id, role: updated.role });
    }
  );

  // ── Remove member (owner only) ──────────────────────────────
  app.delete(
    '/team/members/:id',
    { onRequest: [app.requireRole('owner')] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };

      if (id === actorId) {
        throw new ValidationError('You cannot remove yourself. Have another owner remove you.');
      }

      const result = await db
        .delete(adminUsers)
        .where(and(eq(adminUsers.id, id), eq(adminUsers.tenantId, tenantId)))
        .returning({ id: adminUsers.id });

      if (result.length === 0) throw new NotFoundError('Member', id);

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'team.member_removed',
        entityType: 'admin_user',
        entityId: id,
      });

      return reply.status(204).send();
    }
  );
}
