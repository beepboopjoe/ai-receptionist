// ============================================================
// Internal CRM adapter — reads/writes from the built-in contacts table
// ============================================================
import { db } from '../../../db/client.js';
import { contacts, calls, appointments } from '../../../db/schema.js';
import { eq, and, or, ilike, sql } from 'drizzle-orm';
import type { ICrmAdapter, Contact, CreateContactInput, CallNote } from '@ai-receptionist/shared';
import { normalizePhone, normalizeName } from '../contact-normalizer.js';
import { ConflictError } from '../../../lib/errors.js';

export class InternalCrmAdapter implements ICrmAdapter {
  readonly provider = 'internal' as const;

  async findByPhone(phone: string, tenantId: string): Promise<Contact | null> {
    const normalized = normalizePhone(phone) ?? phone;
    const [row] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, normalized)))
      .limit(1);
    return row ? mapContact(row) : null;
  }

  async findByEmail(email: string, tenantId: string): Promise<Contact | null> {
    const [row] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.email, email.toLowerCase())))
      .limit(1);
    return row ? mapContact(row) : null;
  }

  async search(query: string, tenantId: string): Promise<Contact[]> {
    const term = `%${query}%`;
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          or(
            ilike(contacts.firstName, term),
            ilike(contacts.lastName, term),
            ilike(contacts.phoneE164, term),
            ilike(contacts.email, term)
          )
        )
      )
      .limit(20);
    return rows.map(mapContact);
  }

  async createContact(data: CreateContactInput, tenantId: string): Promise<Contact> {
    const phone = normalizePhone(data.phoneE164) ?? data.phoneE164;

    // Check for duplicate
    const existing = await this.findByPhone(phone, tenantId);
    if (existing) {
      throw new ConflictError(`Contact with phone ${phone} already exists`);
    }

    const [row] = await db
      .insert(contacts)
      .values({
        tenantId,
        firstName: normalizeName(data.firstName),
        lastName: normalizeName(data.lastName),
        phoneE164: phone,
        email: data.email?.toLowerCase() ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        contactType: data.contactType ?? 'existing',
        insuranceProvider: data.insuranceProvider ?? null,
        insuranceId: data.insuranceId ?? null,
        recallDueDate: data.recallDueDate ?? null,
        preferredProvider: data.preferredProvider ?? null,
        notes: data.notes ?? null,
        source: data.source ?? 'manual',
        externalCrmId: data.externalCrmId ?? null,
      })
      .returning();

    if (!row) throw new Error('Contact creation failed');
    return mapContact(row);
  }

  async updateContact(id: string, data: Partial<CreateContactInput>, tenantId: string): Promise<Contact> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.firstName) updateData['firstName'] = normalizeName(data.firstName);
    if (data.lastName) updateData['lastName'] = normalizeName(data.lastName);
    if (data.phoneE164) updateData['phoneE164'] = normalizePhone(data.phoneE164) ?? data.phoneE164;
    if (data.email !== undefined) updateData['email'] = data.email?.toLowerCase() ?? null;
    if (data.dateOfBirth !== undefined) updateData['dateOfBirth'] = data.dateOfBirth;
    if (data.contactType !== undefined) updateData['contactType'] = data.contactType;
    if (data.insuranceProvider !== undefined) updateData['insuranceProvider'] = data.insuranceProvider;
    if (data.insuranceId !== undefined) updateData['insuranceId'] = data.insuranceId;
    if (data.recallDueDate !== undefined) updateData['recallDueDate'] = data.recallDueDate;
    if (data.preferredProvider !== undefined) updateData['preferredProvider'] = data.preferredProvider;
    if (data.notes !== undefined) updateData['notes'] = data.notes;

    const [row] = await db
      .update(contacts)
      .set(updateData as Parameters<typeof db.update>[0] extends infer T ? never : never)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
      .returning();

    if (!row) throw new Error('Contact not found or update failed');
    return mapContact(row);
  }

  async appendCallNote(contactId: string, note: CallNote, tenantId: string): Promise<void> {
    // Append to contact notes field (simple implementation)
    // In V2 this would be a separate call_notes table
    const [existing] = await db
      .select({ notes: contacts.notes })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
      .limit(1);

    if (!existing) return;

    const timestamp = new Date(note.createdAt).toLocaleDateString('en-US');
    const newNote = `[${timestamp}] ${note.summary} (${note.outcome})`;
    const combined = existing.notes
      ? `${existing.notes}\n${newNote}`
      : newNote;

    await db
      .update(contacts)
      .set({ notes: combined, updatedAt: new Date() })
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
  }
}

// Map DB row to shared Contact type
function mapContact(row: typeof contacts.$inferSelect): Contact {
  return {
    id: row.id,
    tenantId: row.tenantId,
    firstName: row.firstName,
    lastName: row.lastName,
    phoneE164: row.phoneE164,
    email: row.email,
    dateOfBirth: row.dateOfBirth,
    contactType: row.contactType as 'new' | 'existing',
    insuranceProvider: row.insuranceProvider,
    insuranceId: row.insuranceId,
    recallDueDate: row.recallDueDate,
    preferredProvider: row.preferredProvider,
    notes: row.notes,
    source: row.source as 'manual' | 'csv_import' | 'call' | 'crm_sync',
    externalCrmId: row.externalCrmId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
