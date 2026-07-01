// ============================================================
// Section meta registry — drives the SectionAgent header on
// each dashboard section page. Pure config, no fetches.
//
// Per-section:
//   - icon, title, whatThisIs copy (1-2 sentences)
//   - static action chips (label + href / external)
//   - relevantSuggestionTypes — which agent_suggestions to show inline
//
// Vertical-aware: copy keys reference helpers that swap words
// ("patient" vs "client" vs "lead") so the agent reads naturally.
// ============================================================
import type { LucideIcon } from 'lucide-react';
import {
  Phone,
  PhoneMissed,
  Calendar,
  AlertCircle,
  Users,
  MessageSquare,
  Megaphone,
  Bell,
  BookOpen,
} from 'lucide-react';
import type { AgentSuggestionType } from './api';

export type SectionKey =
  | 'calls'
  | 'missed-calls'
  | 'appointments'
  | 'escalations'
  | 'contacts'
  | 'messages'
  | 'campaigns'
  | 'reminders'
  | 'knowledge-base';

export interface SectionAction {
  label: string;
  /** Internal route or external URL. */
  href: string;
  /** Optional — open in new tab if true. */
  external?: boolean;
}

export interface SectionMeta {
  key: SectionKey;
  icon: LucideIcon;
  /** Title to show in the agent header. Will fall back to the page's own H1 if omitted. */
  title: string;
  /**
   * "What this is" copy — short, plain-language explanation of the section.
   * Receives `{ contactPlural, appointmentPlural }` so it can swap nouns by vertical.
   */
  whatThisIs: (ctx: VerticalCopyCtx) => string;
  /** Static one-click actions surfaced as chips. */
  actions: (ctx: VerticalCopyCtx) => SectionAction[];
  /**
   * Which agent_suggestion types belong on this section (re-homing from the
   * dashboard-wide AgentSuggestionsCard). Empty array = no inline suggestions
   * for this section, only live counts.
   */
  relevantSuggestionTypes: AgentSuggestionType[];
}

export interface VerticalCopyCtx {
  contactSingular: string; // "patient" / "client" / "lead"
  contactPlural: string;
  appointmentSingular: string; // "appointment" / "consultation" / "showing"
  appointmentPlural: string;
}

// ---- Registry ---------------------------------------------------------------

export const SECTION_META: Record<SectionKey, SectionMeta> = {
  calls: {
    key: 'calls',
    icon: Phone,
    title: 'Call Log',
    whatThisIs: () =>
      "Every call your AI receptionist handled, with a full transcript, summary, and outcome. Click a row to see what was said and where the call went next.",
    actions: () => [
      { label: 'Export to CSV', href: '#export' },
      { label: 'Tune voice settings', href: '/settings/voice-agent' },
      { label: 'Set up webhooks', href: '/settings/webhooks' },
    ],
    relevantSuggestionTypes: [],
  },

  'missed-calls': {
    key: 'missed-calls',
    icon: PhoneMissed,
    title: 'Missed Calls',
    whatThisIs: ({ contactPlural }) =>
      `Calls that ended without booking or escalation. These are your highest-priority callbacks — every missed ${contactPlural === 'leads' ? 'lead' : contactPlural.slice(0, -1)} is a recoverable opportunity.`,
    actions: ({ contactPlural }) => [
      { label: `Launch callback campaign`, href: '/campaigns' },
      { label: 'Set up missed-call SMS', href: '/settings/notifications' },
      { label: `View all ${contactPlural}`, href: '/contacts' },
    ],
    relevantSuggestionTypes: ['missed_call_callback'],
  },

  appointments: {
    key: 'appointments',
    icon: Calendar,
    title: 'Appointments',
    whatThisIs: ({ appointmentPlural }) =>
      `Every ${appointmentPlural.endsWith('s') ? appointmentPlural : appointmentPlural + 's'} your AI booked, plus past visits. Confirm, reschedule, mark complete, or recover no-shows — all from one view.`,
    actions: ({ appointmentSingular }) => [
      { label: `Customize ${appointmentSingular} types`, href: '/settings/voice-agent' },
      { label: 'Reminder settings', href: '/settings/notifications' },
      { label: 'Office hours', href: '/settings/office-hours' },
    ],
    relevantSuggestionTypes: ['appointment_confirmation', 'no_show_recapture'],
  },

  escalations: {
    key: 'escalations',
    icon: AlertCircle,
    title: 'Escalations',
    whatThisIs: () =>
      "Calls the AI couldn't fully handle — flagged for a human to follow up. The AI escalates when callers ask for a manager, when something falls outside its scope, or when the conversation goes sideways.",
    actions: () => [
      { label: 'Set up notifications', href: '/settings/notifications' },
      { label: 'Customize AI behavior', href: '/settings/voice-agent' },
      { label: 'Team & roles', href: '/settings/team' },
    ],
    relevantSuggestionTypes: [],
  },

  // ---- Stubs for future expansion (V1 only ships first 4) ----
  contacts: {
    key: 'contacts',
    icon: Users,
    title: 'Contacts',
    whatThisIs: ({ contactPlural }) =>
      `Everyone who has called or interacted with your AI. ${contactPlural[0]?.toUpperCase() + contactPlural.slice(1)} are auto-created on first inbound call and enriched as you interact.`,
    actions: () => [
      { label: 'Import from CSV', href: '#import' },
      { label: 'Export to CSV', href: '#export' },
      { label: 'CRM integrations', href: '/settings/integrations' },
    ],
    relevantSuggestionTypes: ['stale_lead_followup'],
  },

  messages: {
    key: 'messages',
    icon: MessageSquare,
    title: 'Messages',
    whatThisIs: () =>
      "Two-way SMS inbox. The AI auto-replies to common questions, sends appointment confirmations, and lets you jump in for anything that needs a human touch.",
    actions: () => [
      { label: 'Quick reply templates', href: '/settings/notifications' },
      { label: 'Compose new', href: '#compose' },
    ],
    relevantSuggestionTypes: [],
  },

  campaigns: {
    key: 'campaigns',
    icon: Megaphone,
    title: 'Campaigns',
    whatThisIs: ({ contactPlural }) =>
      `Outbound calling campaigns. The AI qualifies leads, books appointments, and respects do-not-call requests automatically. Use the suggested campaigns below to launch in one click against your existing ${contactPlural}.`,
    actions: () => [
      { label: 'Create from scratch', href: '/campaigns/new' },
      { label: 'Quiet hours & dial windows', href: '/settings/office-hours' },
    ],
    relevantSuggestionTypes: [],
  },

  reminders: {
    key: 'reminders',
    icon: Bell,
    title: 'Reminders',
    whatThisIs: ({ appointmentSingular }) =>
      `Auto-sent SMS reminders before every ${appointmentSingular}. Recipients can reply CONFIRM or CANCEL — your AI handles both. Standard schedule is 24 hours and 2 hours out.`,
    actions: () => [
      { label: 'Customize reminder copy', href: '/settings/notifications' },
      { label: 'Disable / re-enable SMS', href: '/settings/notifications' },
    ],
    relevantSuggestionTypes: [],
  },

  'knowledge-base': {
    key: 'knowledge-base',
    icon: BookOpen,
    title: 'Knowledge Base',
    whatThisIs: ({ contactPlural }) =>
      `Upload fee schedules, intake forms, FAQs, or policy PDFs and the AI grounds every call in them — so when ${contactPlural} ask about pricing, hours, or your specific services, the AI gives the right answer instead of "let me have someone call you back".`,
    actions: () => [
      { label: 'How it works', href: '/knowledge-base' },
      { label: 'Upload a doc', href: '#upload' },
    ],
    relevantSuggestionTypes: [],
  },
};

export function getSectionMeta(key: SectionKey): SectionMeta {
  return SECTION_META[key];
}
