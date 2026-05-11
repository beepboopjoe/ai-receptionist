// ============================================================
// Call Types — shared between API and Dashboard
// ============================================================

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus =
  | 'active'
  | 'completed'
  | 'missed'
  | 'transferred'
  | 'failed';

export type CallOutcome =
  | 'booked'
  | 'rescheduled'
  | 'cancelled'
  | 'escalated'
  | 'no_action'
  | 'voicemail';

export type WorkflowType =
  | 'new_contact'
  | 'existing_contact'
  | 'reschedule'
  | 'cancellation'
  | 'reminder'
  | 'escalation'
  | 'after_hours';

export interface TranscriptEntry {
  role: 'agent' | 'caller';
  text: string;
  timestamp: string; // ISO 8601
}

export interface Call {
  id: string;
  tenantId: string;
  contactId: string | null;
  rcCallId: string;
  rcSessionId: string | null;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  status: CallStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  workflowTriggered: WorkflowType | null;
  escalationReason: string | null;
  outcome: CallOutcome | null;
  summary: string | null;
  recordingUrl: string | null;
  transcript: TranscriptEntry[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallListItem {
  id: string;
  contactId: string | null;
  contactName: string | null;
  fromNumber: string;
  status: CallStatus;
  outcome: CallOutcome | null;
  workflowTriggered: WorkflowType | null;
  durationSeconds: number | null;
  startedAt: string | null;
  createdAt: string;
}
