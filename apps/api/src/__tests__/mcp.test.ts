// ============================================================
// Telfin MCP v1 — auth, tool list, create_lead, tenant isolation.
// In-memory store only. Does not import Fastify, db, or config.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  displayKeyHint,
  MCP_API_KEY_SCHEME,
  PUBLIC_API_KEY_SCHEME,
} from '../modules/public-api/api-key.crypto.js';
import { authorizeMcpHeaders } from '../modules/mcp/mcp.auth.js';
import { dispatchMcpRequest, parseJsonRpc } from '../modules/mcp/mcp.protocol.js';
import { callMcpTool } from '../modules/mcp/mcp.handlers.js';
import {
  MCP_TOOL_NAMES,
  listMcpToolsForClient,
  getMcpTool,
} from '../modules/mcp/mcp.tools.js';
import {
  excerptTranscript,
  splitPersonName,
  type CreateLeadInput,
  type McpCallDetail,
  type McpLead,
  type McpNumber,
  type McpStore,
  type McpWhoami,
  type SendSmsStoreResult,
} from '../modules/mcp/mcp.store.js';
import type { McpAuthContext } from '../modules/mcp/mcp.types.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function auth(tenantId: string, scope: 'read' | 'write' = 'write'): McpAuthContext {
  return { tenantId, scope, keyId: `key-${tenantId}` };
}

class MemoryMcpStore implements McpStore {
  tenants = new Map<string, Omit<McpWhoami, 'scope'>>();
  leads: McpLead[] = [];
  calls: McpCallDetail[] = [];
  numbers: Array<McpNumber & { tenantId: string }> = [];
  smsEnabled = true;
  created: McpLead[] = [];

  constructor() {
    this.tenants.set('tenant-a', {
      tenantId: 'tenant-a',
      name: 'Riverside Dental',
      slug: 'riverside-dental',
      plan: 'growth',
      planName: 'Growth',
      timezone: 'America/Los_Angeles',
      vertical: 'dental',
    });
    this.tenants.set('tenant-b', {
      tenantId: 'tenant-b',
      name: 'Apex Insurance',
      slug: 'apex-insurance',
      plan: 'trial',
      planName: 'Trial',
      timezone: 'America/New_York',
      vertical: 'insurance',
    });
  }

  async getWhoami(tenantId: string, scope: 'read' | 'write') {
    const row = this.tenants.get(tenantId);
    return row ? { ...row, scope } : null;
  }

  async listLeads(tenantId: string, opts: { since?: Date; limit: number }) {
    return this.leads
      .filter((l) => l.id.startsWith(tenantId) || this.leadTenant(l) === tenantId)
      .filter((l) => !opts.since || new Date(l.createdAt) >= opts.since)
      .slice(0, opts.limit);
  }

  private leadTenant(lead: McpLead): string {
    return (lead as McpLead & { tenantId?: string }).tenantId ?? lead.id.split(':')[0]!;
  }

  async createLead(tenantId: string, input: CreateLeadInput) {
    const existing = this.leads.find(
      (l) => this.leadTenant(l) === tenantId && l.phone === input.phone
    );
    if (existing) return existing;
    const lead: McpLead & { tenantId: string } = {
      id: `${tenantId}:${this.leads.length + 1}`,
      tenantId,
      name: input.name?.trim() || 'MCP Lead',
      phone: input.phone,
      email: input.email ?? null,
      business: input.business ?? null,
      notes: input.notes ?? null,
      source: 'mcp',
      createdAt: new Date().toISOString(),
    };
    this.leads.push(lead);
    this.created.push(lead);
    return lead;
  }

  async listCalls(tenantId: string, opts: { limit: number }) {
    return this.calls.filter((c) => c.id.startsWith(tenantId)).slice(0, opts.limit);
  }

  async getCall(tenantId: string, callId: string) {
    return this.calls.find((c) => c.id === callId && c.id.startsWith(tenantId)) ?? null;
  }

  async listNumbers(tenantId: string) {
    return this.numbers.filter((n) => n.tenantId === tenantId);
  }

  async sendSms(tenantId: string, input: { to: string; body: string }): Promise<SendSmsStoreResult> {
    if (!this.smsEnabled || tenantId === 'tenant-b') {
      return {
        ok: false,
        code: 'SmsNotEnabled',
        message: 'SMS is not enabled for this tenant. Two-way SMS requires the Growth plan or above.',
      };
    }
    return { ok: true, messageId: `msg-${tenantId}-${input.to}` };
  }
}

describe('API key schemes', () => {
  it('mints telfin_sk_ and ark_live_ tokens and hashes them', () => {
    const mcp = generateApiKey(MCP_API_KEY_SCHEME);
    const rest = generateApiKey(PUBLIC_API_KEY_SCHEME);
    expect(mcp.rawToken.startsWith('telfin_sk_')).toBe(true);
    expect(rest.rawToken.startsWith('ark_live_')).toBe(true);
    expect(looksLikeApiKey(mcp.rawToken)).toBe(true);
    expect(looksLikeApiKey(rest.rawToken)).toBe(true);
    expect(hashApiKey(mcp.rawToken)).toHaveLength(64);
    expect(hashApiKey(mcp.rawToken)).not.toBe(mcp.rawToken);
    expect(mcp.prefix.startsWith('telfin_sk_')).toBe(true);
  });

  it('rejects non-keys', () => {
    expect(looksLikeApiKey('')).toBe(false);
    expect(looksLikeApiKey('sk-openai-xxx')).toBe(false);
    expect(looksLikeApiKey('Bearer telfin_sk_abc')).toBe(false);
  });

  it('formats stored prefixes for the UI without leaking the secret', () => {
    expect(displayKeyHint('a1b2c3d4')).toBe('ark_live_a1b2c3d4…');
    expect(displayKeyHint('telfin_sk_deadbeef')).toBe('telfin_sk_deadbeef…');
    expect(displayKeyHint('ark_live_cafed00d')).toBe('ark_live_cafed00d…');
  });
});

describe('MCP auth rejection', () => {
  const lookup = async (token: string) => {
    if (token === 'telfin_sk_good') {
      return { tenantId: 'tenant-a', scope: 'write' as const, keyId: 'k1' };
    }
    if (token === 'ark_live_good') {
      return { tenantId: 'tenant-a', scope: 'read' as const, keyId: 'k2' };
    }
    return null;
  };

  it('rejects missing API key', async () => {
    const result = await authorizeMcpHeaders({}, lookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
    expect(result.body.error.message).toMatch(/API key required/);
  });

  it('rejects wrong prefix', async () => {
    const result = await authorizeMcpHeaders({ authorization: 'Bearer sk-other' }, lookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
    expect(result.body.error.message).toMatch(/Invalid API key format/);
  });

  it('rejects unknown hashed key', async () => {
    const result = await authorizeMcpHeaders({ authorization: 'Bearer telfin_sk_nope' }, lookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
    expect(result.body.error.message).toMatch(/Invalid, revoked, or expired/);
  });

  it('accepts Bearer telfin_sk_ and X-API-Key ark_live_', async () => {
    const a = await authorizeMcpHeaders({ authorization: 'Bearer telfin_sk_good' }, lookup);
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.auth.tenantId).toBe('tenant-a');

    const b = await authorizeMcpHeaders({ 'x-api-key': 'ark_live_good' }, lookup);
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.auth.scope).toBe('read');
  });
});

describe('MCP tools/list shape', () => {
  it('exposes exactly the v1 tool names', () => {
    expect(MCP_TOOL_NAMES).toEqual([
      'telfin_whoami',
      'telfin_list_leads',
      'telfin_create_lead',
      'telfin_list_calls',
      'telfin_get_call',
      'telfin_list_numbers',
      'telfin_send_sms',
    ]);
  });

  it('returns JSON-schema tools without write secrets', async () => {
    const store = new MemoryMcpStore();
    const dispatched = await dispatchMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      auth('tenant-a'),
      store
    );
    expect(dispatched.kind).toBe('response');
    if (dispatched.kind !== 'response') return;
    expect('result' in dispatched.response).toBe(true);
    const result = (dispatched.response as { result: { tools: Array<{ name: string; inputSchema: unknown }> } }).result;
    const names = result.tools.map((t) => t.name);
    expect(names).toEqual(MCP_TOOL_NAMES);
    for (const tool of result.tools) {
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
    }
    expect(names).not.toContain('telfin_place_call');
    expect(names).not.toContain('place_call');
  });

  it('marks create_lead and send_sms as write-scoped', () => {
    expect(getMcpTool('telfin_create_lead')?.scope).toBe('write');
    expect(getMcpTool('telfin_send_sms')?.scope).toBe('write');
    expect(getMcpTool('telfin_whoami')?.scope).toBe('read');
  });
});

describe('MCP initialize / whoami', () => {
  it('negotiates protocol version and serverInfo', async () => {
    const store = new MemoryMcpStore();
    const dispatched = await dispatchMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
      },
      auth('tenant-a'),
      store
    );
    expect(dispatched.kind).toBe('response');
    if (dispatched.kind !== 'response' || !('result' in dispatched.response)) return;
    const result = dispatched.response.result as {
      protocolVersion: string;
      serverInfo: { name: string };
      capabilities: { tools: unknown };
    };
    expect(result.protocolVersion).toBe('2025-03-26');
    expect(result.serverInfo.name).toBe('telfin');
    expect(result.capabilities.tools).toBeTruthy();
  });

  it('whoami returns tenant name, plan, timezone', async () => {
    const store = new MemoryMcpStore();
    const result = await callMcpTool('telfin_whoami', {}, auth('tenant-a', 'read'), store);
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0]!.text) as { name: string; plan: string; timezone: string };
    expect(payload.name).toBe('Riverside Dental');
    expect(payload.plan).toBe('growth');
    expect(payload.timezone).toBe('America/Los_Angeles');
  });
});

describe('create_lead persistence + tenant isolation', () => {
  it('persists a lead with source=mcp on the calling tenant only', async () => {
    const store = new MemoryMcpStore();
    const created = await callMcpTool(
      'telfin_create_lead',
      { name: 'Jamie Rivera', phone: '+14155550100', email: 'jamie@example.com', business: 'Rivera DDS', notes: 'From Claude' },
      auth('tenant-a'),
      store
    );
    expect(created.isError).toBeUndefined();
    const lead = JSON.parse(created.content[0]!.text) as McpLead;
    expect(lead.source).toBe('mcp');
    expect(lead.phone).toBe('+14155550100');
    expect(lead.name).toBe('Jamie Rivera');
    expect(store.created).toHaveLength(1);
    expect(store.created[0]?.phone).toBe('+14155550100');

    store.leads.push({
      id: 'tenant-b:secret',
      name: 'Other Tenant Lead',
      phone: '+14155550999',
      email: null,
      business: null,
      notes: null,
      source: 'manual',
      createdAt: new Date().toISOString(),
    });

    const listA = await callMcpTool('telfin_list_leads', { limit: 50 }, auth('tenant-a', 'read'), store);
    const payloadA = JSON.parse(listA.content[0]!.text) as { data: McpLead[] };
    expect(payloadA.data.map((l) => l.phone)).toContain('+14155550100');
    expect(payloadA.data.map((l) => l.phone)).not.toContain('+14155550999');

    const listB = await callMcpTool('telfin_list_leads', { limit: 50 }, auth('tenant-b', 'read'), store);
    const payloadB = JSON.parse(listB.content[0]!.text) as { data: McpLead[] };
    expect(payloadB.data.map((l) => l.phone)).toContain('+14155550999');
    expect(payloadB.data.map((l) => l.phone)).not.toContain('+14155550100');
  });

  it('does not leak tenant-b calls to tenant-a', async () => {
    const store = new MemoryMcpStore();
    store.calls.push({
      id: 'tenant-b:call-1',
      direction: 'inbound',
      fromNumber: '+15551212',
      toNumber: '+15550000',
      status: 'completed',
      durationSeconds: 42,
      summary: 'secret summary',
      startedAt: new Date().toISOString(),
      outcome: 'booked',
      transcriptExcerpt: 'do not leak',
    });
    const missing = await callMcpTool('telfin_get_call', { call_id: 'tenant-b:call-1' }, auth('tenant-a'), store);
    expect(missing.isError).toBe(true);
    expect(missing.content[0]!.text).toMatch(/not found for this tenant/);
  });

  it('rejects create_lead on a read-only key', async () => {
    const store = new MemoryMcpStore();
    const result = await callMcpTool(
      'telfin_create_lead',
      { phone: '+14155550111' },
      auth('tenant-a', 'read'),
      store
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/read-only scope/);
    expect(store.created).toHaveLength(0);
  });

  it('rejects invalid phone', async () => {
    const store = new MemoryMcpStore();
    const result = await callMcpTool(
      'telfin_create_lead',
      { phone: '415-555-0111' },
      auth('tenant-a'),
      store
    );
    expect(result.isError).toBe(true);
    expect(store.created).toHaveLength(0);
  });
});

describe('telfin_send_sms', () => {
  it('returns a clear not-enabled error instead of inventing carrier behavior', async () => {
    const store = new MemoryMcpStore();
    const result = await callMcpTool(
      'telfin_send_sms',
      { to: '+14155550100', body: 'Hello' },
      auth('tenant-b'),
      store
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/SMS is not enabled/);
  });
});

describe('helpers', () => {
  it('splits names and excerpts transcripts', () => {
    expect(splitPersonName('Jamie Rivera')).toEqual({ firstName: 'Jamie', lastName: 'Rivera' });
    expect(splitPersonName('Jamie')).toEqual({ firstName: 'Jamie', lastName: 'Lead' });
    expect(excerptTranscript([{ role: 'user', text: 'hi' }, { role: 'agent', text: 'hello' }])).toBe(
      'user: hi\nagent: hello'
    );
    expect(excerptTranscript(null)).toBeNull();
  });

  it('rejects JSON-RPC batches', () => {
    const parsed = parseJsonRpc([{ jsonrpc: '2.0', id: 1, method: 'ping' }]);
    expect('error' in parsed).toBe(true);
  });
});

describe('MCP wiring — no outbound spam, no demo cooldown', () => {
  it('does not wrap mcp.router in fastify-plugin', () => {
    const src = readFileSync(join(srcRoot, 'modules/mcp/mcp.router.ts'), 'utf8');
    expect(src).not.toMatch(/export const mcpPlugin = fp\(/);
    expect(src).toContain("'/mcp'");
    expect(src).toContain("'/api/v1/mcp'");
  });

  it('registers the plugin from main.ts', () => {
    const main = readFileSync(join(srcRoot, 'main.ts'), 'utf8');
    expect(main).toMatch(/mcpPlugin/);
    expect(main).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });

  it('MCP module does not dial, skip demo cooldown, or expose campaign tools', () => {
    const dir = join(srcRoot, 'modules/mcp');
    const files = ['mcp.router.ts', 'mcp.handlers.ts', 'mcp.tools.ts', 'mcp.protocol.ts', 'mcp.db-store.ts'];
    const blob = files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    expect(blob).not.toContain('DEMO_SKIP_COOLDOWN');
    expect(blob).not.toContain('dialDirect');
    expect(blob).not.toMatch(/name:\s*['"]telfin_place_call['"]/);
    expect(listMcpToolsForClient().map((t) => t.name)).not.toContain('telfin_place_call');
    expect(listMcpToolsForClient().map((t) => t.name)).not.toContain('telfin_create_campaign');
  });
});
