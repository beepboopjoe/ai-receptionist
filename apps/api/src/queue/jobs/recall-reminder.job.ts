// ============================================================
// recall-reminder job
// Nightly cron: finds patients overdue for a cleaning recall
// and sends reminder SMS
// ============================================================
import type { Job } from 'bullmq';
import { db } from '../../db/client.js';
import { contacts, appointments, tenantSettings, tenants } from '../../db/schema.js';
import { and, eq, lte, gte, isNotNull, notInArray, sql } from 'drizzle-orm';
import { queueNotification } from '../../modules/notifications/notification.service.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface RecallReminderJobData {
  tenantId: string;
}

export async function processRecallReminder(job: Job<RecallReminderJobData>): Promise<void> {
  const { tenantId } = job.data;

  // Get recall interval config
  const [settings] = await db
    .select({ recallIntervalMonths: tenantSettings.recallIntervalMonths })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const intervalMonths = settings?.recallIntervalMonths ?? 6;

  // Find contacts whose recall_due_date is within the next 30 days
  const today = dayjs().startOf('day').toDate();
  const cutoff = dayjs().add(30, 'day').endOf('day').toDate();

  // Find contacts with upcoming appointments (cleaning) so we skip them
  const upcomingCleaningContactIds = await db
    .select({ contactId: appointments.contactId })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        eq(appointments.appointmentType, 'cleaning'),
        gte(appointments.startsAt, today),
        eq(appointments.status, 'confirmed')
      )
    );

  const excludedIds = upcomingCleaningContactIds.map((r) => r.contactId);

  // Find overdue contacts
  const overdueContacts = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phoneE164: contacts.phoneE164,
      recallDueDate: contacts.recallDueDate,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        isNotNull(contacts.recallDueDate),
        lte(contacts.recallDueDate, cutoff.toISOString().slice(0, 10)),
        gte(contacts.recallDueDate, today.toISOString().slice(0, 10)),
        ...(excludedIds.length > 0 ? [notInArray(contacts.id, excludedIds)] : [])
      )
    );

  for (const contact of overdueContacts) {
    await queueNotification({
      tenantId,
      type: 'recall_reminder',
      channel: 'sms',
      contactId: contact.id,
      metadata: {
        patientName: contact.firstName,
        recallDueDate: contact.recallDueDate,
        intervalMonths,
      },
    });
  }

  console.log(
    `[recall-reminder] Queued ${overdueContacts.length} recall reminders for tenant ${tenantId}`
  );
}
