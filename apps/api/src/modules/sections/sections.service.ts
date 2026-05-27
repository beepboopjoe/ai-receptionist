// ============================================================
// Sections service — per-section dynamic data for the
// SectionAgent header that lives on each dashboard surface.
//
// Each section returns:
//   - liveCounts: small set of headline numbers ("12 missed last 7d")
//   - pendingSuggestionIds: filtered subset of agent_suggestions
//     so the section page can render them inline (re-homed from
//     the dashboard's global AgentSuggestionsCard).
//
// Detection is plain SQL — same cheap model as agent.service.ts.
// No LLM calls. Endpoint caching lives in the router layer.
// ============================================================
import { db } from '../../db/client.js';
import {
  calls,
  appointments,
  escalations,
  agentSuggestions,
  contacts,
  smsMessages,
  outboundCampaigns,
  leadDiscoveryJobs,
  kbDocuments,
} from '../../db/schema.js';
import { and, eq, gte, count, sql, desc, inArray } from 'drizzle-orm';

export type SectionKey =
  | 'calls'
  | 'missed-calls'
  | 'appointments'
  | 'escalations'
  | 'contacts'
  | 'messages'
  | 'campaigns'
  | 'reminders'
  | 'lead-discovery'
  | 'knowledge-base';

export interface LiveCount {
  label: string;
  value: number;
  /** Drives the count chip color. */
  severity: 'info' | 'warning' | 'success' | 'critical';
}

export interface SectionSuggestionsResponse {
  liveCounts: LiveCount[];
  pendingSuggestionIds: string[];
}

const SUGGESTION_TYPES_BY_SECTION: Record<SectionKey, string[]> = {
  calls: [],
  'missed-calls': ['missed_call_callback'],
  appointments: ['appointment_confirmation', 'no_show_recapture'],
  escalations: [],
  contacts: ['stale_lead_followup'],
  messages: [],
  campaigns: [],
  reminders: [],
  'lead-discovery': [],
  'knowledge-base': [],
};

// ---- Per-section detectors ------------------------------------------------

async function callsCounts(tenantId: string): Promise<LiveCount[]> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [totalRow] = await db
    .select({ value: count() })
    .from(calls)
    .where(and(eq(calls.tenantId, tenantId), gte(calls.startedAt, since)));

  const [escalatedRow] = await db
    .select({ value: count() })
    .from(calls)
    .where(
      and(
        eq(calls.tenantId, tenantId),
        gte(calls.startedAt, since),
        sql`${calls.escalationReason} IS NOT NULL`
      )
    );

  const total = Number(totalRow?.value ?? 0);
  const escalated = Number(escalatedRow?.value ?? 0);

  return [
    { label: 'Calls last 7 days', value: total, severity: 'info' },
    {
      label: 'Escalated',
      value: escalated,
      severity: escalated > 0 ? 'warning' : 'success',
    },
  ];
}

async function missedCallsCounts(tenantId: string): Promise<LiveCount[]> {
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  const since1 = new Date();
  since1.setDate(since1.getDate() - 1);

  const [weekRow] = await db
    .select({ value: count() })
    .from(calls)
    .where(
      and(
        eq(calls.tenantId, tenantId),
        eq(calls.status, 'missed'),
        gte(calls.startedAt, since7)
      )
    );

  const [dayRow] = await db
    .select({ value: count() })
    .from(calls)
    .where(
      and(
        eq(calls.tenantId, tenantId),
        eq(calls.status, 'missed'),
        gte(calls.startedAt, since1)
      )
    );

  const week = Number(weekRow?.value ?? 0);
  const day = Number(dayRow?.value ?? 0);

  return [
    {
      label: 'Missed last 7 days',
      value: week,
      severity: week > 5 ? 'warning' : 'info',
    },
    {
      label: 'Missed today',
      value: day,
      severity: day > 0 ? 'warning' : 'success',
    },
  ];
}

async function appointmentsCounts(tenantId: string): Promise<LiveCount[]> {
  const now = new Date();
  const in24h = new Date();
  in24h.setHours(in24h.getHours() + 24);
  const past7 = new Date();
  past7.setDate(past7.getDate() - 7);

  const [upcomingRow] = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, 'confirmed'),
        gte(appointments.startsAt, now),
        sql`${appointments.startsAt} <= ${in24h.toISOString()}`
      )
    );

  const [noShowRow] = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, 'no_show'),
        gte(appointments.startsAt, past7)
      )
    );

  const upcoming = Number(upcomingRow?.value ?? 0);
  const noShows = Number(noShowRow?.value ?? 0);

  return [
    { label: 'Upcoming next 24h', value: upcoming, severity: 'info' },
    {
      label: 'No-shows last 7 days',
      value: noShows,
      severity: noShows > 0 ? 'warning' : 'success',
    },
  ];
}

async function escalationsCounts(tenantId: string): Promise<LiveCount[]> {
  const [openRow] = await db
    .select({ value: count() })
    .from(escalations)
    .where(and(eq(escalations.tenantId, tenantId), eq(escalations.status, 'open')));

  const past7 = new Date();
  past7.setDate(past7.getDate() - 7);
  const [recentRow] = await db
    .select({ value: count() })
    .from(escalations)
    .where(
      and(
        eq(escalations.tenantId, tenantId),
        gte(escalations.createdAt, past7)
      )
    );

  const open = Number(openRow?.value ?? 0);
  const recent = Number(recentRow?.value ?? 0);

  return [
    {
      label: 'Open escalations',
      value: open,
      severity: open > 0 ? 'critical' : 'success',
    },
    { label: 'New last 7 days', value: recent, severity: 'info' },
  ];
}

async function contactsCounts(tenantId: string): Promise<LiveCount[]> {
  const past30 = new Date();
  past30.setDate(past30.getDate() - 30);

  const [totalRow] = await db
    .select({ value: count() })
    .from(contacts)
    .where(eq(contacts.tenantId, tenantId));

  const [newRow] = await db
    .select({ value: count() })
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        gte(contacts.createdAt, past30)
      )
    );

  const total = Number(totalRow?.value ?? 0);
  const fresh = Number(newRow?.value ?? 0);

  return [
    { label: 'Total contacts', value: total, severity: 'info' },
    {
      label: 'New last 30 days',
      value: fresh,
      severity: fresh > 0 ? 'success' : 'info',
    },
  ];
}

async function messagesCounts(tenantId: string): Promise<LiveCount[]> {
  const past7 = new Date();
  past7.setDate(past7.getDate() - 7);

  const [inboundRow] = await db
    .select({ value: count() })
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.tenantId, tenantId),
        eq(smsMessages.direction, 'inbound'),
        gte(smsMessages.createdAt, past7)
      )
    );

  const [outboundRow] = await db
    .select({ value: count() })
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.tenantId, tenantId),
        eq(smsMessages.direction, 'outbound'),
        gte(smsMessages.createdAt, past7)
      )
    );

  const inboundCount = Number(inboundRow?.value ?? 0);
  const outboundCount = Number(outboundRow?.value ?? 0);

  return [
    {
      label: 'Inbound last 7 days',
      value: inboundCount,
      severity: inboundCount > 0 ? 'warning' : 'info',
    },
    { label: 'Sent last 7 days', value: outboundCount, severity: 'info' },
  ];
}

async function campaignsCounts(tenantId: string): Promise<LiveCount[]> {
  const [runningRow] = await db
    .select({ value: count() })
    .from(outboundCampaigns)
    .where(
      and(
        eq(outboundCampaigns.tenantId, tenantId),
        eq(outboundCampaigns.status, 'running')
      )
    );

  const [draftRow] = await db
    .select({ value: count() })
    .from(outboundCampaigns)
    .where(
      and(
        eq(outboundCampaigns.tenantId, tenantId),
        eq(outboundCampaigns.status, 'draft')
      )
    );

  const running = Number(runningRow?.value ?? 0);
  const drafts = Number(draftRow?.value ?? 0);

  return [
    {
      label: 'Active campaigns',
      value: running,
      severity: running > 0 ? 'success' : 'info',
    },
    {
      label: 'Drafts',
      value: drafts,
      severity: drafts > 0 ? 'warning' : 'info',
    },
  ];
}

async function leadDiscoveryCounts(tenantId: string): Promise<LiveCount[]> {
  // Past-30-day window mirrors other section detectors.
  const past30 = new Date();
  past30.setDate(past30.getDate() - 30);

  const [importedRow] = await db
    .select({ value: count() })
    .from(leadDiscoveryJobs)
    .where(
      and(
        eq(leadDiscoveryJobs.tenantId, tenantId),
        eq(leadDiscoveryJobs.status, 'imported'),
        gte(leadDiscoveryJobs.createdAt, past30)
      )
    );

  // Total leads imported across all jobs in the window.
  const [totalLeadsRow] = await db
    .select({
      value: sql<number>`COALESCE(SUM(${leadDiscoveryJobs.leadsImported}), 0)`,
    })
    .from(leadDiscoveryJobs)
    .where(
      and(
        eq(leadDiscoveryJobs.tenantId, tenantId),
        gte(leadDiscoveryJobs.createdAt, past30)
      )
    );

  const jobs = Number(importedRow?.value ?? 0);
  const leadsImported = Number(totalLeadsRow?.value ?? 0);

  return [
    {
      label: 'Imported last 30 days',
      value: leadsImported,
      severity: leadsImported > 0 ? 'success' : 'info',
    },
    {
      label: 'Discovery runs',
      value: jobs,
      severity: 'info',
    },
  ];
}

async function knowledgeBaseCounts(tenantId: string): Promise<LiveCount[]> {
  const [readyRow] = await db
    .select({ value: count() })
    .from(kbDocuments)
    .where(and(eq(kbDocuments.tenantId, tenantId), eq(kbDocuments.status, 'ready')));

  const [failedRow] = await db
    .select({ value: count() })
    .from(kbDocuments)
    .where(and(eq(kbDocuments.tenantId, tenantId), eq(kbDocuments.status, 'failed')));

  const ready = Number(readyRow?.value ?? 0);
  const failed = Number(failedRow?.value ?? 0);

  return [
    {
      label: 'Documents ready',
      value: ready,
      severity: ready > 0 ? 'success' : 'info',
    },
    {
      label: 'Failed',
      value: failed,
      severity: failed > 0 ? 'warning' : 'success',
    },
  ];
}

async function remindersCounts(tenantId: string): Promise<LiveCount[]> {
  const past7 = new Date();
  past7.setDate(past7.getDate() - 7);

  // 24h reminders sent in the last week — drives the headline number.
  const [sent24Row] = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.reminder24hSent, true),
        gte(appointments.startsAt, past7)
      )
    );

  const [sent2Row] = await db
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.reminder2hSent, true),
        gte(appointments.startsAt, past7)
      )
    );

  const r24 = Number(sent24Row?.value ?? 0);
  const r2 = Number(sent2Row?.value ?? 0);

  return [
    { label: '24-hour reminders sent', value: r24, severity: 'info' },
    { label: '2-hour reminders sent', value: r2, severity: 'info' },
  ];
}

// ---- Top-level dispatcher --------------------------------------------------

export async function getSectionSuggestions(
  tenantId: string,
  section: SectionKey
): Promise<SectionSuggestionsResponse> {
  // Live counts via per-section detector (parallel inside each detector
  // for what little parallelism is available — drizzle queries are sync to write).
  let liveCounts: LiveCount[] = [];
  try {
    switch (section) {
      case 'calls':
        liveCounts = await callsCounts(tenantId);
        break;
      case 'missed-calls':
        liveCounts = await missedCallsCounts(tenantId);
        break;
      case 'appointments':
        liveCounts = await appointmentsCounts(tenantId);
        break;
      case 'escalations':
        liveCounts = await escalationsCounts(tenantId);
        break;
      case 'contacts':
        liveCounts = await contactsCounts(tenantId);
        break;
      case 'messages':
        liveCounts = await messagesCounts(tenantId);
        break;
      case 'campaigns':
        liveCounts = await campaignsCounts(tenantId);
        break;
      case 'reminders':
        liveCounts = await remindersCounts(tenantId);
        break;
      case 'lead-discovery':
        liveCounts = await leadDiscoveryCounts(tenantId);
        break;
      case 'knowledge-base':
        liveCounts = await knowledgeBaseCounts(tenantId);
        break;
    }
  } catch {
    // Defensive — never fail the whole section response over a count query.
    liveCounts = [];
  }

  // Pending agent_suggestions for the relevant types. Returns IDs only;
  // the frontend already knows how to render full suggestion rows via
  // the existing agentApi.listSuggestions endpoint. Returning IDs keeps
  // this endpoint cheap and avoids duplicating the row shape.
  const types = SUGGESTION_TYPES_BY_SECTION[section];
  let pendingSuggestionIds: string[] = [];
  if (types.length > 0) {
    const rows = await db
      .select({ id: agentSuggestions.id })
      .from(agentSuggestions)
      .where(
        and(
          eq(agentSuggestions.tenantId, tenantId),
          eq(agentSuggestions.status, 'pending'),
          inArray(agentSuggestions.type, types)
        )
      )
      .orderBy(desc(agentSuggestions.suggestedAt))
      .limit(10);
    pendingSuggestionIds = rows.map((r) => r.id);
  }

  return { liveCounts, pendingSuggestionIds };
}

export function isValidSection(section: string): section is SectionKey {
  return [
    'calls',
    'missed-calls',
    'appointments',
    'escalations',
    'contacts',
    'messages',
    'campaigns',
    'reminders',
    'lead-discovery',
    'knowledge-base',
  ].includes(section);
}
