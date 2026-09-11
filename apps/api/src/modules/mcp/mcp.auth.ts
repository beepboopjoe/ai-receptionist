// ============================================================
// MCP request auth — reuse hashed tenant API keys.
// Never trust a client-supplied tenant id.
// ============================================================
import { looksLikeApiKey } from '../public-api/api-key.crypto.js';
import {
  JSONRPC_AUTH_ERROR,
  type JsonRpcFailure,
  type McpAuthContext,
} from './mcp.types.js';

export const MCP_AUTH_HINT =
  'API key required. Send "Authorization: Bearer telfin_sk_…" (or ark_live_…) or "X-API-Key". Mint a key in Settings → API Keys.';

export interface McpKeyLookup {
  tenantId: string;
  scope: 'read' | 'write';
  keyId: string;
}

export function extractBearerOrApiKey(headers: {
  authorization?: string;
  'x-api-key'?: string | string[];
}): string | null {
  const auth = headers.authorization;
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    return token.length > 0 ? token : null;
  }
  const xkey = headers['x-api-key'];
  if (typeof xkey === 'string' && xkey.trim().length > 0) return xkey.trim();
  if (Array.isArray(xkey) && typeof xkey[0] === 'string' && xkey[0].trim().length > 0) {
    return xkey[0].trim();
  }
  return null;
}

export function mcpAuthErrorBody(message: string): JsonRpcFailure {
  return {
    jsonrpc: '2.0',
    id: null,
    error: { code: JSONRPC_AUTH_ERROR, message },
  };
}

export async function authorizeMcpHeaders(
  headers: { authorization?: string; 'x-api-key'?: string | string[] },
  lookup: (token: string) => Promise<McpKeyLookup | null>
): Promise<
  | { ok: true; auth: McpAuthContext }
  | { ok: false; status: 401; body: JsonRpcFailure }
> {
  const token = extractBearerOrApiKey(headers);
  if (!token) {
    return { ok: false, status: 401, body: mcpAuthErrorBody(MCP_AUTH_HINT) };
  }
  if (!looksLikeApiKey(token)) {
    return {
      ok: false,
      status: 401,
      body: mcpAuthErrorBody('Invalid API key format. Expected telfin_sk_… or ark_live_…'),
    };
  }
  const result = await lookup(token);
  if (!result) {
    return {
      ok: false,
      status: 401,
      body: mcpAuthErrorBody('Invalid, revoked, or expired API key.'),
    };
  }
  return {
    ok: true,
    auth: { tenantId: result.tenantId, scope: result.scope, keyId: result.keyId },
  };
}
