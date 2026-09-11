// ============================================================
// Telfin MCP v1 tool catalog.
//
// Read tools work with any API key. Write tools require `write` scope.
// Place-call / campaigns / calendar are intentionally absent.
// ============================================================

export const MCP_SERVER_NAME = 'telfin';
export const MCP_SERVER_VERSION = '1.0.0';
export const MCP_PROTOCOL_VERSION = '2025-03-26';
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

export type McpToolName =
  | 'telfin_whoami'
  | 'telfin_list_leads'
  | 'telfin_create_lead'
  | 'telfin_list_calls'
  | 'telfin_get_call'
  | 'telfin_list_numbers'
  | 'telfin_send_sms';

export interface McpToolDef {
  name: McpToolName;
  description: string;
  scope: 'read' | 'write';
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'telfin_whoami',
    description:
      'Return the authenticated Telfin tenant: name, slug, plan hints, timezone, vertical, and API key scope. Use this first to confirm you are in the right account.',
    scope: 'read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'telfin_list_leads',
    description:
      'List recent tenant-scoped contacts/leads (CRM contacts for this account only). Filters: since (ISO 8601), limit (default 25, max 100). Does not return other tenants or platform-wide marketing leads.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        since: {
          type: 'string',
          description: 'ISO 8601 timestamp — only leads created on or after this instant.',
        },
        limit: {
          type: 'integer',
          description: 'Max rows to return (1–100). Default 25.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'telfin_create_lead',
    description:
      'Create a contact/lead on this tenant. Requires a phone number. source is always `mcp`. Idempotent on phone: if the number already exists for this tenant, returns the existing record. Requires a write-scope API key.',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name (split into first/last).' },
        phone: { type: 'string', description: 'Phone in E.164 (e.g. +14155551234). Required.' },
        email: { type: 'string', description: 'Optional email.' },
        business: { type: 'string', description: 'Optional business / company name (stored in notes).' },
        notes: { type: 'string', description: 'Optional free-text notes.' },
      },
      required: ['phone'],
      additionalProperties: false,
    },
  },
  {
    name: 'telfin_list_calls',
    description:
      'List recent call history for this tenant: direction, duration, status, and summary when present. Newest first.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Max rows to return (1–100). Default 25.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'telfin_get_call',
    description:
      'Fetch one call by id for this tenant, including a transcript excerpt (truncated). Returns not-found if the call is missing or belongs to another tenant.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        call_id: { type: 'string', description: 'Call UUID.' },
      },
      required: ['call_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'telfin_list_numbers',
    description:
      'List this tenant’s phone numbers (DIDs) with purpose and provision status. Released numbers are omitted.',
    scope: 'read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'telfin_send_sms',
    description:
      'Send an SMS from this tenant’s provisioned number. Fails with a clear “not enabled” error when the plan, DID, or SMS carrier is not configured. Requires a write-scope API key. Do not use this for bulk/spam outreach.',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Destination phone in E.164.' },
        body: { type: 'string', description: 'SMS body (required).' },
      },
      required: ['to', 'body'],
      additionalProperties: false,
    },
  },
];

export const MCP_TOOL_NAMES: McpToolName[] = MCP_TOOLS.map((t) => t.name);

export function getMcpTool(name: string): McpToolDef | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

export function listMcpToolsForClient(): Array<{
  name: string;
  description: string;
  inputSchema: McpToolDef['inputSchema'];
}> {
  return MCP_TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}
