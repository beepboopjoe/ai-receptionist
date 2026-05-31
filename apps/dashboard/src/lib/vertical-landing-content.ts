// ============================================================
// Vertical landing page content registry (Phase 15+).
//
// One block per vertical. The /legal, /dental, /insurance,
// /real-estate, /home-services pages each consume one block.
//
// Adding a new vertical: replace the stub with a real
// VerticalLandingContent object. See README in
// apps/dashboard/src/components/marketing/vertical-landing/.
// ============================================================
import {
  Shield,
  Scale,
  Gavel,
  Smile,
  Heart,
  AlarmClock,
  ClipboardCheck,
  FileText,
  Home,
  Calendar,
  Key,
  Wrench,
  AlertTriangle,
  Clock,
  PhoneCall,
  RefreshCw,
  Star,
} from 'lucide-react';
import type { Vertical } from '@/lib/verticals';

import type { CrmStripItem } from '@/components/marketing/vertical-landing/vertical-crm-strip';
import type { FeatureGridItem } from '@/components/marketing/vertical-landing/vertical-features-grid';
import type { RoiStat } from '@/components/marketing/vertical-landing/vertical-roi-block';
import type { FaqItem } from '@/components/marketing/vertical-landing/vertical-faq';

export interface VerticalLandingContent {
  /** SEO metadata used by the page's `metadata` export. */
  seo: {
    title: string;
    description: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    headlineGradientSuffix: string;
    subhead: string;
    accentChipClass: string;
  };
  crmStrip: {
    heading: string;
    subhead?: string;
    crms: CrmStripItem[];
  };
  features: {
    eyebrow: string;
    heading: string;
    iconGradient: string;
    items: FeatureGridItem[];
  };
  roi: {
    heading: string;
    stats: RoiStat[];
  };
  testimonial: {
    quote: string;
    name: string;
    firmOrPractice: string;
    /** TRUE when this is a real testimonial — flips the visual treatment
     *  from "placeholder, swap me out" to "real customer quote". */
    real: boolean;
  };
  faq: {
    heading?: string;
    items: FaqItem[];
  };
  finalCta: {
    heading: string;
    headingGradientSuffix: string;
    subhead: string;
    primaryCtaLabel: string;
    secondaryNote?: string;
  };
}

// ── LEGAL ───────────────────────────────────────────────────

const legal: VerticalLandingContent = {
  seo: {
    title: 'Telfin for Law Firms — Intake, Scheduling, Clio/Filevine Sync',
    description:
      "24/7 AI receptionist built for law firms. Runs initial intake, books consults, escalates conflict-of-interest cases, and posts every call to Clio, Filevine, MyCase, HubSpot, or Salesforce. English + Spanish. No setup fees.",
  },
  hero: {
    eyebrow: 'For Law Firms',
    headline: "Your firm's first phone call",
    headlineGradientSuffix: 'shouldn’t go to voicemail.',
    subhead:
      "AI receptionist + outbound dialer for law firms. Answers every inbound call 24/7, runs initial intake, books consults, and proactively calls clients back — consult reminders, court-date confirmations, stale-lead reactivation, referral asks. Every conversation posts to Clio, Filevine, MyCase, HubSpot, or Salesforce. English, Spanish, and 5 more languages.",
    accentChipClass: 'bg-indigo-100 text-indigo-700',
  },
  crmStrip: {
    heading: 'Connects to the CRMs your firm already runs on.',
    subhead:
      'Every call, every consult booking, every conflict-check escalation lands on the matching contact record in your CRM — automatically, within seconds.',
    crms: [
      { id: 'clio', label: 'Clio', icon: '⚖️', badge: 'Native' },
      { id: 'filevine', label: 'Filevine', icon: '📁', badge: 'Native' },
      { id: 'mycase', label: 'MyCase', icon: '📂', badge: 'Coming soon' },
      { id: 'hubspot', label: 'HubSpot', icon: '🔗', badge: 'Native' },
      { id: 'salesforce', label: 'Salesforce', icon: '☁️', badge: 'Native' },
    ],
  },
  features: {
    eyebrow: 'Built for law firm intake',
    heading: 'The AI knows when to take the case and when to hand it back to you.',
    iconGradient: 'from-indigo-500 to-violet-500',
    items: [
      {
        icon: Scale,
        title: 'Conflict-check-aware escalation',
        body: "When a caller mentions an opposing party or a matter your firm has previously represented, the AI stops intake and routes the call to your conflict-check process. No commitments given on the call.",
      },
      {
        icon: Shield,
        title: 'Privileged-by-default',
        body: 'Call transcripts and AI summaries are encrypted at rest, never used for training, and excluded from cross-tenant analytics. Caller is notified at start of call that an automated system is taking intake.',
      },
      {
        icon: Gavel,
        title: 'Court-date sensitivity',
        body: 'When a caller says "I was served papers", "I have a court date", or mentions a restraining order, the AI flags it as time-sensitive and routes to your on-call attorney’s cell immediately.',
      },
      {
        icon: PhoneCall,
        title: 'Consult-reminder campaigns',
        body: 'Automatic outbound calls to scheduled consults 24 hours and 2 hours before — no-show rates typically cut in half. Cancellations reschedule on the same call instead of disappearing into voicemail.',
      },
      {
        icon: RefreshCw,
        title: 'Stale-lead reactivation',
        body: 'AI calls every prospect who inquired but never booked, on a configurable cadence. Dormant pipeline that would otherwise rot in your CRM becomes signed retainers — usually 8-12× lift on cases that were already paid for in marketing.',
      },
      {
        icon: Star,
        title: 'Past-client referral asks',
        body: 'Polite quarterly outbound to closed-matter clients asking for referrals. The ask your associates know they should make and never have the time to actually pick up the phone for.',
      },
    ],
  },
  roi: {
    heading: 'Why law firms switch.',
    stats: [
      {
        value: '63%',
        body: 'of after-hours legal-intake calls go to voicemail without an AI receptionist. Almost all of those callers hire the next firm that picks up.',
      },
      {
        value: '$2,400',
        body: 'average value of a closed PI case. The math on one missed call vs. one signed retainer is not subtle.',
      },
      {
        value: '~50%',
        body: 'typical no-show reduction when the AI runs consult-reminder calls at the 24-hour and 2-hour marks. Cancellations reschedule on the spot.',
      },
      {
        value: '8-12×',
        body: 'reactivation lift on stale leads that never returned the initial callback. The AI catches them; your intake team converts them.',
      },
      {
        value: '0',
        body: 'weekends, holidays, or sick days. The AI works every call — your associates don’t have to.',
      },
    ],
  },
  testimonial: {
    real: false,
    quote:
      'Add your firm’s testimonial here once you have one. Edit `content.legal.testimonial` in `vertical-landing-content.ts` and flip `real: true` to remove this placeholder treatment.',
    name: 'Your client’s name',
    firmOrPractice: 'Their firm',
  },
  faq: {
    items: [
      {
        q: 'Does the AI give legal advice?',
        a: "No. The AI is instructed in every system prompt to never give legal advice, predict case outcomes, or interpret statutes. It collects facts, books consults, and escalates anything substantive to a human attorney.",
      },
      {
        q: 'How do you handle attorney-client privilege?',
        a: "Callers are notified at the start of each call that an automated system is taking intake. Transcripts are encrypted at rest and access-controlled to your firm only — we never use them for AI training or share them across tenants. The platform is not the attorney in the relationship; your retainer agreement establishes that downstream.",
      },
      {
        q: 'What CRMs do you integrate with?',
        a: "Native two-way sync: Clio, Filevine, HubSpot, Salesforce. MyCase coming soon. Every completed call posts as a Note/Activity on the matching contact record — your team sees AI activity inside their normal workflow. Custom integrations available on the Scale plan.",
      },
      {
        q: 'Can it handle Spanish-speaking callers?',
        a: 'Yes. The AI detects language automatically and switches between English and Spanish on the same call without losing context. The sample call above is available in English and Spanish.',
      },
      {
        q: 'Does it work for criminal defense intake (urgent court dates, jail calls)?',
        a: 'Yes. The legal-vertical escalation vocabulary includes "arrested", "court date", "served papers", "subpoena", "restraining order", and similar phrases — any of these immediately routes the call to your transfer number with a "this is time-sensitive" alert.',
      },
      {
        q: 'What happens during a conflict check?',
        a: "When a caller mentions an opposing party name, the AI responds with \"Let me have one of our attorneys call you back to confirm we can help with this matter\" and escalates to your conflict-check process. No representation is offered, no engagement letter implied, no advice given.",
      },
      {
        q: 'How is this different from Smith.ai or Ruby Receptionists?',
        a: 'Smith.ai and Ruby are humans-in-the-loop services priced around $290–$600/month for 30–200 calls. We are 100% AI, dramatically higher call cap at the same price point, and — critically — we make outbound calls too. Smith.ai and Ruby are inbound-only; we run your consult reminders, stale-lead reactivation, court-date confirmations, and referral asks from the same platform that answers your inbound line.',
      },
      {
        q: 'Is this UPL (unauthorized practice of law)?',
        a: 'No. The AI is explicitly instructed in every system prompt to never give legal advice, never form an attorney-client relationship, and never predict case outcomes. It is intake software — legally analogous to a trained paralegal taking initial intake notes. The retainer agreement your firm executes with the client downstream is what establishes representation.',
      },
      {
        q: 'What about state-bar advertising rules?',
        a: 'The AI does not advertise on its own. It answers inbound calls placed to numbers your firm controls and makes outbound calls only to numbers you have imported with an existing relationship (current clients, web-form leads, signed retainers). Your firm remains the responsible advertiser under your jurisdiction\'s Rules of Professional Conduct.',
      },
      {
        q: 'Recording laws — what about two-party consent states?',
        a: 'Configurable per tenant. In California, Florida, Illinois, Massachusetts, Maryland, Montana, New Hampshire, Pennsylvania, and Washington the AI opens every call with an explicit recording-and-AI announcement. In one-party-consent states the standard intake disclosure still notifies the caller that an automated system is taking the call.',
      },
      {
        q: 'Multi-state practice — can the AI route by jurisdiction?',
        a: 'Yes. The AI asks for the state of the matter during intake and routes the call to the right licensed attorney based on the routing rules you configure in /settings/voice-agent. Different attorneys for different states is a single dropdown.',
      },
      {
        q: 'TCPA compliance for the outbound campaigns?',
        a: 'Outbound only dials numbers your firm has imported with an established business relationship — existing clients, web-form leads, signed-retainer clients, or lists you uploaded. The platform does not cold-call from purchased lists. DNC handling and per-state quiet-hours windows are configurable per campaign.',
      },
      {
        q: 'Does the AI flag statute-of-limitations risk on intake?',
        a: 'Yes. When a caller says "I was injured 18 months ago" or "this happened two years ago" or similar date-anchored language, the AI flags the call as time-sensitive and escalates to a human rather than scheduling a routine callback. The exact vocabulary is configurable per practice area.',
      },
      {
        q: 'What languages beyond English and Spanish?',
        a: 'Italian, Arabic, Farsi, Armenian, and Russian on every paid plan — critical for immigration practices serving Russian-, Persian-, or Armenian-speaking communities. The AI detects caller language automatically and switches mid-call without losing context.',
      },
    ],
  },
  finalCta: {
    heading: 'Stop losing intake to voicemail.',
    headingGradientSuffix: 'Start the trial.',
    subhead:
      'Free trial. No card. No setup fees. Connect Clio or Filevine in 60 seconds and place a test call.',
    primaryCtaLabel: 'Start free trial',
    secondaryNote: 'Encrypted at rest · Never used for training · Cancel anytime',
  },
};

// ── DENTAL ──────────────────────────────────────────────────

const dental: VerticalLandingContent = {
  seo: {
    title: 'Telfin for Dental Practices — Recall, Booking, EHR Sync',
    description:
      "24/7 AI receptionist for dental practices. Handles new-patient bookings, recall follow-ups, insurance verification handoff, after-hours emergency triage. Connects to Dentrix, Eaglesoft, Open Dental. HIPAA-ready. English + Spanish.",
  },
  hero: {
    eyebrow: 'For Dental Practices',
    headline: "Stop losing new patients to",
    headlineGradientSuffix: 'voicemail.',
    subhead:
      "AI receptionist for dental practices — answers every call 24/7, books new-patient appointments, handles recalls in English and Spanish, escalates dental emergencies, and pushes every call into Dentrix, Eaglesoft, or Open Dental.",
    accentChipClass: 'bg-green-100 text-green-700',
  },
  crmStrip: {
    heading: 'Plugs into the dental software your practice already uses.',
    subhead:
      'Every booked appointment, every patient recall, every emergency triage lands on the right patient chart — automatically, within seconds.',
    crms: [
      { id: 'dentrix', label: 'Dentrix', icon: '🦷', badge: 'Coming soon' },
      { id: 'eaglesoft', label: 'Eaglesoft', icon: '🪺', badge: 'Coming soon' },
      { id: 'open_dental', label: 'Open Dental', icon: '🦷', badge: 'Coming soon' },
      { id: 'hubspot', label: 'HubSpot', icon: '🔗', badge: 'Native' },
      { id: 'salesforce', label: 'Salesforce', icon: '☁️', badge: 'Native' },
    ],
  },
  features: {
    eyebrow: 'Built for dental intake',
    heading: 'The AI handles the calls your front desk doesn’t have time for.',
    iconGradient: 'from-green-500 to-emerald-500',
    items: [
      {
        icon: Smile,
        title: 'New-patient bookings, 24/7',
        body: "Collects name, date of birth, insurance, and reason for visit. Offers up to 3 slot options that match your office hours and provider availability. Sends a confirmation SMS the moment the appointment is on the books.",
      },
      {
        icon: AlarmClock,
        title: 'Emergency triage that knows when to escalate',
        body: 'When a caller says "pain", "swelling", "abscess", "broken tooth", or "bleeding", the AI immediately routes the call to your on-call dentist instead of asking them to wait for the next business day.',
      },
      {
        icon: Heart,
        title: 'Recall + reactivation, on autopilot',
        body: 'Patients overdue for their six-month cleaning get a friendly outbound call in English or Spanish. The AI books them straight back onto your schedule without your team lifting a finger.',
      },
    ],
  },
  roi: {
    heading: 'Why dental practices switch.',
    stats: [
      {
        value: '40%',
        body: 'of new-patient calls happen after hours or during lunch. Without an AI receptionist, almost all of those go to the practice across the street.',
      },
      {
        value: '$1,800',
        body: 'lifetime value of a new dental patient (industry average). One captured call pays for the platform for years.',
      },
      {
        value: '15 hrs/wk',
        body: 'your front desk spends on the phone. The AI handles routine intake so your team focuses on patients in the chair.',
      },
    ],
  },
  testimonial: {
    real: false,
    quote:
      'Add your practice’s testimonial here once you have one. Edit `content.dental.testimonial` in `vertical-landing-content.ts` and flip `real: true` to remove this placeholder treatment.',
    name: 'Your patient’s name',
    firmOrPractice: 'Their practice',
  },
  faq: {
    items: [
      {
        q: 'Is the platform HIPAA-ready?',
        a: 'Yes. Scale plan includes a Business Associate Agreement (BAA). Call transcripts and patient data are encrypted at rest, access-controlled to your practice only, and never used for AI training. Idle-timeout, audit log, and compliance settings are surfaced in /settings.',
      },
      {
        q: 'Can it verify insurance during the call?',
        a: "Not directly — the AI collects the patient's insurance carrier, policy ID, and group number and routes verification to your front-desk staff or your existing insurance verification service. Direct payer-API verification is on the roadmap.",
      },
      {
        q: 'What dental software does it integrate with?',
        a: 'Native sync with HubSpot and Salesforce today. Dentrix, Eaglesoft, and Open Dental adapters coming soon — Scale-plan customers get early access. For now, appointment and patient data syncs via CSV import + the Public REST API.',
      },
      {
        q: 'Does it handle Spanish-speaking patients?',
        a: 'Yes. The AI detects language automatically and switches between English and Spanish mid-call without losing context. Sample recall and reminder calls above are available in both languages.',
      },
      {
        q: 'How does after-hours emergency triage work?',
        a: 'When a caller mentions "pain", "swelling", "abscess", or "broken tooth", the AI says "This sounds urgent — let me connect you to our on-call dentist right now" and transfers immediately to the number you configured in /settings/voice-agent. No "we’ll get back to you Monday".',
      },
      {
        q: 'Will patients know they’re talking to an AI?',
        a: 'Yes. The AI introduces itself by name and the conversation includes a brief disclosure. Patients overwhelmingly prefer this to voicemail — the AI is warm, clear, and books the appointment, which is what they actually wanted.',
      },
    ],
  },
  finalCta: {
    heading: 'Every missed call is a patient lost.',
    headingGradientSuffix: 'Start the trial.',
    subhead:
      'Free trial. No card. No setup fees. Place a test call and book a mock new-patient appointment in under 90 seconds.',
    primaryCtaLabel: 'Start free trial',
    secondaryNote: 'HIPAA-ready · Encrypted at rest · BAA available on Scale plan',
  },
};

// ── INSURANCE ───────────────────────────────────────────────

const insurance: VerticalLandingContent = {
  seo: {
    title: 'Telfin for Insurance Agencies — Claim Intake, Quotes, Renewals',
    description:
      "24/7 AI receptionist for insurance agencies. Captures claim details, routes quote requests, follows up on policy renewals, escalates urgent claims. Connects to Applied Epic, HubSpot, Salesforce, Zoho. English + Spanish.",
  },
  hero: {
    eyebrow: 'For Insurance Agencies',
    headline: "Claims and quote requests",
    headlineGradientSuffix: 'don’t wait for office hours.',
    subhead:
      "AI receptionist for insurance agencies — answers every call 24/7, captures first-notice-of-loss details, triages quote requests to the right producer, and posts every conversation to your agency management system.",
    accentChipClass: 'bg-blue-100 text-blue-700',
  },
  crmStrip: {
    heading: 'Works with your agency management system.',
    subhead:
      'Every claim intake, every quote request, every renewal conversation lands on the right client record — automatically, within seconds.',
    crms: [
      { id: 'applied_epic', label: 'Applied Epic', icon: '📋', badge: 'Coming soon' },
      { id: 'hubspot', label: 'HubSpot', icon: '🔗', badge: 'Native' },
      { id: 'salesforce', label: 'Salesforce', icon: '☁️', badge: 'Native' },
      { id: 'zoho', label: 'Zoho CRM', icon: '🟧', badge: 'Native' },
    ],
  },
  features: {
    eyebrow: 'Built for agency intake',
    heading: 'The AI knows what to triage and what to defer to a licensed producer.',
    iconGradient: 'from-blue-500 to-cyan-500',
    items: [
      {
        icon: ClipboardCheck,
        title: 'First-notice-of-loss intake',
        body: 'Collects accident details — date, time, location, parties involved, damage description, injuries — and immediately routes to your claims adjuster. Photo and video upload request sent via SMS during the call.',
      },
      {
        icon: FileText,
        title: 'Quote-request triage',
        body: 'AI captures the prospect’s coverage need (auto, home, commercial, life), gathers basic risk info, and routes to the right licensed producer. Never quotes prices itself — defers to a human for binding work.',
      },
      {
        icon: AlarmClock,
        title: 'Renewal + lapse prevention',
        body: 'Outbound calls to clients with upcoming renewals in English or Spanish. Confirms continued coverage or routes payment-issue conversations to a human producer.',
      },
    ],
  },
  roi: {
    heading: 'Why agencies switch.',
    stats: [
      {
        value: '24/7',
        body: 'Accidents and emergencies don’t respect business hours. Your agency’s front desk shouldn’t be the reason a client files a claim with their carrier’s 800-number instead.',
      },
      {
        value: '$420',
        body: 'average annual commission on a single auto policy. One captured quote request that converts pays for the platform many times over.',
      },
      {
        value: '0',
        body: 'binding decisions made by the AI. It collects, triages, and escalates — your licensed producers stay in the loop on every quote and bind.',
      },
    ],
  },
  testimonial: {
    real: false,
    quote:
      'Add your agency’s testimonial here once you have one. Edit `content.insurance.testimonial` in `vertical-landing-content.ts` and flip `real: true` to remove this placeholder treatment.',
    name: 'Your client’s name',
    firmOrPractice: 'Their agency',
  },
  faq: {
    items: [
      {
        q: 'Can the AI quote prices or bind coverage?',
        a: 'No, and that’s by design. Insurance is regulated and quoting requires a licensed producer. The AI gathers risk info, routes to the right person at your agency, and is explicitly instructed never to give a price or imply binding.',
      },
      {
        q: 'How does it handle first-notice-of-loss calls?',
        a: 'Collects all the standard FNOL fields (date, location, parties, damage, injuries), confirms back to the caller, immediately routes to your claims adjuster, and posts the full transcript on the client’s record in your agency management system. Photo upload request sent via SMS mid-call.',
      },
      {
        q: 'What agency management systems do you integrate with?',
        a: 'Native sync with HubSpot, Salesforce, and Zoho today. Applied Epic adapter coming soon. For other AMS systems, the Public REST API and CSV import handle most workflows; custom integrations available on Scale plan.',
      },
      {
        q: 'Can it handle Spanish-speaking clients?',
        a: 'Yes. The AI switches between English and Spanish automatically based on caller language, mid-call if needed, without losing context.',
      },
      {
        q: 'What about urgent claims (DUI arrests, total losses, fires)?',
        a: 'The insurance-vertical escalation vocabulary includes "accident", "totaled", "fire damage", "flood", "fraud", and similar high-urgency phrases. The AI immediately routes those to your on-call adjuster instead of taking standard intake.',
      },
      {
        q: 'Does it handle commercial as well as personal lines?',
        a: 'Yes. The AI gathers basic risk info for both — including commercial classifications, fleet size, payroll, prior losses — and routes commercial calls to your commercial producer per your office hours and routing rules.',
      },
    ],
  },
  finalCta: {
    heading: 'Every missed call is a policy lost.',
    headingGradientSuffix: 'Start the trial.',
    subhead:
      'Free trial. No card. No setup fees. Place a test FNOL call and watch the transcript land in HubSpot in under a minute.',
    primaryCtaLabel: 'Start free trial',
    secondaryNote: 'Encrypted at rest · SOC 2 controls · Cancel anytime',
  },
};

// ── REAL ESTATE ─────────────────────────────────────────────

const realEstate: VerticalLandingContent = {
  seo: {
    title: 'Telfin for Real Estate — Lead Capture, Showings, Listing FAQ',
    description:
      "24/7 AI receptionist for real estate brokerages. Captures inbound leads, books showings, answers listing questions, follows up on stale leads. Connects to Follow Up Boss, HubSpot, Salesforce. The 5-minute response rule, automated.",
  },
  hero: {
    eyebrow: 'For Real Estate',
    headline: "Leads go to whoever answers first.",
    headlineGradientSuffix: 'Make that you.',
    subhead:
      "AI receptionist for real estate brokerages — answers every call 24/7, captures lead details, books showings, answers listing questions, and posts every conversation to Follow Up Boss, HubSpot, or Salesforce. The 5-minute response rule, automated.",
    accentChipClass: 'bg-amber-100 text-amber-700',
  },
  crmStrip: {
    heading: 'Connects to your real estate CRM.',
    subhead:
      'Every lead, every showing booking, every listing inquiry lands on the right contact record in your CRM — instantly, while the lead is still hot.',
    crms: [
      { id: 'follow_up_boss', label: 'Follow Up Boss', icon: '🏠', badge: 'Coming soon' },
      { id: 'hubspot', label: 'HubSpot', icon: '🔗', badge: 'Native' },
      { id: 'salesforce', label: 'Salesforce', icon: '☁️', badge: 'Native' },
      { id: 'zoho', label: 'Zoho CRM', icon: '🟧', badge: 'Native' },
    ],
  },
  features: {
    eyebrow: 'Built for real estate intake',
    heading: 'Capture every lead. Book every showing. Never miss a beat.',
    iconGradient: 'from-amber-500 to-orange-500',
    items: [
      {
        icon: Home,
        title: 'Listing FAQ on autopilot',
        body: "Callers ask about a specific listing's price, square footage, school district, or HOA fees. The AI answers from your uploaded listing docs (via Knowledge Base) instead of routing every question to your phone.",
      },
      {
        icon: Calendar,
        title: 'Showing scheduling in seconds',
        body: 'AI checks your agent’s calendar, offers up to 3 showing time slots, books the one the caller picks, and sends a confirmation SMS with the address and lockbox/access details.',
      },
      {
        icon: Key,
        title: 'Lead capture for every cold call',
        body: 'Captures name, callback number, buyer/seller intent, price range, and timeline. Posts the new contact to Follow Up Boss with full transcript so your agent walks into the follow-up with context.',
      },
    ],
  },
  roi: {
    heading: 'Why brokerages switch.',
    stats: [
      {
        value: '78%',
        body: 'of real estate leads go with the first agent who responds. Without an AI receptionist, after-hours leads almost always go to your competitor.',
      },
      {
        value: '5 min',
        body: 'industry-standard "lead response window" beyond which conversion rates fall off a cliff. The AI’s response time is < 5 seconds.',
      },
      {
        value: '$8,400',
        body: 'average commission on a single buyer-side closing. One captured lead that closes pays for the platform for a decade.',
      },
    ],
  },
  testimonial: {
    real: false,
    quote:
      'Add your brokerage’s testimonial here once you have one. Edit `content.real_estate.testimonial` in `vertical-landing-content.ts` and flip `real: true` to remove this placeholder treatment.',
    name: 'Your client’s name',
    firmOrPractice: 'Their brokerage',
  },
  faq: {
    items: [
      {
        q: 'Will the AI give listing details I haven’t uploaded?',
        a: 'No. The AI answers from your Knowledge Base (uploaded listing docs, MLS exports, school district fact sheets) and your business context. If a caller asks something not in your docs, the AI says "let me have your agent call you right back with that" instead of guessing.',
      },
      {
        q: 'Does it integrate with MLS feeds?',
        a: 'Not directly today. Most brokerages upload listing flyers or export listings as PDFs to the Knowledge Base — the AI grounds calls in those. Direct MLS-API integration is on the roadmap.',
      },
      {
        q: 'How does showing scheduling work?',
        a: 'AI connects to your Google or Microsoft calendar (set up in /settings/integrations), reads your available slots, offers up to 3 showing times, and books on confirmation. Multi-agent brokerages can route by listing agent, geography, or round-robin.',
      },
      {
        q: 'Can it handle Spanish-speaking leads?',
        a: 'Yes. The AI detects language automatically and switches between English and Spanish without losing context.',
      },
      {
        q: 'What CRMs do you connect to?',
        a: 'Native sync with HubSpot, Salesforce, and Zoho today. Follow Up Boss adapter coming soon. Lead Discovery (find new leads via Google Maps) is bundled in Growth and Scale plans.',
      },
      {
        q: 'What about urgent calls (closing-day issues, inspection problems)?',
        a: 'The real estate escalation vocabulary includes "closing", "inspection failed", "offer expiring", "lockout", "lender deadline" — any of these immediately routes to your transfer number with a "this is time-sensitive" alert.',
      },
    ],
  },
  finalCta: {
    heading: 'The lead goes to whoever answers.',
    headingGradientSuffix: 'Always be answering.',
    subhead:
      'Free trial. No card. No setup fees. Place a test buyer-lead call and watch it land in Follow Up Boss in under a minute.',
    primaryCtaLabel: 'Start free trial',
    secondaryNote: 'Encrypted at rest · Calendar sync included · Cancel anytime',
  },
};

// ── HOME SERVICES ───────────────────────────────────────────

const homeServices: VerticalLandingContent = {
  seo: {
    title: 'Telfin for Home Services — Dispatch, Emergencies, Quotes',
    description:
      "24/7 AI receptionist for HVAC, plumbing, electrical, roofing, and other home services. Triages emergency calls (gas leak, no heat, burst pipe), books jobs, captures quote requests. Connects to ServiceTitan, Jobber, HubSpot.",
  },
  hero: {
    eyebrow: 'For Home Services',
    headline: "It’s 2am. The customer has no heat.",
    headlineGradientSuffix: 'Your phone is ringing.',
    subhead:
      "AI receptionist for HVAC, plumbing, electrical, roofing, and field service businesses — answers every call 24/7, triages emergencies, books jobs, and posts every conversation to ServiceTitan, Jobber, HubSpot, or Salesforce.",
    accentChipClass: 'bg-orange-100 text-orange-700',
  },
  crmStrip: {
    heading: 'Connects to the dispatch software your crew already runs.',
    subhead:
      'Every emergency call, every quote request, every job booking lands on the right customer record — automatically, within seconds.',
    crms: [
      { id: 'servicetitan', label: 'ServiceTitan', icon: '🔧', badge: 'Coming soon' },
      { id: 'jobber', label: 'Jobber', icon: '🛠️', badge: 'Coming soon' },
      { id: 'hubspot', label: 'HubSpot', icon: '🔗', badge: 'Native' },
      { id: 'salesforce', label: 'Salesforce', icon: '☁️', badge: 'Native' },
      { id: 'zoho', label: 'Zoho CRM', icon: '🟧', badge: 'Native' },
    ],
  },
  features: {
    eyebrow: 'Built for field service intake',
    heading: 'The AI knows what’s an emergency and what can wait until Monday.',
    iconGradient: 'from-orange-500 to-red-500',
    items: [
      {
        icon: AlertTriangle,
        title: 'Emergency triage that actually triages',
        body: 'When a caller says "gas leak", "flooding", "no heat", "no power", or "sparking", the AI immediately routes to your on-call tech instead of asking them to wait until business hours. Configurable per-trade emergency vocabulary.',
      },
      {
        icon: Calendar,
        title: 'Same-day and next-day job booking',
        body: 'AI checks your dispatch calendar, offers available windows, and books the job. Confirmation SMS sent with arrival window and the tech’s name. Multi-tech businesses route by trade, region, or skill set.',
      },
      {
        icon: Wrench,
        title: 'Quote-request capture without firm pricing',
        body: 'Collects job scope, address, photos via SMS upload, and timeline. Routes to the right estimator without ever quoting a firm price for unseen work — protects you from price-quote disputes.',
      },
    ],
  },
  roi: {
    heading: 'Why field service businesses switch.',
    stats: [
      {
        value: '$650',
        body: 'average emergency-service ticket (HVAC + plumbing industry blended). One after-hours call captured pays for the platform for months.',
      },
      {
        value: '24/7',
        body: 'Burst pipes and broken furnaces happen at 2am. Your competitor’s voicemail is your business opportunity.',
      },
      {
        value: '15 hrs/wk',
        body: 'your dispatcher spends on the phone. The AI handles routine bookings so your team focuses on the trucks.',
      },
    ],
  },
  testimonial: {
    real: false,
    quote:
      'Add your business’s testimonial here once you have one. Edit `content.home_services.testimonial` in `vertical-landing-content.ts` and flip `real: true` to remove this placeholder treatment.',
    name: 'Your customer’s name',
    firmOrPractice: 'Their business',
  },
  faq: {
    items: [
      {
        q: 'How does emergency triage work?',
        a: 'The home services escalation vocabulary includes "gas leak", "flooding", "burst pipe", "no heat", "no power", "sparking", "fire", "sewage" — any of these immediately routes the call to your on-call tech with a "this is an emergency" alert. You configure who that goes to per trade and shift.',
      },
      {
        q: 'Will the AI quote firm prices?',
        a: 'No, and that’s a deliberate design choice. The AI captures job scope, photos (via SMS upload), and timeline — but never gives a firm dollar quote for unseen work. Quotes are routed to your estimator. Protects you from "but the AI said $400" disputes.',
      },
      {
        q: 'What dispatch software do you integrate with?',
        a: 'Native sync with HubSpot, Salesforce, and Zoho today. ServiceTitan and Jobber adapters coming soon — Scale-plan customers get early access. For other dispatch software, the Public REST API and CSV import handle the most common workflows.',
      },
      {
        q: 'Can it handle Spanish-speaking customers?',
        a: 'Yes. The AI detects language automatically and switches between English and Spanish mid-call without losing context.',
      },
      {
        q: 'How does multi-tech routing work?',
        a: 'Multi-tech businesses can route bookings by trade (HVAC vs plumbing vs electrical), region/zip code, or round-robin. Set the routing rules in /settings/voice-agent. Emergency calls always route to the configured on-call number regardless.',
      },
      {
        q: 'What about commercial-vs-residential differentiation?',
        a: 'AI asks at the start of intake whether the property is residential or commercial and routes accordingly. Commercial calls can be routed to your commercial estimator with different SLA expectations than residential dispatch.',
      },
    ],
  },
  finalCta: {
    heading: 'Burst pipes at 2am.',
    headingGradientSuffix: 'Answer every one.',
    subhead:
      'Free trial. No card. No setup fees. Place a test emergency call and watch the dispatch land in HubSpot in seconds.',
    primaryCtaLabel: 'Start free trial',
    secondaryNote: 'Encrypted at rest · Multi-tech routing · Cancel anytime',
  },
};

// ── REGISTRY ────────────────────────────────────────────────

// `generic` doesn't have a dedicated vertical landing page; the homepage covers that role.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _genericStub = null as any as VerticalLandingContent;

export const content: Record<Vertical, VerticalLandingContent> = {
  legal,
  dental,
  insurance,
  real_estate: realEstate,
  home_services: homeServices,
  generic: _genericStub,
};
