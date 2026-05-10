// ============================================================
// CRM service — unified interface, delegates to adapters
// ============================================================
import { InternalCrmAdapter } from './adapters/internal.adapter.js';
import type { ICrmAdapter, Contact, CreateContactInput, CallNote } from '@ai-receptionist/shared';
import { audit } from '../../audit/audit-logger.js';

// V1: only the internal adapter. V2 adds Dentrix, Eaglesoft, etc.
const adapter: ICrmAdapter = new InternalCrmAdapter();

export async function identifyCaller(
  phone: string,
  tenantId: string
): Promise<Contact | null> {
  return adapter.findByPhone(phone, tenantId);
}

export async function findContactByEmail(
  email: string,
  tenantId: string
): Promise<Contact | null> {
  return adapter.findByEmail(email, tenantId);
}

export async function searchContacts(
  query: string,
  tenantId: string
): Promise<Contact[]> {
  return adapter.search(query, tenantId);
}

export async function createContact(
  data: CreateContactInput,
  tenantId: string
): Promise<Contact> {
  const contact = await adapter.createContact(data, tenantId);
  audit.contactCreated(tenantId, contact.id, data.source ?? 'call');
  return contact;
}

export async function updateContact(
  id: string,
  data: Partial<CreateContactInput>,
  tenantId: string
): Promise<Contact> {
  return adapter.updateContact(id, data, tenantId);
}

export async function saveCallNote(
  contactId: string,
  note: CallNote,
  tenantId: string
): Promise<void> {
  return adapter.appendCallNote(contactId, note, tenantId);
}
