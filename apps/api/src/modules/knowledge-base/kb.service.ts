// ============================================================
// Knowledge Base Service — Phase 12.8.
//
// Public surface:
//   uploadDocument         — multipart upload → enqueues kb-process job
//   listDocuments          — tenant's docs (no file_bytes payload)
//   getDocument            — single doc (no file_bytes)
//   deleteDocument         — cascades chunks via FK
//   reprocessDocument      — re-enqueues parse+embed for a single doc
//   getUsage               — current quota usage + limits
//   processDocument        — INTERNAL: parse → chunk → embed → store.
//                             Called only from kb-process.job.
//   retrieveRelevantChunks — top-K cosine similarity at call-start.
//
// All public functions enforce tenant scoping. Plan-quota enforced
// in uploadDocument via getUsage(); graceful-fail patterns mirror
// lead-billing.service (return {ok,reason} rather than throwing).
// ============================================================
import { db } from '../../db/client.js';
import { kbDocuments, kbChunks, tenants } from '../../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { config } from '../../config.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { sniffMime, parseDocument, SUPPORTED_MIME } from './document-parsers.js';
import { chunkText } from './chunker.js';
import { embedTexts, embedQuery } from './openai-embeddings.client.js';
import { kbQueue } from '../../queue/queues.js';
import pino from 'pino';

const logger = pino({ name: 'kb-service' });

// ---- Plan quotas ------------------------------------------------

export interface KbQuota { docs: number; bytes: number }

export function getQuotaForPlan(plan: string): KbQuota {
  switch (plan) {
    case 'scale':
      return { docs: config.KB_DOC_LIMIT_SCALE, bytes: config.KB_BYTES_LIMIT_SCALE };
    case 'growth':
      return { docs: config.KB_DOC_LIMIT_GROWTH, bytes: config.KB_BYTES_LIMIT_GROWTH };
    case 'starter':
      return { docs: config.KB_DOC_LIMIT_STARTER, bytes: config.KB_BYTES_LIMIT_STARTER };
    case 'trial':
    default:
      return { docs: config.KB_DOC_LIMIT_TRIAL, bytes: config.KB_BYTES_LIMIT_TRIAL };
  }
}

// ---- Public API -------------------------------------------------

export interface UploadInput {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface UploadedDocument {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  createdAt: Date;
}

export async function uploadDocument(
  tenantId: string,
  input: UploadInput,
  uploadedBy: string | null = null
): Promise<UploadedDocument> {
  const mime = sniffMime(input.filename, input.mimetype);
  if (!SUPPORTED_MIME.has(mime)) {
    throw new ValidationError(`Unsupported file type "${mime}". Use PDF, DOCX, TXT, or MD.`);
  }
  if (input.buffer.length === 0) {
    throw new ValidationError('Uploaded file is empty.');
  }

  // Quota check (best-effort; row-locking deferred to 12.8.1).
  const usage = await getUsage(tenantId);
  if (usage.docCount >= usage.limits.docs) {
    throw new ValidationError(
      `Document limit reached for your plan (${usage.limits.docs}). Upgrade or delete an existing doc.`
    );
  }
  if (usage.totalBytes + input.buffer.length > usage.limits.bytes) {
    throw new ValidationError(
      `Storage limit reached for your plan (${formatBytes(usage.limits.bytes)}). Upgrade or delete an existing doc.`
    );
  }

  const [doc] = await db
    .insert(kbDocuments)
    .values({
      tenantId,
      filename: input.filename,
      mimeType: mime,
      sizeBytes: input.buffer.length,
      fileBytes: input.buffer,
      status: 'pending',
      ...(uploadedBy && { uploadedBy }),
    })
    .returning({
      id: kbDocuments.id,
      filename: kbDocuments.filename,
      mimeType: kbDocuments.mimeType,
      sizeBytes: kbDocuments.sizeBytes,
      status: kbDocuments.status,
      createdAt: kbDocuments.createdAt,
    });

  if (!doc) throw new Error('kb_documents insert returned no row');

  // Enqueue async processing. Worker pulls file_bytes back from DB.
  await kbQueue.add('process', { documentId: doc.id });

  return doc;
}

export interface DocumentSummary {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: Date;
  processedAt: Date | null;
}

export async function listDocuments(tenantId: string): Promise<DocumentSummary[]> {
  return db
    .select({
      id: kbDocuments.id,
      filename: kbDocuments.filename,
      mimeType: kbDocuments.mimeType,
      sizeBytes: kbDocuments.sizeBytes,
      status: kbDocuments.status,
      errorMessage: kbDocuments.errorMessage,
      chunkCount: kbDocuments.chunkCount,
      createdAt: kbDocuments.createdAt,
      processedAt: kbDocuments.processedAt,
    })
    .from(kbDocuments)
    .where(eq(kbDocuments.tenantId, tenantId))
    .orderBy(desc(kbDocuments.createdAt));
}

export async function getDocument(tenantId: string, docId: string): Promise<DocumentSummary> {
  const [row] = await db
    .select({
      id: kbDocuments.id,
      filename: kbDocuments.filename,
      mimeType: kbDocuments.mimeType,
      sizeBytes: kbDocuments.sizeBytes,
      status: kbDocuments.status,
      errorMessage: kbDocuments.errorMessage,
      chunkCount: kbDocuments.chunkCount,
      createdAt: kbDocuments.createdAt,
      processedAt: kbDocuments.processedAt,
    })
    .from(kbDocuments)
    .where(and(eq(kbDocuments.id, docId), eq(kbDocuments.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new NotFoundError('Document', docId);
  return row;
}

export async function deleteDocument(tenantId: string, docId: string): Promise<void> {
  const result = await db
    .delete(kbDocuments)
    .where(and(eq(kbDocuments.id, docId), eq(kbDocuments.tenantId, tenantId)))
    .returning({ id: kbDocuments.id });
  if (result.length === 0) throw new NotFoundError('Document', docId);
}

export async function reprocessDocument(tenantId: string, docId: string): Promise<void> {
  // Verify ownership + existence.
  await getDocument(tenantId, docId);
  // Wipe any prior chunks; FK cascade handles delete.
  await db.delete(kbChunks).where(eq(kbChunks.documentId, docId));
  await db
    .update(kbDocuments)
    .set({ status: 'pending', chunkCount: 0, errorMessage: null, processedAt: null })
    .where(eq(kbDocuments.id, docId));
  await kbQueue.add('process', { documentId: docId });
}

export interface UsageSummary {
  docCount: number;
  totalBytes: number;
  limits: KbQuota;
}

export async function getUsage(tenantId: string): Promise<UsageSummary> {
  const [agg] = await db
    .select({
      docCount: sql<number>`COUNT(*)::int`,
      totalBytes: sql<number>`COALESCE(SUM(${kbDocuments.sizeBytes}), 0)::int`,
    })
    .from(kbDocuments)
    .where(eq(kbDocuments.tenantId, tenantId));

  const [tenantRow] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const plan = tenantRow?.plan ?? 'trial';
  return {
    docCount: Number(agg?.docCount ?? 0),
    totalBytes: Number(agg?.totalBytes ?? 0),
    limits: getQuotaForPlan(plan),
  };
}

// ---- Worker-only: processDocument -------------------------------

export async function processDocument(documentId: string): Promise<void> {
  // Load file bytes + metadata.
  const [doc] = await db
    .select({
      id: kbDocuments.id,
      tenantId: kbDocuments.tenantId,
      filename: kbDocuments.filename,
      mimeType: kbDocuments.mimeType,
      fileBytes: kbDocuments.fileBytes,
    })
    .from(kbDocuments)
    .where(eq(kbDocuments.id, documentId))
    .limit(1);

  if (!doc) {
    logger.warn({ documentId }, 'processDocument: doc not found (likely deleted)');
    return;
  }

  await db
    .update(kbDocuments)
    .set({ status: 'processing', errorMessage: null })
    .where(eq(kbDocuments.id, documentId));

  try {
    // 1. Parse.
    const text = await parseDocument(doc.mimeType, Buffer.from(doc.fileBytes as unknown as Buffer));
    if (text.trim().length === 0) {
      throw new ValidationError(
        `Document "${doc.filename}" extracted no text (image-only PDF? Scanned doc?).`
      );
    }

    // 2. Chunk.
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new ValidationError(`Document "${doc.filename}" produced 0 chunks.`);
    }

    // 3. Embed (batched). null = OpenAI not configured.
    const embeddings = await embedTexts(chunks);

    // 4. Persist chunks. embeddings may be null in dev mode without OPENAI_API_KEY;
    //    chunks still get stored so the UI can show them, just won't be searchable.
    await db.delete(kbChunks).where(eq(kbChunks.documentId, documentId));
    const model = config.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    const rows = chunks.map((content, idx) => ({
      documentId,
      tenantId: doc.tenantId,
      chunkIndex: idx,
      content,
      embedding: embeddings ? embeddings[idx]?.embedding : null,
      embeddingModel: model,
      tokenCount: embeddings ? embeddings[idx]?.tokenCount ?? 0 : 0,
    }));
    // Insert in batches of 200 to keep parameter counts sane.
    for (let i = 0; i < rows.length; i += 200) {
      await db.insert(kbChunks).values(rows.slice(i, i + 200) as never);
    }

    await db
      .update(kbDocuments)
      .set({
        status: 'ready',
        chunkCount: chunks.length,
        processedAt: new Date(),
        errorMessage: embeddings ? null : 'OPENAI_API_KEY unset — chunks stored without embeddings',
      })
      .where(eq(kbDocuments.id, documentId));

    logger.info(
      { documentId, chunkCount: chunks.length, embedded: !!embeddings },
      'KB document processed'
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, documentId }, 'KB document processing failed');
    await db
      .update(kbDocuments)
      .set({ status: 'failed', errorMessage: message.slice(0, 1000), processedAt: new Date() })
      .where(eq(kbDocuments.id, documentId));
  }
}

// ---- Retrieval --------------------------------------------------

/**
 * Top-K relevant chunks for `query` scoped to `tenantId`.
 * Returns [] (not null) on any failure so the prompt-builder never breaks.
 */
export async function retrieveRelevantChunks(
  tenantId: string,
  query: string,
  k: number = 4
): Promise<string[]> {
  try {
    const queryEmbedding = await embedQuery(query);
    if (!queryEmbedding) return []; // OpenAI not configured.

    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    const result = await db.execute<{ content: string; distance: number }>(sql`
      SELECT content, embedding <=> ${vectorLiteral}::vector AS distance
      FROM kb_chunks
      WHERE tenant_id = ${tenantId}
        AND embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT ${k}
    `);

    // Drizzle returns rows as `result.rows` for pg driver; normalise.
    const rows = Array.isArray(result)
      ? (result as { content: string }[])
      : ((result as { rows?: { content: string }[] }).rows ?? []);

    return rows.map((r) => r.content);
  } catch (err) {
    logger.error({ err, tenantId, query: query.slice(0, 100) }, 'retrieveRelevantChunks failed');
    return [];
  }
}

// ---- Helpers ----------------------------------------------------

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
