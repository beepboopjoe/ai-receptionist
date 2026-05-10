// ============================================================
// Vertical Configs — UI-specific copy/emoji/use-cases for each
// vertical. The `Vertical` union itself lives in
// @ai-receptionist/shared so the API and dashboard share one
// source of truth for the list of supported industries.
// ============================================================
export type { Vertical } from '@ai-receptionist/shared';
import type { Vertical } from '@ai-receptionist/shared';
export { VERTICAL_VALUES, isVertical, asVertical } from '@ai-receptionist/shared';

export interface VerticalConfig {
  id: Vertical;
  label: string;
  emoji: string;
  /** Singular noun for a contact (patient, client, lead, customer, caller) */
  contactNoun: string;
  contactNounPlural: string;
  /** Singular noun for a meeting/visit (appointment, consultation, showing) */
  appointmentNoun: string;
  appointmentNounPlural: string;
  /** Singular noun for the business (practice, firm, agency, brokerage) */
  businessNoun: string;
  /** Example placeholder for business name field */
  businessPlaceholder: string;
  /** Short description shown on landing page vertical cards */
  description: string;
  /** Three bullet use-cases shown on landing page card */
  useCaseBullets: [string, string, string];
  /** Use-case IDs for the demo page (maps to backend prompt keys) */
  useCaseIds: string[];
  /** Human-readable use-case labels matching useCaseIds order */
  useCaseLabels: string[];
  /** Outbound campaign type names */
  campaignTypes: string[];
  /** CRM / calendar integrations relevant to this vertical */
  integrations: string[];
}

export const VERTICAL_CONFIGS: Record<Vertical, VerticalConfig> = {
  dental: {
    id: 'dental',
    label: 'Healthcare / Dental',
    emoji: '🦷',
    contactNoun: 'patient',
    contactNounPlural: 'patients',
    appointmentNoun: 'appointment',
    appointmentNounPlural: 'appointments',
    businessNoun: 'practice',
    businessPlaceholder: 'Riverside Dental Group',
    description: 'Never miss a patient call again. Book cleanings, handle emergencies, and run recall campaigns automatically.',
    useCaseBullets: ['Appointment booking & recall', 'Emergency triage & escalation', 'Insurance verification calls'],
    useCaseIds: ['dental_receptionist', 'dental_new_patient', 'dental_reminder', 'dental_emergency', 'dental_recall'],
    useCaseLabels: ['Receptionist', 'New Patient Intake', 'Appointment Reminder', 'Emergency Triage', 'Patient Recall'],
    campaignTypes: ['Overdue Recall', 'Treatment Plan Follow-Up', 'Patient Reactivation', 'New Patient Outreach'],
    integrations: ['Dentrix', 'Eaglesoft', 'Open Dental', 'Google Calendar'],
  },

  insurance: {
    id: 'insurance',
    label: 'Insurance Agency',
    emoji: '📋',
    contactNoun: 'client',
    contactNounPlural: 'clients',
    appointmentNoun: 'consultation',
    appointmentNounPlural: 'consultations',
    businessNoun: 'agency',
    businessPlaceholder: 'Apex Insurance Group',
    description: 'Qualify inbound leads, follow up on quotes, and schedule policy reviews — while your agents focus on closing.',
    useCaseBullets: ['Inbound lead qualification', 'Quote follow-up calls', 'Policy renewal reminders'],
    useCaseIds: ['insurance_receptionist', 'insurance_lead_intake', 'insurance_reminder', 'insurance_lead_followup', 'insurance_renewal'],
    useCaseLabels: ['Receptionist', 'Lead Intake', 'Appointment Reminder', 'Lead Follow-Up', 'Renewal Outreach'],
    campaignTypes: ['Quote Follow-Up', 'Policy Renewal', 'Lapsed Client Reactivation', 'Cross-Sell Outreach'],
    integrations: ['Salesforce', 'HubSpot', 'Applied Epic', 'Google Calendar'],
  },

  legal: {
    id: 'legal',
    label: 'Law Firm',
    emoji: '⚖️',
    contactNoun: 'client',
    contactNounPlural: 'clients',
    appointmentNoun: 'consultation',
    appointmentNounPlural: 'consultations',
    businessNoun: 'firm',
    businessPlaceholder: 'Smith & Associates Law',
    description: 'Capture every new case inquiry 24/7, screen and schedule consultations, and follow up on prospects automatically.',
    useCaseBullets: ['24/7 new case intake', 'Consultation scheduling', 'Client follow-up & reminders'],
    useCaseIds: ['legal_receptionist', 'legal_intake', 'legal_reminder', 'legal_lead_followup', 'legal_client_update'],
    useCaseLabels: ['Receptionist', 'Case Intake', 'Appointment Reminder', 'Lead Follow-Up', 'Client Update Call'],
    campaignTypes: ['Prospect Follow-Up', 'Consultation Booking', 'Inactive Client Re-engagement', 'Referral Outreach'],
    integrations: ['Clio', 'MyCase', 'PracticePanther', 'Google Calendar'],
  },

  real_estate: {
    id: 'real_estate',
    label: 'Real Estate',
    emoji: '🏠',
    contactNoun: 'lead',
    contactNounPlural: 'leads',
    appointmentNoun: 'showing',
    appointmentNounPlural: 'showings',
    businessNoun: 'brokerage',
    businessPlaceholder: 'Horizon Realty Group',
    description: 'Qualify buyer and seller leads instantly, schedule showings automatically, and follow up on every inquiry.',
    useCaseBullets: ['Instant lead qualification', 'Showing scheduling', 'Seller & buyer follow-up'],
    useCaseIds: ['real_estate_receptionist', 'real_estate_lead_intake', 'real_estate_reminder', 'real_estate_lead_followup', 'real_estate_listing_inquiry'],
    useCaseLabels: ['Receptionist', 'Lead Intake', 'Showing Reminder', 'Lead Follow-Up', 'Listing Inquiry'],
    campaignTypes: ['New Listing Outreach', 'Buyer Lead Follow-Up', 'Seller Lead Follow-Up', 'Past Client Re-engagement'],
    integrations: ['Follow Up Boss', 'Salesforce', 'HubSpot', 'Google Calendar'],
  },

  home_services: {
    id: 'home_services',
    label: 'Home Services',
    emoji: '🔧',
    contactNoun: 'customer',
    contactNounPlural: 'customers',
    appointmentNoun: 'appointment',
    appointmentNounPlural: 'appointments',
    businessNoun: 'business',
    businessPlaceholder: 'ProFix Home Services',
    description: 'Answer every service call, book jobs instantly, and send maintenance reminders — even after hours.',
    useCaseBullets: ['24/7 job booking', 'After-hours emergency dispatch', 'Service reminder campaigns'],
    useCaseIds: ['home_services_receptionist', 'home_services_booking', 'home_services_reminder', 'home_services_lead_followup', 'home_services_emergency'],
    useCaseLabels: ['Receptionist', 'Job Booking', 'Appointment Reminder', 'Lead Follow-Up', 'Emergency Dispatch'],
    campaignTypes: ['Seasonal Maintenance', 'Inactive Customer Reactivation', 'Service Renewal', 'Referral Outreach'],
    integrations: ['ServiceTitan', 'Jobber', 'HubSpot', 'Google Calendar'],
  },

  generic: {
    id: 'generic',
    label: 'Other Business',
    emoji: '💼',
    contactNoun: 'caller',
    contactNounPlural: 'callers',
    appointmentNoun: 'appointment',
    appointmentNounPlural: 'appointments',
    businessNoun: 'business',
    businessPlaceholder: 'My Business',
    description: 'AI handles every inbound call, books appointments, and runs outbound campaigns — for any appointment-based business.',
    useCaseBullets: ['24/7 call answering', 'Appointment booking', 'Outbound follow-up'],
    useCaseIds: ['generic_receptionist', 'generic_intake', 'generic_reminder', 'generic_lead_followup', 'generic_after_hours'],
    useCaseLabels: ['Receptionist', 'New Client Intake', 'Appointment Reminder', 'Lead Follow-Up', 'After-Hours'],
    campaignTypes: ['Lead Follow-Up', 'Inactive Contact Reactivation', 'Appointment Reminders', 'New Client Outreach'],
    integrations: ['HubSpot', 'Salesforce', 'Google Calendar', 'Twilio'],
  },
};

export const VERTICALS = Object.values(VERTICAL_CONFIGS);

/** Get vertical config by ID, falling back to generic */
export function getVertical(id: string | null | undefined): VerticalConfig {
  return VERTICAL_CONFIGS[(id as Vertical) ?? 'generic'] ?? VERTICAL_CONFIGS.generic;
}

/** Read the saved vertical from localStorage (client-side only) */
export function getSavedVertical(): Vertical {
  if (typeof window === 'undefined') return 'generic';
  try {
    const saved = localStorage.getItem('onboarding_vertical');
    return (saved as Vertical) ?? 'generic';
  } catch {
    return 'generic';
  }
}
