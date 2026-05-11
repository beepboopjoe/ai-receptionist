// ============================================================
// Existing Contact Flow
// Runs post-call when caller is a known contact
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import { bookAppointment, getUpcomingAppointments } from '../../scheduler/scheduler.service.js';
import { queueNotification } from '../../notifications/notification.service.js';
import { advanceStep } from '../state-machine.js';
import { db } from '../../../db/client.js';
import { tenantSettings, tenants } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { AppointmentType } from '@ai-receptionist/shared';

export class ExistingContactFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, callId, rcCallId, collectedData, contact } = state;

    // Determine sub-intent from what the AI collected during conversation
    const intent = collectedData.intent as string | undefined;

    // Delegate based on detected intent
    if (intent === 'reschedule') {
      // Re-route to reschedule logic (lazy import avoids circular)
      const { RescheduleFlow } = await import('./reschedule.flow.js');
      return new RescheduleFlow().execute(state);
    }

    if (intent === 'cancel' || intent === 'cancellation') {
      const { CancellationFlow } = await import('./cancellation.flow.js');
      return new CancellationFlow().execute(state);
    }

    if (!collectedData.selectedSlotStart || !collectedData.appointmentType) {
      // No booking data collected — general inquiry, no action needed
      return { outcome: 'no_action', summary: 'Existing contact called; no appointment action taken.' };
    }

    // Book appointment for existing contact (skip data collection)
    await advanceStep(rcCallId, 'booking');

    const [tenant] = await db.select({ timezone: tenants.timezone })
      .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const timezone = tenant?.timezone ?? 'America/New_York';

    const [settings] = await db.select({ appointmentTypes: tenantSettings.appointmentTypes })
      .from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
    const apptTypes = (settings?.appointmentTypes as AppointmentType[]) ?? [];
    const apptType = apptTypes.find((t) => t.id === collectedData.appointmentType)
      ?? { durationMin: 60, bufferMin: 10 };

    const startAt = new Date(collectedData.selectedSlotStart);
    const endAt = new Date(startAt.getTime() + apptType.durationMin * 60 * 1000);

    if (!contact) {
      return { outcome: 'no_action', summary: 'Contact record missing for existing contact flow.' };
    }

    const appointment = await bookAppointment({
      tenantId,
      contactId: contact.id,
      callId,
      appointmentType: collectedData.appointmentType ?? 'checkup',
      startAt,
      endAt,
      durationMinutes: apptType.durationMin,
      attendeeEmail: contact.email ?? undefined,
      timezone,
    });

    // Send confirmation + schedule reminders
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
      summary: `Existing contact ${contact.firstName} ${contact.lastName} booked a ${collectedData.appointmentType} on ${startAt.toLocaleDateString('en-US')} at ${startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
    };
  }
}
