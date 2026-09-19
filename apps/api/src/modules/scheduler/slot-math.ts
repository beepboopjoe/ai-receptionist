// ============================================================
// Shared slot math — same 15-minute grid the Google adapter uses.
// Internal calendar + public booking reuse this so phone / text / web
// see the same windows. Buffer is reserved after the appointment
// but is not part of the booked end time.
// ============================================================
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import type { TimeSlot } from './adapters/base.adapter.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface BusyRange {
  start: Date;
  end: Date;
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function overlapsAny(start: Date, end: Date, busy: BusyRange[]): boolean {
  return busy.some((b) => rangesOverlap(start, end, b.start, b.end));
}

export function generateCandidateSlots(opts: {
  dateKey: string;
  timezone: string;
  officeOpen: string;
  officeClose: string;
  durationMinutes: number;
  bufferMinutes?: number;
  now?: Date;
}): TimeSlot[] {
  const { dateKey, timezone: tz, officeOpen, officeClose, durationMinutes } = opts;
  const bufferMinutes = opts.bufferMinutes ?? 0;
  const now = opts.now ?? new Date();

  const dayStart = dayjs.tz(`${dateKey}T${officeOpen}`, tz);
  const dayEnd = dayjs.tz(`${dateKey}T${officeClose}`, tz);
  if (!dayStart.isValid() || !dayEnd.isValid() || !dayEnd.isAfter(dayStart)) return [];

  const slots: TimeSlot[] = [];
  let current = dayStart;

  while (
    current.add(durationMinutes, 'minute').isBefore(dayEnd) ||
    current.add(durationMinutes, 'minute').isSame(dayEnd)
  ) {
    const startAt = current.toDate();
    const endAt = current.add(durationMinutes, 'minute').toDate();
    slots.push({
      startAt,
      endAt,
      available: startAt.getTime() > now.getTime(),
    });
    current = current.add(15, 'minute');
  }

  return slots;
}

export function filterOpenSlots(
  slots: TimeSlot[],
  busy: BusyRange[],
  bufferMinutes = 0,
): TimeSlot[] {
  return slots.filter((slot) => {
    if (!slot.available) return false;
    const reservedEnd = new Date(slot.endAt.getTime() + bufferMinutes * 60_000);
    return !overlapsAny(slot.startAt, reservedEnd, busy);
  });
}
