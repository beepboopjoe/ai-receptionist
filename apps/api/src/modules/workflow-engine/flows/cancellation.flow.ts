// ============================================================
// Cancellation Flow
// Cancels an upcoming appointment and optionally offers rebooking
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import {
  cancelAppointment,
  getUpcomingAppointments,
} from '../../scheduler/scheduler.service.js';
import { queueNotification } from '../../notifications/notification.service.js';
import { advanceStep } from '../state-machine.js';

export class CancellationFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, rcCallId, collectedData, contact } = state;

    if (!contact) {
      return { outcome: 'no_action', summary: 'Cannot cancel: no contact identified.' };
    }

    await advanceStep(rcCallId, 'cancelling');

    // Resolve the appointment to cancel
    let appointmentId = collectedData.appointmentId as string | undefined;

    if (!appointmentId) {
      const upcoming = await getUpcomingAppointments(contact.id, tenantId);
      if (!upcoming.length) {
        return { outcome: 'no_action', summary: 'No upcoming appointments found to cancel.' };
      }
      const next = upcoming[0];
      if (!next) {
        return { outcome: 'no_action', summary: 'No upcoming appointments found to cancel.' };
      }
      appointmentId = next.id;
    }

    const cancellationReason = (collectedData.cancellationReason as string | undefined) ?? 'unspecified';

    // Cancel in calendar + DB
    await cancelAppointment({ appointmentId, tenantId, reason: cancellationReason });

    // Send cancellation confirmation
    await queueNotification({
      tenantId,
      type: 'confirmation',
      channel: 'sms',
      contactId: contact.id,
      appointmentId,
      metadata: {
        patientName: contact.firstName,
        isCancellation: true,
        cancellationReason,
      },
    });

    // Notify staff of cancellation (creates a task in the dashboard)
    await queueNotification({
      tenantId,
      type: 'staff_task',
      channel: 'sms',
      contactId: contact.id,
      appointmentId,
      metadata: {
        taskType: 'cancellation',
        patientName: `${contact.firstName} ${contact.lastName}`,
        patientPhone: contact.phoneE164,
        cancellationReason,
        wantsToRebook: collectedData.wantsToRebook === true,
      },
    });

    await advanceStep(rcCallId, 'complete');

    const wantsToRebook = collectedData.wantsToRebook === true;
    return {
      outcome: 'cancelled',
      appointmentId,
      summary: `Cancelled ${contact.firstName} ${contact.lastName}'s appointment. Reason: ${cancellationReason}. Wants to rebook: ${wantsToRebook ? 'yes' : 'no'}.`,
    };
  }
}
