// ============================================================
// API key service
//
// Mint / lookup / revoke API keys for the public API. Raw tokens
// are returned only once at creation; everything else operates on
// the SHA-256 hash so a DB leak doesn't yield usable keys.
//
// Wire format the customer sees:
//   ark_live_<32 random hex chars>
//   ^^^ prefix    ^^^ random
// The first 8 chars after `ark_live_` are also stored as a
// non-secret `prefix` so the UI can show "ark_live_a1b2c3d4…" in
// the keys table without leaking the rest.
// ============================================================
import crypto from 'node:crypto';
import { db } from '../../db/client.js';
import { tenantApiKeys } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const KEY_PREFIX = 'ark_live_';
const RANDOM_BYTES = 24; // 48 hex chars

export interface IssuedKey {
  /** The raw secret. Shown once at creation, never again. */
  rawToken: string;
  /** First 8 chars of the random portion — safe to display in the UI. */
  prefix: string;
  /** SHA-256 hex of rawToken — what we persist. */
  keyHash: string;
}

export function generateApiKey(): IssuedKey {
  const random = crypto.randomBytes(RANDOM_BYTES).toString('hex');
  const rawToken = `${KEY_PREFIX}${random}`;
  const prefix = random.slice(0, 8);
  const keyHash = hashApiKey(rawToken);
  return { rawToken, prefix, keyHash };
}

export function hashApiKey(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export interface ApiKeyLookupResult {
  tenantId: string;
  scope: 'read' | 'write';
  keyId: string;
}

/**
 * Look up an incoming raw token. Returns null if the key is unknown,
 * revoked, or expired. Side effect: bumps `last_used_at` so customers
 * can see when their key was last active.
 */
export async function authenticateApiKey(rawToken: string): Promise<ApiKeyLookupResult | null> {
  if (!rawToken || !rawToken.startsWith(KEY_PREFIX)) return null;
  const keyHash = hashApiKey(rawToken);

  const [row] = await db
    .select()
    .from(tenantApiKeys)
    .where(eq(tenantApiKeys.keyHash, keyHash))
    .limit(1);

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  // Fire-and-forget last-used bookkeeping; never block the request.
  void db
    .update(tenantApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(tenantApiKeys.id, row.id))
    .catch(() => undefined);

  return {
    tenantId: row.tenantId,
    scope: (row.scope === 'write' ? 'write' : 'read'),
    keyId: row.id,
  };
}
