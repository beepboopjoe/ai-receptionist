// ============================================================
// Workflow & Call State Types
// ============================================================

import type { WorkflowType } from './call.types.js';
import type { Contact } from './contact.types.js';

export type FlowStep =
  | 'greeting'
  | 'identify_caller'
  | 'collect_info'
  | 'confirm_intent'
  | 'check_availability'
  | 'offer_slots'
  | 'confirm_booking'
  | 'collect_insurance'
  | 'confirm_cancellation'
  | 'collect_reschedule'
  | 'escalating'
  | 'summary'
  | 'complete';

export type EscalationReason =
  | 'pain_emergency'
  | 'billing'
  | 'complaint'
  | 'cannot_understand'
  | 'caller_requested'
  | 'max_retries_exceeded';

export type EscalationPriority = 'urgent' | 'normal';
export type EscalationStatus = 'open' | 'in_progress' | 'resolved';

// Active call state stored in Redis
export interface CallState {
  callId: string;         // Our internal UUID
  rcCallId: string;       // RingCentral call ID
  tenantId: string;
  fromNumber: string;
  toNumber: string;
  contact: Contact | null;
  workflow: WorkflowType | null;
  currentStep: FlowStep;
  retryCount: number;
  collectedData: CollectedCallData;
  startedAt: string;
  lastActivityAt: string;
  elevenLabsSessionId: string | null;
}

export interface CollectedCallData {
  // Patient identity
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  email?: string;
  insuranceProvider?: string;

  // Appointment
  appointmentType?: string;
  appointmentId?: string;           // For reschedule / cancel flows
  preferredDate?: string;
  selectedSlotStart?: string;
  selectedSlotEnd?: string;

  // Intent detection
  intent?: 'book' | 'reschedule' | 'cancel' | 'inquiry' | string;

  // Cancellation / reschedule
  cancellationReason?: string;
  rescheduleFromAppointmentId?: string;
  wantsToRebook?: boolean;

  // Escalation
  escalationReason?: string;
  escalationText?: string;
  isEmergency?: boolean;

  // After-hours
  callbackRequested?: boolean;

  // Flexible extra data collected during conversation
  [key: string]: unknown;
}

export interface Escalation {
  id: string;
  tenantId: string;
  callId: string;
  contactId: string | null;
  reason: EscalationReason;
  priority: EscalationPriority;
  status: EscalationStatus;
  assignedTo: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

// Flow execution result
export interface FlowResult {
  outcome: 'booked' | 'rescheduled' | 'cancelled' | 'escalated' | 'no_action' | 'voicemail';
  appointmentId?: string;
  escalationId?: string;
  summary?: string;
}

// Office hours config (stored in JSONB)
export interface DayHours {
  open: string;  // "09:00"
  close: string; // "17:00"
}

export interface OfficeHours {
  mon?: DayHours;
  tue?: DayHours;
  wed?: DayHours;
  thu?: DayHours;
  fri?: DayHours;
  sat?: DayHours;
  sun?: DayHours;
  holidays?: string[]; // ISO date strings
}
