import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone as any);

export type DialWindowResult =
  | { allowed: true }
  | { allowed: false; msUntilOpen: number; reason: 'before_window' | 'after_window' };

/**
 * Check whether the current time falls inside the configured dial window
 * for a given timezone. Returns whether dialling is allowed now, and if not,
 * how many milliseconds until the window opens.
 *
 * Pure function — no side effects, no DB calls. Exported for testing.
 */
export function checkDialWindow(params: {
  now: Date;
  timezone: string;
  windowStart: string; // "HH:MM"
  windowEnd: string;   // "HH:MM"
}): DialWindowResult {
  const { now, timezone: tz, windowStart, windowEnd } = params;
  const nowInTz = dayjs(now).tz(tz);

  const [startH, startM] = windowStart.split(':').map(Number);
  const [endH, endM] = windowEnd.split(':').map(Number);

  const openToday = nowInTz.clone().hour(startH ?? 9).minute(startM ?? 0).second(0).millisecond(0);
  const closeToday = nowInTz.clone().hour(endH ?? 17).minute(endM ?? 0).second(0).millisecond(0);

  if (nowInTz.isBefore(openToday)) {
    return {
      allowed: false,
      msUntilOpen: openToday.diff(nowInTz, 'millisecond'),
      reason: 'before_window',
    };
  }

  if (nowInTz.isAfter(closeToday) || nowInTz.isSame(closeToday)) {
    // Next opening is tomorrow
    const openTomorrow = openToday.add(1, 'day');
    return {
      allowed: false,
      msUntilOpen: openTomorrow.diff(nowInTz, 'millisecond'),
      reason: 'after_window',
    };
  }

  return { allowed: true };
}
