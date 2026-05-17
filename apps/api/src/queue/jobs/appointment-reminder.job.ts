// ============================================================
// Appointment SMS Reminder Sweep — called every 15 min by worker.ts.
//
// Two windows per run:
//   24h: startsAt BETWEEN (now + 23h) AND (now + 25h), reminder24hSent = false
//    2h: startsAt BETWEEN (now + 1h45m) AND (now + 2h15m), reminder2hSent = false
//
// For each hit: sendSms → flip the flag → write to sms_messages + notifications.
// Idempotent: boolean flags prevent double-sends even on concurrent cron ticks.
// Skips silently when TELNYX_FROM_NUMBER is not configured.
// ============================================================
import { db } from '../../db/client.js';
import {
  appointments,
  contacts,
  tenants,
  smsMessages,
  notifications,
} from '../../db/schema.js';
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { sendSms } from '../../modules/notifications/adapters/telnyx-sms.adapter.js';
import { getTenantFromNumber } from '../../modules/sms/tenant-from-number.js';
import { config } from '../../config.js';

function fmtTime(dt: Date, tz = 'America/New_York'): string {
  return dt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  });
}

function fmtDate(dt: Date, tz = 'America/New_York'): string {
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  });
}

export async function runAppointmentReminderSweep(): Promise<{
  sent: number;
  errors: number;
}> {
  if (!config.TELNYX_API_KEY) {
    // Skip silently in dev when Telnyx isn't configured at all
    return { sent: 0, errors: 0 };
  }

  const now = new Date();
  let sent = 0;
  let errors = 0;
  // Per-tenant from-number cache so we don't re-query for each appointment.
  const fromCache = new Map<string, string | null>();
  async function fromFor(tenantId: string): Promise<string | null> {
    if (fromCache.has(tenantId)) return fromCache.get(tenantId)!;
    const num = await getTenantFromNumber(tenantId);
    fromCache.set(tenantId, num);
    return num;
  }

  // ─── 24-hour reminder ──────────────────────────────────────────────────────
  const w24Start = new Date(now.getTime() + 23 * 3_600_000);
  const w24End   = new Date(now.getTime() + 25 * 3_600_000);

  const due24h = await db
    .select({
      apptId:     appointments.id,
      tenantId:   appointments.tenantId,
      startsAt:   appointments.startsAt,
      apptType:   appointments.appointmentType,
      tz:         tenants.timezone,
      tenantName: tenants.name,
      contactId:  contacts.id,
      firstName:  contacts.firstName,
      phone:      contacts.phoneE164,
    })
    .from(appointments)
    .innerJoin(contacts, eq(appointments.contactId, contacts.id))
    .innerJoin(tenants,  eq(appointments.tenantId,  tenants.id))
    .where(
      and(
        eq(appointments.reminder24hSent, false),
        eq(appointments.status, 'confirmed'),
        gte(appointments.startsAt, w24Start),
        lte(appointments.startsAt, w24End),
        isNotNull(contacts.phoneE164),
      )
    );

  for (const row of due24h) {
    const fromNumber = await fromFor(row.tenantId);
    if (!fromNumber) {
      console.warn(`[reminder] 24h skip — tenant ${row.tenantId} has no provisioned phone number`);
      continue;
    }
    const body = `Hi ${row.firstName}! Reminder: your ${row.apptType} appointment at ${row.tenantName} is tomorrow (${fmtDate(row.startsAt, row.tz)}) at ${fmtTime(row.startsAt, row.tz)}. Reply CONFIRM to confirm or CANCEL to cancel.`;
    try {
      const msgId = await sendSms(row.phone, body, fromNumber);
      await db
        .update(appointments)
        .set({ reminder24hSent: true, updatedAt: new Date() })
        .where(eq(appointments.id, row.apptId));
      await db.insert(smsMessages).values({
        tenantId:        row.tenantId,
        direction:       'outbound',
        fromNumber,
        toNumber:        row.phone,
        body,
        telnyxMessageId: msgId,
        status:          'delivered',
        contactId:       row.contactId,
      });
      await db.insert(notifications).values({
        tenantId:      row.tenantId,
        contactId:     row.contactId,
        appointmentId: row.apptId,
        type:          'appointment_reminder_24h',
        channel:       'sms',
        toAddress:     row.phone,
        status:        'sent',
        templateId:    'appointment-reminder-24h',
        body,
        providerMsgId: msgId,
        sentAt:        new Date(),
      });
      sent++;
    } catch (err) {
      console.error(`[reminder] 24h SMS failed for appt ${row.apptId}:`, err);
      errors++;
    }
  }

  // ─── 2-hour reminder ───────────────────────────────────────────────────────
  const w2hStart = new Date(now.getTime() + 105 * 60_000); // 1h 45m
  const w2hEnd   = new Date(now.getTime() + 135 * 60_000); // 2h 15m

  const due2h = await db
    .select({
      apptId:     appointments.id,
      tenantId:   appointments.tenantId,
      startsAt:   appointments.startsAt,
      apptType:   appointments.appointmentType,
      tz:         tenants.timezone,
      tenantName: tenants.name,
      contactId:  contacts.id,
      firstName:  contacts.firstName,
      phone:      contacts.phoneE164,
    })
    .from(appointments)
    .innerJoin(contacts, eq(appointments.contactId, contacts.id))
    .innerJoin(tenants,  eq(appointments.tenantId,  tenants.id))
    .where(
      and(
        eq(appointments.reminder2hSent, false),
        eq(appointments.status, 'confirmed'),
        gte(appointments.startsAt, w2hStart),
        lte(appointments.startsAt, w2hEnd),
        isNotNull(contacts.phoneE164),
      )
    );

  for (const row of due2h) {
    const fromNumber = await fromFor(row.tenantId);
    if (!fromNumber) {
      console.warn(`[reminder] 2h skip — tenant ${row.tenantId} has no provisioned phone number`);
      continue;
    }
    const body = `Hi ${row.firstName}! Quick reminder: your ${row.apptType} at ${row.tenantName} is in about 2 hours (${fmtTime(row.startsAt, row.tz)}). See you soon! 👋`;
    try {
      const msgId = await sendSms(row.phone, body, fromNumber);
      await db
        .update(appointments)
        .set({ reminder2hSent: true, updatedAt: new Date() })
        .where(eq(appointments.id, row.apptId));
      await db.insert(smsMessages).values({
        tenantId:        row.tenantId,
        direction:       'outbound',
        fromNumber,
        toNumber:        row.phone,
        body,
        telnyxMessageId: msgId,
        status:          'delivered',
        contactId:       row.contactId,
      });
      await db.insert(notifications).values({
        tenantId:      row.tenantId,
        contactId:     row.contactId,
        appointmentId: row.apptId,
        type:          'appointment_reminder_2h',
        channel:       'sms',
        toAddress:     row.phone,
        status:        'sent',
        templateId:    'appointment-reminder-2h',
        body,
        providerMsgId: msgId,
        sentAt:        new Date(),
      });
      sent++;
    } catch (err) {
      console.error(`[reminder] 2h SMS failed for appt ${row.apptId}:`, err);
      errors++;
    }
  }

  return { sent, errors };
}
