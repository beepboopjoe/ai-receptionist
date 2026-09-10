// ============================================================
// Office-hours helpers for inbound workflow selection.
//
// media-stream keys days as dayjs `ddd` (mon/tue/…). Signup/dashboard
// sometimes stores monday/… + {open:boolean, start, end}. Demo tenant
// settings include both shapes and are 00:00–23:59 every day.
// ============================================================
import type { DayHours, OfficeHours } from '@ai-receptionist/shared';
import type { Dayjs } from 'dayjs';

const STREAM_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function isAlwaysOpenWindow(open: string, close: string): boolean {
  const o = open.trim();
  const c = close.trim();
  return o === '00:00' && (c === '23:59' || c === '24:00');
}

/**
 * True when now is outside [open, close). A 00:00–23:59 (or 24:00) window
 * is treated as always open, including the final minute of the day.
 */
export function isOutsideHours(now: Dayjs, open: string, close: string): boolean {
  if (isAlwaysOpenWindow(open, close)) return false;
  const [openH = 9, openM = 0] = open.split(':').map(Number);
  const [closeH = 17, closeM = 0] = close.split(':').map(Number);
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  const nowMins = now.hour() * 60 + now.minute();
  return nowMins < openMins || nowMins >= closeMins;
}

function asStreamDayHours(value: unknown): DayHours | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec['open'] === 'string' && typeof rec['close'] === 'string') {
    return { open: rec['open'], close: rec['close'] };
  }
  // Dashboard/signup shape: { open: boolean, start, end }
  if (typeof rec['start'] === 'string' && typeof rec['end'] === 'string') {
    if (rec['open'] === false) return null;
    return { open: rec['start'], close: rec['end'] };
  }
  return null;
}

export function lookupTodayHours(
  officeHours: OfficeHours | Record<string, unknown>,
  dayKey: string,
): DayHours | null {
  const rec = officeHours as Record<string, unknown>;
  const direct = asStreamDayHours(rec[dayKey]);
  if (direct) return direct;

  const longNames: Record<string, string> = {
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday',
    sun: 'sunday',
  };
  const long = longNames[dayKey];
  if (long) {
    const fromLong = asStreamDayHours(rec[long]);
    if (fromLong) return fromLong;
  }
  return null;
}

/**
 * Whether this inbound call should use the after-hours workflow.
 * Demo / call-me is always treated as open so callers never hear
 * "we're closed" on the public product demo.
 */
function holidayDates(officeHours: OfficeHours | Record<string, unknown>): string[] {
  const rec = officeHours as Record<string, unknown>;
  return Array.isArray(rec.holidays)
    ? rec.holidays.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
    : [];
}

export function isHolidayDate(
  officeHours: OfficeHours | Record<string, unknown>,
  now: Dayjs,
): boolean {
  return holidayDates(officeHours).includes(now.format('YYYY-MM-DD'));
}

export function isAfterHoursCall(opts: {
  now: Dayjs;
  officeHours: OfficeHours | Record<string, unknown>;
  /** dayjs `ddd`.toLowerCase() — mon/tue/… */
  dayKey: string;
  isDemo?: boolean;
}): boolean {
  if (opts.isDemo) return false;
  if (isHolidayDate(opts.officeHours, opts.now)) return true;
  const today = lookupTodayHours(opts.officeHours, opts.dayKey);
  if (!today) return true;
  return isOutsideHours(opts.now, today.open, today.close);
}

/** True when every weekday `mon`–`sun` is a 00:00–23:59/24:00 window. */
export function hasAlwaysOpenStreamHours(hours: unknown): boolean {
  if (!hours || typeof hours !== 'object') return false;
  const rec = hours as Record<string, unknown>;
  return STREAM_DAYS.every((day) => {
    const h = asStreamDayHours(rec[day]);
    return Boolean(h && isAlwaysOpenWindow(h.open, h.close));
  });
}
