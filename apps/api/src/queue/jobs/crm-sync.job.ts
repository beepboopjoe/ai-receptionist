// ============================================================
// crm-sync job — async contact upsert after a call
// Runs in the background so it never blocks the voice flow
// ============================================================
import type { Job } from 'bullmq';
import { db } from '../../db/client.js';
import { contacts } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { normalizePhone } from '../../modules/crm/contact-normalizer.js';

export interface CrmSyncJobData {
  tenantId: string;
  phone: string;
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string;
    insuranceProvider?: string;
    insuranceId?: string;
    notes?: string;
    source?: string;
  };
}

export async function processCrmSync(job: Job<CrmSyncJobData>): Promise<void> {
  const { tenantId, phone, data } = job.data;
  const phoneE164 = normalizePhone(phone);
  if (!phoneE164) return;

  await db
    .insert(contacts)
    .values({
      tenantId,
      phoneE164,
      firstName: data.firstName ?? 'Unknown',
      lastName: data.lastName ?? '',
      email: data.email,
      dateOfBirth: data.dateOfBirth,
      insuranceProvider: data.insuranceProvider,
      insuranceId: data.insuranceId,
      notes: data.notes,
      source: (data.source as 'call' | 'manual' | 'csv_import' | 'crm_sync') ?? 'call',
      patientType: 'new',
    })
    .onConflictDoUpdate({
      target: [contacts.tenantId, contacts.phoneE164],
      set: {
        firstName: data.firstName ?? contacts.firstName,
        lastName: data.lastName ?? contacts.lastName,
        email: data.email ?? contacts.email,
        updatedAt: new Date(),
      },
    });
}
