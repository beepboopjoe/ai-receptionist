// ============================================================
// CRM event sync job — Phase 13.
//
// For a single event (call_note | appointment_booked |
// escalation_created), load every connected integration for
// the tenant and dispatch to its adapter. Per-CRM failures are
// isolated: one CRM down doesn't block the others.
//
// Updates integrations.last_synced_at on success, error_message
// on failure (latest error wins; no historical log in V1).
// ============================================================
import type { Job } from 'bullmq';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { decryptCredentials } from '../../lib/encryption.js';
import {
  appendHubSpotCallNote,
  appendHubSpotAppointment,
  appendHubSpotEscalation,
  type HubSpotTokens,
} from '../../modules/crm/adapters/hubspot.adapter.js';
import {
  appendSalesforceCallNote,
  appendSalesforceAppointment,
  appendSalesforceEscalation,
  type SalesforceTokens,
} from '../../modules/crm/adapters/salesforce.adapter.js';
import {
  appendClioCallNote,
  appendClioAppointment,
  appendClioEscalation,
  type ClioTokens,
} from '../../modules/crm/adapters/clio.adapter.js';
import {
  appendFilevineCallNote,
  appendFilevineAppointment,
  appendFilevineEscalation,
  type FilevineCredentials,
} from '../../modules/crm/adapters/filevine.adapter.js';
import type {
  CallNote,
  AppointmentSyncPayload,
  EscalationSyncPayload,
} from '@ai-receptionist/shared';
import type { CrmEventJobData } from '../../modules/crm/event-sync.service.js';
import pino from 'pino';

const logger = pino({ name: 'crm-event-sync-job' });

/** Providers that the dispatch table knows how to call. */
const SUPPORTED_PROVIDERS = ['hubspot', 'salesforce', 'clio', 'filevine'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export async function processCrmEventSync(job: Job<CrmEventJobData>): Promise<void> {
  const { tenantId, eventType, payload } = job.data;

  const rows = await db
    .select({
      id: integrations.id,
      provider: integrations.provider,
      credentials: integrations.credentials,
      metadata: integrations.metadata,
    })
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenantId), eq(integrations.status, 'connected')));

  if (rows.length === 0) {
    logger.debug({ tenantId, eventType }, 'No connected CRMs — skipping');
    return;
  }

  for (const row of rows) {
    if (!SUPPORTED_PROVIDERS.includes(row.provider as SupportedProvider)) continue;

    try {
      const creds = decryptCredentials(row.credentials as Record<string, string>);
      const meta = (row.metadata ?? {}) as Record<string, unknown>;

      switch (row.provider) {
        case 'hubspot': {
          const tokens: HubSpotTokens = {
            access_token: creds.access_token!,
            refresh_token: creds.refresh_token!,
            expires_at: Number(creds.expires_at),
          };
          await dispatchHubSpot(eventType, payload, tokens, row.id, tenantId);
          break;
        }
        case 'salesforce': {
          const tokens: SalesforceTokens = {
            access_token: creds.access_token!,
            refresh_token: creds.refresh_token!,
            instance_url: creds.instance_url!,
          };
          await dispatchSalesforce(eventType, payload, tokens, row.id, tenantId, meta);
          break;
        }
        case 'clio': {
          const tokens: ClioTokens = {
            access_token: creds.access_token!,
            refresh_token: creds.refresh_token!,
            expires_at: Number(creds.expires_at),
          };
          await dispatchClio(eventType, payload, tokens, row.id, tenantId);
          break;
        }
        case 'filevine': {
          const fvCreds: FilevineCredentials = {
            apiKey: creds.apiKey!,
            apiSecret: creds.apiSecret!,
            orgId: creds.orgId!,
          };
          await dispatchFilevine(eventType, payload, fvCreds, row.id, tenantId);
          break;
        }
      }

      // Success: update last_synced_at + clear any prior error.
      await db
        .update(integrations)
        .set({ lastSyncedAt: new Date(), errorMessage: null, updatedAt: new Date() })
        .where(eq(integrations.id, row.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, tenantId, provider: row.provider, eventType }, 'CRM sync failed');
      // Persist latest error so the dashboard can surface it.
      await db
        .update(integrations)
        .set({ errorMessage: message.slice(0, 500), updatedAt: new Date() })
        .where(eq(integrations.id, row.id));
      // Don't rethrow — continue to next CRM.
    }
  }
}

async function dispatchHubSpot(
  eventType: CrmEventJobData['eventType'],
  payload: CrmEventJobData['payload'],
  tokens: HubSpotTokens,
  integrationId: string,
  tenantId: string
): Promise<void> {
  switch (eventType) {
    case 'call_note':
      await appendHubSpotCallNote(tokens, payload as CallNote, integrationId, tenantId);
      return;
    case 'appointment_booked':
      await appendHubSpotAppointment(tokens, payload as AppointmentSyncPayload, integrationId, tenantId);
      return;
    case 'escalation_created':
      await appendHubSpotEscalation(tokens, payload as EscalationSyncPayload, integrationId, tenantId);
      return;
  }
}

async function dispatchSalesforce(
  eventType: CrmEventJobData['eventType'],
  payload: CrmEventJobData['payload'],
  tokens: SalesforceTokens,
  integrationId: string,
  tenantId: string,
  _meta: Record<string, unknown>
): Promise<void> {
  switch (eventType) {
    case 'call_note':
      await appendSalesforceCallNote(tokens, payload as CallNote, integrationId, tenantId);
      return;
    case 'appointment_booked':
      await appendSalesforceAppointment(tokens, payload as AppointmentSyncPayload, integrationId, tenantId);
      return;
    case 'escalation_created':
      await appendSalesforceEscalation(tokens, payload as EscalationSyncPayload, integrationId, tenantId);
      return;
  }
}

async function dispatchClio(
  eventType: CrmEventJobData['eventType'],
  payload: CrmEventJobData['payload'],
  tokens: ClioTokens,
  integrationId: string,
  tenantId: string
): Promise<void> {
  switch (eventType) {
    case 'call_note':
      await appendClioCallNote(tokens, payload as CallNote, integrationId, tenantId);
      return;
    case 'appointment_booked':
      await appendClioAppointment(tokens, payload as AppointmentSyncPayload, integrationId, tenantId);
      return;
    case 'escalation_created':
      await appendClioEscalation(tokens, payload as EscalationSyncPayload, integrationId, tenantId);
      return;
  }
}

async function dispatchFilevine(
  eventType: CrmEventJobData['eventType'],
  payload: CrmEventJobData['payload'],
  creds: FilevineCredentials,
  integrationId: string,
  tenantId: string
): Promise<void> {
  switch (eventType) {
    case 'call_note':
      await appendFilevineCallNote(creds, payload as CallNote, integrationId, tenantId);
      return;
    case 'appointment_booked':
      await appendFilevineAppointment(creds, payload as AppointmentSyncPayload, integrationId, tenantId);
      return;
    case 'escalation_created':
      await appendFilevineEscalation(creds, payload as EscalationSyncPayload, integrationId, tenantId);
      return;
  }
}
