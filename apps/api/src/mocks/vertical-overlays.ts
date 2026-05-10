// ============================================================
// Vertical mock overlays
//
// fixtures.ts contains the base shape of mock data (callers,
// appointments, escalations, notifications). This module provides
// vertical-flavored overrides — appointment types, call reasons,
// provider names, escalation reasons — so a dev account configured
// as e.g. 'legal' sees lawyer-flavored mock data instead of dental.
//
// Used by mocks.router.ts when serving GET endpoints under dev mode.
// ============================================================
import type { Vertical } from '@ai-receptionist/shared';
export type { Vertical };

export interface VerticalOverlay {
  apptTypes: string[];
  callReasons: string[];
  providerNames: string[];
  escalationReasons: string[];
  campaignNames: string[];
  notificationBodies: { reminder: string; confirmation: string };
}

export const VERTICAL_OVERLAYS: Record<Vertical, VerticalOverlay> = {
  dental: {
    apptTypes:        ['Cleaning', 'Checkup', 'Filling', 'Crown', 'Root Canal', 'Extraction', 'New Patient Exam'],
    callReasons:      ['Appointment booking', 'Recall reminder', 'Pain question', 'Insurance verification', 'Rescheduling', 'Cancellation', 'Cost question'],
    providerNames:    ['Dr. Chen', 'Dr. Patel', 'Dr. Rivera'],
    escalationReasons:['Severe pain — needs same-day appointment', 'Billing question — caller wants human', 'Insurance dispute', 'Treatment plan question'],
    campaignNames:    ['Overdue Recall Outreach', 'Treatment Plan Follow-Up', 'New Patient Welcome', 'Inactive Patient Reactivation'],
    notificationBodies: {
      reminder:     'Reminder: Cleaning tomorrow at 10am with Dr. Chen',
      confirmation: 'Confirmed: Crown appointment Mar 28 at 11am with Dr. Patel',
    },
  },
  insurance: {
    apptTypes:        ['Quote Consultation', 'Policy Review', 'Renewal Meeting', 'Claim Follow-Up', 'New Client Intake'],
    callReasons:      ['Quote request', 'Claim inquiry', 'Policy change', 'Renewal question', 'Cancellation', 'Coverage clarification'],
    providerNames:    ['Agent Rivera', 'Agent Singh', 'Agent Carter'],
    escalationReasons:['Claim dispute — caller wants human', 'Coverage gap concern', 'Renewal urgency', 'Policy change request'],
    campaignNames:    ['Quote Follow-Up', 'Policy Renewal Outreach', 'Lapsed Client Reactivation', 'Cross-Sell Campaign'],
    notificationBodies: {
      reminder:     'Reminder: Quote consultation tomorrow at 10am with Agent Rivera',
      confirmation: 'Confirmed: Policy review meeting Mar 28 at 11am with Agent Singh',
    },
  },
  legal: {
    apptTypes:        ['Initial Consultation', 'Case Review', 'Document Signing', 'Deposition Prep', 'Client Follow-Up'],
    callReasons:      ['New case inquiry', 'Case status', 'Document question', 'Court date question', 'Billing question', 'Referral'],
    providerNames:    ['Smith, J.D.', 'Patel, Esq.', 'Reyes, Esq.'],
    escalationReasons:['Urgent court deadline', 'Subpoena received', 'Arrest notification — needs counsel', 'Settlement question'],
    campaignNames:    ['Prospect Follow-Up', 'Free Consultation Outreach', 'Past-Client Re-engagement', 'Referral Network Outreach'],
    notificationBodies: {
      reminder:     'Reminder: Initial consultation tomorrow at 10am with Smith, J.D.',
      confirmation: 'Confirmed: Case review Mar 28 at 11am with Patel, Esq.',
    },
  },
  real_estate: {
    apptTypes:        ['Property Showing', 'Open House', 'Listing Consultation', 'Buyer Consultation', 'Closing Meeting'],
    callReasons:      ['Listing inquiry', 'Showing request', 'Pre-approval question', 'Offer question', 'Open house info', 'Seller consultation'],
    providerNames:    ['Agent Kim', 'Agent Brown', 'Agent Vasquez'],
    escalationReasons:['Closing date conflict', 'Inspection issue', 'Offer expiring', 'Lender deadline approaching'],
    campaignNames:    ['New Listing Outreach', 'Buyer Lead Follow-Up', 'Seller Lead Follow-Up', 'Past-Client Re-engagement'],
    notificationBodies: {
      reminder:     'Reminder: Property showing tomorrow at 2pm with Agent Kim',
      confirmation: 'Confirmed: Listing consultation Mar 28 at 11am with Agent Brown',
    },
  },
  home_services: {
    apptTypes:        ['Free Estimate', 'Service Call', 'Installation', 'Routine Maintenance', 'Emergency Dispatch'],
    callReasons:      ['Service request', 'Quote request', 'Emergency repair', 'Maintenance reminder', 'Warranty question', 'Scheduling change'],
    providerNames:    ['Mike (Tech)', 'Jordan (Tech)', 'Carlos (Tech)'],
    escalationReasons:['No heat / hot water', 'Burst pipe — water everywhere', 'Gas smell reported', 'Customer escalation about prior visit'],
    campaignNames:    ['Seasonal Maintenance Outreach', 'Inactive Customer Reactivation', 'Service Renewal', 'Referral Outreach'],
    notificationBodies: {
      reminder:     'Reminder: Service call tomorrow between 10am–12pm with Mike',
      confirmation: 'Confirmed: Free estimate Mar 28 at 11am with Jordan',
    },
  },
  generic: {
    apptTypes:        ['Consultation', 'Follow-up', 'Intake Meeting', 'Review', 'Service Call'],
    callReasons:      ['Appointment booking', 'Service inquiry', 'Billing question', 'Urgent request', 'Rescheduling', 'New client intake', 'Cancellation', 'General question'],
    providerNames:    ['Alex Carter', 'Jordan Lee', 'Sam Rivera'],
    escalationReasons:['Urgent request — needs same-day attention', 'Billing question — caller wants human', 'Complaint about last service', 'Complex inquiry — requires specialist'],
    campaignNames:    ['Inactive Contact Reactivation', 'Lead Follow-Up', 'Appointment Reminders', 'New Client Outreach'],
    notificationBodies: {
      reminder:     'Reminder: Consultation tomorrow at 10am',
      confirmation: 'Confirmed: Follow-up meeting Mar 28 at 11am',
    },
  },
};

export function getOverlay(vertical: string | undefined | null): VerticalOverlay {
  return VERTICAL_OVERLAYS[(vertical as Vertical) ?? 'generic'] ?? VERTICAL_OVERLAYS.generic;
}
