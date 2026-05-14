// ============================================================
// Insurance — New Contact Flow
// Override for new_contact__insurance.
//
// Insurance intake captures policy type + coverage needs, then
// books a consultation appointment with that metadata attached.
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import { createContact } from '../../crm/crm.service.js';
import { bookAppointment } from '../../scheduler/scheduler.service.js';
import { queueNotification } from '../../notifications/notification.service.js';
import { advanceStep } from '../state-machine.js';
import { db } from '../../../db/client.js';
import { tenants } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';

export class InsuranceNewContactFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, callId, rcCallId, fromNumber, collectedData } = state;

    await advanceStep(rcCallId, 'collect_info');

    if (!collectedData.firstName || !collectedData.selectedSlotStart) {
      return { outcome: 'no_action', summary: 'Insufficient data for insurance intake.' };
    }

    // Extract insurance-specific data
    const policyType = (collectedData['policyType'] as string | undefined) ?? 'auto';
    const coverageNeeded = (collectedData['coverageNeeded'] as string | undefined) ?? '';

    // Get tenant timezone
    const [tenant] = await db
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const timezone = tenant?.timezone ?? 'America/New_York';

    // 1. Create contact with insurance notes
    const contact = await createContact(
      {
        firstName: collectedData.firstName,
        lastName: collectedData.lastName ?? '',
        phoneE164: fromNumber,
        email: collectedData.email,
        contactType: 'new',
        source: 'call',
        notes: [
          `Policy type: ${policyType}`,
          coverageNeeded ? `Coverage needed: ${coverageNeeded}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      tenantId
    );

    // 2. Book insurance consultation
    const startAt = new Date(collectedData.selectedSlotStart);
    const endAt = new Date(startAt.getTime() + 45 * 60 * 1000); // 45-min default for insurance

    const appointment = await bookAppointment({
      tenantId,
      contactId: contact.id,
      callId,
      appointmentType: 'insurance_consultation',
      startAt,
      endAt,
      durationMinutes: 45,
      attendeeEmail: collectedData.email,
      timezone,
    });

    // 3. Confirmation SMS
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
        appointmentType: 'insurance consultation',
        policyType,
      },
    });

    await advanceStep(rcCallId, 'complete');

    return {
      outcome: 'booked',
      appointmentId: appointment.id,
      summary: `Insurance consultation booked for ${contact.firstName} ${contact.lastName} on ${startAt.toLocaleDateString('en-US')}. Policy type: ${policyType}.`,
    };
  }
}
