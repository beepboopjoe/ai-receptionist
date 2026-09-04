// ============================================================
// Data-retention purge — daily sweep.
//
// Makes the per-tenant `dataRetentionDays` setting real: deletes
// PHI-bearing records (calls, contacts, appointments, SMS) older
// than the tenant's retention window. Previously this setting was
// stored but never enforced.
//
// Only runs for tenants with retention_enforced=true (a legal-hold
// escape hatch). Every purge that removes rows is written to
// compliance_events for an auditable trail.
//
// FK safety: all child references to these tables are ON DELETE
// SET NULL / CASCADE, so direct per-table deletes never hit a
// foreign-key violation.
// ============================================================
import { db } from '../../db/client.js';
import {
  tenants,
  calls,
  contacts,
  appointments,
  smsMessages,
  complianceEvents,
} from '../../db/schema.js';
import { and, eq, lt, count, type AnyColumn } from 'drizzle-orm';

interface RetentionResult {
  tenantsChecked: number;
  tenantsPurged: number;
  rowsDeleted: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function runDataRetentionSweep(): Promise<RetentionResult> {
  const rows = await db
    .select({
      id: tenants.id,
      retentionDays: tenants.dataRetentionDays,
    })
    .from(tenants)
    .where(eq(tenants.retentionEnforced, true));

  let tenantsPurged = 0;
  let rowsDeleted = 0;

  for (const t of rows) {
    const cutoff = new Date(Date.now() - t.retentionDays * MS_PER_DAY);

    // Count-then-delete per table so the audit event records an
    // accurate breakdown. Deletes are independent per table.
    const breakdown: Record<string, number> = {};

    const purge = async (
      label: string,
      table: typeof calls | typeof contacts | typeof appointments | typeof smsMessages,
      tsCol: AnyColumn,
      tenantCol: AnyColumn
    ): Promise<number> => {
      const where = and(eq(tenantCol, t.id), lt(tsCol, cutoff));
      const [{ n }] = await db.select({ n: count() }).from(table).where(where);
      const num = Number(n);
      if (num > 0) {
        await db.delete(table).where(where);
        breakdown[label] = num;
      }
      return num;
    };

    let tenantTotal = 0;
    tenantTotal += await purge('calls', calls, calls.startedAt, calls.tenantId);
    tenantTotal += await purge('appointments', appointments, appointments.createdAt, appointments.tenantId);
    tenantTotal += await purge('sms_messages', smsMessages, smsMessages.createdAt, smsMessages.tenantId);
    // Contacts last — deleting them SET NULLs any surviving call/appointment
    // rows' contact_id, which is the intended behavior.
    tenantTotal += await purge('contacts', contacts, contacts.createdAt, contacts.tenantId);

    if (tenantTotal > 0) {
      tenantsPurged++;
      rowsDeleted += tenantTotal;
      // Fire-and-forget-safe audit trail — never blocks the sweep.
      await db
        .insert(complianceEvents)
        .values({
          tenantId: t.id,
          eventType: 'retention_purge',
          actorEmail: 'system',
          metadata: {
            retentionDays: t.retentionDays,
            cutoff: cutoff.toISOString(),
            deleted: breakdown,
            total: tenantTotal,
          },
        })
        .catch((err) => {
          console.error('[retention] failed to log purge event:', err);
        });
    }
  }

  return { tenantsChecked: rows.length, tenantsPurged, rowsDeleted };
}
