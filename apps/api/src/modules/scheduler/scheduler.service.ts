// ============================================================
// Scheduler service — unified scheduling interface
// Business logic lives here; providers are swappable via adapters.
// ============================================================
import { db } from '../../db/client.js';
import { integrations, tenantSettings, appointments, tenants } from '../../db/schema.js';
import { eq, and, gte, lt, gt } from 'drizzle-orm';
import { decryptCredentials } from '../../lib/encryption.js';
import { createCalendarAdapter } from './adapters/calendar.factory.js';
import { persistGoogleCalendarTokens } from './google-calendar-oauth.js';
import type { ICalendarAdapter, TimeSlot, CalendarEvent } from './adapters/base.adapter.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { audit } from '../../audit/audit-logger.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import type { AppointmentType, OfficeHours } from '@ai-receptionist/shared';
import { emitWebhook } from '../webhooks/webhook.service.js';
import { pushActivity } from '../activity/activity.service.js';
import { isHolidayDate, lookupTodayHours } from '../telephony/office-hours.js';
import { findAppointmentType, resolveAppointmentTypes } from './appointment-types.js';
import { InternalCalendarAdapter, listConfirmedBusyRanges } from './adapters/internal.adapter.js';
import { filterOpenSlots } from './slot-math.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface BookAppointmentParams {
  tenantId: string;
  contactId: string;
  callId?: string;
  appointmentType: string;
  providerName?: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  notes?: string;
  attendeeEmail?: string;
  timezone: string;
}

export interface AvailabilityParams {
  tenantId: string;
  date: Date;
  /** Calendar date YYYY-MM-DD in the tenant timezone. Preferred over `date`. */
  dateKey?: string;
  appointmentType: string;
  timezone: string;
}

// ---- Internal helpers ----

async function getCalendarAdapter(tenantId: string): Promise<{
  adapter: ICalendarAdapter;
  calendarId: string;
}> {
  // Try Google first, then Microsoft. Fall back to the internal
  // appointments table so voice + web can book without OAuth.
  for (const provider of ['google', 'microsoft']) {
    const [integration] = await db
      .select({ credentials: integrations.credentials, metadata: integrations.metadata })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, provider === 'google' ? 'google_calendar' : 'microsoft_calendar'),
          eq(integrations.status, 'connected')
        )
      )
      .limit(1);

    if (integration) {
      const creds = decryptCredentials(integration.credentials as Record<string, string>);
      const meta = integration.metadata as Record<string, string>;
      const adapter = createCalendarAdapter(
        provider,
        creds,
        provider === 'google'
          ? {
              onTokens: (tokens) => {
                void persistGoogleCalendarTokens({ tenantId, tokens }).catch((err) => {
                  console.error('[scheduler] failed to persist Google token refresh:', err);
                });
              },
            }
          : undefined
      );
      return { adapter, calendarId: meta['calendar_id'] ?? 'primary' };
    }
  }

  return { adapter: new InternalCalendarAdapter(tenantId), calendarId: 'internal' };
}

async function getTenantSettings(tenantId: string): Promise<{
  appointmentTypes: AppointmentType[];
  officeHours: OfficeHours;
  timezone: string;
}> {
  const [settings] = await db
    .select({
      appointmentTypes: tenantSettings.appointmentTypes,
      officeHours: tenantSettings.officeHours,
    })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const [tenant] = await db
    .select({ timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return {
    appointmentTypes: resolveAppointmentTypes(settings?.appointmentTypes),
    officeHours: (settings?.officeHours as OfficeHours) ?? {},
    timezone: tenant?.timezone ?? 'America/New_York',
  };
}

export async function findOverlappingAppointment(opts: {
  tenantId: string;
  startAt: Date;
  endAt: Date;
  excludeId?: string;
}): Promise<typeof appointments.$inferSelect | null> {
  const rows = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, opts.tenantId),
        eq(appointments.status, 'confirmed'),
        lt(appointments.startsAt, opts.endAt),
        gt(appointments.endsAt, opts.startAt),
      ),
    )
    .limit(5);

  const hit = opts.excludeId ? rows.find((row) => row.id !== opts.excludeId) : rows[0];
  return hit ?? null;
}

// ---- Public API ----

/**
 * Get available appointment slots for a given date and appointment type.
 */
export async function getAvailableSlots(params: AvailabilityParams): Promise<TimeSlot[]> {
  const { tenantId, appointmentType } = params;
  const settings = await getTenantSettings(tenantId);
  const timezone = params.timezone || settings.timezone;
  const dateKey = params.dateKey ?? dayjs(params.date).tz(timezone).format('YYYY-MM-DD');
  const date = dayjs.tz(`${dateKey}T12:00:00`, timezone).toDate();

  const apptType = findAppointmentType(settings.appointmentTypes, appointmentType);
  if (!apptType) {
    throw new NotFoundError('Appointment type', appointmentType);
  }

  const local = dayjs.tz(`${dateKey}T12:00:00`, timezone);
  const dayKey = local.format('ddd').toLowerCase();
  if (isHolidayDate(settings.officeHours, local)) return [];
  const dayHours = lookupTodayHours(settings.officeHours, dayKey);
  if (!dayHours) return [];

  const { adapter, calendarId } = await getCalendarAdapter(tenantId);
  const slots = await adapter.listAvailableSlots({
    calendarId,
    date,
    durationMinutes: apptType.durationMin,
    bufferMinutes: apptType.bufferMin,
    timezone,
    officeOpen: dayHours.open,
    officeClose: dayHours.close,
  });

  const future = slots.filter((s) => s.startAt.getTime() > Date.now());
  // Always subtract confirmed rows. Catches bookings that never reached
  // the connected calendar (createEvent failed) and web/voice races.
  if (adapter.provider === 'internal') return future;
  const windowStart = dayjs.tz(`${dateKey}T00:00:00`, timezone).toDate();
  const windowEnd = dayjs.tz(`${dateKey}T23:59:59`, timezone).toDate();
  const busy = await listConfirmedBusyRanges(tenantId, windowStart, windowEnd);
  return filterOpenSlots(future, busy, apptType.bufferMin);
}

/**
 * Book an appointment: creates calendar event + DB record.
 */
export async function bookAppointment(params: BookAppointmentParams): Promise<typeof appointments.$inferSelect> {
  const { tenantId, contactId, callId, appointmentType, providerName, startAt, endAt, durationMinutes, notes, attendeeEmail, timezone } = params;

  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now()) {
    throw new ConflictError('That time is no longer available.');
  }

  const conflict = await findOverlappingAppointment({ tenantId, startAt, endAt });
  if (conflict) {
    throw new ConflictError('That time is no longer available.');
  }

  const { adapter, calendarId } = await getCalendarAdapter(tenantId);

  // Create calendar event
  let calendarEvent: CalendarEvent | null = null;
  try {
    calendarEvent = await adapter.createEvent({
      calendarId,
      title: `${appointmentType} — ${providerName ?? 'Any Provider'}`,
      startAt,
      endAt,
      attendeeEmails: attendeeEmail ? [attendeeEmail] : [],
      timezone,
      ...(notes ? { description: notes } : {}),
    });
  } catch (err) {
    console.error('[scheduler] Calendar event creation failed:', err);
    // Continue — appointment is still created in DB
  }

  // Save appointment to DB
  const [appointment] = await db
    .insert(appointments)
    .values({
      tenantId,
      contactId,
      callId: callId ?? null,
      calendarProvider: adapter.provider,
      calendarEventId: calendarEvent?.id ?? null,
      calendarId,
      appointmentType,
      providerName: providerName ?? null,
      startsAt: startAt,
      endsAt: endAt,
      durationMinutes,
      status: 'confirmed',
      notes: notes ?? null,
    })
    .returning();

  if (!appointment) throw new Error('Failed to create appointment');

  audit.appointmentCreated(tenantId, appointment.id, {
    appointmentType,
    startsAt: startAt,
    contactId,
  });

  // Outbound webhook + dashboard live activity. Both are fire-and-forget.
  void emitWebhook(tenantId, 'appointment.booked', {
    appointmentId: appointment.id,
    contactId,
    appointmentType,
    startsAt: startAt.toISOString(),
    endsAt: endAt.toISOString(),
    providerName: providerName ?? null,
    callId: callId ?? null,
  });
  pushActivity(tenantId, 'appointment_booked', {
    appointmentId: appointment.id,
    appointmentType,
    startsAt: startAt.toISOString(),
  });

  return appointment;
}

/**
 * Reschedule an existing appointment.
 */
export async function rescheduleAppointment(params: {
  tenantId: string;
  appointmentId: string;
  newStartAt: Date;
  newEndAt: Date;
  timezone: string;
}): Promise<typeof appointments.$inferSelect> {
  const { tenantId, appointmentId, newStartAt, newEndAt, timezone } = params;

  const [existing] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)))
    .limit(1);

  if (!existing) throw new NotFoundError('Appointment', appointmentId);

  const conflict = await findOverlappingAppointment({
    tenantId,
    startAt: newStartAt,
    endAt: newEndAt,
    excludeId: appointmentId,
  });
  if (conflict) {
    throw new ConflictError('That time is no longer available.');
  }

  const before = { ...existing };
  const { adapter } = await getCalendarAdapter(tenantId);

  // Update calendar event
  if (existing.calendarEventId) {
    try {
      await adapter.updateEvent(existing.calendarEventId, {
        calendarId: existing.calendarId ?? 'primary',
        startAt: newStartAt,
        endAt: newEndAt,
        timezone,
      });
    } catch (err) {
      console.error('[scheduler] Calendar event update failed:', err);
    }
  }

  const [updated] = await db
    .update(appointments)
    .set({ startsAt: newStartAt, endsAt: newEndAt, status: 'confirmed', updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId))
    .returning();

  if (!updated) throw new Error('Failed to update appointment');

  audit.appointmentRescheduled(tenantId, appointmentId, before, updated);
  return updated;
}

/**
 * Cancel an existing appointment.
 */
export async function cancelAppointment(params: {
  tenantId: string;
  appointmentId: string;
  reason?: string;
}): Promise<void> {
  const { tenantId, appointmentId } = params;

  const [existing] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)))
    .limit(1);

  if (!existing) throw new NotFoundError('Appointment', appointmentId);

  const before = { ...existing };
  const { adapter } = await getCalendarAdapter(tenantId);

  if (existing.calendarEventId) {
    try {
      await adapter.cancelEvent(existing.calendarEventId, existing.calendarId ?? 'primary');
    } catch (err) {
      console.error('[scheduler] Calendar event cancellation failed:', err);
    }
  }

  await db
    .update(appointments)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));

  audit.appointmentCancelled(tenantId, appointmentId, before);

  void emitWebhook(tenantId, 'appointment.cancelled', {
    appointmentId,
    contactId: existing.contactId,
    appointmentType: existing.appointmentType,
    startsAt: existing.startsAt?.toISOString?.() ?? existing.startsAt,
    reason: params.reason ?? null,
  });
  pushActivity(tenantId, 'appointment_cancelled', {
    appointmentId,
    appointmentType: existing.appointmentType,
  });
}

/**
 * Get upcoming appointments for a contact.
 */
export async function getUpcomingAppointments(
  tenantId: string,
  contactId: string
): Promise<typeof appointments.$inferSelect[]> {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.contactId, contactId),
        eq(appointments.status, 'confirmed'),
        gte(appointments.startsAt, new Date())
      )
    )
    .limit(10);
}
