// ============================================================
// API key service
//
// Mint / lookup / revoke API keys for the public API and MCP.
// Raw tokens are returned only once at creation; everything else
// operates on the SHA-256 hash so a DB leak doesn't yield usable keys.
// ============================================================
import { db } from '../../db/client.js';
import { tenantApiKeys } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashApiKey, looksLikeApiKey } from './api-key.crypto.js';

export {
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  displayKeyHint,
  PUBLIC_API_KEY_SCHEME,
  MCP_API_KEY_SCHEME,
} from './api-key.crypto.js';
export type { IssuedKey, ApiKeyScheme } from './api-key.crypto.js';

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
  if (!looksLikeApiKey(rawToken)) return null;
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
