// ============================================================
// Agent service — detectors + approval/execution flow.
//
// The dashboard agent surfaces actionable recommendations to the
// operator. Detectors run on a schedule (see agent-scanner.worker.ts)
// and write rows to `agent_suggestions`. The dashboard reads pending
// rows, the operator approves them, and this service executes the
// action through existing infrastructure (campaigns, SMS, etc.).
//
// Design principles:
//   1. Suggest > Execute. Operator approval is the default; tenant must
//      explicitly opt in to auto-execute, and HIPAA-mode tenants can't.
//   2. Detectors are idempotent. We use a `dedupe_key` per source entity
//      so the scanner can run hourly without creating duplicates.
//   3. The exact action script is captured in `payload.script` so the
//      operator sees what the AI will say BEFORE approving.
// ============================================================
import { db } from '../../db/client.js';
import {
  agentSuggestions,
  tenants,
  calls,
  contacts,
  appointments,
  outboundCampaigns,
  campaignContacts,
  smsMessages,
  type AgentSuggestion,
} from '../../db/schema.js';
import { eq, and, sql, desc, lt, gte, isNull, inArray } from 'drizzle-orm';
import { outboundDialerQueue } from '../../queue/queues.js';
import { sendSms } from '../notifications/adapters/telnyx-sms.adapter.js';
import { pushActivity } from '../activity/activity.service.js';
import { isPromoTrialCapped } from '../billing/usage.service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import pino from 'pino';

const logger = pino({ name: 'agent.service' });

export type AgentSuggestionType =
  | 'missed_call_callback'
  | 'appointment_confirmation'
  | 'stale_lead_followup'
  | 'no_show_recapture';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPhone(e164: string): string {
  // +12125551234 → (212) 555-1234
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

function contactDisplayName(c: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!c) return 'Unknown contact';
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Unknown contact';
}

// ── Detectors ───────────────────────────────────────────────────────────────
// Each detector returns an array of `NewAgentSuggestion`-shaped rows.
// They share these conventions:
//   • dedupeKey is the source entity ID (callId / appointmentId / contactId)
//     so a re-run won't create duplicates while a pending row exists.
//   • payload.script is the customer-facing message the AI/SMS will use.

interface MissedCallRow {
  callId: string;
  fromNumber: string;
  startedAt: Date | null;
  contactId: string | null;
  firstName: string | null;
  lastName: string | null;
}

async function detectMissedCallbacks(tenantId: string): Promise<Array<{
  type: AgentSuggestionType;
  dedupeKey: string;
  payload: Record<string, unknown>;
}>> {
  // Calls in the last 24h that didn't reach a human and haven't been
  // called back by an outbound campaign yet.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = (await db
    .select({
      callId: calls.id,
      fromNumber: calls.fromNumber,
      startedAt: calls.startedAt,
      contactId: calls.contactId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
    })
    .from(calls)
    .leftJoin(contacts, eq(calls.contactId, contacts.id))
    .where(
      and(
        eq(calls.tenantId, tenantId),
        eq(calls.direction, 'inbound'),
        inArray(calls.status, ['missed', 'no_answer', 'failed']),
        gte(calls.startedAt, since)
      )
    )
    .limit(50)) as MissedCallRow[];

  return rows.map((row) => {
    const name = contactDisplayName(row);
    const phone = formatPhone(row.fromNumber);
    return {
      type: 'missed_call_callback' as const,
      dedupeKey: `call:${row.callId}`,
      payload: {
        callId: row.callId,
        fromNumber: row.fromNumber,
        contactId: row.contactId,
        contactName: name,
        phoneDisplay: phone,
        missedAt: row.startedAt?.toISOString() ?? null,
        script:
          `Hi${row.firstName ? ` ${row.firstName}` : ''}, this is the AI receptionist calling back ` +
          `from your earlier call. We didn't have a chance to connect — I'd love to help you with ` +
          `whatever you needed. Is now a good time to talk?`,
      },
    };
  });
}

async function detectAppointmentConfirmations(tenantId: string): Promise<Array<{
  type: AgentSuggestionType;
  dedupeKey: string;
  payload: Record<string, unknown>;
}>> {
  // Appointments scheduled to start in the next 12–36 hours that haven't
  // been confirmed yet (no 24h reminder sent + status still 'confirmed' default).
  const now = new Date();
  const start = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const rows = await db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      appointmentType: appointments.appointmentType,
      contactId: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phoneE164,
      reminder24hSent: appointments.reminder24hSent,
    })
    .from(appointments)
    .innerJoin(contacts, eq(appointments.contactId, contacts.id))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
        eq(appointments.reminder24hSent, false),
        inArray(appointments.status, ['confirmed', 'pending'])
      )
    )
    .limit(50);

  return rows.map((row) => {
    const firstName = row.firstName ?? '';
    const time = row.startsAt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    return {
      type: 'appointment_confirmation' as const,
      dedupeKey: `appt:${row.appointmentId}`,
      payload: {
        appointmentId: row.appointmentId,
        contactId: row.contactId,
        contactName: contactDisplayName(row),
        phone: row.phone,
        phoneDisplay: formatPhone(row.phone),
        startsAt: row.startsAt.toISOString(),
        startsAtDisplay: time,
        appointmentType: row.appointmentType,
        script:
          `Hi${firstName ? ` ${firstName}` : ''}, just a friendly reminder about your ` +
          `${row.appointmentType} on ${time}. Reply YES to confirm or call us if you need to reschedule.`,
      },
    };
  });
}

async function detectStaleLeads(tenantId: string): Promise<Array<{
  type: AgentSuggestionType;
  dedupeKey: string;
  payload: Record<string, unknown>;
}>> {
  // Contacts created 5–30 days ago with no follow-up call (no outbound or
  // inbound call linked to them since creation). Caps at 25 / tenant / run.
  const minAge = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const maxAge = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db.execute(sql`
    SELECT
      c.id          AS contact_id,
      c.first_name  AS first_name,
      c.last_name   AS last_name,
      c.phone_e164  AS phone,
      c.created_at  AS created_at
    FROM contacts c
    WHERE c.tenant_id = ${tenantId}
      AND c.created_at <= ${minAge}
      AND c.created_at >= ${maxAge}
      AND NOT EXISTS (
        SELECT 1 FROM calls k
        WHERE k.contact_id = c.id
          AND k.tenant_id = c.tenant_id
          AND k.started_at > c.created_at
      )
    ORDER BY c.created_at ASC
    LIMIT 25
  `);

  // pg driver returns objects with snake_case keys
  const list = (rows as unknown as { rows: Array<Record<string, unknown>> }).rows ?? (rows as unknown as Array<Record<string, unknown>>);

  return (list as Array<Record<string, unknown>>).map((row) => {
    const first = (row['first_name'] as string | null) ?? null;
    const last = (row['last_name'] as string | null) ?? null;
    const phone = (row['phone'] as string) ?? '';
    return {
      type: 'stale_lead_followup' as const,
      dedupeKey: `contact:${row['contact_id'] as string}`,
      payload: {
        contactId: row['contact_id'],
        contactName: contactDisplayName({ firstName: first, lastName: last }),
        phone,
        phoneDisplay: formatPhone(phone),
        createdAt: (row['created_at'] as Date | string | null)?.toString() ?? null,
        script:
          `Hi${first ? ` ${first}` : ''}, this is a follow-up from our practice. ` +
          `We noticed you reached out a few days ago and wanted to check in — is there anything ` +
          `we can help you schedule today?`,
      },
    };
  });
}

async function detectNoShowRecaptures(tenantId: string): Promise<Array<{
  type: AgentSuggestionType;
  dedupeKey: string;
  payload: Record<string, unknown>;
}>> {
  // Appointments in the last 72h with status 'no_show'.
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const rows = await db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      appointmentType: appointments.appointmentType,
      contactId: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phoneE164,
    })
    .from(appointments)
    .innerJoin(contacts, eq(appointments.contactId, contacts.id))
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, 'no_show'),
        gte(appointments.startsAt, since)
      )
    )
    .limit(25);

  return rows.map((row) => {
    const firstName = row.firstName ?? '';
    return {
      type: 'no_show_recapture' as const,
      dedupeKey: `noshow:${row.appointmentId}`,
      payload: {
        appointmentId: row.appointmentId,
        contactId: row.contactId,
        contactName: contactDisplayName(row),
        phone: row.phone,
        phoneDisplay: formatPhone(row.phone),
        missedAt: row.startsAt.toISOString(),
        appointmentType: row.appointmentType,
        script:
          `Hi${firstName ? ` ${firstName}` : ''}, we noticed you missed your recent ` +
          `${row.appointmentType}. No problem — would you like to reschedule? Reply with a ` +
          `day that works for you and we'll find a time.`,
      },
    };
  });
}

// ── Scan: orchestrates all detectors for one tenant ─────────────────────────

export interface ScanResult {
  tenantId: string;
  detected: number;
  inserted: number;
  byType: Record<AgentSuggestionType, number>;
}

export async function scanTenant(tenantId: string): Promise<ScanResult> {
  // Skip disabled tenants up-front.
  const [tenant] = await db
    .select({ agentEnabled: tenants.agentEnabled, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant || !tenant.isActive || !tenant.agentEnabled) {
    return {
      tenantId,
      detected: 0,
      inserted: 0,
      byType: {
        missed_call_callback: 0,
        appointment_confirmation: 0,
        stale_lead_followup: 0,
        no_show_recapture: 0,
      },
    };
  }

  const [missed, confirms, stale, noShow] = await Promise.all([
    detectMissedCallbacks(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'detectMissedCallbacks failed');
      return [] as Awaited<ReturnType<typeof detectMissedCallbacks>>;
    }),
    detectAppointmentConfirmations(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'detectAppointmentConfirmations failed');
      return [] as Awaited<ReturnType<typeof detectAppointmentConfirmations>>;
    }),
    detectStaleLeads(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'detectStaleLeads failed');
      return [] as Awaited<ReturnType<typeof detectStaleLeads>>;
    }),
    detectNoShowRecaptures(tenantId).catch((err) => {
      logger.error({ err, tenantId }, 'detectNoShowRecaptures failed');
      return [] as Awaited<ReturnType<typeof detectNoShowRecaptures>>;
    }),
  ]);

  const all = [...missed, ...confirms, ...stale, ...noShow];
  const byType: Record<AgentSuggestionType, number> = {
    missed_call_callback: missed.length,
    appointment_confirmation: confirms.length,
    stale_lead_followup: stale.length,
    no_show_recapture: noShow.length,
  };

  let inserted = 0;
  for (const item of all) {
    // ON CONFLICT DO NOTHING via the partial unique index on (tenant, type, dedupeKey)
    // where status='pending'. Drizzle doesn't expose it neatly, so we use raw SQL.
    try {
      const result = await db.execute(sql`
        INSERT INTO agent_suggestions (tenant_id, type, status, dedupe_key, payload)
        VALUES (${tenantId}, ${item.type}, 'pending', ${item.dedupeKey}, ${JSON.stringify(item.payload)}::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING id
      `);
      const ret = (result as unknown as { rows?: Array<unknown> }).rows ?? (result as unknown as Array<unknown>);
      if ((ret as Array<unknown>).length > 0) inserted++;
    } catch (err) {
      logger.warn({ err, tenantId, type: item.type, dedupeKey: item.dedupeKey }, 'suggestion insert skipped');
    }
  }

  logger.info({ tenantId, detected: all.length, inserted, byType }, 'Agent scan complete');

  return { tenantId, detected: all.length, inserted, byType };
}

// ── List / fetch ────────────────────────────────────────────────────────────

export async function listSuggestions(
  tenantId: string,
  options: { status?: string; limit?: number } = {}
): Promise<AgentSuggestion[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const status = options.status ?? 'pending';

  return db
    .select()
    .from(agentSuggestions)
    .where(and(eq(agentSuggestions.tenantId, tenantId), eq(agentSuggestions.status, status)))
    .orderBy(desc(agentSuggestions.suggestedAt))
    .limit(limit);
}

export async function getSuggestion(
  id: string,
  tenantId: string
): Promise<AgentSuggestion | null> {
  const [row] = await db
    .select()
    .from(agentSuggestions)
    .where(and(eq(agentSuggestions.id, id), eq(agentSuggestions.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

// ── Approve / skip / execute ────────────────────────────────────────────────

export async function skipSuggestion(
  id: string,
  tenantId: string,
  userId: string
): Promise<AgentSuggestion> {
  const existing = await getSuggestion(id, tenantId);
  if (!existing) throw new NotFoundError('Suggestion not found');
  if (existing.status !== 'pending') {
    throw new ValidationError(`Suggestion is ${existing.status}, can't be skipped`);
  }

  const [updated] = await db
    .update(agentSuggestions)
    .set({ status: 'skipped', decidedAt: new Date(), decidedBy: userId })
    .where(eq(agentSuggestions.id, id))
    .returning();

  if (!updated) throw new NotFoundError('Suggestion not found after skip');
  return updated;
}

/**
 * Approve a suggestion. Marks it 'approved' then immediately attempts
 * execution. Each suggestion type executes through different infrastructure:
 *
 *   missed_call_callback → creates a 1-lead outbound campaign and enqueues the dial
 *   appointment_confirmation → sends SMS via Telnyx
 *   stale_lead_followup → creates a 1-lead outbound campaign
 *   no_show_recapture → sends SMS via Telnyx
 */
export async function approveSuggestion(
  id: string,
  tenantId: string,
  userId: string
): Promise<AgentSuggestion> {
  const existing = await getSuggestion(id, tenantId);
  if (!existing) throw new NotFoundError('Suggestion not found');
  if (existing.status !== 'pending') {
    throw new ValidationError(`Suggestion is ${existing.status}, can't be approved`);
  }

  // Mark approved first so the UI updates immediately.
  await db
    .update(agentSuggestions)
    .set({ status: 'approved', decidedAt: new Date(), decidedBy: userId })
    .where(eq(agentSuggestions.id, id));

  // Execute through the matching channel.
  let result: { ok: boolean; detail: string };
  try {
    switch (existing.type) {
      case 'missed_call_callback':
        result = await executeOutboundCallback(existing, tenantId, 'missed_call_callback');
        break;
      case 'stale_lead_followup':
        result = await executeOutboundCallback(existing, tenantId, 'stale_lead_followup');
        break;
      case 'appointment_confirmation':
        result = await executeSmsAction(existing, tenantId);
        break;
      case 'no_show_recapture':
        result = await executeSmsAction(existing, tenantId);
        break;
      default:
        result = { ok: false, detail: `Unknown suggestion type: ${existing.type}` };
    }
  } catch (err) {
    logger.error({ err, suggestionId: id, type: existing.type }, 'Suggestion execution failed');
    result = {
      ok: false,
      detail: err instanceof Error ? err.message : 'Unknown execution error',
    };
  }

  const [updated] = await db
    .update(agentSuggestions)
    .set({
      status: result.ok ? 'executed' : 'failed',
      executedAt: result.ok ? new Date() : null,
      executionResult: { ok: result.ok, detail: result.detail },
    })
    .where(eq(agentSuggestions.id, id))
    .returning();

  if (!updated) throw new NotFoundError('Suggestion not found after execution');

  // Push activity for live dashboard
  void pushActivity(tenantId, {
    type: result.ok ? 'agent_action_executed' : 'agent_action_failed',
    data: {
      suggestionId: id,
      suggestionType: existing.type,
      detail: result.detail,
    },
  } as never);

  return updated;
}

// ── Executors ───────────────────────────────────────────────────────────────

interface CallbackPayload {
  callId?: string;
  contactId?: string | null;
  fromNumber?: string;
  phone?: string;
  contactName?: string;
  script?: string;
}

async function executeOutboundCallback(
  suggestion: AgentSuggestion,
  tenantId: string,
  campaignKind: 'missed_call_callback' | 'stale_lead_followup'
): Promise<{ ok: boolean; detail: string }> {
  const p = (suggestion.payload as CallbackPayload | null) ?? {};
  const phone = p.fromNumber ?? p.phone;
  if (!phone) {
    return { ok: false, detail: 'No phone number on suggestion payload' };
  }

  // Promo-trial cap — refuse to enqueue an outbound call when the tenant
  // has consumed all allotted minutes. Lets the operator know via the
  // failed-execution toast that the cap is the reason.
  if (await isPromoTrialCapped(tenantId)) {
    return { ok: false, detail: 'Promo trial minute cap reached — upgrade to keep dialing' };
  }

  // Use a default placeholder; the actual from-number is resolved by the dial job
  // from tenant_phone_numbers. We just need a campaign + lead row.
  const campaignName =
    campaignKind === 'missed_call_callback'
      ? `Agent callback · ${new Date().toLocaleDateString()}`
      : `Agent follow-up · ${new Date().toLocaleDateString()}`;

  const [campaign] = await db
    .insert(outboundCampaigns)
    .values({
      tenantId,
      name: campaignName,
      fromNumber: 'auto',
      status: 'running',
      totalLeads: 1,
      maxRetries: 1,
      retryDelayMinutes: 60,
      maxConcurrentCalls: 1,
      startedAt: new Date(),
    })
    .returning();

  if (!campaign) {
    return { ok: false, detail: 'Failed to create outbound campaign' };
  }

  // Resolve or create the campaign-contact row.
  const [name1, ...rest] = (p.contactName ?? 'Unknown').split(' ');
  const firstName = name1 ?? 'Unknown';
  const lastName = rest.join(' ') || '';

  const [cc] = await db
    .insert(campaignContacts)
    .values({
      campaignId: campaign.id,
      tenantId,
      contactId: p.contactId ?? null,
      phoneE164: phone,
      firstName,
      lastName,
      email: null,
      status: 'pending',
    })
    .returning();

  if (!cc) {
    return { ok: false, detail: 'Failed to insert campaign contact' };
  }

  await outboundDialerQueue.add('outbound-dial', {
    campaignContactId: cc.id,
    campaignId: campaign.id,
    tenantId,
  });

  logger.info(
    { tenantId, suggestionId: suggestion.id, campaignId: campaign.id, phone },
    'Agent: outbound callback campaign enqueued'
  );

  return {
    ok: true,
    detail: `Outbound callback queued (campaign ${campaign.id})`,
  };
}

interface SmsPayload {
  phone?: string;
  contactId?: string | null;
  script?: string;
}

async function executeSmsAction(
  suggestion: AgentSuggestion,
  tenantId: string
): Promise<{ ok: boolean; detail: string }> {
  const p = (suggestion.payload as SmsPayload | null) ?? {};
  if (!p.phone) {
    return { ok: false, detail: 'No phone number on suggestion payload' };
  }
  if (!p.script) {
    return { ok: false, detail: 'No script on suggestion payload' };
  }

  // Resolve tenant's outbound SMS-capable number (best-effort).
  const messageId = await sendSms(p.phone, p.script);

  // Mirror the message into the SMS inbox so it shows in the conversation.
  await db.insert(smsMessages).values({
    tenantId,
    direction: 'outbound',
    fromNumber: 'agent',
    toNumber: p.phone,
    body: p.script,
    telnyxMessageId: messageId,
    contactId: p.contactId ?? null,
    status: 'sent',
  });

  return { ok: true, detail: `SMS sent (msg ${messageId})` };
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function getAgentSettings(tenantId: string): Promise<{
  agentEnabled: boolean;
  agentAutoExecute: boolean;
  hipaaMode: boolean;
}> {
  const [tenant] = await db
    .select({
      agentEnabled: tenants.agentEnabled,
      agentAutoExecute: tenants.agentAutoExecute,
      hipaaMode: tenants.hipaaMode,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) throw new NotFoundError('Tenant not found');
  return tenant;
}

export async function updateAgentSettings(
  tenantId: string,
  patch: { agentEnabled?: boolean; agentAutoExecute?: boolean }
): Promise<void> {
  // HIPAA tenants can't enable auto-execute.
  const [tenant] = await db
    .select({ hipaaMode: tenants.hipaaMode })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) throw new NotFoundError('Tenant not found');

  if (patch.agentAutoExecute === true && tenant.hipaaMode) {
    throw new ValidationError(
      'Auto-execute is not available for HIPAA-mode tenants. Approvals must be manual.'
    );
  }

  const update: Record<string, unknown> = {};
  if (patch.agentEnabled !== undefined) update['agentEnabled'] = patch.agentEnabled;
  if (patch.agentAutoExecute !== undefined) update['agentAutoExecute'] = patch.agentAutoExecute;

  if (Object.keys(update).length === 0) {
    throw new ValidationError('No settings provided to update');
  }

  await db
    .update(tenants)
    .set(update)
    .where(eq(tenants.id, tenantId));
}

// ── Maintenance: expire stale pending suggestions ───────────────────────────

export async function expireOldSuggestions(): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const result = await db
    .update(agentSuggestions)
    .set({ status: 'expired', decidedAt: new Date() })
    .where(
      and(
        eq(agentSuggestions.status, 'pending'),
        lt(agentSuggestions.suggestedAt, cutoff)
      )
    )
    .returning({ id: agentSuggestions.id });
  return result.length;
}
