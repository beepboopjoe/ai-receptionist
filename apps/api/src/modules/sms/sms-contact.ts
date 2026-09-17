// ============================================================
// Upsert a CRM contact from an SMS number so Messages / Contacts
// stay in sync (same idea as Ask Telfin call shortcut).
// ============================================================
import { ConflictError } from '../../lib/errors.js';
import { createContact, identifyCaller, updateContact } from '../crm/crm.service.js';
import { notesHaveSmsOptOut, withSmsOptOutNotes } from './sms-keywords.js';

export async function ensureSmsContact(params: {
  tenantId: string;
  phoneE164: string;
  firstName?: string;
  lastName?: string;
  notes?: string;
  markOptOut?: boolean;
}): Promise<{ id: string; created: boolean; optedOut: boolean }> {
  const existing = await identifyCaller(params.phoneE164, params.tenantId);
  if (existing) {
    const nextNotes = params.markOptOut
      ? withSmsOptOutNotes(existing.notes)
      : params.notes && !existing.notes
        ? params.notes
        : undefined;
    const nextFirst =
      params.firstName && (existing.firstName === 'Contact' || !existing.firstName)
        ? params.firstName
        : undefined;
    const nextLast = params.lastName && !existing.lastName ? params.lastName : undefined;
    if (nextNotes || nextFirst || nextLast) {
      await updateContact(
        existing.id,
        {
          ...(nextFirst ? { firstName: nextFirst } : {}),
          ...(nextLast ? { lastName: nextLast } : {}),
          ...(nextNotes ? { notes: nextNotes } : {}),
        },
        params.tenantId,
      );
    }
    return {
      id: existing.id,
      created: false,
      optedOut: params.markOptOut || notesHaveSmsOptOut(existing.notes),
    };
  }

  try {
    const notes = params.markOptOut
      ? withSmsOptOutNotes(params.notes)
      : params.notes ?? null;
    const created = await createContact(
      {
        firstName: params.firstName?.trim() || 'Contact',
        lastName: params.lastName?.trim() || '',
        phoneE164: params.phoneE164,
        contactType: 'new',
        source: 'sms',
        ...(notes ? { notes } : {}),
      },
      params.tenantId,
    );
    return { id: created.id, created: true, optedOut: Boolean(params.markOptOut) };
  } catch (err) {
    if (err instanceof ConflictError) {
      const raced = await identifyCaller(params.phoneE164, params.tenantId);
      if (raced) {
        return {
          id: raced.id,
          created: false,
          optedOut: notesHaveSmsOptOut(raced.notes),
        };
      }
    }
    throw err;
  }
}
