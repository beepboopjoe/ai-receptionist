// ============================================================
// API key management — admin (JWT-authenticated) CRUD for the
// keys customers use to call /api/v1/public/*. Mounted under
// /api/v1/api-keys. Owner-only.
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { tenantApiKeys } from '../../db/schema.js';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import { auditLog } from '../../audit/audit-logger.js';
import { generateApiKey } from './api-key.service.js';

const VALID_SCOPES = ['read', 'write'] as const;

export async function apiKeyAdminPlugin(app: FastifyInstance): Promise<void> {
  // List keys (owner only — keys grant tenant-wide access)
  app.get(
    '/api-keys',
    { onRequest: [app.requireRole('owner')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const rows = await db
        .select({
          id: tenantApiKeys.id,
          prefix: tenantApiKeys.prefix,
          name: tenantApiKeys.name,
          scope: tenantApiKeys.scope,
          lastUsedAt: tenantApiKeys.lastUsedAt,
          expiresAt: tenantApiKeys.expiresAt,
          revokedAt: tenantApiKeys.revokedAt,
          createdAt: tenantApiKeys.createdAt,
        })
        .from(tenantApiKeys)
        .where(and(eq(tenantApiKeys.tenantId, tenantId), isNull(tenantApiKeys.revokedAt)))
        .orderBy(desc(tenantApiKeys.createdAt));
      return reply.send({ data: rows });
    }
  );

  // Mint a new key — raw secret is in the response, never shown again.
  app.post(
    '/api-keys',
    { onRequest: [app.requireRole('owner')] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { name, scope, expiresInDays } = request.body as {
        name: string;
        scope?: string;
        expiresInDays?: number;
      };

      if (!name || name.trim().length === 0) {
        throw new ValidationError('name is required');
      }
      const resolvedScope: 'read' | 'write' =
        scope === 'write' ? 'write' : (VALID_SCOPES as readonly string[]).includes(scope ?? '') ? (scope as 'read' | 'write') : 'read';

      // Optional expiry — defaults to "never" so integrations don't break
      // unexpectedly. Customers who want rotation set this explicitly.
      let expiresAt: Date | null = null;
      if (typeof expiresInDays === 'number' && expiresInDays > 0) {
        expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
      }

      const { rawToken, prefix, keyHash } = generateApiKey();
      const [created] = await db
        .insert(tenantApiKeys)
        .values({
          tenantId,
          prefix,
          keyHash,
          name: name.trim(),
          scope: resolvedScope,
          createdBy: actorId,
          expiresAt,
        })
        .returning();

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'api_key.created',
        entityType: 'api_key',
        entityId: created.id,
        metadata: { name: created.name, scope: created.scope, prefix },
      });

      return reply.status(201).send({
        id: created.id,
        prefix,
        name: created.name,
        scope: created.scope,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
        rawToken,
        message: 'Save this token now — it will not be shown again. Use it as: Authorization: Bearer <token>',
      });
    }
  );

  // Revoke (soft-delete)
  app.delete(
    '/api-keys/:id',
    { onRequest: [app.requireRole('owner')] },
    async (request, reply) => {
      const { tenantId, id: actorId } = request.authUser;
      const { id } = request.params as { id: string };

      const [updated] = await db
        .update(tenantApiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(tenantApiKeys.id, id), eq(tenantApiKeys.tenantId, tenantId)))
        .returning({ id: tenantApiKeys.id });

      if (!updated) throw new NotFoundError('API key', id);

      auditLog({
        tenantId,
        actorType: 'admin',
        actorId,
        action: 'api_key.revoked',
        entityType: 'api_key',
        entityId: id,
      });

      return reply.status(204).send();
    }
  );
}
