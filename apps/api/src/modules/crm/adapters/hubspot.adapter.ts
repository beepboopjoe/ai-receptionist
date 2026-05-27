// ============================================================
// HubSpot CRM adapter — OAuth token exchange + contact sync
// ============================================================
import { config } from '../../../config.js';

const HS_BASE = 'https://api.hubapi.com';
const HS_AUTH = 'https://app.hubspot.com/oauth/authorize';
const HS_TOKEN = 'https://api.hubapi.com/oauth/v1/token';

export interface HubSpotTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
}

export interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    hs_object_id?: string;
  };
}

// ── OAuth ──────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.HUBSPOT_CLIENT_ID,
    redirect_uri: config.HUBSPOT_REDIRECT_URI,
    scope: 'crm.objects.contacts.read crm.objects.contacts.write',
    state,
  });
  return `${HS_AUTH}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<HubSpotTokens> {
  const res = await fetch(HS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.HUBSPOT_CLIENT_ID,
      client_secret: config.HUBSPOT_CLIENT_SECRET,
      redirect_uri: config.HUBSPOT_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot token exchange failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshTokens(refreshToken: string): Promise<HubSpotTokens> {
  const res = await fetch(HS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.HUBSPOT_CLIENT_ID,
      client_secret: config.HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot token refresh failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

// ── Contact API ────────────────────────────────────────────

export async function listContacts(
  accessToken: string,
  after?: string
): Promise<{ results: HubSpotContact[]; paging?: { next?: { after: string } } }> {
  const params = new URLSearchParams({
    limit: '100',
    properties: 'firstname,lastname,email,phone',
  });
  if (after) params.set('after', after);

  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`HubSpot listContacts failed: ${res.status}`);
  return res.json() as Promise<{ results: HubSpotContact[]; paging?: { next?: { after: string } } }>;
}

export async function createContact(
  accessToken: string,
  props: { firstname?: string; lastname?: string; email?: string; phone?: string }
): Promise<HubSpotContact> {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: props }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot createContact failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<HubSpotContact>;
}

export async function updateContact(
  accessToken: string,
  hsId: string,
  props: { firstname?: string; lastname?: string; email?: string; phone?: string }
): Promise<void> {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/${hsId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: props }),
  });
  if (!res.ok) throw new Error(`HubSpot updateContact failed: ${res.status}`);
}

// ── Activity sync (Phase 13) ───────────────────────────────
// Lookup-or-create the contact by phone, then post a Note / Meeting / Task
// with an association. These helpers refresh the access token automatically
// on 401 and persist the new token back to integrations.credentials.

import { db } from '../../../db/client.js';
import { integrations } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { encryptCredentials } from '../../../lib/encryption.js';
import type {
  CallNote,
  AppointmentSyncPayload,
  EscalationSyncPayload,
} from '@ai-receptionist/shared';

const HS_ASSOC_NOTE_TO_CONTACT = 202;     // HubSpot-defined association type IDs.
const HS_ASSOC_MEETING_TO_CONTACT = 200;
const HS_ASSOC_TASK_TO_CONTACT = 204;

/** Look up a HubSpot contact ID by E.164 phone, returning null if not found. */
async function findContactByPhone(accessToken: string, phoneE164: string): Promise<string | null> {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [
        { filters: [{ propertyName: 'phone', operator: 'EQ', value: phoneE164 }] },
      ],
      properties: ['phone'],
      limit: 1,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { id: string }[] };
  return data.results?.[0]?.id ?? null;
}

/**
 * Wrap a HubSpot API call with auto-refresh on 401. Persists the refreshed
 * token back to integrations.credentials for next time.
 */
async function withAutoRefresh<T>(
  tokens: HubSpotTokens,
  integrationId: string,
  fn: (accessToken: string) => Promise<{ ok: boolean; status: number; data: T | null; body?: string }>
): Promise<T> {
  let result = await fn(tokens.access_token);

  // 401 means the token expired between checks; refresh once.
  if (result.status === 401) {
    const fresh = await refreshTokens(tokens.refresh_token);
    await db
      .update(integrations)
      .set({
        credentials: encryptCredentials({
          access_token: fresh.access_token,
          refresh_token: fresh.refresh_token,
          expires_at: String(fresh.expires_at),
        }),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
    result = await fn(fresh.access_token);
  }

  if (!result.ok || !result.data) {
    throw new Error(`HubSpot API failed (${result.status}): ${result.body ?? 'no body'}`);
  }
  return result.data;
}

export async function appendHubSpotCallNote(
  tokens: HubSpotTokens,
  note: CallNote,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = note.fromNumber
    ? await findContactByPhone(tokens.access_token, note.fromNumber)
    : null;

  const body = [
    `📞 AI Receptionist call — ${note.outcome}`,
    note.summary ? `\nSummary:\n${note.summary}` : '',
    note.transcript ? `\n\nTranscript:\n${note.transcript}` : '',
  ].join('');

  await withAutoRefresh(tokens, integrationId, async (accessToken) => {
    const res = await fetch(`${HS_BASE}/crm/v3/objects/notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          hs_note_body: body.slice(0, 65535), // HubSpot's max for hs_note_body
          hs_timestamp: new Date(note.createdAt).getTime(),
        },
        ...(contactId && {
          associations: [
            {
              to: { id: contactId },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: HS_ASSOC_NOTE_TO_CONTACT }],
            },
          ],
        }),
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { id: (await res.json() as { id: string }).id } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}

export async function appendHubSpotAppointment(
  tokens: HubSpotTokens,
  appt: AppointmentSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = await findContactByPhone(tokens.access_token, appt.contactPhoneE164);

  await withAutoRefresh(tokens, integrationId, async (accessToken) => {
    const res = await fetch(`${HS_BASE}/crm/v3/objects/meetings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          hs_meeting_title: `${appt.appointmentType} — booked by AI`,
          hs_meeting_body: appt.notes ?? `${appt.appointmentType} appointment booked by AI Receptionist.`,
          hs_timestamp: new Date(appt.startsAt).getTime(),
          hs_meeting_start_time: new Date(appt.startsAt).getTime(),
          hs_meeting_end_time: new Date(appt.endsAt).getTime(),
          hs_meeting_outcome: 'SCHEDULED',
        },
        ...(contactId && {
          associations: [
            {
              to: { id: contactId },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: HS_ASSOC_MEETING_TO_CONTACT }],
            },
          ],
        }),
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { id: (await res.json() as { id: string }).id } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}

export async function appendHubSpotEscalation(
  tokens: HubSpotTokens,
  esc: EscalationSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = await findContactByPhone(tokens.access_token, esc.contactPhoneE164);
  const dueAt = esc.dueAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  await withAutoRefresh(tokens, integrationId, async (accessToken) => {
    const res = await fetch(`${HS_BASE}/crm/v3/objects/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          hs_task_subject: `⚠️ AI escalation: ${esc.reason}`,
          hs_task_body: esc.description ?? esc.reason,
          hs_task_priority: 'HIGH',
          hs_task_status: 'NOT_STARTED',
          hs_timestamp: new Date(dueAt).getTime(),
        },
        ...(contactId && {
          associations: [
            {
              to: { id: contactId },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: HS_ASSOC_TASK_TO_CONTACT }],
            },
          ],
        }),
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { id: (await res.json() as { id: string }).id } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}
