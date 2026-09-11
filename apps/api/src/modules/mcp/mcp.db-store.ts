// ============================================================
// Drizzle-backed MCP store. Every query is tenant-scoped.
// ============================================================
import { db } from '../../db/client.js';
import { calls, contacts, tenantPhoneNumbers, tenants } from '../../db/schema.js';
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { getPlan } from '@ai-receptionist/shared';
import { sendTenantSms } from '../sms/send-tenant-sms.js';
import {
  composeLeadNotes,
  excerptTranscript,
  parseLeadName,
  splitPersonName,
  type CreateLeadInput,
  type McpCallDetail,
  type McpLead,
  type McpStore,
  type McpWhoami,
} from './mcp.store.js';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

function contactToLead(row: {
  id: string;
  firstName: string;
  lastName: string;
  phoneE164: string;
  email: string | null;
  notes: string | null;
  source: string;
  createdAt: Date;
}): McpLead {
  const notes = row.notes;
  const businessMatch = notes?.match(/^Business:\s*(.+)$/m);
  return {
    id: row.id,
    name: parseLeadName(row.firstName, row.lastName),
    phone: row.phoneE164,
    email: row.email,
    business: businessMatch?.[1]?.trim() ?? null,
    notes,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

export const drizzleMcpStore: McpStore = {
  async getWhoami(tenantId, scope): Promise<McpWhoami | null> {
    const [row] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        plan: tenants.plan,
        timezone: tenants.timezone,
        vertical: tenants.vertical,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!row) return null;
    const plan = getPlan(row.plan);
    return {
      tenantId: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      planName: plan?.name ?? null,
      timezone: row.timezone,
      vertical: row.vertical,
      scope,
    };
  },

  async listLeads(tenantId, opts) {
    const conditions = [eq(contacts.tenantId, tenantId)];
    if (opts.since) conditions.push(gte(contacts.createdAt, opts.since));
    const rows = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phoneE164: contacts.phoneE164,
        email: contacts.email,
        notes: contacts.notes,
        source: contacts.source,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.createdAt))
      .limit(opts.limit);
    return rows.map(contactToLead);
  },

  async createLead(tenantId, input: CreateLeadInput) {
    const { firstName, lastName } = splitPersonName(input.name);
    const notes = composeLeadNotes(input.business, input.notes);
    const values = {
      tenantId,
      firstName,
      lastName,
      phoneE164: input.phone,
      email: input.email ?? null,
      notes,
      source: 'mcp',
      contactType: 'lead',
    };
    try {
      const [created] = await db.insert(contacts).values(values).returning({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phoneE164: contacts.phoneE164,
        email: contacts.email,
        notes: contacts.notes,
        source: contacts.source,
        createdAt: contacts.createdAt,
      });
      if (!created) throw new Error('Failed to create lead');
      return contactToLead(created);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const [existing] = await db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          phoneE164: contacts.phoneE164,
          email: contacts.email,
          notes: contacts.notes,
          source: contacts.source,
          createdAt: contacts.createdAt,
        })
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, input.phone)))
        .limit(1);
      if (!existing) throw err;
      return contactToLead(existing);
    }
  },

  async listCalls(tenantId, opts) {
    const rows = await db
      .select({
        id: calls.id,
        direction: calls.direction,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        status: calls.status,
        durationSeconds: calls.durationSeconds,
        summary: calls.summary,
        startedAt: calls.startedAt,
      })
      .from(calls)
      .where(eq(calls.tenantId, tenantId))
      .orderBy(desc(calls.startedAt))
      .limit(opts.limit);
    return rows.map((row) => ({
      id: row.id,
      direction: row.direction,
      fromNumber: row.fromNumber,
      toNumber: row.toNumber,
      status: row.status,
      durationSeconds: row.durationSeconds,
      summary: row.summary,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    }));
  },

  async getCall(tenantId, callId): Promise<McpCallDetail | null> {
    const [row] = await db
      .select({
        id: calls.id,
        direction: calls.direction,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        status: calls.status,
        durationSeconds: calls.durationSeconds,
        summary: calls.summary,
        startedAt: calls.startedAt,
        outcome: calls.outcome,
        transcript: calls.transcript,
      })
      .from(calls)
      .where(and(eq(calls.id, callId), eq(calls.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      direction: row.direction,
      fromNumber: row.fromNumber,
      toNumber: row.toNumber,
      status: row.status,
      durationSeconds: row.durationSeconds,
      summary: row.summary,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      outcome: row.outcome,
      transcriptExcerpt: excerptTranscript(row.transcript),
    };
  },

  async listNumbers(tenantId) {
    const rows = await db
      .select({
        id: tenantPhoneNumbers.id,
        phoneE164: tenantPhoneNumbers.phoneE164,
        purpose: tenantPhoneNumbers.purpose,
        provisionStatus: tenantPhoneNumbers.provisionStatus,
        isPrimary: tenantPhoneNumbers.isPrimary,
        numberType: tenantPhoneNumbers.numberType,
      })
      .from(tenantPhoneNumbers)
      .where(and(eq(tenantPhoneNumbers.tenantId, tenantId), isNull(tenantPhoneNumbers.releasedAt)))
      .orderBy(desc(tenantPhoneNumbers.isPrimary), desc(tenantPhoneNumbers.purchasedAt));
    return rows;
  },

  async sendSms(tenantId, input) {
    const result = await sendTenantSms({ tenantId, to: input.to, body: input.body });
    if (result.ok) return { ok: true, messageId: result.messageId };
    return { ok: false, code: result.code, message: result.message };
  },
};
