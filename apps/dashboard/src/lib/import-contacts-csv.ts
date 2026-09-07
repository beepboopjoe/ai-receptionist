import { contactsApi } from './api';

export interface ContactsCsvImportResult {
  imported: number;
  skipped: number;
}

export async function importContactsCsvAndWait(file: File): Promise<ContactsCsvImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await contactsApi.importCsv(formData);
  if (!res.jobId) {
    if (typeof res.imported === 'number') {
      return { imported: res.imported, skipped: typeof res.errors === 'number' ? res.errors : 0 };
    }
    throw new Error(res.message ?? 'Upload failed');
  }

  const started = Date.now();
  while (Date.now() - started < 30_000) {
    const status = await contactsApi.getImport(res.jobId);
    if (status.status === 'completed' || status.status === 'failed') {
      return { imported: status.imported, skipped: status.skipped };
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error('Import is still processing — refresh in a moment.');
}
