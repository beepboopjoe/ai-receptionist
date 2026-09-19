// ============================================================
// Internal calendar — office hours minus confirmed appointments.
// Used when Google / Microsoft is not connected so phone, text,
// and the public booking page still share one store.
// ============================================================
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { appointments } from '../../../db/schema.js';
import type {
  CalendarEvent,
  CreateEventParams,
  ICalendarAdapter,
  ListSlotsParams,
  TimeSlot,
} from './base.adapter.js';
import { filterOpenSlots, generateCandidateSlots, type BusyRange } from '../slot-math.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export class InternalCalendarAdapter implements ICalendarAdapter {
  readonly provider = 'internal' as const;

  constructor(private readonly tenantId: string) {}

  async listAvailableSlots(params: ListSlotsParams): Promise<TimeSlot[]> {
    const openTime = params.officeOpen ?? '09:00';
    const closeTime = params.officeClose ?? '17:00';
    const dateKey = dayjs(params.date).tz(params.timezone).format('YYYY-MM-DD');
    const candidates = generateCandidateSlots({
      dateKey,
      timezone: params.timezone,
      officeOpen: openTime,
      officeClose: closeTime,
      durationMinutes: params.durationMinutes,
      bufferMinutes: params.bufferMinutes ?? 0,
    });
    if (candidates.length === 0) return [];

    const windowStart = dayjs.tz(`${dateKey}T00:00:00`, params.timezone).toDate();
    const windowEnd = dayjs.tz(`${dateKey}T23:59:59`, params.timezone).toDate();
    const busy = await listConfirmedBusyRanges(this.tenantId, windowStart, windowEnd);
    return filterOpenSlots(candidates, busy, params.bufferMinutes ?? 0);
  }

  async createEvent(params: CreateEventParams): Promise<CalendarEvent> {
    const id = randomUUID();
    return {
      id,
      providerEventId: id,
      title: params.title,
      startAt: params.startAt,
      endAt: params.endAt,
      attendees: params.attendeeEmails ?? [],
      calendarId: params.calendarId || 'internal',
    };
  }

  async updateEvent(eventId: string, params: Partial<CreateEventParams>): Promise<CalendarEvent> {
    return {
      id: eventId,
      providerEventId: eventId,
      title: params.title ?? '',
      startAt: params.startAt ?? new Date(),
      endAt: params.endAt ?? new Date(),
      attendees: params.attendeeEmails ?? [],
      calendarId: params.calendarId ?? 'internal',
    };
  }

  async cancelEvent(_eventId: string, _calendarId: string): Promise<void> {
    // DB status is the source of truth for the internal calendar.
  }

  async getEvent(_eventId: string, _calendarId: string): Promise<CalendarEvent | null> {
    return null;
  }

  async listCalendars(_credentials: Record<string, string>): Promise<Array<{ id: string; name: string }>> {
    return [{ id: 'internal', name: 'Telfin calendar' }];
  }
}

export async function listConfirmedBusyRanges(
  tenantId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<BusyRange[]> {
  const rows = await db
    .select({
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, 'confirmed'),
        lt(appointments.startsAt, windowEnd),
        gt(appointments.endsAt, windowStart),
      ),
    );

  return rows.map((row) => ({
    start: row.startsAt instanceof Date ? row.startsAt : new Date(row.startsAt),
    end: row.endsAt instanceof Date ? row.endsAt : new Date(row.endsAt),
  }));
}
