// ============================================================
// Appointment-type normalization.
// Signup stores duration_min / buffer_min; shared types and the
// scheduler use durationMin / bufferMin. Accept both.
// ============================================================
import type { AppointmentType } from '@ai-receptionist/shared';

export const FALLBACK_APPOINTMENT_TYPES: AppointmentType[] = [
  { id: 'consultation', name: 'Consultation', durationMin: 30, bufferMin: 10 },
  { id: 'follow_up', name: 'Follow-Up', durationMin: 30, bufferMin: 5 },
];

export function normalizeAppointmentType(raw: unknown): AppointmentType | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === 'string' ? rec.id.trim() : '';
  if (!id) return null;
  const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : id;
  const durationMin = Number(rec.durationMin ?? rec.duration_min ?? 30);
  const bufferMin = Number(rec.bufferMin ?? rec.buffer_min ?? 0);
  return {
    id,
    name,
    durationMin: Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 30,
    bufferMin: Number.isFinite(bufferMin) && bufferMin >= 0 ? bufferMin : 0,
  };
}

export function normalizeAppointmentTypes(raw: unknown): AppointmentType[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAppointmentType).filter((t): t is AppointmentType => t !== null);
}

export function resolveAppointmentTypes(raw: unknown): AppointmentType[] {
  const types = normalizeAppointmentTypes(raw);
  return types.length > 0 ? types : FALLBACK_APPOINTMENT_TYPES;
}

export function findAppointmentType(
  types: AppointmentType[],
  needle: string,
): AppointmentType | undefined {
  const key = needle.trim().toLowerCase();
  if (!key) return undefined;
  return types.find((t) => t.id.toLowerCase() === key || t.name.toLowerCase() === key);
}
