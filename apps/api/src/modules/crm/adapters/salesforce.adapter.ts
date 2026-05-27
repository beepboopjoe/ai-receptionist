// ============================================================
// Salesforce adapter — Phase 13.
//
// OAuth 2.0 Web Server Flow. Sandbox vs Production picked at
// connect time via the `is_sandbox` query param and persisted
// in integrations.metadata.is_sandbox. Once connected we get
// an instance_url (e.g. https://acmecorp.my.salesforce.com)
// that becomes the API base for that tenant.
//
// Activity sync:
//   call_note         → Task sObject (Type=Call, Status=Completed)
//   appointment       → Event sObject (StartDateTime, EndDateTime)
//   escalation        → Task sObject (Priority=High, Status=Not Started)
//
// Each Task/Event is linked to a Contact via WhoId after looking
// the contact up by Phone. We don't auto-create Contacts in V1
// (Salesforce's required fields and validation rules vary too
// much by org); if no Contact matches, the activity gets created
// unlinked, which still surfaces in the "Tasks/Events" report.
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

const API_VERSION = 'v60.0';
const PROD_AUTH = 'https://login.salesforce.com';
const SANDBOX_AUTH = 'https://test.salesforce.com';

export interface SalesforceTokens {
  access_token: string;
  refresh_token: string;
  /** Tenant-specific Salesforce instance URL returned with token response. */
  instance_url: string;
}

// ── OAuth ──────────────────────────────────────────────────

export function buildAuthUrl(state: string, isSandbox: boolean): string {
  const base = isSandbox ? SANDBOX_AUTH : PROD_AUTH;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.SALESFORCE_CLIENT_ID,
    redirect_uri: config.SALESFORCE_REDIRECT_URI,
    scope: 'api refresh_token offline_access',
    state,
  });
  return `${base}/services/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  isSandbox: boolean
): Promise<SalesforceTokens> {
  const base = isSandbox ? SANDBOX_AUTH : PROD_AUTH;
  const res = await fetch(`${base}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.SALESFORCE_CLIENT_ID,
      client_secret: config.SALESFORCE_CLIENT_SECRET,
      redirect_uri: config.SALESFORCE_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce token exchange failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    instance_url: string;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    instance_url: data.instance_url,
  };
}

export async function refreshTokens(
  refreshToken: string,
  isSandbox: boolean
): Promise<SalesforceTokens> {
  const base = isSandbox ? SANDBOX_AUTH : PROD_AUTH;
  const res = await fetch(`${base}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.SALESFORCE_CLIENT_ID,
      client_secret: config.SALESFORCE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce token refresh failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    instance_url: string;
    /** refresh_token is NOT returned on refresh — re-use the original. */
  };
  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // unchanged
    instance_url: data.instance_url,
  };
}

// ── Activity sync ──────────────────────────────────────────

async function findContactByPhone(
  tokens: SalesforceTokens,
  phoneE164: string
): Promise<string | null> {
  const soql = `SELECT Id FROM Contact WHERE Phone = '${phoneE164.replace(/'/g, "\\'")}' LIMIT 1`;
  const url = `${tokens.instance_url}/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { records?: { Id: string }[] };
  return data.records?.[0]?.Id ?? null;
}

async function withAutoRefresh<T>(
  tokens: SalesforceTokens,
  integrationId: string,
  isSandbox: boolean,
  fn: (t: SalesforceTokens) => Promise<{ ok: boolean; status: number; data: T | null; body?: string }>
): Promise<T> {
  let result = await fn(tokens);
  if (result.status === 401) {
    const fresh = await refreshTokens(tokens.refresh_token, isSandbox);
    await db
      .update(integrations)
      .set({
        credentials: encryptCredentials({
          access_token: fresh.access_token,
          refresh_token: fresh.refresh_token,
          instance_url: fresh.instance_url,
        }),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
    result = await fn(fresh);
  }
  if (!result.ok || !result.data) {
    throw new Error(`Salesforce API failed (${result.status}): ${result.body ?? 'no body'}`);
  }
  return result.data;
}

export async function appendSalesforceCallNote(
  tokens: SalesforceTokens,
  note: CallNote,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  // Salesforce doesn't store sandbox flag in token — read it from integrations.metadata at call site if needed.
  // For simplicity in V1, refresh defaults to production. Sandbox accounts get reconnected if refresh fails.
  const isSandbox = tokens.instance_url.includes('sandbox.my.salesforce') || tokens.instance_url.includes('test.salesforce');

  const whoId = note.fromNumber ? await findContactByPhone(tokens, note.fromNumber) : null;

  const description = [
    `AI Receptionist call — ${note.outcome}`,
    note.summary && `\nSummary:\n${note.summary}`,
    note.transcript && `\n\nTranscript:\n${note.transcript}`,
  ].filter(Boolean).join('');

  await withAutoRefresh(tokens, integrationId, isSandbox, async (t) => {
    const res = await fetch(`${t.instance_url}/services/data/${API_VERSION}/sobjects/Task`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Subject: `Call — ${note.outcome}`,
        Description: description.slice(0, 32000), // Task.Description text limit
        Type: 'Call',
        Status: 'Completed',
        ActivityDate: new Date(note.createdAt).toISOString().slice(0, 10),
        ...(whoId && { WhoId: whoId }),
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

export async function appendSalesforceAppointment(
  tokens: SalesforceTokens,
  appt: AppointmentSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const isSandbox = tokens.instance_url.includes('sandbox.my.salesforce') || tokens.instance_url.includes('test.salesforce');
  const whoId = await findContactByPhone(tokens, appt.contactPhoneE164);

  await withAutoRefresh(tokens, integrationId, isSandbox, async (t) => {
    const res = await fetch(`${t.instance_url}/services/data/${API_VERSION}/sobjects/Event`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Subject: `${appt.appointmentType} — booked by AI`,
        Description: appt.notes ?? `${appt.appointmentType} appointment booked by AI Receptionist.`,
        StartDateTime: appt.startsAt,
        EndDateTime: appt.endsAt,
        ...(whoId && { WhoId: whoId }),
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

export async function appendSalesforceEscalation(
  tokens: SalesforceTokens,
  esc: EscalationSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const isSandbox = tokens.instance_url.includes('sandbox.my.salesforce') || tokens.instance_url.includes('test.salesforce');
  const whoId = await findContactByPhone(tokens, esc.contactPhoneE164);
  const dueAt = esc.dueAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  await withAutoRefresh(tokens, integrationId, isSandbox, async (t) => {
    const res = await fetch(`${t.instance_url}/services/data/${API_VERSION}/sobjects/Task`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Subject: `⚠️ AI escalation: ${esc.reason}`,
        Description: esc.description ?? esc.reason,
        Type: 'Other',
        Priority: 'High',
        Status: 'Not Started',
        ActivityDate: new Date(dueAt).toISOString().slice(0, 10),
        ...(whoId && { WhoId: whoId }),
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
