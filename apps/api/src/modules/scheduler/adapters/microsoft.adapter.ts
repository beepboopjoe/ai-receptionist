// ============================================================
// Microsoft Graph Calendar adapter
// ============================================================
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

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

interface MsEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ emailAddress: { address: string } }>;
}

export class MicrosoftCalendarAdapter implements ICalendarAdapter {
  readonly provider = 'microsoft' as const;

  constructor(private credentials: Record<string, string>) {}

  private get accessToken(): string {
    return this.credentials['access_token'] ?? '';
  }

  private async graphFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new IntegrationError('microsoft_calendar', `Graph API error: ${err}`);
    }
    return res;
  }

  async listAvailableSlots(params: ListSlotsParams): Promise<TimeSlot[]> {
    const { date, durationMinutes, timezone: tz, bufferMinutes = 0 } = params;

    const openTime = params.officeOpen ?? '09:00';
    const closeTime = params.officeClose ?? '17:00';

    const dayStart = dayjs.tz(`${dayjs(date).format('YYYY-MM-DD')}T${openTime}`, tz);
    const dayEnd = dayjs.tz(`${dayjs(date).format('YYYY-MM-DD')}T${closeTime}`, tz);

    // Get schedule availability
    const res = await this.graphFetch('/me/calendar/getSchedule', {
      method: 'POST',
      body: JSON.stringify({
        schedules: ['me'],
        startTime: { dateTime: dayStart.toISOString(), timeZone: 'UTC' },
        endTime: { dateTime: dayEnd.toISOString(), timeZone: 'UTC' },
        availabilityViewInterval: 15,
      }),
    });

    const data = await res.json() as {
      value: Array<{
        scheduleItems: Array<{ start: { dateTime: string }; end: { dateTime: string } }>;
      }>;
    };

    const busyItems = data.value[0]?.scheduleItems ?? [];
    const busyTimes = busyItems.map((item) => ({
      start: new Date(item.start.dateTime),
      end: new Date(item.end.dateTime),
    }));

    const slots: TimeSlot[] = [];
    const slotDuration = durationMinutes + bufferMinutes;
    let current = dayStart;

    while (current.add(durationMinutes, 'minute').isBefore(dayEnd) || current.add(durationMinutes, 'minute').isSame(dayEnd)) {
      const slotEnd = current.add(slotDuration, 'minute');
      const available = !busyTimes.some(
        (busy) => current.toDate() < busy.end && slotEnd.toDate() > busy.start
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
    const body = {
      subject: params.title,
      body: { contentType: 'text', content: params.description ?? '' },
      start: { dateTime: params.startAt.toISOString(), timeZone: params.timezone },
      end: { dateTime: params.endAt.toISOString(), timeZone: params.timezone },
      attendees: params.attendeeEmails?.map((email) => ({
        emailAddress: { address: email },
        type: 'required',
      })),
    };

    const res = await this.graphFetch('/me/events', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const event = await res.json() as MsEvent;
    return this.mapEvent(event);
  }

  async updateEvent(eventId: string, params: Partial<CreateEventParams>): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {};
    if (params.title) body['subject'] = params.title;
    if (params.startAt)
      body['start'] = { dateTime: params.startAt.toISOString(), timeZone: params.timezone };
    if (params.endAt)
      body['end'] = { dateTime: params.endAt.toISOString(), timeZone: params.timezone };

    const res = await this.graphFetch(`/me/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    return this.mapEvent(await res.json() as MsEvent);
  }

  async cancelEvent(eventId: string, _calendarId: string): Promise<void> {
    await this.graphFetch(`/me/events/${eventId}`, { method: 'DELETE' });
  }

  async getEvent(eventId: string, _calendarId: string): Promise<CalendarEvent | null> {
    try {
      const res = await this.graphFetch(`/me/events/${eventId}`);
      return this.mapEvent(await res.json() as MsEvent);
    } catch {
      return null;
    }
  }

  async listCalendars(_creds: Record<string, string>): Promise<Array<{ id: string; name: string }>> {
    const res = await this.graphFetch('/me/calendars');
    const data = await res.json() as { value: Array<{ id: string; name: string }> };
    return data.value.map((c) => ({ id: c.id, name: c.name }));
  }

  private mapEvent(event: MsEvent): CalendarEvent {
    return {
      id: event.id,
      providerEventId: event.id,
      title: event.subject,
      startAt: new Date(event.start.dateTime),
      endAt: new Date(event.end.dateTime),
      attendees: (event.attendees ?? []).map((a) => a.emailAddress.address),
      calendarId: 'primary',
    };
  }
}
