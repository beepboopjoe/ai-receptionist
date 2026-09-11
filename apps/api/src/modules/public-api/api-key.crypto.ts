// ============================================================
// API key minting / hashing (no DB).
//
// Wire formats the customer sees:
//   ark_live_<48 hex chars>   — Public REST API (legacy + default)
//   telfin_sk_<48 hex chars>  — MCP / Claude / Cursor connectors
//
// Both hash the full raw token with SHA-256. The `prefix` column is
// a non-secret display hint (scheme + first 8 hex chars).
// ============================================================
import crypto from 'node:crypto';

export const PUBLIC_API_KEY_SCHEME = 'ark_live_';
export const MCP_API_KEY_SCHEME = 'telfin_sk_';
export const API_KEY_SCHEMES = [PUBLIC_API_KEY_SCHEME, MCP_API_KEY_SCHEME] as const;
export type ApiKeyScheme = (typeof API_KEY_SCHEMES)[number];

const RANDOM_BYTES = 24; // 48 hex chars

export interface IssuedKey {
  /** The raw secret. Shown once at creation, never again. */
  rawToken: string;
  /** Display hint — e.g. `telfin_sk_a1b2c3d4`. Safe to persist. */
  prefix: string;
  /** SHA-256 hex of rawToken — what we persist. */
  keyHash: string;
  scheme: ApiKeyScheme;
}

export function looksLikeApiKey(rawToken: string): boolean {
  if (!rawToken) return false;
  return API_KEY_SCHEMES.some((scheme) => rawToken.startsWith(scheme));
}

export function hashApiKey(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateApiKey(scheme: ApiKeyScheme = PUBLIC_API_KEY_SCHEME): IssuedKey {
  const random = crypto.randomBytes(RANDOM_BYTES).toString('hex');
  const rawToken = `${scheme}${random}`;
  const prefix = `${scheme}${random.slice(0, 8)}`;
  const keyHash = hashApiKey(rawToken);
  return { rawToken, prefix, keyHash, scheme };
}

/** Render a stored prefix for the dashboard. Legacy rows are 8 hex chars. */
export function displayKeyHint(storedPrefix: string): string {
  if (
    storedPrefix.startsWith(PUBLIC_API_KEY_SCHEME) ||
    storedPrefix.startsWith(MCP_API_KEY_SCHEME)
  ) {
    return `${storedPrefix}…`;
  }
  return `${PUBLIC_API_KEY_SCHEME}${storedPrefix}…`;
}
