// ============================================================
// Zoho CRM adapter — Phase 13.
//
// Zoho has region-specific data centers, each with its own auth +
// API base URL. The DC ('com' | 'eu' | 'in' | 'com.au' | 'jp') is
// chosen by the tenant during OAuth and persisted in
// integrations.metadata.dc — every subsequent API call routes
// through the right host.
//
// Activity sync via Zoho CRM v6 REST API:
//   call_note    → POST /Notes      attached to Contact via Parent_Id
//   appointment  → POST /Events     attached via What_Id (Contact module)
//   escalation   → POST /Tasks      Priority='Highest', What_Id linked
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

export type ZohoDc = 'com' | 'eu' | 'in' | 'com.au' | 'jp';

export interface ZohoTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
  dc: ZohoDc;
}

function authBase(dc: ZohoDc): string {
  return `https://accounts.zoho.${dc}`;
}

function apiBase(dc: ZohoDc): string {
  return `https://www.zohoapis.${dc}/crm/v6`;
}

// ── OAuth ──────────────────────────────────────────────────

export function buildAuthUrl(state: string, dc: ZohoDc): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.ZOHO_CLIENT_ID,
    redirect_uri: config.ZOHO_REDIRECT_URI,
    scope: 'ZohoCRM.modules.ALL,ZohoCRM.settings.READ',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${authBase(dc)}/oauth/v2/auth?${params.toString()}`;
}

export async function exchangeCode(code: string, dc: ZohoDc): Promise<ZohoTokens> {
  const res = await fetch(`${authBase(dc)}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.ZOHO_CLIENT_ID,
      client_secret: config.ZOHO_CLIENT_SECRET,
      redirect_uri: config.ZOHO_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho token exchange failed: ${res.status} ${body}`);
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
    dc,
  };
}

export async function refreshTokens(refreshToken: string, dc: ZohoDc): Promise<ZohoTokens> {
  const res = await fetch(`${authBase(dc)}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.ZOHO_CLIENT_ID,
      client_secret: config.ZOHO_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho token refresh failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // unchanged on refresh
    expires_at: Date.now() + data.expires_in * 1000,
    dc,
  };
}

// ── Activity sync ──────────────────────────────────────────

async function findContactByPhone(tokens: ZohoTokens, phoneE164: string): Promise<string | null> {
  const url = `${apiBase(tokens.dc)}/Contacts/search?phone=${encodeURIComponent(phoneE164)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { id: string }[] };
  return data.data?.[0]?.id ?? null;
}

async function withAutoRefresh<T>(
  tokens: ZohoTokens,
  integrationId: string,
  fn: (t: ZohoTokens) => Promise<{ ok: boolean; status: number; data: T | null; body?: string }>
): Promise<T> {
  let result = await fn(tokens);
  if (result.status === 401) {
    const fresh = await refreshTokens(tokens.refresh_token, tokens.dc);
    await db
      .update(integrations)
      .set({
        credentials: encryptCredentials({
          access_token: fresh.access_token,
          refresh_token: fresh.refresh_token,
          expires_at: String(fresh.expires_at),
          dc: fresh.dc,
        }),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
    result = await fn(fresh);
  }
  if (!result.ok || !result.data) {
    throw new Error(`Zoho API failed (${result.status}): ${result.body ?? 'no body'}`);
  }
  return result.data;
}

export async function appendZohoCallNote(
  tokens: ZohoTokens,
  note: CallNote,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = note.fromNumber ? await findContactByPhone(tokens, note.fromNumber) : null;
  const body = [
    `Telfin call — ${note.outcome}`,
    note.summary && `\nSummary:\n${note.summary}`,
    note.transcript && `\n\nTranscript:\n${note.transcript}`,
  ].filter(Boolean).join('');

  await withAutoRefresh(tokens, integrationId, async (t) => {
    const res = await fetch(`${apiBase(t.dc)}/Notes`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${t.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [
          {
            Note_Title: `Call — ${note.outcome}`,
            Note_Content: body.slice(0, 32000),
            ...(contactId && { Parent_Id: { module: 'Contacts', id: contactId } }),
          },
        ],
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { ok: true } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}

export async function appendZohoAppointment(
  tokens: ZohoTokens,
  appt: AppointmentSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = await findContactByPhone(tokens, appt.contactPhoneE164);

  await withAutoRefresh(tokens, integrationId, async (t) => {
    const res = await fetch(`${apiBase(t.dc)}/Events`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${t.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [
          {
            Event_Title: `${appt.appointmentType} — booked by AI`,
            Description: appt.notes ?? `${appt.appointmentType} booked by Telfin.`,
            Start_DateTime: appt.startsAt,
            End_DateTime: appt.endsAt,
            ...(contactId && { What_Id: contactId, $se_module: 'Contacts' }),
          },
        ],
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { ok: true } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}

export async function appendZohoEscalation(
  tokens: ZohoTokens,
  esc: EscalationSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const contactId = await findContactByPhone(tokens, esc.contactPhoneE164);
  const dueAt = esc.dueAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  await withAutoRefresh(tokens, integrationId, async (t) => {
    const res = await fetch(`${apiBase(t.dc)}/Tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${t.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [
          {
            Subject: `⚠️ AI escalation: ${esc.reason}`,
            Description: esc.description ?? esc.reason,
            Priority: 'Highest',
            Status: 'Not Started',
            Due_Date: dueAt.slice(0, 10),
            ...(contactId && { What_Id: contactId, $se_module: 'Contacts' }),
          },
        ],
      }),
    });
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? { ok: true } : null,
      ...(res.ok ? {} : { body: await res.text() }),
    };
  });
}
