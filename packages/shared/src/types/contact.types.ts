// ============================================================
// Contact / CRM Types
// ============================================================

export type ContactType = 'new' | 'existing';
export type ContactSource = 'manual' | 'csv_import' | 'call' | 'crm_sync';

export interface Contact {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  phoneE164: string;
  email: string | null;
  dateOfBirth: string | null; // ISO date YYYY-MM-DD
  contactType: ContactType;
  insuranceProvider: string | null;
  insuranceId: string | null;
  recallDueDate: string | null; // ISO date
  preferredProvider: string | null;
  notes: string | null;
  source: ContactSource;
  externalCrmId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactInput {
  firstName: string;
  lastName: string;
  phoneE164: string;
  email?: string;
  dateOfBirth?: string;
  contactType?: ContactType;
  insuranceProvider?: string;
  insuranceId?: string;
  recallDueDate?: string;
  preferredProvider?: string;
  notes?: string;
  source?: ContactSource;
  externalCrmId?: string;
}

export interface CallNote {
  callId: string;
  summary: string;
  outcome: string;
  appointmentId?: string;
  createdAt: string;
}

// ---- CRM Adapter Interface ----

export interface ICrmAdapter {
  readonly provider: 'internal' | 'csv_import' | string;
  findByPhone(phone: string, tenantId: string): Promise<Contact | null>;
  findByEmail(email: string, tenantId: string): Promise<Contact | null>;
  search(query: string, tenantId: string): Promise<Contact[]>;
  createContact(data: CreateContactInput, tenantId: string): Promise<Contact>;
  updateContact(id: string, data: Partial<CreateContactInput>, tenantId: string): Promise<Contact>;
  appendCallNote(contactId: string, note: CallNote, tenantId: string): Promise<void>;
}
