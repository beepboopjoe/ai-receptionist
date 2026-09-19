// ============================================================
// Tenant snapshot for the public booking page.
// ============================================================
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { integrations, tenantSettings } from '../../db/schema.js';
import type { OfficeHours } from '@ai-receptionist/shared';
import { resolveAppointmentTypes } from '../scheduler/appointment-types.js';

export async function getTenantSettingsForBooking(tenantId: string): Promise<{
  appointmentTypes: ReturnType<typeof resolveAppointmentTypes>;
  officeHours: OfficeHours | Record<string, unknown>;
  calendarConnected: boolean;
}> {
  const [settings] = await db
    .select({
      appointmentTypes: tenantSettings.appointmentTypes,
      officeHours: tenantSettings.officeHours,
    })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const [calendar] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.status, 'connected'),
        or(
          eq(integrations.provider, 'google_calendar'),
          eq(integrations.provider, 'microsoft_calendar'),
        ),
      ),
    )
    .limit(1);

  return {
    appointmentTypes: resolveAppointmentTypes(settings?.appointmentTypes),
    officeHours: (settings?.officeHours as OfficeHours) ?? {},
    calendarConnected: Boolean(calendar),
  };
}
