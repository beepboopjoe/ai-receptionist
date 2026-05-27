// ============================================================
// OpenAI embeddings client (Phase 12.8).
//
// Thin fetch wrapper around https://api.openai.com/v1/embeddings.
// We don't pull the `openai` package — matches the pattern of
// calling ElevenLabs / Apify / Grok directly.
//
// Graceful no-op when OPENAI_API_KEY is unset: returns null so
// callers can short-circuit without crashing the worker.
// ============================================================
import { config } from '../../config.js';
import { IntegrationError } from '../../lib/errors.js';
import pino from 'pino';

const logger = pino({ name: 'openai-embeddings' });

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const MAX_BATCH = 96; // OpenAI accepts up to 2048; we cap lower for sane payloads.

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

/**
 * Embed an array of strings. Batches automatically when input exceeds MAX_BATCH.
 * Returns null when OPENAI_API_KEY is not configured (graceful no-op).
 */
export async function embedTexts(texts: string[]): Promise<EmbeddingResult[] | null> {
  const key = config.OPENAI_API_KEY;
  if (!key) {
    logger.debug('OPENAI_API_KEY unset — skipping embedding');
    return null;
  }
  if (texts.length === 0) return [];

  const model = config.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const out: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH);
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, input: batch }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new IntegrationError(
        'openai',
        `Embeddings call failed (${res.status}): ${body.slice(0, 500)}`
      );
    }

    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
      usage: { total_tokens: number };
    };
    // Distribute total_tokens proportionally — OpenAI doesn't return per-row tokens.
    const perRowTokens = Math.floor(json.usage.total_tokens / Math.max(1, batch.length));
    for (const row of json.data) {
      out.push({ embedding: row.embedding, tokenCount: perRowTokens });
    }
  }

  return out;
}

/**
 * Embed a single query string for retrieval-time similarity search.
 * Returns null when OPENAI_API_KEY is unset.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  const result = await embedTexts([text]);
  if (result === null) return null;
  return result[0]?.embedding ?? null;
}
