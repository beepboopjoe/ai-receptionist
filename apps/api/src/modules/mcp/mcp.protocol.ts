// ============================================================
// Thin MCP JSON-RPC dispatcher (Streamable HTTP payload).
// Speaks initialize / ping / tools/list / tools/call.
// ============================================================
import {
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  listMcpToolsForClient,
} from './mcp.tools.js';
import { callMcpTool } from './mcp.handlers.js';
import type { McpStore } from './mcp.store.js';
import {
  JSONRPC_INVALID_PARAMS,
  JSONRPC_INVALID_REQUEST,
  JSONRPC_METHOD_NOT_FOUND,
  JSONRPC_PARSE_ERROR,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpAuthContext,
} from './mcp.types.js';

export type McpDispatchResult =
  | { kind: 'response'; response: JsonRpcResponse }
  | { kind: 'notification' }
  | { kind: 'parse-error'; response: JsonRpcResponse };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseJsonRpc(body: unknown): JsonRpcRequest | { error: JsonRpcResponse } {
  if (Array.isArray(body)) {
    return {
      error: {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JSONRPC_INVALID_REQUEST,
          message: 'JSON-RPC batches are not supported on Telfin MCP v1.',
        },
      },
    };
  }
  if (!isObject(body)) {
    return {
      error: {
        jsonrpc: '2.0',
        id: null,
        error: { code: JSONRPC_PARSE_ERROR, message: 'Request body must be a JSON object.' },
      },
    };
  }
  if (body['jsonrpc'] !== '2.0' || typeof body['method'] !== 'string') {
    return {
      error: {
        jsonrpc: '2.0',
        id: (typeof body['id'] === 'string' || typeof body['id'] === 'number' ? body['id'] : null),
        error: { code: JSONRPC_INVALID_REQUEST, message: 'Invalid JSON-RPC 2.0 request.' },
      },
    };
  }
  const id = body['id'];
  return {
    jsonrpc: '2.0',
    method: body['method'],
    ...(id !== undefined ? { id: id as string | number | null } : {}),
    ...(body['params'] !== undefined ? { params: body['params'] } : {}),
  };
}

function negotiateProtocolVersion(requested: unknown): string {
  if (typeof requested === 'string' && (MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return MCP_PROTOCOL_VERSION;
}

export async function dispatchMcpRequest(
  body: unknown,
  auth: McpAuthContext,
  store: McpStore
): Promise<McpDispatchResult> {
  const parsed = parseJsonRpc(body);
  if ('error' in parsed) {
    return { kind: 'parse-error', response: parsed.error };
  }

  const id = parsed.id;
  const isNotification = id === undefined;

  if (parsed.method === 'notifications/initialized' || parsed.method.startsWith('notifications/')) {
    return { kind: 'notification' };
  }

  const respond = (result: unknown): McpDispatchResult => ({
    kind: 'response',
    response: { jsonrpc: '2.0', id: id ?? null, result },
  });
  const fail = (code: number, message: string, data?: unknown): McpDispatchResult => ({
    kind: 'response',
    response: {
      jsonrpc: '2.0',
      id: id ?? null,
      error: data !== undefined ? { code, message, data } : { code, message },
    },
  });

  if (isNotification) {
    return { kind: 'notification' };
  }

  switch (parsed.method) {
    case 'initialize': {
      const params = isObject(parsed.params) ? parsed.params : {};
      return respond({
        protocolVersion: negotiateProtocolVersion(params['protocolVersion']),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        instructions:
          'Telfin MCP is tenant-scoped. Use telfin_whoami first. Do not place outbound calls or run campaigns via MCP. Calendar book/cancel is not in v1.',
      });
    }
    case 'ping':
      return respond({});
    case 'tools/list':
      return respond({ tools: listMcpToolsForClient() });
    case 'tools/call': {
      if (!isObject(parsed.params) || typeof parsed.params['name'] !== 'string') {
        return fail(JSONRPC_INVALID_PARAMS, 'tools/call requires params.name');
      }
      const result = await callMcpTool(
        parsed.params['name'],
        parsed.params['arguments'] ?? {},
        auth,
        store
      );
      return respond(result);
    }
    default:
      return fail(JSONRPC_METHOD_NOT_FOUND, `Method not found: ${parsed.method}`);
  }
}

export function encodeMcpHttpBody(
  response: JsonRpcResponse,
  acceptHeader: string | undefined
): { contentType: string; body: string } {
  const accept = (acceptHeader ?? '').toLowerCase();
  const wantsJson = accept.includes('application/json');
  const wantsSse = accept.includes('text/event-stream');
  if (wantsSse && !wantsJson) {
    return {
      contentType: 'text/event-stream',
      body: `event: message\ndata: ${JSON.stringify(response)}\n\n`,
    };
  }
  return {
    contentType: 'application/json',
    body: JSON.stringify(response),
  };
}
