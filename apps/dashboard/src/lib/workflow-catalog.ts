// ============================================================
// Workflow catalog (Phase 28a) — the source of truth for the
// /workflows gallery.
//
// Telfin is the "AI front desk": a SYSTEM OF ACTION, not a system
// of record. Every workflow here is something the front desk DOES
// (call / text / email / book / remind / follow up) — never a
// place to store data. The gallery is a packaging + deep-link
// layer over features that already exist; it is NOT a new
// execution engine. Each entry's `setupHref` points at the
// existing surface that already powers it.
//
// Status honesty:
//   'live'        — works today out of the box
//   'setup'       — configurable today via setupHref
//   'coming_soon' — concrete near-term path, not yet shipped
//
// Vertical-aware labels: built via buildWorkflowCatalog(vertical)
// so a dental tenant reads "patients", a legal tenant "clients".
// ============================================================
import {
  Phone,
  MessageSquareReply,
  MoonStar,
  BookOpen,
  CalendarCheck,
  BellRing,
  RefreshCw,
  Star,
  Users,
  CalendarClock,
  HeartHandshake,
  ClipboardList,
  Mail,
  Receipt,
  PhoneOutgoing,
  Crosshair,
  type LucideIcon,
} from 'lucide-react';
import type { VerticalConfig } from './verticals';

export type WorkflowCategory = 'reactive' | 'proactive' | 'admin';
export type WorkflowChannel = 'voice' | 'sms' | 'email' | 'multi';
export type WorkflowStatus = 'live' | 'setup' | 'coming_soon';

export interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  channel: WorkflowChannel;
  status: WorkflowStatus;
  /** Deep-link to the existing dashboard surface that powers this workflow.
   *  null for coming_soon entries. */
  setupHref: string | null;
  icon: LucideIcon;
}

export const CATEGORY_META: Record<
  WorkflowCategory,
  { label: string; tagline: string }
> = {
  reactive: {
    label: 'The front desk picks up',
    tagline: 'Inbound — your AI answers, books, triages, and never sends a caller to voicemail.',
  },
  proactive: {
    label: 'The outreach you never get to',
    tagline: 'Outbound — your AI calls and messages on its own to win back, remind, and grow.',
  },
  admin: {
    label: 'Keeping the desk tidy',
    tagline: 'The follow-through that keeps leads warm and the books clean.',
  },
};

export const CHANNEL_META: Record<WorkflowChannel, { label: string }> = {
  voice: { label: 'Voice' },
  sms: { label: 'SMS' },
  email: { label: 'Email' },
  multi: { label: 'Voice + SMS' },
};

export const STATUS_META: Record<
  WorkflowStatus,
  { label: string; cta: string }
> = {
  live: { label: 'Live', cta: 'Open' },
  setup: { label: 'Set up', cta: 'Set up' },
  coming_soon: { label: 'Coming soon', cta: 'Coming soon' },
};

/**
 * Build the catalog with vertical-aware copy. Pass `useVertical()`'s result.
 * `c` = contact noun (patient/client/lead/customer), `cap` = appointment noun.
 */
export function buildWorkflowCatalog(v: VerticalConfig): WorkflowDef[] {
  const c = v.contactNoun; // e.g. "patient"
  const cPl = v.contactNounPlural; // e.g. "patients"
  const appt = v.appointmentNoun; // e.g. "appointment"

  return [
    // ── Reactive — the front desk picks up ──────────────────────
    {
      id: 'call-answering',
      name: 'Call Answering (24/7)',
      description: `Your AI receptionist answers every inbound call day and night, greets ${cPl} by name, and handles the conversation end to end.`,
      category: 'reactive',
      channel: 'voice',
      status: 'live',
      setupHref: '/settings/voice-agent',
      icon: Phone,
    },
    {
      id: 'missed-call-textback',
      name: 'Missed-Call Text-Back',
      description: `If a call slips through, the AI texts the ${c} back within seconds so the lead never goes cold.`,
      category: 'reactive',
      channel: 'sms',
      status: 'setup',
      setupHref: '/missed-calls',
      icon: MessageSquareReply,
    },
    {
      id: 'after-hours-triage',
      name: 'After-Hours Triage & Escalation',
      description: 'Out-of-hours calls are screened for urgency. True emergencies route to your on-call line; everything else is captured for the morning.',
      category: 'reactive',
      channel: 'voice',
      status: 'setup',
      setupHref: '/settings/office-hours',
      icon: MoonStar,
    },
    {
      id: 'faq-answering',
      name: 'FAQ Answering',
      description: 'The AI answers questions about hours, pricing, services, and policies — grounded in the documents you upload, so it never guesses.',
      category: 'reactive',
      channel: 'voice',
      status: 'setup',
      setupHref: '/settings/knowledge-base',
      icon: BookOpen,
    },
    {
      id: 'appointment-booking',
      name: `${cap(appt)} Booking`,
      description: `Books, reschedules, and cancels ${appt}s straight into your calendar during the call — no callback, no phone tag.`,
      category: 'reactive',
      channel: 'voice',
      status: 'live',
      setupHref: '/appointments',
      icon: CalendarCheck,
    },

    // ── Proactive — the outreach you never get to ───────────────
    {
      id: 'ask-your-ai',
      name: 'Ask Your AI to Make a Call',
      description: `Type a request in plain words — "call and confirm tomorrow's 2pm" — and your AI dials, handles the conversation, and shows you the transcript.`,
      category: 'proactive',
      channel: 'voice',
      status: 'live',
      setupHref: '/dashboard',
      icon: PhoneOutgoing,
    },
    {
      id: 'get-new-leads',
      name: 'Get New Leads',
      description: 'Describe who you want to reach — "dentists in Chicago, rated 4+" — and we find real businesses with phone numbers, ready to call. Pay only per lead you keep.',
      category: 'proactive',
      channel: 'voice',
      status: 'live',
      setupHref: '/leads/discover',
      icon: Crosshair,
    },
    {
      id: 'appointment-reminders',
      name: `${cap(appt)} Reminders`,
      description: `The AI calls and texts ${cPl} 24 hours and 2 hours before their ${appt} — no-shows typically drop by half, and cancellations reschedule on the spot.`,
      category: 'proactive',
      channel: 'multi',
      status: 'setup',
      setupHref: '/campaigns/new',
      icon: BellRing,
    },
    {
      id: 'stale-lead-reactivation',
      name: 'Stale-Lead Reactivation',
      description: `Every ${c} who inquired but never booked gets a friendly follow-up on a cadence you set. Dormant pipeline you already paid for becomes booked business.`,
      category: 'proactive',
      channel: 'multi',
      status: 'setup',
      setupHref: '/campaigns/new',
      icon: RefreshCw,
    },
    {
      id: 'review-requests',
      name: 'Review Requests',
      description: `After a completed ${appt}, the AI asks happy ${cPl} for a review and sends them straight to your Google/Yelp page.`,
      category: 'proactive',
      channel: 'sms',
      status: 'coming_soon',
      setupHref: null,
      icon: Star,
    },
    {
      id: 'referral-asks',
      name: 'Referral Asks',
      description: `Periodic, polite outreach to past ${cPl} asking for referrals — the highest-ROI outreach there is, and the one nobody has time to actually make.`,
      category: 'proactive',
      channel: 'multi',
      status: 'setup',
      setupHref: '/campaigns/new',
      icon: HeartHandshake,
    },
    {
      id: 'recall-renewal',
      name: 'Recall / Renewal Reminders',
      description: `Recurring outreach for ${cPl} due to come back — recalls, renewals, annual reviews — scheduled to run on autopilot.`,
      category: 'proactive',
      channel: 'multi',
      status: 'setup',
      setupHref: '/campaigns',
      icon: CalendarClock,
    },
    {
      id: 'winback',
      name: 'Win-Back / We-Miss-You',
      description: `Re-engage ${cPl} who haven't been back in a while with a warm check-in and an easy way to rebook.`,
      category: 'proactive',
      channel: 'multi',
      status: 'coming_soon',
      setupHref: null,
      icon: Users,
    },
    {
      id: 'waitlist-fill',
      name: 'Waitlist Fill',
      description: `When a ${appt} cancels, the AI calls down your waitlist to fill the slot before it's lost.`,
      category: 'proactive',
      channel: 'voice',
      status: 'coming_soon',
      setupHref: null,
      icon: CalendarCheck,
    },

    // ── Admin — keeping the desk tidy ───────────────────────────
    {
      id: 'lead-intake',
      name: 'Lead Intake & Qualification',
      description: `New ${cPl} are captured, qualified, and added to your pipeline automatically — with the full call transcript attached.`,
      category: 'admin',
      channel: 'voice',
      status: 'live',
      setupHref: '/contacts',
      icon: ClipboardList,
    },
    {
      id: 'email-followups',
      name: 'Email Follow-Up Templates',
      description: `Send polished, on-brand emails after key moments — confirmations, prep instructions, document requests — from a library of templates.`,
      category: 'admin',
      channel: 'email',
      status: 'setup',
      setupHref: '/settings/email-templates',
      icon: Mail,
    },
    {
      id: 'payment-reminders',
      name: 'Payment / Invoice Reminders',
      description: `The AI calls and texts ${cPl} with outstanding balances to remind them to pay — no awkward conversations for your team.`,
      category: 'admin',
      channel: 'multi',
      status: 'coming_soon',
      setupHref: null,
      icon: Receipt,
    },
  ];
}

/** Capitalize the first letter (for nouns interpolated at sentence/title start). */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
