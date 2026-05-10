// ============================================================
// Public-API auth middleware
//
// Reads the `Authorization: Bearer ark_live_<…>` header (or
// `X-API-Key` as a fallback so customers don't have to fight curl
// quoting), looks up the key, and attaches `request.apiKey` to the
// Fastify request.
//
// We deliberately don't reuse `app.authenticate` (which expects a
// JWT). Public-API routes use `app.requireApiKey('read'|'write')`
// instead. JWT-authenticated routes are still owner/admin/staff
// gated separately.
// ============================================================
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { authenticateApiKey, type ApiKeyLookupResult } from './api-key.service.js';
import { AuthError } from '../../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyLookupResult;
  }
  interface FastifyInstance {
    requireApiKey: (requiredScope: 'read' | 'write') => (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

function extractToken(request: FastifyRequest): string | null {
  // Prefer the standard Authorization header.
  const auth = request.headers.authorization;
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  // Fall back to X-API-Key for tools that don't set Authorization easily.
  const xkey = request.headers['x-api-key'];
  if (typeof xkey === 'string' && xkey.length > 0) {
    return xkey.trim();
  }
  return null;
}

const apiKeyMiddleware = fp(async (app: FastifyInstance) => {
  app.decorate('requireApiKey', (requiredScope: 'read' | 'write') => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const token = extractToken(request);
      if (!token) {
        throw new AuthError('API key required. Send "Authorization: Bearer ark_live_…" or "X-API-Key" header.');
      }
      const result = await authenticateApiKey(token);
      if (!result) {
        throw new AuthError('Invalid, revoked, or expired API key.');
      }
      // Read-scope keys cannot make write calls. Write-scope keys can make either.
      if (requiredScope === 'write' && result.scope !== 'write') {
        throw new AuthError('This API key has read-only scope. Write scope required.');
      }
      request.apiKey = result;
    };
  });
});

export default apiKeyMiddleware;
