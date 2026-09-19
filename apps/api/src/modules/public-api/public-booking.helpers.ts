// ============================================================
// Public booking — pure helpers (unit-tested, no DB).
// ============================================================
import type { AppointmentType } from '@ai-receptionist/shared';
import { lookupTodayHours } from '../telephony/office-hours.js';

export const PUBLIC_BOOKING_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
export const PUBLIC_BOOKING_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const PUBLIC_BOOKING_MAX_DAYS_AHEAD = 60;

export const BOOKING_UPGRADE_MESSAGE =
  'Online booking is not live on the Free plan. Upgrade to take appointments from this page.';

export const BOOKING_NOT_LIVE_VISITOR_MESSAGE =
  'Online booking is not live yet. Please call the business to make an appointment.';

const DAY_LABELS: Array<{ key: string; label: string }> = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export function isValidBookingSlug(slug: string): boolean {
  return PUBLIC_BOOKING_SLUG_RE.test(slug.trim());
}

export function isValidBookingDateKey(dateKey: string): boolean {
  if (!PUBLIC_BOOKING_DATE_RE.test(dateKey)) return false;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === (m ?? 1) - 1 && dt.getUTCDate() === d;
}

export function splitCustomerName(raw: string): { firstName: string; lastName: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Guest', lastName: 'Customer' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '-' };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export function isEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function formatHoursForPublicPage(officeHours: unknown): Array<{
  key: string;
  label: string;
  open: string | null;
  close: string | null;
  closed: boolean;
}> {
  return DAY_LABELS.map(({ key, label }) => {
    const hours = lookupTodayHours(officeHours as never, key);
    if (!hours) return { key, label, open: null, close: null, closed: true };
    return { key, label, open: hours.open, close: hours.close, closed: false };
  });
}

export function publicServices(types: AppointmentType[]): Array<{
  id: string;
  name: string;
  durationMinutes: number;
}> {
  return types.map((t) => ({
    id: t.id,
    name: t.name,
    durationMinutes: t.durationMin,
  }));
}

export function assertBookableDateKey(dateKey: string, now = new Date()): string | null {
  if (!isValidBookingDateKey(dateKey)) return 'Pick a valid date.';
  // Yesterday UTC so evening US timezones are not rejected at the date-key layer.
  // Slot generation still drops times that have already passed.
  const floor = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (dateKey < floor) return 'Pick a date that is still upcoming.';
  const max = new Date(now.getTime() + PUBLIC_BOOKING_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (dateKey > max) return `Pick a date within the next ${PUBLIC_BOOKING_MAX_DAYS_AHEAD} days.`;
  return null;
}

