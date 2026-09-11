// ============================================================
// Telfin MCP — Streamable HTTP endpoint.
//
// POST /mcp  (alias POST /api/v1/mcp)
//   JSON-RPC 2.0: initialize | ping | tools/list | tools/call
//   Auth: Authorization: Bearer telfin_sk_… | ark_live_…  or X-API-Key
//
// Stateless (no session map) so tenants cannot leak across requests.
// Does not wrap with fastify-plugin — routes are declared with full paths.
// ============================================================
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticateApiKey } from '../public-api/api-key.service.js';
import { authorizeMcpHeaders } from './mcp.auth.js';
import { drizzleMcpStore } from './mcp.db-store.js';
import { dispatchMcpRequest, encodeMcpHttpBody } from './mcp.protocol.js';

const MCP_PATHS = ['/mcp', '/api/v1/mcp'] as const;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, X-API-Key, Mcp-Session-Id, Last-Event-ID, MCP-Protocol-Version',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
} as const;

function applyCors(reply: FastifyReply): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    void reply.header(k, v);
  }
}

const rateLimit = { max: 60, timeWindow: '1 minute' as const };

async function handlePost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  applyCors(reply);
  const authResult = await authorizeMcpHeaders(
    {
      ...(typeof request.headers.authorization === 'string'
        ? { authorization: request.headers.authorization }
        : {}),
      ...(request.headers['x-api-key'] !== undefined
        ? { 'x-api-key': request.headers['x-api-key'] }
        : {}),
    },
    authenticateApiKey
  );
  if (!authResult.ok) {
    const encoded = encodeMcpHttpBody(authResult.body, request.headers.accept);
    if (encoded.contentType === 'text/event-stream') {
      void reply.header('Content-Type', encoded.contentType);
      return reply.status(authResult.status).send(encoded.body);
    }
    return reply.status(authResult.status).send(authResult.body);
  }

  const dispatched = await dispatchMcpRequest(request.body, authResult.auth, drizzleMcpStore);
  if (dispatched.kind === 'notification') {
    return reply.status(202).send();
  }
  const encoded = encodeMcpHttpBody(dispatched.response, request.headers.accept);
  if (encoded.contentType === 'text/event-stream') {
    void reply.header('Content-Type', encoded.contentType);
    return reply.status(200).send(encoded.body);
  }
  return reply.status(200).send(dispatched.response);
}

async function handleUnsupported(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  applyCors(reply);
  void reply.header('Allow', 'POST, OPTIONS');
  const payload = {
    jsonrpc: '2.0' as const,
    id: null,
    error: {
      code: -32000,
      message: 'Telfin MCP is stateless. Use POST with a JSON-RPC body (initialize, tools/list, tools/call).',
    },
  };
  const encoded = encodeMcpHttpBody(payload, request.headers.accept);
  if (encoded.contentType === 'text/event-stream') {
    void reply.header('Content-Type', encoded.contentType);
    return reply.status(405).send(encoded.body);
  }
  return reply.status(405).send(payload);
}

async function handleOptions(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  applyCors(reply);
  return reply.status(204).send();
}

export async function mcpPlugin(app: FastifyInstance): Promise<void> {
  for (const path of MCP_PATHS) {
    app.options(path, { config: { rateLimit: false } }, handleOptions);
    app.post(
      path,
      { config: { rateLimit } },
      handlePost
    );
    app.get(path, { config: { rateLimit } }, handleUnsupported);
    app.delete(path, { config: { rateLimit } }, handleUnsupported);
  }
}
