// ============================================================
// Tenant-scoped store interface for MCP tools.
// Real impl talks to Postgres; tests inject an in-memory fake.
// Every method takes tenantId — never infer it from the payload.
// ============================================================

export interface McpWhoami {
  tenantId: string;
  name: string;
  slug: string;
  plan: string;
  planName: string | null;
  timezone: string;
  vertical: string;
  scope: 'read' | 'write';
}

export interface McpLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  business: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
}

export interface CreateLeadInput {
  name?: string;
  phone: string;
  email?: string;
  business?: string;
  notes?: string;
}

export interface McpCallListItem {
  id: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  durationSeconds: number | null;
  summary: string | null;
  startedAt: string | null;
}

export interface McpCallDetail extends McpCallListItem {
  outcome: string | null;
  transcriptExcerpt: string | null;
}

export interface McpNumber {
  id: string;
  phoneE164: string;
  purpose: string;
  provisionStatus: string;
  isPrimary: boolean;
  numberType: string;
}

export type SendSmsStoreResult =
  | { ok: true; messageId: string }
  | { ok: false; code: string; message: string };

export interface McpStore {
  getWhoami(tenantId: string, scope: 'read' | 'write'): Promise<McpWhoami | null>;
  listLeads(tenantId: string, opts: { since?: Date; limit: number }): Promise<McpLead[]>;
  createLead(tenantId: string, input: CreateLeadInput): Promise<McpLead>;
  listCalls(tenantId: string, opts: { limit: number }): Promise<McpCallListItem[]>;
  getCall(tenantId: string, callId: string): Promise<McpCallDetail | null>;
  listNumbers(tenantId: string): Promise<McpNumber[]>;
  sendSms(tenantId: string, input: { to: string; body: string }): Promise<SendSmsStoreResult>;
}

export const PHONE_E164 = /^\+\d{8,15}$/;
export const DEFAULT_LIST_LIMIT = 25;
export const MAX_LIST_LIMIT = 100;
export const TRANSCRIPT_EXCERPT_CHARS = 4000;

export function clampLimit(value: unknown, fallback = DEFAULT_LIST_LIMIT): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_LIST_LIMIT);
}

export function parseSince(value: unknown): Date | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error('since must be an ISO 8601 string');
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error('since is not a valid ISO 8601 date');
  }
  return d;
}

export function splitPersonName(name: string | undefined): { firstName: string; lastName: string } {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { firstName: 'MCP', lastName: 'Lead' };
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed, lastName: 'Lead' };
  const last = trimmed.slice(space + 1).trim();
  return { firstName: trimmed.slice(0, space), lastName: last || 'Lead' };
}

export function excerptTranscript(transcript: unknown, max = TRANSCRIPT_EXCERPT_CHARS): string | null {
  if (transcript == null) return null;
  let text: string;
  if (typeof transcript === 'string') {
    text = transcript;
  } else if (Array.isArray(transcript)) {
    text = transcript
      .map((line) => {
        if (typeof line === 'string') return line;
        if (line && typeof line === 'object') {
          const rec = line as { role?: unknown; text?: unknown };
          const role = typeof rec.role === 'string' ? rec.role : '?';
          const body = typeof rec.text === 'string' ? rec.text : '';
          return `${role}: ${body}`.trim();
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  } else {
    try {
      text = JSON.stringify(transcript);
    } catch {
      return null;
    }
  }
  const clipped = text.trim();
  if (!clipped) return null;
  return clipped.length > max ? `${clipped.slice(0, max)}…` : clipped;
}

export function composeLeadNotes(business?: string, notes?: string): string | null {
  const parts: string[] = [];
  const biz = (business ?? '').trim();
  const n = (notes ?? '').trim();
  if (biz) parts.push(`Business: ${biz}`);
  if (n) parts.push(n);
  return parts.length > 0 ? parts.join('\n') : null;
}

export function parseLeadName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
