// ============================================================
// Clio adapter — Phase 13.
//
// OAuth 2.0 (standard Authorization Code Flow) against Clio
// Manage. Activity sync uses Clio's REST API v4:
//   call_note    → POST /api/v4/communications.json
//                  (type='PhoneCommunication', subject, body,
//                   date, communication_type='Voicemail/Note')
//   appointment  → POST /api/v4/calendar_entries.json
//   escalation   → POST /api/v4/tasks.json (priority='High')
//
// All linked to a Contact via { contact: { id } } on the resource.
// Contact lookup by phone via GET /api/v4/contacts?query=<phone>.
//
// Clio's tokens have a 1-hour access lifetime and refresh tokens
// good for 1 year. Refresh is identical to other OAuth providers.
// ============================================================
import { config } from '../../../config.js';
import { db } from '../../../db/client.js';
import { integrations } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { encryptCredentials } from '../../../lib/encryption.js';
import type {
  CallNote,
  AppointmentSyncPayload,
  EscalationSyncPayload,
} from '@ai-receptionist/shared';

const CLIO_BASE = 'https://app.clio.com';
const API_PATH = '/api/v4';

export interface ClioTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
}

// ── OAuth ──────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.CLIO_CLIENT_ID,
    redirect_uri: config.CLIO_REDIRECT_URI,
    state,
  });
  return `${CLIO_BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<ClioTokens> {
  const res = await fetch(`${CLIO_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.CLIO_CLIENT_ID,
      client_secret: config.CLIO_CLIENT_SECRET,
      redirect_uri: config.CLIO_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clio token exchange failed: ${res.status} ${body}`);
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

export async function refreshTokens(refreshToken: string): Promise<ClioTokens> {
  const res = await fetch(`${CLIO_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.CLIO_CLIENT_ID,
      client_secret: config.CLIO_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clio token refresh failed: ${res.status} ${body}`);
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

// ── Activity sync ──────────────────────────────────────────

async function findContactByPhone(
  accessToken: string,
  phoneE164: string
): Promise<number | null> {
  const url = `${CLIO_BASE}${API_PATH}/contacts.json?query=${encodeURIComponent(phoneE164)}&limit=1&fields=id`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { id: number }[] };
  return data.data?.[0]?.id ?? null;
}

async function withAutoRefresh<T>(
  tokens: ClioTokens,
  integrationId: string,
  fn: (accessToken: string) => Promise<{ ok: boolean; status: number; data: T | null; body?: string }>
): Promise<T> {
  let result = await fn(tokens.access_token);
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
    throw new Error(`Clio API failed (${result.status}): ${result.body ?? 'no body'}`);
  }
  return result.data;
}

export async function appendClioCallNote(
  tokens: ClioTokens,
  note: CallNote,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = note.fromNumber
    ? await findContactByPhone(tokens.access_token, note.fromNumber)
    : null;

  const body = [
    `Telfin call — ${note.outcome}`,
    note.summary && `\nSummary:\n${note.summary}`,
    note.transcript && `\n\nTranscript:\n${note.transcript}`,
  ].filter(Boolean).join('');

  await withAutoRefresh(tokens, integrationId, async (accessToken) => {
    const res = await fetch(`${CLIO_BASE}${API_PATH}/communications.json`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          type: 'PhoneCommunication',
          subject: `Call — ${note.outcome}`,
          body: body.slice(0, 32000),
          date: note.createdAt,
          ...(contactId && { receiver: { id: contactId } }),
        },
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { id: (await res.json() as { data: { id: number } }).data.id } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}

export async function appendClioAppointment(
  tokens: ClioTokens,
  appt: AppointmentSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = await findContactByPhone(tokens.access_token, appt.contactPhoneE164);

  await withAutoRefresh(tokens, integrationId, async (accessToken) => {
    const res = await fetch(`${CLIO_BASE}${API_PATH}/calendar_entries.json`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          summary: `${appt.appointmentType} — booked by AI`,
          description: appt.notes ?? `${appt.appointmentType} booked by Telfin.`,
          start_at: appt.startsAt,
          end_at: appt.endsAt,
          ...(contactId && { contacts: [{ id: contactId }] }),
        },
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { id: (await res.json() as { data: { id: number } }).data.id } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}

export async function appendClioEscalation(
  tokens: ClioTokens,
  esc: EscalationSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = await findContactByPhone(tokens.access_token, esc.contactPhoneE164);
  const dueAt = esc.dueAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  await withAutoRefresh(tokens, integrationId, async (accessToken) => {
    const res = await fetch(`${CLIO_BASE}${API_PATH}/tasks.json`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          name: `⚠️ AI escalation: ${esc.reason}`,
          description: esc.description ?? esc.reason,
          priority: 'High',
          due_at: dueAt,
          ...(contactId && { matter: { contact: { id: contactId } } }),
        },
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { id: (await res.json() as { data: { id: number } }).data.id } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}
