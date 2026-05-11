// ============================================================
// New Contact Flow
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import { createContact } from '../../crm/crm.service.js';
import { bookAppointment, getAvailableSlots } from '../../scheduler/scheduler.service.js';
import { queueNotification } from '../../notifications/notification.service.js';
import { advanceStep, collectData } from '../state-machine.js';
import { db } from '../../../db/client.js';
import { tenantSettings, tenants } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { AppointmentType } from '@ai-receptionist/shared';

export class NewContactFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, callId, rcCallId, collectedData } = state;

    // At this point, the ElevenLabs conversation has collected contact data
    // via its tool-calling or structured extraction capabilities.
    // This flow runs AFTER the AI voice conversation has concluded.

    await advanceStep(rcCallId, 'collect_info');

    // Validate we have the minimum required data
    if (!collectedData.firstName || !collectedData.lastName || !collectedData.selectedSlotStart) {
      return { outcome: 'no_action', summary: 'Insufficient data collected during call.' };
    }

    // Get timezone
    const [tenant] = await db.select({ timezone: tenants.timezone }).from(tenants)
      .where(eq(tenants.id, tenantId)).limit(1);
    const timezone = tenant?.timezone ?? 'America/New_York';

    // Get appointment type details
    const [settings] = await db.select({ appointmentTypes: tenantSettings.appointmentTypes })
      .from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
    const apptTypes = (settings?.appointmentTypes as AppointmentType[]) ?? [];
    const apptType = apptTypes.find((t) => t.id === collectedData.appointmentType)
      ?? { durationMin: 60, bufferMin: 10 };

    // 1. Create contact
    const contact = await createContact(
      {
        firstName: collectedData.firstName,
        lastName: collectedData.lastName ?? '',
        phoneE164: state.fromNumber,
        email: collectedData.email,
        dateOfBirth: collectedData.dateOfBirth,
        insuranceProvider: collectedData.insuranceProvider,
        contactType: 'new',
        source: 'call',
      },
      tenantId
    );

    // 2. Book appointment
    const startAt = new Date(collectedData.selectedSlotStart);
    const endAt = new Date(
      startAt.getTime() + apptType.durationMin * 60 * 1000
    );

    const appointment = await bookAppointment({
      tenantId,
      contactId: contact.id,
      callId,
      appointmentType: collectedData.appointmentType ?? 'checkup',
      startAt,
      endAt,
      durationMinutes: apptType.durationMin,
      attendeeEmail: collectedData.email,
      timezone,
    });

    // 3. Send confirmation + schedule reminders
    await Promise.all([
      queueNotification({
        tenantId,
        type: 'confirmation',
        channel: 'sms',
        contactId: contact.id,
        appointmentId: appointment.id,
        metadata: {
          contactName: contact.firstName,
          appointmentDate: startAt.toLocaleDateString('en-US'),
          appointmentTime: startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          appointmentType: collectedData.appointmentType ?? 'appointment',
        },
      }),
      queueNotification({
        tenantId,
        type: 'reminder_24h',
        channel: 'sms',
        contactId: contact.id,
        appointmentId: appointment.id,
        sendAt: new Date(startAt.getTime() - 24 * 60 * 60 * 1000),
        metadata: {
          contactName: contact.firstName,
          appointmentDate: startAt.toLocaleDateString('en-US'),
          appointmentTime: startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        },
      }),
      queueNotification({
        tenantId,
        type: 'reminder_2h',
        channel: 'sms',
        contactId: contact.id,
        appointmentId: appointment.id,
        sendAt: new Date(startAt.getTime() - 2 * 60 * 60 * 1000),
        metadata: {
          contactName: contact.firstName,
          appointmentDate: startAt.toLocaleDateString('en-US'),
          appointmentTime: startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        },
      }),
    ]);

    await advanceStep(rcCallId, 'complete');

    return {
      outcome: 'booked',
      appointmentId: appointment.id,
      summary: `New contact ${contact.firstName} ${contact.lastName} booked a ${collectedData.appointmentType} on ${startAt.toLocaleDateString('en-US')} at ${startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
    };
  }
}
