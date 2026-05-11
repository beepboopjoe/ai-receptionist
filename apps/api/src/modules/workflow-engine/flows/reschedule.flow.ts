// ============================================================
// Reschedule Flow
// Moves an existing appointment to a new slot
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import {
  rescheduleAppointment,
  getUpcomingAppointments,
} from '../../scheduler/scheduler.service.js';
import { queueNotification } from '../../notifications/notification.service.js';
import { advanceStep } from '../state-machine.js';
import { db } from '../../../db/client.js';
import { tenantSettings, tenants } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { AppointmentType } from '@ai-receptionist/shared';

export class RescheduleFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, callId, rcCallId, collectedData, contact } = state;

    if (!contact) {
      return { outcome: 'no_action', summary: 'Cannot reschedule: no contact identified.' };
    }

    if (!collectedData.selectedSlotStart) {
      return { outcome: 'no_action', summary: 'No new slot selected for reschedule.' };
    }

    await advanceStep(rcCallId, 'rescheduling');

    const [tenant] = await db.select({ timezone: tenants.timezone })
      .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const timezone = tenant?.timezone ?? 'America/New_York';

    const [settings] = await db.select({ appointmentTypes: tenantSettings.appointmentTypes })
      .from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
    const apptTypes = (settings?.appointmentTypes as AppointmentType[]) ?? [];

    // Find the appointment to reschedule
    // The AI should have collected which appointment the caller wants to move
    const appointmentIdToReschedule = collectedData.appointmentId as string | undefined;
    if (!appointmentIdToReschedule) {
      // Try to find by upcoming appointments if no specific ID provided
      const upcoming = await getUpcomingAppointments(contact.id, tenantId);
      if (!upcoming.length) {
        return { outcome: 'no_action', summary: 'No upcoming appointments found to reschedule.' };
      }
      const next = upcoming[0];
      if (!next) {
        return { outcome: 'no_action', summary: 'No upcoming appointments found to reschedule.' };
      }
      collectedData.appointmentId = next.id;
      collectedData.appointmentType = collectedData.appointmentType ?? next.appointmentType;
    }

    const appointmentType = collectedData.appointmentType as string ?? 'checkup';
    const apptType = apptTypes.find((t) => t.id === appointmentType) ?? { durationMin: 60, bufferMin: 10 };

    const newStartAt = new Date(collectedData.selectedSlotStart);
    const newEndAt = new Date(newStartAt.getTime() + apptType.durationMin * 60 * 1000);

    const updated = await rescheduleAppointment({
      appointmentId: collectedData.appointmentId as string,
      tenantId,
      newStartAt,
      newEndAt,
      timezone,
    });

    // Cancel old reminders and queue new ones
    await Promise.all([
      queueNotification({
        tenantId,
        type: 'confirmation',
        channel: 'sms',
        contactId: contact.id,
        appointmentId: updated.id,
        metadata: {
          contactName: contact.firstName,
          appointmentDate: newStartAt.toLocaleDateString('en-US'),
          appointmentTime: newStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          appointmentType,
          isReschedule: true,
        },
      }),
      queueNotification({
        tenantId,
        type: 'reminder_24h',
        channel: 'sms',
        contactId: contact.id,
        appointmentId: updated.id,
        sendAt: new Date(newStartAt.getTime() - 24 * 60 * 60 * 1000),
        metadata: {
          contactName: contact.firstName,
          appointmentDate: newStartAt.toLocaleDateString('en-US'),
          appointmentTime: newStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        },
      }),
      queueNotification({
        tenantId,
        type: 'reminder_2h',
        channel: 'sms',
        contactId: contact.id,
        appointmentId: updated.id,
        sendAt: new Date(newStartAt.getTime() - 2 * 60 * 60 * 1000),
        metadata: {
          contactName: contact.firstName,
          appointmentDate: newStartAt.toLocaleDateString('en-US'),
          appointmentTime: newStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        },
      }),
    ]);

    await advanceStep(rcCallId, 'complete');

    return {
      outcome: 'rescheduled',
      appointmentId: updated.id,
      summary: `Rescheduled ${contact.firstName} ${contact.lastName}'s ${appointmentType} to ${newStartAt.toLocaleDateString('en-US')} at ${newStartAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
    };
  }
}
