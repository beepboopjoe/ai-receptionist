// ============================================================
// CRM Event Sync — Phase 13.
//
// Thin public API. Each function enqueues exactly one job that
// fans out to every connected CRM for the tenant. Fire-and-forget
// from callers — never throws, never blocks the originating
// request (mirrors emitWebhook + pushActivity pattern).
//
// Actual per-CRM dispatch lives in crm-event-sync.job.ts.
// ============================================================
import { crmEventSyncQueue } from '../../queue/queues.js';
import type {
  CallNote,
  AppointmentSyncPayload,
  EscalationSyncPayload,
} from '@ai-receptionist/shared';
import pino from 'pino';

const logger = pino({ name: 'crm-event-sync' });

export type CrmEventType = 'call_note' | 'appointment_booked' | 'escalation_created';

export interface CrmEventJobData {
  tenantId: string;
  eventType: CrmEventType;
  /** Payload shape depends on eventType — adapter pulls fields it needs. */
  payload: CallNote | AppointmentSyncPayload | EscalationSyncPayload;
}

/**
 * Sync a call completion to every connected CRM as a Note/Activity.
 * Fire-and-forget — uncaught errors only logged.
 */
export function syncCallNote(tenantId: string, payload: CallNote): void {
  enqueue({ tenantId, eventType: 'call_note', payload }).catch((err) =>
    logger.error({ err, tenantId, callId: payload.callId }, 'syncCallNote enqueue failed')
  );
}

/**
 * Sync a booked appointment to every connected CRM as an Event/Meeting.
 */
export function syncAppointment(tenantId: string, payload: AppointmentSyncPayload): void {
  enqueue({ tenantId, eventType: 'appointment_booked', payload }).catch((err) =>
    logger.error({ err, tenantId, appointmentId: payload.appointmentId }, 'syncAppointment enqueue failed')
  );
}

/**
 * Sync an escalation to every connected CRM as a high-priority Task.
 */
export function syncEscalation(tenantId: string, payload: EscalationSyncPayload): void {
  enqueue({ tenantId, eventType: 'escalation_created', payload }).catch((err) =>
    logger.error({ err, tenantId, escalationId: payload.escalationId }, 'syncEscalation enqueue failed')
  );
}

async function enqueue(data: CrmEventJobData): Promise<void> {
  await crmEventSyncQueue.add(data.eventType, data, {
    // Modest retry — fan-out worker handles per-CRM resilience itself.
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}
