// ============================================================
// Legal — New Contact Flow
// Override for new_contact__legal.
//
// Legal intake requires a conflict-of-interest check before any
// appointment is booked. For new clients we:
//   1. Create the contact record
//   2. Capture matter type + opposing party from collectedData
//   3. Create an open escalation tagged "conflict_check_required"
//   4. Do NOT auto-book — the attorney reviews the conflict first
//
// For subsequent calls (existing_contact) the generic flow runs.
// ============================================================
import type { BaseFlow } from './base.flow.js';
import type { FlowResult, CallState } from '@ai-receptionist/shared';
import { createContact } from '../../crm/crm.service.js';
import { advanceStep } from '../state-machine.js';
import { db } from '../../../db/client.js';
import { escalations } from '../../../db/schema.js';
import { queueNotification } from '../../notifications/notification.service.js';
import { auditLog } from '../../../audit/audit-logger.js';

export class LegalNewContactFlow implements BaseFlow {
  async execute(state: CallState): Promise<FlowResult> {
    const { tenantId, callId, rcCallId, fromNumber, collectedData, contact } = state;

    await advanceStep(rcCallId, 'collect_info');

    // Minimum data check
    if (!collectedData.firstName) {
      return { outcome: 'no_action', summary: 'Insufficient contact data for legal intake.' };
    }

    // Extract legal-specific data (Grok voice agent stores these in collectedData)
    const matterType = (collectedData['matterType'] as string | undefined) ?? 'general';
    const opposingParty = (collectedData['opposingParty'] as string | undefined) ?? '';

    // 1. Create contact record
    const newContact = await createContact(
      {
        firstName: collectedData.firstName,
        lastName: collectedData.lastName ?? '',
        phoneE164: fromNumber,
        email: collectedData.email,
        contactType: 'new',
        source: 'call',
        notes: [
          `Matter type: ${matterType}`,
          opposingParty ? `Opposing party: ${opposingParty}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      tenantId
    );

    // 2. Create conflict-check escalation (do NOT auto-book)
    const [escalation] = await db
      .insert(escalations)
      .values({
        tenantId,
        callId: callId ?? undefined,
        contactId: newContact.id,
        reason: 'conflict_check_required',
        priority: 'normal',
        status: 'open',
      })
      .returning();

    auditLog({
      tenantId,
      actorType: 'system',
      action: 'call.legal_intake',
      entityType: 'escalation',
      entityId: escalation?.id,
      metadata: { matterType, opposingParty, contactId: newContact.id },
    });

    // 3. Notify staff to run conflict check before booking
    await queueNotification({
      tenantId,
      type: 'staff_task',
      channel: 'sms',
      contactId: newContact.id,
      callId: callId ?? undefined,
      metadata: {
        taskType: 'conflict_check',
        priority: 'normal',
        contactName: `${newContact.firstName} ${newContact.lastName}`,
        contactPhone: fromNumber,
        matterType,
        opposingParty,
        escalationId: escalation?.id,
        message: `New legal intake — run conflict check before booking. Matter: ${matterType}${opposingParty ? `. Opposing: ${opposingParty}` : ''}.`,
      },
    });

    await advanceStep(rcCallId, 'complete');

    return {
      outcome: 'escalated',
      escalationId: escalation?.id,
      summary: `Legal intake for ${newContact.firstName} ${newContact.lastName}. Matter: ${matterType}. Conflict check required before booking. Staff notified.`,
    };
  }
}
