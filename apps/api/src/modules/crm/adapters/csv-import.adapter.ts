// ============================================================
// CSV import adapter — bulk contact creation from uploaded CSV
// ============================================================
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { db } from '../../../db/client.js';
import { contacts } from '../../../db/schema.js';
import { normalizePhone, normalizeName, normalizeEmail, parseDate } from '../contact-normalizer.js';
import type { CsvImportStatus } from '@ai-receptionist/shared';
import Redis from 'ioredis';
import { config } from '../../../config.js';

// Required CSV columns
const REQUIRED_COLUMNS = ['first_name', 'last_name', 'phone'];

interface CsvRow {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  date_of_birth?: string;
  insurance_provider?: string;
  notes?: string;
  recall_due_date?: string;
}

function getRedis(): Redis {
  return new Redis(config.REDIS_URL, { lazyConnect: true });
}

function importKey(jobId: string): string {
  return `csv_import:${jobId}`;
}

/**
 * Save import job status to Redis (expires after 24h).
 */
async function saveJobStatus(jobId: string, status: CsvImportStatus): Promise<void> {
  const redis = getRedis();
  await redis.set(importKey(jobId), JSON.stringify(status), 'EX', 86400);
  await redis.quit();
}

/**
 * Get import job status from Redis.
 */
export async function getImportJobStatus(jobId: string): Promise<CsvImportStatus | null> {
  const redis = getRedis();
  const raw = await redis.get(importKey(jobId));
  await redis.quit();
  if (!raw) return null;
  return JSON.parse(raw) as CsvImportStatus;
}

/**
 * Process a CSV file buffer and import contacts.
 * Runs asynchronously — progress is tracked in Redis.
 */
export async function importContactsCsv(params: {
  tenantId: string;
  jobId: string;
  csvBuffer: Buffer;
}): Promise<void> {
  const { tenantId, jobId, csvBuffer } = params;

  // Parse CSV
  const rows: CsvRow[] = await new Promise((resolve, reject) => {
    const records: CsvRow[] = [];
    const parser = parse({ columns: true, trim: true, skip_empty_lines: true });
    parser.on('readable', () => {
      let row: CsvRow;
      while ((row = parser.read() as CsvRow) !== null) {
        records.push(row);
      }
    });
    parser.on('error', reject);
    parser.on('end', () => resolve(records));
    Readable.from(csvBuffer).pipe(parser);
  });

  const status: CsvImportStatus = {
    jobId,
    status: 'processing',
    total: rows.length,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  await saveJobStatus(jobId, status);

  // Process rows in batches of 100
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    for (const [idx, row] of batch.entries()) {
      const rowNum = i + idx + 1;

      // Validate required columns
      if (!row.first_name || !row.last_name || !row.phone) {
        status.skipped++;
        status.errors.push({ row: rowNum, reason: 'Missing required column(s): first_name, last_name, phone' });
        continue;
      }

      const phone = normalizePhone(row.phone);
      if (!phone) {
        status.skipped++;
        status.errors.push({ row: rowNum, reason: `Invalid phone number: ${row.phone}` });
        continue;
      }

      try {
        await db
          .insert(contacts)
          .values({
            tenantId,
            firstName: normalizeName(row.first_name),
            lastName: normalizeName(row.last_name),
            phoneE164: phone,
            email: row.email ? normalizeEmail(row.email) : null,
            dateOfBirth: row.date_of_birth ? parseDate(row.date_of_birth) : null,
            patientType: 'existing',
            insuranceProvider: row.insurance_provider ?? null,
            notes: row.notes ?? null,
            recallDueDate: row.recall_due_date ? parseDate(row.recall_due_date) : null,
            source: 'csv_import',
          })
          .onConflictDoUpdate({
            target: [contacts.tenantId, contacts.phoneE164],
            set: {
              firstName: normalizeName(row.first_name),
              lastName: normalizeName(row.last_name),
              email: row.email ? normalizeEmail(row.email) : null,
              updatedAt: new Date(),
            },
          });

        status.imported++;
      } catch (err) {
        status.skipped++;
        status.errors.push({ row: rowNum, reason: String(err) });
      }
    }

    // Save progress after each batch
    await saveJobStatus(jobId, status);
  }

  status.status = 'completed';
  await saveJobStatus(jobId, status);
}
