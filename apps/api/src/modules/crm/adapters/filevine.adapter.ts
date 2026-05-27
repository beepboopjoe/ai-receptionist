// ============================================================
// Filevine adapter — Phase 13.
//
// Filevine uses Personal Access Token (PAT) + Secret + Org ID
// rather than OAuth — tenants generate credentials in their
// Filevine account settings and paste them into our dashboard.
//
// V1 auth model: send `X-FV-PersonalAccessToken: <pat>` +
// `X-FV-Secret: <secret>` + `X-FV-OrgId: <orgId>` headers.
// If Filevine has changed to a JWT exchange model, swap the
// helpers in this file (the public adapter surface stays the
// same).
//
// Activity sync:
//   call_note   → POST /core/notes
//   appointment → POST /core/appointments
//   escalation  → POST /core/tasks (Priority='High')
//
// Filevine's primary entity is `Project` (a case/matter).
// Notes/Appointments/Tasks attach to a Project. V1 attaches
// to the project found by phone-number search; future will
// support per-tenant default project selection.
// ============================================================
import { db } from '../../../db/client.js';
import { integrations } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import type {
  CallNote,
  AppointmentSyncPayload,
  EscalationSyncPayload,
} from '@ai-receptionist/shared';

const FV_BASE = 'https://api.filevineapp.com';

export interface FilevineCredentials {
  apiKey: string;       // Personal Access Token
  apiSecret: string;
  orgId: string;
}

function buildHeaders(creds: FilevineCredentials): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-FV-PersonalAccessToken': creds.apiKey,
    'X-FV-Secret': creds.apiSecret,
    'X-FV-OrgId': creds.orgId,
  };
}

/** Validate creds by hitting a cheap GET (org info). Used at connect time. */
export async function validateCredentials(creds: FilevineCredentials): Promise<boolean> {
  try {
    const res = await fetch(`${FV_BASE}/core/orgs/${encodeURIComponent(creds.orgId)}`, {
      headers: buildHeaders(creds),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Find a Project (case) by a person's phone — returns null if no match. */
async function findProjectByPhone(creds: FilevineCredentials, phoneE164: string): Promise<string | null> {
  try {
    const url = `${FV_BASE}/core/projects?searchQuery=${encodeURIComponent(phoneE164)}&limit=1`;
    const res = await fetch(url, { headers: buildHeaders(creds) });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: { projectId?: { native?: string } }[] };
    return data.items?.[0]?.projectId?.native ?? null;
  } catch {
    return null;
  }
}

async function postOrThrow(
  url: string,
  creds: FilevineCredentials,
  payload: unknown,
  integrationId: string
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(creds),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    // On 401/403 the credentials likely changed — mark as needing reconnect.
    if (res.status === 401 || res.status === 403) {
      await db
        .update(integrations)
        .set({
          status: 'reauth_required',
          errorMessage: 'Filevine credentials rejected — please reconnect.',
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integrationId));
    }
    throw new Error(`Filevine API failed (${res.status}): ${body.slice(0, 500)}`);
  }
}

export async function appendFilevineCallNote(
  creds: FilevineCredentials,
  note: CallNote,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const projectId = note.fromNumber ? await findProjectByPhone(creds, note.fromNumber) : null;
  const body = [
    `AI Receptionist call — ${note.outcome}`,
    note.summary && `\n\nSummary:\n${note.summary}`,
    note.transcript && `\n\nTranscript:\n${note.transcript}`,
  ].filter(Boolean).join('');

  await postOrThrow(
    `${FV_BASE}/core/notes`,
    creds,
    {
      ...(projectId && { projectId: { native: projectId } }),
      subject: `Call — ${note.outcome}`,
      body: body.slice(0, 32000),
      createdDate: note.createdAt,
    },
    integrationId
  );
}

export async function appendFilevineAppointment(
  creds: FilevineCredentials,
  appt: AppointmentSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const projectId = await findProjectByPhone(creds, appt.contactPhoneE164);

  await postOrThrow(
    `${FV_BASE}/core/appointments`,
    creds,
    {
      ...(projectId && { projectId: { native: projectId } }),
      subject: `${appt.appointmentType} — booked by AI`,
      description: appt.notes ?? `${appt.appointmentType} booked by AI Receptionist.`,
      startTime: appt.startsAt,
      endTime: appt.endsAt,
    },
    integrationId
  );
}

export async function appendFilevineEscalation(
  creds: FilevineCredentials,
  esc: EscalationSyncPayload,
  integrationId: string,
  _tenantId: string
): Promise<void> {
  const projectId = await findProjectByPhone(creds, esc.contactPhoneE164);
  const dueAt = esc.dueAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  await postOrThrow(
    `${FV_BASE}/core/tasks`,
    creds,
    {
      ...(projectId && { projectId: { native: projectId } }),
      subject: `⚠️ AI escalation: ${esc.reason}`,
      description: esc.description ?? esc.reason,
      priority: 'High',
      dueDate: dueAt,
    },
    integrationId
  );
}
