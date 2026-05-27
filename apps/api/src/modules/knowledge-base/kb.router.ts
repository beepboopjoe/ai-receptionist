// ============================================================
// Knowledge Base router — Phase 12.8.
//
// Endpoints (all tenant-scoped via the JWT):
//   POST   /kb/documents               — multipart upload (admin/owner)
//   GET    /kb/documents               — list tenant's docs
//   GET    /kb/documents/:id           — single doc (without bytes)
//   DELETE /kb/documents/:id           — delete + cascade chunks
//   POST   /kb/documents/:id/reprocess — re-enqueue parse+embed
//   GET    /kb/usage                   — quota + current usage for the UI bar
// ============================================================
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  reprocessDocument,
  getUsage,
} from './kb.service.js';
import { ValidationError } from '../../lib/errors.js';

export async function kbRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // ---- Upload ----
  app.post(
    '/kb/documents',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request, reply) => {
      const { tenantId, userId } = request.user as { tenantId: string; userId?: string };

      // Single-file upload (multipart). If multiple files are sent, use the first only.
      const parts = request.parts();
      let filename: string | null = null;
      let mimetype: string | null = null;
      let buffer: Buffer | null = null;

      for await (const part of parts) {
        if (part.type === 'file' && buffer === null) {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk);
          buffer = Buffer.concat(chunks);
          filename = part.filename ?? 'document';
          mimetype = part.mimetype ?? 'application/octet-stream';
        } else if (part.type === 'file') {
          // Drain extra files we won't store (multipart streams must be consumed).
          for await (const _ of part.file) { /* drain */ }
        }
      }

      if (!buffer || !filename || !mimetype) {
        throw new ValidationError('No file provided in upload.');
      }

      const doc = await uploadDocument(tenantId, { filename, mimetype, buffer }, userId ?? null);
      return reply.code(202).send(doc);
    }
  );

  // ---- List ----
  app.get(
    '/kb/documents',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      const docs = await listDocuments(tenantId);
      return { documents: docs };
    }
  );

  // ---- Single doc ----
  app.get<{ Params: { id: string } }>(
    '/kb/documents/:id',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      const doc = await getDocument(tenantId, request.params.id);
      return doc;
    }
  );

  // ---- Delete ----
  app.delete<{ Params: { id: string } }>(
    '/kb/documents/:id',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request, reply) => {
      const { tenantId } = request.user as { tenantId: string };
      await deleteDocument(tenantId, request.params.id);
      return reply.code(204).send();
    }
  );

  // ---- Reprocess ----
  app.post<{ Params: { id: string } }>(
    '/kb/documents/:id/reprocess',
    { onRequest: [app.requireRole('admin', 'owner')] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      await reprocessDocument(tenantId, request.params.id);
      return { ok: true };
    }
  );

  // ---- Usage ----
  app.get(
    '/kb/usage',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { tenantId } = request.user as { tenantId: string };
      return await getUsage(tenantId);
    }
  );
}

export const kbPlugin = fp(kbRoutes, { name: 'knowledge-base' });
