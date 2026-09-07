'use client';
import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { mutate } from 'swr';
import { importContactsCsvAndWait } from '@/lib/import-contacts-csv';
import { useToast } from '@/components/ui/toast';
import { useVertical } from '@/lib/useVertical';

export function CsvImportButton({
  variant = 'primary',
  label,
}: {
  variant?: 'primary' | 'secondary';
  label?: string;
}) {
  const toast = useToast();
  const vertical = useVertical();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const contactsLabel = vertical.contactNounPlural;

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const result = await importContactsCsvAndWait(file);
      toast.success(
        `Imported ${result.imported} ${contactsLabel}${result.skipped ? ` · ${result.skipped} skipped` : ''}`
      );
      await Promise.all([
        mutate((key) => Array.isArray(key) && key[0] === 'contacts'),
        mutate('contacts-golive'),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={
          variant === 'primary'
            ? 'btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-60'
            : 'btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-60'
        }
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? 'Importing…' : label ?? `Import ${contactsLabel} CSV`}
      </button>
    </>
  );
}
