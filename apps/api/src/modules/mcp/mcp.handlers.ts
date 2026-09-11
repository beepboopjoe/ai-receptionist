// ============================================================
// MCP tool handlers. Pure wrt HTTP — they take auth + a store.
// ============================================================
import { getMcpTool, type McpToolName } from './mcp.tools.js';
import type { McpAuthContext } from './mcp.types.js';
import {
  PHONE_E164,
  clampLimit,
  parseSince,
  type McpStore,
} from './mcp.store.js';

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function ok(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function err(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

export async function callMcpTool(
  name: string,
  rawArgs: unknown,
  auth: McpAuthContext,
  store: McpStore
): Promise<McpToolResult> {
  const tool = getMcpTool(name);
  if (!tool) {
    return err(
      `Unknown tool "${name}". Telfin MCP v1 does not expose place_call, join_call, calendar, or campaign tools.`
    );
  }
  if (tool.scope === 'write' && auth.scope !== 'write') {
    return err('This API key has read-only scope. Mint a write-scope key in Settings → API Keys.');
  }

  const args = asRecord(rawArgs);

  try {
    switch (tool.name as McpToolName) {
      case 'telfin_whoami': {
        const who = await store.getWhoami(auth.tenantId, auth.scope);
        if (!who) return err('Tenant not found for this API key.');
        return ok(who);
      }
      case 'telfin_list_leads': {
        const since = parseSince(args['since']);
        const limit = clampLimit(args['limit']);
        const leads = await store.listLeads(auth.tenantId, {
          limit,
          ...(since ? { since } : {}),
        });
        return ok({ data: leads, count: leads.length, limit });
      }
      case 'telfin_create_lead': {
        const phone = str(args['phone']);
        if (!phone || !PHONE_E164.test(phone)) {
          return err('phone is required and must be E.164 (e.g. +14155551234).');
        }
        const lead = await store.createLead(auth.tenantId, {
          phone,
          ...(str(args['name']) ? { name: str(args['name']) } : {}),
          ...(str(args['email']) ? { email: str(args['email']) } : {}),
          ...(str(args['business']) ? { business: str(args['business']) } : {}),
          ...(str(args['notes']) ? { notes: str(args['notes']) } : {}),
        });
        return ok(lead);
      }
      case 'telfin_list_calls': {
        const limit = clampLimit(args['limit']);
        const calls = await store.listCalls(auth.tenantId, { limit });
        return ok({ data: calls, count: calls.length, limit });
      }
      case 'telfin_get_call': {
        const callId = str(args['call_id']);
        if (!callId) return err('call_id is required.');
        const call = await store.getCall(auth.tenantId, callId);
        if (!call) return err(`Call '${callId}' was not found for this tenant.`);
        return ok(call);
      }
      case 'telfin_list_numbers': {
        const numbers = await store.listNumbers(auth.tenantId);
        return ok({ data: numbers, count: numbers.length });
      }
      case 'telfin_send_sms': {
        const to = str(args['to']);
        const body = str(args['body']);
        if (!to || !PHONE_E164.test(to)) {
          return err('to is required and must be E.164 (e.g. +14155551234).');
        }
        if (!body) return err('body is required.');
        const result = await store.sendSms(auth.tenantId, { to, body });
        if (!result.ok) {
          return err(result.message);
        }
        return ok({ ok: true, messageId: result.messageId });
      }
      default:
        return err(`Unknown tool "${name}".`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Tool failed';
    return err(message);
  }
}
