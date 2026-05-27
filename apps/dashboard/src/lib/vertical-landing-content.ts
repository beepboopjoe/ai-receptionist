// ============================================================
// Vertical landing page content registry (Phase 15+).
//
// One block per vertical. The /legal, /dental, /insurance,
// /real-estate, /home-services pages each consume one block.
//
// Adding a new vertical: replace the TODO stub with a real
// VerticalLandingContent object using `legal` as the template.
// See apps/dashboard/src/components/marketing/vertical-landing/
// README.md for the full workflow.
// ============================================================
import {
  Shield,
  Scale,
  Gavel,
  type LucideIcon,
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
  /** Sample call ID — must match an entry in sample-calls.ts. */
  sampleCallId: string;
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

// Helper to keep icon imports next to where they're used.
const legalFeatureIcons: { conflict: LucideIcon; privilege: LucideIcon; courtDate: LucideIcon } = {
  conflict: Scale,
  privilege: Shield,
  courtDate: Gavel,
};

// ── LEGAL ───────────────────────────────────────────────────

const legal: VerticalLandingContent = {
  seo: {
    title: 'AI Receptionist for Law Firms — Intake, Scheduling, Clio/Filevine Sync',
    description:
      "24/7 AI receptionist built for law firms. Runs initial intake, books consults, escalates conflict-of-interest cases, and posts every call to Clio, Filevine, MyCase, HubSpot, or Salesforce. English + Spanish. No setup fees.",
  },
  hero: {
    eyebrow: 'For Law Firms',
    headline: "Your firm's first phone call",
    headlineGradientSuffix: 'shouldn’t go to voicemail.',
    subhead:
      "AI receptionist for law firms — answers every call 24/7, runs initial intake, books consults, and posts every conversation to Clio, Filevine, MyCase, or Salesforce. Built for the way attorneys actually work.",
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
        icon: legalFeatureIcons.conflict,
        title: 'Conflict-check-aware escalation',
        body: "When a caller mentions an opposing party or a matter your firm has previously represented, the AI stops intake and routes the call to your conflict-check process. No commitments given on the call.",
      },
      {
        icon: legalFeatureIcons.privilege,
        title: 'Privileged-by-default',
        body: 'Call transcripts and AI summaries are encrypted at rest, never used for training, and excluded from cross-tenant analytics. Caller is notified at start of call that an automated system is taking intake.',
      },
      {
        icon: legalFeatureIcons.courtDate,
        title: 'Court-date sensitivity',
        body: 'When a caller says "I was served papers", "I have a court date", or mentions a restraining order, the AI flags it as time-sensitive and routes to your on-call attorney’s cell immediately.',
      },
    ],
  },
  sampleCallId: 'legal_en_intake',
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

// ── STUBS FOR FUTURE VERTICALS (Phase 15.1+) ────────────────
// Replace each stub with a full VerticalLandingContent block.
// See README in components/marketing/vertical-landing/.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _todoStub = null as any as VerticalLandingContent;

export const content: Record<Vertical, VerticalLandingContent> = {
  legal,
  // TODO Phase 15.1
  dental: _todoStub,
  insurance: _todoStub,
  real_estate: _todoStub,
  home_services: _todoStub,
  // generic doesn't get a vertical landing page; the homepage covers that role.
  generic: _todoStub,
};
