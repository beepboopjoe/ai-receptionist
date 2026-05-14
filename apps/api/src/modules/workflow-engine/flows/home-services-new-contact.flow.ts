// ============================================================
// Home Services — New Contact Flow
// Override for new_contact__home_services.
//
// Triages by urgency:
//   urgent    → immediate escalation (same-day callback)
//   scheduled → book appointment with 2-day minimum buffer
//   estimate  → book appointment with 2-day minimum buffer
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import { createContact } from '../../crm/crm.service.js';
import { bookAppointment } from '../../scheduler/scheduler.service.js';
import { queueNotification } from '../../notifications/notification.service.js';
import { advanceStep } from '../state-machine.js';
import { db } from '../../../db/client.js';
import { escalations, tenants } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { auditLog } from '../../../audit/audit-logger.js';

type Urgency = 'urgent' | 'scheduled' | 'estimate';

export class HomeServicesNewContactFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, callId, rcCallId, fromNumber, collectedData, contact: existingContact } = state;

    await advanceStep(rcCallId, 'collect_info');

    if (!collectedData.firstName) {
      return { outcome: 'no_action', summary: 'Insufficient data for home services intake.' };
    }

    const serviceType = (collectedData['serviceType'] as string | undefined) ?? 'general';
    const urgency: Urgency = (['urgent', 'scheduled', 'estimate'].includes(
      collectedData['urgency'] as string
    )
      ? collectedData['urgency']
      : 'scheduled') as Urgency;

    // 1. Create contact with service notes
    const contact = await createContact(
      {
        firstName: collectedData.firstName,
        lastName: collectedData.lastName ?? '',
        phoneE164: fromNumber,
        email: collectedData.email,
        contactType: 'new',
        source: 'call',
        notes: [`Service type: ${serviceType}`, `Urgency: ${urgency}`].join('\n'),
      },
      tenantId
    );

    // ── Urgent: escalate, don't auto-book ──────────────────
    if (urgency === 'urgent') {
      const [escalation] = await db
        .insert(escalations)
        .values({
          tenantId,
          callId: callId ?? undefined,
          contactId: contact.id,
          reason: 'urgent_service_request',
          priority: 'urgent',
          status: 'open',
        })
        .returning();

      auditLog({
        tenantId,
        actorType: 'system',
        action: 'call.home_services_urgent',
        entityType: 'escalation',
        entityId: escalation?.id,
        metadata: { serviceType, urgency, contactId: contact.id },
      });

      await queueNotification({
        tenantId,
        type: 'staff_task',
        channel: 'sms',
        contactId: contact.id,
        callId: callId ?? undefined,
        metadata: {
          taskType: 'urgent_callback',
          priority: 'urgent',
          contactName: `${contact.firstName} ${contact.lastName}`,
          contactPhone: fromNumber,
          serviceType,
          escalationId: escalation?.id,
          message: `🚨 URGENT: ${contact.firstName} needs same-day ${serviceType} service. Call back immediately.`,
        },
      });

      await advanceStep(rcCallId, 'complete');

      return {
        outcome: 'escalated',
        escalationId: escalation?.id,
        summary: `Urgent ${serviceType} request from ${contact.firstName} ${contact.lastName}. Staff notified for same-day callback.`,
      };
    }

    // ── Scheduled / estimate: book with 2-day buffer ───────
    if (!collectedData.selectedSlotStart) {
      // No slot selected — create a callback request instead
      await queueNotification({
        tenantId,
        type: 'staff_task',
        channel: 'sms',
        contactId: contact.id,
        callId: callId ?? undefined,
        metadata: {
          taskType: 'schedule_callback',
          priority: 'normal',
          contactName: `${contact.firstName} ${contact.lastName}`,
          contactPhone: fromNumber,
          serviceType,
          urgency,
          message: `New ${urgency} ${serviceType} request from ${contact.firstName}. No slot selected — schedule a visit.`,
        },
      });

      await advanceStep(rcCallId, 'complete');

      return {
        outcome: 'no_action',
        summary: `${urgency} ${serviceType} request from ${contact.firstName} ${contact.lastName}. Staff notified to schedule.`,
      };
    }

    // Enforce 2-day minimum buffer for scheduled / estimate
    const requestedStart = new Date(collectedData.selectedSlotStart);
    const minStart = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const startAt = requestedStart < minStart ? minStart : requestedStart;
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 1-hour slot

    const [tenant] = await db
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const timezone = tenant?.timezone ?? 'America/New_York';

    const appointment = await bookAppointment({
      tenantId,
      contactId: contact.id,
      callId,
      appointmentType: urgency === 'estimate' ? 'estimate_visit' : 'service_appointment',
      startAt,
      endAt,
      durationMinutes: 60,
      attendeeEmail: collectedData.email,
      timezone,
    });

    await queueNotification({
      tenantId,
      type: 'confirmation',
      channel: 'sms',
      contactId: contact.id,
      appointmentId: appointment.id,
      metadata: {
        contactName: contact.firstName,
        appointmentDate: startAt.toLocaleDateString('en-US'),
        appointmentTime: startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        appointmentType: urgency === 'estimate' ? 'estimate visit' : `${serviceType} appointment`,
      },
    });

    await advanceStep(rcCallId, 'complete');

    return {
      outcome: 'booked',
      appointmentId: appointment.id,
      summary: `${urgency} ${serviceType} appointment booked for ${contact.firstName} ${contact.lastName} on ${startAt.toLocaleDateString('en-US')}.`,
    };
  }
}
