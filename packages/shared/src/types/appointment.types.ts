// ============================================================
// Appointment & Calendar Types
// ============================================================

export type CalendarProvider = 'google' | 'microsoft' | 'internal';

export type AppointmentStatus =
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'rescheduled';

export interface Appointment {
  id: string;
  tenantId: string;
  contactId: string;
  callId: string | null;
  calendarProvider: CalendarProvider;
  calendarEventId: string | null;
  calendarId: string | null;
  appointmentType: string;
  providerName: string | null;
  startsAt: string; // ISO 8601
  endsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  reminder24hSent: boolean;
  reminder2hSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentType {
  id: string;
  name: string;
  durationMin: number;
  bufferMin: number;
}

// ---- Calendar Adapter Interface ----

export interface TimeSlot {
  startAt: Date;
  endAt: Date;
  available: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  attendees: string[];
  calendarId: string;
  providerEventId: string;
}

export interface CreateEventParams {
  calendarId: string;
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  attendeeEmails?: string[];
  timezone: string;
}

export interface ListSlotsParams {
  calendarId: string;
  date: Date;
  durationMinutes: number;
  timezone: string;
  bufferMinutes?: number;
  officeOpen?: string;  // "09:00"
  officeClose?: string; // "17:00"
}

export interface ICalendarAdapter {
  readonly provider: CalendarProvider;
  listAvailableSlots(params: ListSlotsParams): Promise<TimeSlot[]>;
  createEvent(params: CreateEventParams): Promise<CalendarEvent>;
  updateEvent(eventId: string, params: Partial<CreateEventParams>): Promise<CalendarEvent>;
  cancelEvent(eventId: string, calendarId: string): Promise<void>;
  getEvent(eventId: string, calendarId: string): Promise<CalendarEvent | null>;
  listCalendars(credentials: Record<string, string>): Promise<Array<{ id: string; name: string }>>;
}
