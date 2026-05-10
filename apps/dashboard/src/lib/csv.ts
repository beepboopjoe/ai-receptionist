// ============================================================
// Browser-side CSV export
//
// Tiny zero-dependency helper that turns an array of objects into
// a CSV blob and triggers a download. Used by the <DownloadCsvButton>
// component on every list page (calls, contacts, appointments,
// escalations, campaigns, webhook deliveries).
//
// CSV escaping rules implemented:
//   - Wrap in double quotes if the value contains a quote, comma, or newline.
//   - Double any embedded quote.
//   - null/undefined render as empty cell.
//   - Date objects render as ISO 8601.
//   - Non-string primitives use String(...) coercion.
// ============================================================

export interface CsvColumn<T> {
  /** Header label written in row 1. */
  label: string;
  /** Cell value extractor. Returning null/undefined yields an empty cell. */
  value: (row: T) => unknown;
}

function escapeCell(input: unknown): string {
  if (input === null || input === undefined) return '';
  let value: string;
  if (input instanceof Date) {
    value = input.toISOString();
  } else if (typeof input === 'object') {
    value = JSON.stringify(input);
  } else {
    value = String(input);
  }
  // Wrap in quotes if the cell would otherwise break the CSV parser.
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Convert rows to a CSV string. Exposed for testing + non-download use cases. */
export function rowsToCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(',')
  );
  return [header, ...lines].join('\r\n');
}

/**
 * Trigger a browser download of `rows` as `filename`. Safe to call from
 * a click handler — uses `URL.createObjectURL` so no server round-trip.
 */
export function downloadCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  filename: string
): void {
  if (typeof window === 'undefined') return;
  const csv = rowsToCsv(rows, columns);
  // BOM so Excel opens UTF-8 cleanly with non-ASCII characters.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke after a tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
