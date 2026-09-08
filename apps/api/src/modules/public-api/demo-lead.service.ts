// ============================================================
// Persist homepage call-me visitors as demo-tenant contacts.
// Reuses contacts + call.contactId — no new CRM.
// Never throws to the dial / hangup path.
// ============================================================
import { db } from '../../db/client.js';
import { calls, contacts } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { normalizePhone } from '../crm/contact-normalizer.js';
import {
  formatDemoLeadNotes,
  splitLeadName,
  type DemoLeadDraft,
} from './demo-closer.js';
import type { DemoCallMeBootLog } from './public-demo.helpers.js';

export interface UpsertDemoCallMeLeadInput {
  tenantId: string;
  phoneE164: string;
  callId?: string;
  draft: DemoLeadDraft;
  log?: DemoCallMeBootLog;
}

export async function upsertDemoCallMeLead(
  input: UpsertDemoCallMeLeadInput,
): Promise<{ contactId: string } | null> {
  const phone = normalizePhone(input.phoneE164) ?? input.phoneE164.trim();
  if (!phone || !input.tenantId) return null;

  try {
    const [existing] = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        notes: contacts.notes,
      })
      .from(contacts)
      .where(and(eq(contacts.tenantId, input.tenantId), eq(contacts.phoneE164, phone)))
      .limit(1);

    const extracted = splitLeadName(input.draft);
    const firstName =
      input.draft.firstName.trim()
        ? extracted.firstName
        : (existing?.firstName && existing.firstName !== 'Visitor' ? existing.firstName : extracted.firstName);
    const lastName =
      input.draft.lastName.trim()
        ? extracted.lastName
        : (existing?.lastName && existing.lastName !== 'Lead' ? existing.lastName : extracted.lastName);
    const notes = formatDemoLeadNotes({
      existing: existing?.notes,
      phone,
      draft: input.draft,
    });

    let contactId = existing?.id;
    if (existing) {
      await db
        .update(contacts)
        .set({
          firstName,
          lastName,
          notes,
          source: 'demo_call_me',
          contactType: 'new',
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.id, existing.id), eq(contacts.tenantId, input.tenantId)));
    } else {
      const [inserted] = await db
        .insert(contacts)
        .values({
          tenantId: input.tenantId,
          firstName,
          lastName,
          phoneE164: phone,
          contactType: 'new',
          source: 'demo_call_me',
          notes,
        })
        .returning({ id: contacts.id });
      contactId = inserted?.id;
    }

    if (!contactId) return null;

    if (input.callId) {
      await db
        .update(calls)
        .set({ contactId, updatedAt: new Date() })
        .where(and(eq(calls.id, input.callId), eq(calls.tenantId, input.tenantId)));
    }

    input.log?.info(
      {
        contactId,
        callId: input.callId,
        closed: input.draft.closed,
        language: input.draft.language,
      },
      'Demo call-me lead persisted',
    );
    return { contactId };
  } catch (err) {
    input.log?.warn({ err, callId: input.callId }, 'Demo call-me lead persist failed');
    return null;
  }
}
