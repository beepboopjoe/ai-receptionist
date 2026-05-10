'use client';
// ============================================================
// DownloadCsvButton — drop-in download button for any list page.
//
// Usage:
//   <DownloadCsvButton
//     rows={calls}
//     columns={[
//       { label: 'From', value: (c) => c.fromNumber },
//       { label: 'Status', value: (c) => c.status },
//       { label: 'Started', value: (c) => c.startedAt && new Date(c.startedAt) },
//     ]}
//     filename="calls.csv"
//   />
// ============================================================
import { Download } from 'lucide-react';
import { downloadCsv, type CsvColumn } from '@/lib/csv';
import { useToast } from '@/components/ui/toast';

interface Props<T> {
  rows: readonly T[];
  columns: readonly CsvColumn<T>[];
  filename: string;
  /** Override the button label. Defaults to "Download CSV". */
  label?: string;
  /** Disable the button when there's nothing to export. Defaults to true. */
  disableWhenEmpty?: boolean;
  className?: string;
}

export function DownloadCsvButton<T>({
  rows,
  columns,
  filename,
  label = 'Download CSV',
  disableWhenEmpty = true,
  className = '',
}: Props<T>) {
  const toast = useToast();
  const isEmpty = rows.length === 0;

  function handleClick() {
    try {
      downloadCsv(rows, columns, filename);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate CSV');
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disableWhenEmpty && isEmpty}
      className={`btn-secondary text-sm ${className}`}
      title={isEmpty ? 'No rows to export' : `Download ${rows.length} rows as CSV`}
    >
      <Download size={14} /> {label}
    </button>
  );
}
