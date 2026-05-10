// ============================================================
// Google Calendar adapter
// ============================================================
import { google, type calendar_v3 } from 'googleapis';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import type {
  ICalendarAdapter,
  TimeSlot,
  CalendarEvent,
  CreateEventParams,
  ListSlotsParams,
} from './base.adapter.js';
import { IntegrationError } from '../../../lib/errors.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export class GoogleCalendarAdapter implements ICalendarAdapter {
  readonly provider = 'google' as const;
  private calendar: calendar_v3.Calendar;

  constructor(private credentials: Record<string, string>) {
    const auth = new google.auth.OAuth2(
      credentials['google_client_id'],
      credentials['google_client_secret']
    );
    auth.setCredentials({
      access_token: credentials['access_token'],
      refresh_token: credentials['refresh_token'],
    });
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async listAvailableSlots(params: ListSlotsParams): Promise<TimeSlot[]> {
    const { calendarId, date, durationMinutes, timezone: tz, bufferMinutes = 0 } = params;

    const openTime = params.officeOpen ?? '09:00';
    const closeTime = params.officeClose ?? '17:00';

    const dayStart = dayjs.tz(
      `${dayjs(date).format('YYYY-MM-DD')}T${openTime}`,
      tz
    );
    const dayEnd = dayjs.tz(
      `${dayjs(date).format('YYYY-MM-DD')}T${closeTime}`,
      tz
    );

    // Fetch existing events to find busy times
    let busyTimes: Array<{ start: Date; end: Date }> = [];
    try {
      const freebusyRes = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          items: [{ id: calendarId }],
        },
      });

      const busy = freebusyRes.data.calendars?.[calendarId]?.busy ?? [];
      busyTimes = busy.map((b) => ({
        start: new Date(b.start ?? ''),
        end: new Date(b.end ?? ''),
      }));
    } catch (err) {
      throw new IntegrationError('google_calendar', `Free/busy query failed: ${String(err)}`);
    }

    // Generate candidate slots every 15 minutes
    const slots: TimeSlot[] = [];
    const slotDuration = durationMinutes + bufferMinutes;
    let current = dayStart;

    while (current.add(durationMinutes, 'minute').isBefore(dayEnd) || current.add(durationMinutes, 'minute').isSame(dayEnd)) {
      const slotEnd = current.add(slotDuration, 'minute');
      const available = !busyTimes.some(
        (busy) =>
          current.toDate() < busy.end && slotEnd.toDate() > busy.start
      );
      slots.push({
        startAt: current.toDate(),
        endAt: current.add(durationMinutes, 'minute').toDate(),
        available,
      });
      current = current.add(15, 'minute');
    }

    return slots.filter((s) => s.available);
  }

  async createEvent(params: CreateEventParams): Promise<CalendarEvent> {
    try {
      const res = await this.calendar.events.insert({
        calendarId: params.calendarId,
        requestBody: {
          summary: params.title,
          description: params.description,
          start: { dateTime: params.startAt.toISOString(), timeZone: params.timezone },
          end: { dateTime: params.endAt.toISOString(), timeZone: params.timezone },
          attendees: params.attendeeEmails?.map((email) => ({ email })),
        },
      });

      const event = res.data;
      return this.mapEvent(event, params.calendarId);
    } catch (err) {
      throw new IntegrationError('google_calendar', `Event creation failed: ${String(err)}`);
    }
  }

  async updateEvent(eventId: string, params: Partial<CreateEventParams>): Promise<CalendarEvent> {
    const calendarId = params.calendarId ?? 'primary';
    try {
      const res = await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          summary: params.title,
          description: params.description,
          start: params.startAt
            ? { dateTime: params.startAt.toISOString(), timeZone: params.timezone }
            : undefined,
          end: params.endAt
            ? { dateTime: params.endAt.toISOString(), timeZone: params.timezone }
            : undefined,
        },
      });
      return this.mapEvent(res.data, calendarId);
    } catch (err) {
      throw new IntegrationError('google_calendar', `Event update failed: ${String(err)}`);
    }
  }

  async cancelEvent(eventId: string, calendarId: string): Promise<void> {
    try {
      await this.calendar.events.delete({ calendarId, eventId });
    } catch (err) {
      throw new IntegrationError('google_calendar', `Event cancellation failed: ${String(err)}`);
    }
  }

  async getEvent(eventId: string, calendarId: string): Promise<CalendarEvent | null> {
    try {
      const res = await this.calendar.events.get({ calendarId, eventId });
      return this.mapEvent(res.data, calendarId);
    } catch {
      return null;
    }
  }

  async listCalendars(_creds: Record<string, string>): Promise<Array<{ id: string; name: string }>> {
    try {
      const res = await this.calendar.calendarList.list();
      return (res.data.items ?? []).map((c) => ({
        id: c.id ?? '',
        name: c.summary ?? c.id ?? '',
      }));
    } catch (err) {
      throw new IntegrationError('google_calendar', `Calendar list failed: ${String(err)}`);
    }
  }

  private mapEvent(event: calendar_v3.Schema$Event, calendarId: string): CalendarEvent {
    return {
      id: event.id ?? '',
      providerEventId: event.id ?? '',
      title: event.summary ?? '',
      startAt: new Date(event.start?.dateTime ?? event.start?.date ?? ''),
      endAt: new Date(event.end?.dateTime ?? event.end?.date ?? ''),
      attendees: (event.attendees ?? []).map((a) => a.email ?? '').filter(Boolean),
      calendarId,
    };
  }
}
