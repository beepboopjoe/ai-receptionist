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
  /** Optional full transcript — adapters that support a long-form body include this. */
  transcript?: string;
  /** Optional call metadata. */
  durationSec?: number;
  direction?: 'inbound' | 'outbound';
  fromNumber?: string;
  createdAt: string;
}

/** Phase 13 — payload for syncing a booked appointment to a CRM as an Event/Meeting. */
export interface AppointmentSyncPayload {
  appointmentId: string;
  /** Local contact ID — adapter resolves to its own CRM contactId. */
  contactPhoneE164: string;
  contactEmail?: string | null;
  contactName?: string;
  appointmentType: string;
  startsAt: string; // ISO 8601
  endsAt: string;   // ISO 8601
  notes?: string;
}

/** Phase 13 — payload for syncing an escalation to a CRM as a Task/To-Do. */
export interface EscalationSyncPayload {
  escalationId: string;
  contactPhoneE164: string;
  contactEmail?: string | null;
  contactName?: string;
  reason: string;
  /** Free-text description (transcript snippet, AI's summary of the urgency). */
  description?: string;
  /** ISO 8601 due time — defaults to "now + 4h" if not set by caller. */
  dueAt?: string;
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
  /** Phase 13 — optional. Adapters that don't yet implement these skip silently in sync fan-out. */
  createAppointmentEvent?(contactId: string, appt: AppointmentSyncPayload, tenantId: string): Promise<void>;
  createEscalationTask?(contactId: string, esc: EscalationSyncPayload, tenantId: string): Promise<void>;
}
