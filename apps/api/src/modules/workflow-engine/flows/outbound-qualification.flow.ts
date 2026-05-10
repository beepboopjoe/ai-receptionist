// ============================================================
// Outbound Qualification Flow
// Post-call: reads Grok-extracted data → ensures contact exists →
// books appointment (if slot selected) → updates campaign counters →
// queues notifications.
// ============================================================
import { db } from '../../../db/client.js';
import { campaignContacts, outboundCampaigns, tenants, tenantSettings } from '../../../db/schema.js';
import { eq, sql, and } from 'drizzle-orm';
import { identifyCaller, createContact } from '../../crm/crm.service.js';
import { bookAppointment } from '../../scheduler/scheduler.service.js';
import { queueNotification } from '../../notifications/notification.service.js';
import type { CallState } from '@ai-receptionist/shared';
import type { AppointmentType } from '@ai-receptionist/shared';
import pino from 'pino';
import dayjs from 'dayjs';

const logger = pino({ name: 'outbound-qualification-flow' });

export interface OutboundQualificationResult {
  outcome: string;
  summary: string;
  appointmentId?: string;
}

// Fields Grok extracts at end of call (matches outbound-qualification.prompt.ts)
interface GrokExtractedData {
  qualificationStatus: 'qualified' | 'not_qualified' | 'callback_requested' | 'do_not_call';
  interestedInAppointmentType: string | null;
  preferredTimeOfDay: 'morning' | 'afternoon' | null;
  selectedSlotStart: string | null;   // ISO datetime or null
  email: string | null;
  qualificationNotes: string | null;
  campaignContactId?: string;
}

/**
 * Main entry point — called by the orchestrator after the call ends.
 */
export async function runOutboundQualificationFlow(
  state: CallState
): Promise<OutboundQualificationResult> {
  const campaignContactId = state.collectedData?.campaignContactId as string | undefined;

  if (!campaignContactId) {
    logger.warn({ callId: state.callId }, 'No campaignContactId in call state — skipping outbound flow');
    return { outcome: 'no_action', summary: 'No campaign contact ID found in call state' };
  }

  const [cc] = await db
    .select()
    .from(campaignContacts)
    .where(eq(campaignContacts.id, campaignContactId))
    .limit(1);

  if (!cc) {
    logger.warn({ campaignContactId }, 'CampaignContact not found');
    return { outcome: 'no_action', summary: 'Campaign contact record not found' };
  }

  // Extract Grok's structured output from collectedData
  const extracted = extractGrokData(state.collectedData as Record<string, unknown>);
  logger.info({ campaignContactId, extracted }, 'Outbound qualification data extracted');

  // Route by qualification status
  switch (extracted.qualificationStatus) {
    case 'qualified':
      return handleQualified(cc, state, extracted);
    case 'do_not_call':
      return handleDoNotCall(cc);
    case 'callback_requested':
      return handleCallbackRequested(cc, extracted);
    default:
      return handleNotQualified(cc, extracted);
  }
}

// ---- Handlers ----

async function handleQualified(
  cc: typeof campaignContacts.$inferSelect,
  state: CallState,
  extracted: GrokExtractedData
): Promise<OutboundQualificationResult> {
  const { tenantId, callId } = state;

  // 1. Ensure CRM contact exists (create from lead data if needed)
  let contactId = cc.contactId ?? null;
  if (!contactId) {
    contactId = await ensureContact(cc, extracted.email, tenantId);
  } else if (extracted.email) {
    // Update email if we collected it and didn't have it
    await db
      .update(campaignContacts)
      .set({ email: extracted.email, updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));
  }

  // 2. Try to book appointment if the AI negotiated a slot
  let appointmentId: string | undefined;
  if (extracted.selectedSlotStart && extracted.interestedInAppointmentType && contactId) {
    try {
      appointmentId = await attemptBooking({
        tenantId,
        contactId,
        callId,
        slotStart: extracted.selectedSlotStart,
        appointmentType: extracted.interestedInAppointmentType,
        email: extracted.email ?? cc.email ?? undefined,
        notes: extracted.qualificationNotes ?? undefined,
      });
    } catch (err) {
      logger.error({ err, campaignContactId: cc.id }, 'Appointment booking failed — marking as qualified-only');
      // Fall through: still mark as qualified, staff will follow up
    }
  }

  const newStatus = appointmentId ? 'booked' : 'qualified';
  const notes = extracted.qualificationNotes ?? 'Lead qualified via AI outbound call';

  await db
    .update(campaignContacts)
    .set({
      status: newStatus,
      outcome: newStatus,
      contactId,
      qualificationNotes: notes,
      appointmentId: appointmentId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(campaignContacts.id, cc.id));

  // 3. Increment campaign counters
  await db
    .update(outboundCampaigns)
    .set({
      qualifiedCount: sql`${outboundCampaigns.qualifiedCount} + 1`,
      ...(appointmentId ? { bookedCount: sql`${outboundCampaigns.bookedCount} + 1` } : {}),
      updatedAt: new Date(),
    })
    .where(eq(outboundCampaigns.id, cc.campaignId));

  // 4. Send confirmation SMS if booked
  if (appointmentId && (cc.email || extracted.email)) {
    try {
      await queueNotification({
        tenantId,
        contactId: contactId ?? undefined,
        appointmentId,
        callId,
        type: 'confirmation',
        channel: 'sms',
        toAddress: cc.phoneE164,
        templateId: 'confirmation',
        templateVars: {
          firstName: cc.firstName,
          appointmentType: extracted.interestedInAppointmentType ?? 'appointment',
        },
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to queue confirmation SMS — booking still recorded');
    }
  }

  // 5. If qualified but no booking, create a staff follow-up notification
  if (!appointmentId) {
    await createStaffFollowUpTask(tenantId, cc, contactId, notes);
  }

  await checkCampaignCompletion(cc.campaignId);

  const summary = appointmentId
    ? `Lead booked: ${extracted.interestedInAppointmentType} on ${extracted.selectedSlotStart}`
    : `Lead qualified — ${notes}. Preferred: ${extracted.preferredTimeOfDay ?? 'flexible'}`;

  logger.info({ campaignContactId: cc.id, newStatus, appointmentId }, 'Outbound qualification complete');
  return { outcome: newStatus, summary, appointmentId };
}

async function handleDoNotCall(
  cc: typeof campaignContacts.$inferSelect
): Promise<OutboundQualificationResult> {
  await db
    .update(campaignContacts)
    .set({ status: 'do_not_call', outcome: 'do_not_call', updatedAt: new Date() })
    .where(eq(campaignContacts.id, cc.id));

  await checkCampaignCompletion(cc.campaignId);
  logger.info({ campaignContactId: cc.id }, 'Lead opted out — marked do_not_call');
  return { outcome: 'do_not_call', summary: 'Lead requested removal from call list' };
}

async function handleCallbackRequested(
  cc: typeof campaignContacts.$inferSelect,
  extracted: GrokExtractedData
): Promise<OutboundQualificationResult> {
  // Leave status as 'pending' — the dialer retry mechanism will handle it
  // Log the preference note
  await db
    .update(campaignContacts)
    .set({
      qualificationNotes: extracted.qualificationNotes ?? 'Lead requested callback at different time',
      updatedAt: new Date(),
    })
    .where(eq(campaignContacts.id, cc.id));

  return { outcome: 'callback_requested', summary: extracted.qualificationNotes ?? 'Callback requested' };
}

async function handleNotQualified(
  cc: typeof campaignContacts.$inferSelect,
  extracted: GrokExtractedData
): Promise<OutboundQualificationResult> {
  await db
    .update(campaignContacts)
    .set({
      status: 'not_qualified',
      outcome: 'not_qualified',
      qualificationNotes: extracted.qualificationNotes ?? 'Not interested',
      updatedAt: new Date(),
    })
    .where(eq(campaignContacts.id, cc.id));

  await checkCampaignCompletion(cc.campaignId);
  return { outcome: 'not_qualified', summary: extracted.qualificationNotes ?? 'Lead not qualified' };
}

// ---- Helper functions ----

/**
 * Parse Grok's structured JSON output from collectedData.
 * Grok is instructed to output a JSON block at end of call;
 * we also accept individual fields stored directly in collectedData.
 */
function extractGrokData(collectedData: Record<string, unknown>): GrokExtractedData {
  return {
    qualificationStatus:
      (collectedData['qualificationStatus'] as GrokExtractedData['qualificationStatus']) ??
      'not_qualified',
    interestedInAppointmentType:
      (collectedData['interestedInAppointmentType'] as string | null) ?? null,
    preferredTimeOfDay:
      (collectedData['preferredTimeOfDay'] as GrokExtractedData['preferredTimeOfDay']) ?? null,
    selectedSlotStart: (collectedData['selectedSlotStart'] as string | null) ?? null,
    email: (collectedData['email'] as string | null) ?? null,
    qualificationNotes: (collectedData['qualificationNotes'] as string | null) ?? null,
    campaignContactId: collectedData['campaignContactId'] as string | undefined,
  };
}

/**
 * Ensure a CRM contact record exists for this lead.
 * Returns the contact UUID.
 */
async function ensureContact(
  cc: typeof campaignContacts.$inferSelect,
  email: string | null,
  tenantId: string
): Promise<string> {
  // Try to find by phone first
  const existing = await identifyCaller(cc.phoneE164, tenantId);
  if (existing) {
    // Link the campaign contact to the CRM record
    await db
      .update(campaignContacts)
      .set({ contactId: existing.id, updatedAt: new Date() })
      .where(eq(campaignContacts.id, cc.id));
    return existing.id;
  }

  // Create new contact
  const newContact = await createContact(
    {
      firstName: cc.firstName,
      lastName: cc.lastName || '',
      phoneE164: cc.phoneE164,
      email: email ?? cc.email ?? undefined,
      patientType: 'new',
      source: 'call',
    },
    tenantId
  );

  await db
    .update(campaignContacts)
    .set({ contactId: newContact.id, updatedAt: new Date() })
    .where(eq(campaignContacts.id, cc.id));

  return newContact.id;
}

/**
 * Book an appointment using the scheduler service.
 * Returns the appointment UUID, or throws if booking fails.
 */
async function attemptBooking(params: {
  tenantId: string;
  contactId: string;
  callId: string;
  slotStart: string;
  appointmentType: string;
  email?: string;
  notes?: string;
}): Promise<string> {
  const { tenantId, contactId, callId, slotStart, appointmentType, email, notes } = params;

  // Get tenant timezone and appointment type config
  const [tenant] = await db
    .select({ timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const tz = tenant?.timezone ?? 'America/New_York';

  const [settings] = await db
    .select({ appointmentTypes: tenantSettings.appointmentTypes })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const apptTypes = (settings?.appointmentTypes ?? []) as AppointmentType[];

  // Find matching appointment type (fuzzy: by id or by name substring)
  const lc = appointmentType.toLowerCase();
  const apptType = apptTypes.find(
    (t) => t.id === lc || t.name.toLowerCase().includes(lc) || lc.includes(t.id)
  ) ?? apptTypes[0]; // fallback to first type if no match

  const durationMinutes = apptType?.durationMin ?? 60;
  const startAt = dayjs(slotStart).toDate();
  const endAt = dayjs(slotStart).add(durationMinutes, 'minute').toDate();

  const appointment = await bookAppointment({
    tenantId,
    contactId,
    callId,
    appointmentType: apptType?.id ?? appointmentType,
    startAt,
    endAt,
    durationMinutes,
    notes: notes ?? 'Booked via AI outbound call',
    attendeeEmail: email,
    timezone: tz,
  });

  return appointment.id;
}

/**
 * Create a staff follow-up task notification for a qualified-but-not-booked lead.
 */
async function createStaffFollowUpTask(
  tenantId: string,
  cc: typeof campaignContacts.$inferSelect,
  contactId: string | null,
  notes: string
): Promise<void> {
  try {
    await queueNotification({
      tenantId,
      contactId: contactId ?? undefined,
      type: 'staff_task',
      channel: 'sms',
      toAddress: 'staff', // resolved to transferNumber in notification service
      templateId: 'staff_task',
      templateVars: {
        firstName: cc.firstName,
        lastName: cc.lastName,
        phone: cc.phoneE164,
        notes,
        action: 'Qualified outbound lead — follow up to book appointment',
      },
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to queue staff follow-up notification');
  }
}

/**
 * Check if all leads are in terminal states → mark campaign completed.
 * Uses a simple heuristic: pending + dialing + connected + queued = 0
 */
async function checkCampaignCompletion(campaignId: string): Promise<void> {
  const [campaign] = await db
    .select()
    .from(outboundCampaigns)
    .where(eq(outboundCampaigns.id, campaignId))
    .limit(1);

  if (!campaign || campaign.status !== 'running') return;

  // Count leads still in active/pending states
  const [{ activeCount }] = await db.execute<{ activeCount: string }>(
    sql`SELECT COUNT(*) AS "activeCount" FROM campaign_contacts
        WHERE campaign_id = ${campaignId}
        AND status IN ('pending', 'queued', 'dialing', 'connected')`
  );

  if (Number(activeCount) === 0) {
    await db
      .update(outboundCampaigns)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(outboundCampaigns.id, campaignId));

    logger.info({ campaignId }, 'Campaign auto-completed — all leads processed');
  }
}
