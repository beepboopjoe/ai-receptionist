// ============================================================
// Tenant & Settings Types
// ============================================================

import type { AppointmentType } from './appointment.types.js';
import type { OfficeHours } from './workflow.types.js';

export type TenantPlan = 'trial' | 'growth' | 'scale' | 'business' | 'enterprise';

export type AfterHoursMode = 'voicemail' | 'callback' | 'transfer';

/** How inbound Telnyx DIDs are answered before the AI greets. */
export type InboundRoutingMode = 'ai_always' | 'after_hours_ai' | 'overflow_ai';

export type IntegrationProvider =
  | 'ringcentral'
  | 'google_calendar'
  | 'microsoft_calendar'
  | 'twilio'
  | 'sendgrid';

export type IntegrationStatus = 'pending' | 'connected' | 'error';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  timezone: string;
  isActive: boolean;
  onboardingStep: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  id: string;
  tenantId: string;
  officeHours: OfficeHours;
  afterHoursMode: AfterHoursMode;
  /** Telephony routing for the inbound DID. Distinct from afterHoursMode (AI script). */
  inboundRoutingMode: InboundRoutingMode;
  transferNumber: string | null;
  maxHoldSeconds: number;
  voiceAgentId: string | null;
  voiceName: string;
  appointmentTypes: AppointmentType[];
  recallIntervalMonths: number;
}

export interface Integration {
  id: string;
  tenantId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  credentials: Record<string, string>; // Never sent to frontend; server-side only
  metadata: Record<string, string>;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

// Safe version for frontend (no credentials)
export interface IntegrationSummary {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  metadata: Record<string, string>;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}
