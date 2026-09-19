// ============================================================
// Tenant & Settings Types
// ============================================================

import type { AppointmentType } from './appointment.types.js';
import type { OfficeHours } from './workflow.types.js';

export type TenantPlan = 'trial' | 'starter' | 'growth' | 'scale' | 'business' | 'enterprise';

export type AfterHoursMode = 'voicemail' | 'callback' | 'transfer';

/** How inbound DIDs are answered before the AI greets. */
export type InboundRoutingMode =
  | 'ai_always'
  | 'after_hours_ai'
  | 'overflow_ai'
  /** During hours: try staff first, AI on no-answer. After hours: AI answers. */
  | 'staff_first';

/**
 * Spoken language for the AI receptionist.
 * English is primary. Spanish is the one extra language done well.
 * `auto` = bilingual EN/ES (English greeting, switch when they speak Spanish).
 */
export const SPOKEN_LANGUAGE_VALUES = ['en', 'es', 'auto'] as const;
export type SpokenLanguage = (typeof SPOKEN_LANGUAGE_VALUES)[number];

export function isSpokenLanguage(value: unknown): value is SpokenLanguage {
  return typeof value === 'string' && (SPOKEN_LANGUAGE_VALUES as readonly string[]).includes(value);
}

/** Unknown / missing → English. */
export function normalizeSpokenLanguage(input: unknown): SpokenLanguage {
  if (isSpokenLanguage(input)) return input;
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return 'en';
  if (raw === 'spanish' || raw === 'espanol' || raw === 'español' || raw === 'spa') return 'es';
  if (
    raw === 'bilingual' ||
    raw === 'both' ||
    raw === 'en-es' ||
    raw === 'enes' ||
    raw === 'en_es'
  ) {
    return 'auto';
  }
  return 'en';
}

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
  /** English (default) / Spanish / bilingual EN+ES auto-detect. */
  spokenLanguage: SpokenLanguage;
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
