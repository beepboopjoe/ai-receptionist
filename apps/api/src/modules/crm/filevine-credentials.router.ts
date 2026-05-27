// ============================================================
// Filevine credentials router — Phase 13.
//
// Unlike OAuth CRMs, Filevine uses Personal Access Token + Secret
// + Org ID that the tenant pastes directly. We validate by hitting
// their org-info endpoint before persisting.
//
//   POST   /integrations/filevine/connect    { apiKey, apiSecret, orgId }
//   POST   /integrations/filevine/disconnect
// ============================================================
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { encryptCredentials } from '../../lib/encryption.js';
import { ValidationError } from '../../lib/errors.js';
import { validateCredentials } from './adapters/filevine.adapter.js';

export async function filevineCredentialsPlugin(app: FastifyInstance): Promise<void> {
  app.post(
    '/integrations/filevine/connect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      const body = request.body as { apiKey?: string; apiSecret?: string; orgId?: string };

      const apiKey = body?.apiKey?.trim();
      const apiSecret = body?.apiSecret?.trim();
      const orgId = body?.orgId?.trim();

      if (!apiKey || !apiSecret || !orgId) {
        throw new ValidationError('apiKey, apiSecret, and orgId are all required.');
      }

      // Sanity check the credentials before persisting.
      const ok = await validateCredentials({ apiKey, apiSecret, orgId });
      if (!ok) {
        return reply.code(400).send({
          error: 'invalid_credentials',
          message: 'Filevine rejected those credentials. Double-check the PAT, Secret, and Org ID in your Filevine account settings.',
        });
      }

      await db
        .insert(integrations)
        .values({
          tenantId,
          provider: 'filevine',
          status: 'connected',
          credentials: encryptCredentials({ apiKey, apiSecret, orgId }),
          metadata: {},
        })
        .onConflictDoUpdate({
          target: [integrations.tenantId, integrations.provider],
          set: {
            credentials: encryptCredentials({ apiKey, apiSecret, orgId }),
            status: 'connected',
            errorMessage: null,
            updatedAt: new Date(),
          },
        });

      return reply.code(201).send({ ok: true });
    }
  );

  app.post(
    '/integrations/filevine/disconnect',
    { onRequest: [app.requireRole('admin')] },
    async (request, reply) => {
      const { tenantId } = request.authUser;
      await db
        .delete(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, 'filevine')));
      return reply.send({ ok: true });
    }
  );
}
