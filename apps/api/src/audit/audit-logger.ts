// ============================================================
// Audit Logger — append-only audit trail for all key actions
// ============================================================
import { db } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export type ActorType = 'system' | 'ai_agent' | 'admin_user' | 'api';

export interface AuditEntry {
  tenantId: string;
  actorType: ActorType;
  actorId?: string;
  action: string;       // e.g. 'appointment.created', 'call.escalated'
  entityType: string;   // e.g. 'appointment', 'call', 'contact'
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit entry. Intentionally fire-and-forget — never awaited in
 * request handlers so it never blocks the response. Errors are logged but
 * do not bubble up.
 */
export function auditLog(entry: AuditEntry): void {
  db.insert(auditLogs)
    .values({
      tenantId: entry.tenantId,
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before as Record<string, unknown> | null | undefined,
      after: entry.after as Record<string, unknown> | null | undefined,
      metadata: (entry.metadata ?? {}) as Record<string, unknown>,
    })
    .execute()
    .catch((err) => {
      console.error('[audit] Failed to write audit log:', err);
    });
}

// Convenience helpers for common actions
export const audit = {
  appointmentCreated: (tenantId: string, appointmentId: string, data: unknown) =>
    auditLog({
      tenantId,
      actorType: 'ai_agent',
      action: 'appointment.created',
      entityType: 'appointment',
      entityId: appointmentId,
      after: data,
    }),

  appointmentCancelled: (tenantId: string, appointmentId: string, before: unknown) =>
    auditLog({
      tenantId,
      actorType: 'ai_agent',
      action: 'appointment.cancelled',
      entityType: 'appointment',
      entityId: appointmentId,
      before,
    }),

  appointmentRescheduled: (
    tenantId: string,
    appointmentId: string,
    before: unknown,
    after: unknown
  ) =>
    auditLog({
      tenantId,
      actorType: 'ai_agent',
      action: 'appointment.rescheduled',
      entityType: 'appointment',
      entityId: appointmentId,
      before,
      after,
    }),

  callEscalated: (
    tenantId: string,
    callId: string,
    reason: string,
    priority: string
  ) =>
    auditLog({
      tenantId,
      actorType: 'ai_agent',
      action: 'call.escalated',
      entityType: 'call',
      entityId: callId,
      metadata: { reason, priority },
    }),

  callCompleted: (tenantId: string, callId: string, outcome: string) =>
    auditLog({
      tenantId,
      actorType: 'ai_agent',
      action: 'call.completed',
      entityType: 'call',
      entityId: callId,
      metadata: { outcome },
    }),

  contactCreated: (tenantId: string, contactId: string, source: string) =>
    auditLog({
      tenantId,
      actorType: 'ai_agent',
      action: 'contact.created',
      entityType: 'contact',
      entityId: contactId,
      metadata: { source },
    }),

  integrationConnected: (tenantId: string, provider: string, adminUserId: string) =>
    auditLog({
      tenantId,
      actorType: 'admin_user',
      actorId: adminUserId,
      action: 'integration.connected',
      entityType: 'integration',
      metadata: { provider },
    }),
};
