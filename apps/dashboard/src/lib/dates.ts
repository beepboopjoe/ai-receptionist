// Safe date formatting — never render "Invalid Date" for null/empty/garbage.

export function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTimeOrDash(
  value: unknown,
  opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' },
): string {
  const d = parseDate(value);
  return d ? d.toLocaleTimeString([], opts) : '—';
}
