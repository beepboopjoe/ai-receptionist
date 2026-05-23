// ============================================================
// Curation Wizard — per-vertical question definitions.
//
// The wizard at /settings/voice-agent/curate walks the user through
// these 8 questions and synthesizes the answers into a sectioned
// blob that gets saved to tenant_settings.business_context. That
// field is injected into the AI's system prompt on every call
// (see apps/api/src/modules/voice-agent/prompt-builder.ts).
//
// Conventions:
//   - All 8 questions exist for every vertical (same `id`s).
//   - `sectionTitle` is the markdown heading in the synthesized
//     text and is also used to round-trip parse the saved context
//     back into pre-filled answers on re-run. Don't change titles
//     casually — that breaks the round-trip.
//   - `label` is what the user sees on the wizard screen. It can
//     vary per vertical even when sectionTitle is shared.
// ============================================================
import type { Vertical } from '@ai-receptionist/shared';

export interface CurationQuestion {
  id: string;
  sectionTitle: string;
  label: string;
  hint?: string;
  placeholder: string;
  rows?: number;
}

// ── Question builders that adapt to vertical ──────────────────
function q(opts: CurationQuestion): CurationQuestion {
  return { rows: 5, ...opts };
}

// Identifiers reused across verticals so the parser knows where
// each answer belongs. Changing these is a breaking change.
const IDS = {
  whatWeDo: 'what_we_do',
  serviceArea: 'service_area',
  commonReasons: 'common_reasons',
  insurancePricing: 'insurance_pricing',
  schedulingPolicies: 'scheduling_policies',
  escalation: 'escalation',
  neverDo: 'never_do',
  voiceTone: 'voice_tone',
} as const;

// ── Shared sections (same wording across every vertical) ──────
const sharedServiceArea: CurationQuestion = q({
  id: IDS.serviceArea,
  sectionTitle: 'Service area & locations',
  label: 'Where are you based, and what areas do you serve?',
  hint: 'Office address, regions served, any second locations.',
  placeholder: 'e.g. One office at 123 Main St, Pasadena CA. We serve Pasadena and the surrounding 10 miles.',
});

const sharedEscalation: CurationQuestion = q({
  id: IDS.escalation,
  sectionTitle: 'When to escalate to a human',
  label: 'When should the AI immediately escalate to a real person?',
  hint: 'List the situations where the AI must hand off — emergencies, sensitive questions, anything outside its lane.',
  placeholder: 'e.g. Anyone mentioning severe pain, bleeding, legal threats, or asking for the owner by name. Also any caller who explicitly asks for a human.',
});

const sharedVoiceTone: CurationQuestion = q({
  id: IDS.voiceTone,
  sectionTitle: 'Brand voice & tone',
  label: 'How should the AI sound on the phone?',
  hint: 'Warm and familiar? Direct and efficient? Reassuring? Anything to avoid?',
  placeholder: 'e.g. Warm and friendly, like a long-time front-desk person. First names. Never aggressive or sales-y. Brief but never rushed.',
  rows: 4,
});

// ── Per-vertical sets ─────────────────────────────────────────
export const CURATION_QUESTIONS: Record<Vertical, CurationQuestion[]> = {
  dental: [
    q({
      id: IDS.whatWeDo,
      sectionTitle: 'What we do',
      label: 'In one or two sentences, what kind of dental practice are you?',
      placeholder: "e.g. We're a family dental practice focused on pediatric and general care. Dr. Chen has been practicing 18 years.",
    }),
    sharedServiceArea,
    q({
      id: IDS.commonReasons,
      sectionTitle: 'Common reasons people call',
      label: 'What are the top reasons patients call you?',
      placeholder: 'e.g. Schedule a cleaning (most common)\nEmergency tooth pain\nInsurance/coverage questions\nReschedule existing appointment',
    }),
    q({
      id: IDS.insurancePricing,
      sectionTitle: 'Insurance & pricing',
      label: 'Which insurance carriers do you accept? Anything specific about pricing?',
      placeholder: 'e.g. We take all major PPOs — Aetna, Cigna, Delta Dental, Blue Cross. We do NOT take HMO plans or Medicaid. New-patient exam is $89 if uninsured.',
    }),
    q({
      id: IDS.schedulingPolicies,
      sectionTitle: 'Scheduling rules & policies',
      label: 'What should the AI know about scheduling?',
      hint: 'Lead times, cancellation rules, late arrivals, new-patient logistics.',
      placeholder: 'e.g. New patients should arrive 15 minutes early to fill out paperwork. We reserve same-day emergency slots for existing patients only. 24-hour cancellation policy.',
    }),
    sharedEscalation,
    q({
      id: IDS.neverDo,
      sectionTitle: 'Things the AI should never do or say',
      label: 'What are the hard "do not" rules?',
      placeholder: 'e.g. Never give clinical advice or treatment recommendations. Never quote a price for a specific procedure. Never confirm insurance coverage — defer to billing staff.',
    }),
    sharedVoiceTone,
  ],

  legal: [
    q({
      id: IDS.whatWeDo,
      sectionTitle: 'What we do',
      label: 'In one or two sentences, what kind of law firm are you?',
      placeholder: "e.g. We're a personal injury firm focused on car accidents and workplace injuries. We work on contingency only.",
    }),
    sharedServiceArea,
    q({
      id: IDS.commonReasons,
      sectionTitle: 'Common reasons people call',
      label: 'What are the top reasons people call you?',
      placeholder: 'e.g. New case intake after an accident (most common)\nQuestions about a case in progress\nReferrals from other attorneys\nReschedule a consultation',
    }),
    q({
      id: IDS.insurancePricing,
      sectionTitle: 'Case types & fee structure',
      label: 'What case types do you take, and how do you charge?',
      placeholder: 'e.g. We take auto accidents, slip & fall, workplace injuries. No criminal, no family law. 33% contingency on settled cases, 40% if it goes to trial. Free initial consultation.',
    }),
    q({
      id: IDS.schedulingPolicies,
      sectionTitle: 'Consultation logistics',
      label: 'What should the AI know about booking consultations?',
      hint: 'Lead times, what info the caller should bring, in-person vs phone.',
      placeholder: 'e.g. First consultation is 30 minutes, free, by phone or in-person. Ask the caller to gather the police report, photos, and any medical bills before the call.',
    }),
    sharedEscalation,
    q({
      id: IDS.neverDo,
      sectionTitle: 'Things the AI should never do or say',
      label: 'What are the hard "do not" rules?',
      placeholder: 'e.g. Never give legal advice or opinions on a case. Never predict settlement amounts or success rates. Never discuss strategy. Never promise anything about case outcomes.',
    }),
    sharedVoiceTone,
  ],

  insurance: [
    q({
      id: IDS.whatWeDo,
      sectionTitle: 'What we do',
      label: 'In one or two sentences, what kind of insurance agency are you?',
      placeholder: "e.g. Independent agency representing 12 carriers. Personal lines focus — auto, home, umbrella. Family-owned 25 years.",
    }),
    sharedServiceArea,
    q({
      id: IDS.commonReasons,
      sectionTitle: 'Common reasons people call',
      label: 'What are the top reasons people call you?',
      placeholder: 'e.g. New auto/home quote request (most common)\nFile a claim or check claim status\nAdd a vehicle or driver to existing policy\nAnnual renewal questions',
    }),
    q({
      id: IDS.insurancePricing,
      sectionTitle: 'Lines & carriers',
      label: 'What lines do you write, and which carriers do you represent?',
      placeholder: 'e.g. Lines: auto, home, umbrella, life, commercial GL. Carriers: Travelers, Progressive, Safeco, Nationwide, The Hartford, Liberty Mutual. We do NOT write health or Medicare.',
    }),
    q({
      id: IDS.schedulingPolicies,
      sectionTitle: 'Quote & claim logistics',
      label: 'How should the AI handle quote requests and claims?',
      placeholder: 'e.g. For quotes: gather name, DOB, current insurer, vehicles + drivers, then schedule a 15-min call with an agent. For claims: get policy number + nature of loss, then transfer immediately.',
    }),
    sharedEscalation,
    q({
      id: IDS.neverDo,
      sectionTitle: 'Things the AI should never do or say',
      label: 'What are the hard "do not" rules?',
      placeholder: 'e.g. Never quote premiums or coverage limits. Never approve or deny claims. Never interpret policy language. Always defer specifics to a licensed agent.',
    }),
    sharedVoiceTone,
  ],

  real_estate: [
    q({
      id: IDS.whatWeDo,
      sectionTitle: 'What we do',
      label: 'In one or two sentences, what kind of real estate practice is this?',
      placeholder: "e.g. Boutique brokerage focused on luxury single-family homes in the Pasadena area. 6 agents, average list price $1.8M.",
    }),
    sharedServiceArea,
    q({
      id: IDS.commonReasons,
      sectionTitle: 'Common reasons people call',
      label: 'What are the top reasons people call you?',
      placeholder: 'e.g. Inquiry about a specific listing (most common)\nRequest a property valuation for a potential sale\nBuyer looking for a showing\nQuestion about the local market',
    }),
    q({
      id: IDS.insurancePricing,
      sectionTitle: 'Specialty & price ranges',
      label: 'What price ranges and neighborhoods do you specialize in?',
      placeholder: 'e.g. We specialize in $1M–$5M single-family in Pasadena, San Marino, La Cañada. Limited commercial/multifamily work. Don\'t take rentals under $4,500/mo.',
    }),
    q({
      id: IDS.schedulingPolicies,
      sectionTitle: 'Showings & consultations',
      label: 'How should the AI handle showing requests and seller consultations?',
      placeholder: 'e.g. Showings: at least 4-hour notice, pre-approval letter required for homes over $2M. Seller consultations: 60-min in-person at the property, free.',
    }),
    sharedEscalation,
    q({
      id: IDS.neverDo,
      sectionTitle: 'Things the AI should never do or say',
      label: 'What are the hard "do not" rules?',
      placeholder: 'e.g. Never give mortgage or legal advice. Never disclose seller motivations or other offer details. Never represent property condition beyond what\'s in the public listing.',
    }),
    sharedVoiceTone,
  ],

  home_services: [
    q({
      id: IDS.whatWeDo,
      sectionTitle: 'What we do',
      label: 'In one or two sentences, what services do you provide?',
      placeholder: "e.g. Plumbing and HVAC, residential only. Licensed in CA, 12 trucks, 24/7 emergency service.",
    }),
    sharedServiceArea,
    q({
      id: IDS.commonReasons,
      sectionTitle: 'Common reasons people call',
      label: 'What are the top reasons people call you?',
      placeholder: 'e.g. Schedule a service call (clogged drain, no hot water, etc.)\nEmergency (burst pipe, no AC in summer)\nQuote on a new install or replacement\nFollow-up question on a recent job',
    }),
    q({
      id: IDS.insurancePricing,
      sectionTitle: 'Service area, trades & rates',
      label: 'What service area, trades, and rate structure should the AI know?',
      placeholder: 'e.g. Service area: 25-mile radius from Pasadena. Trades: plumbing, HVAC, water heaters. Diagnostic fee $89 weekdays / $149 nights & weekends, waived if work is performed.',
    }),
    q({
      id: IDS.schedulingPolicies,
      sectionTitle: 'Booking rules & emergencies',
      label: 'How should the AI handle bookings and what counts as an emergency?',
      placeholder: 'e.g. Standard bookings 1–3 days out. Same-day for emergencies (gas leak, flooding, no heat in winter, no AC over 90°). 30-min arrival window for emergencies.',
    }),
    sharedEscalation,
    q({
      id: IDS.neverDo,
      sectionTitle: 'Things the AI should never do or say',
      label: 'What are the hard "do not" rules?',
      placeholder: 'e.g. Never quote firm prices for jobs not yet inspected. Never recommend DIY fixes for gas or electrical issues. Never diagnose over the phone beyond high-level triage.',
    }),
    sharedVoiceTone,
  ],

  generic: [
    q({
      id: IDS.whatWeDo,
      sectionTitle: 'What we do',
      label: 'In one or two sentences, what does your business do?',
      placeholder: "e.g. We're a boutique consulting firm helping small businesses with operations and growth strategy. 4 partners, fully remote.",
    }),
    sharedServiceArea,
    q({
      id: IDS.commonReasons,
      sectionTitle: 'Common reasons people call',
      label: 'What are the top reasons people call you?',
      placeholder: 'e.g. New client inquiry (most common)\nQuestions about pricing or services\nExisting client check-in\nBilling/invoice questions',
    }),
    q({
      id: IDS.insurancePricing,
      sectionTitle: 'Services & pricing',
      label: 'What services do you offer, and how do you price?',
      placeholder: 'e.g. We offer 3-month strategy engagements ($15k flat) and ongoing advisory retainers ($3k/mo). No hourly work. Free 30-min discovery call.',
    }),
    q({
      id: IDS.schedulingPolicies,
      sectionTitle: 'Scheduling rules & policies',
      label: 'What should the AI know about scheduling?',
      placeholder: 'e.g. All meetings via Zoom unless otherwise requested. Discovery calls are 30 min and free. 24-hour cancellation policy. Available Tue–Thu only.',
    }),
    sharedEscalation,
    q({
      id: IDS.neverDo,
      sectionTitle: 'Things the AI should never do or say',
      label: 'What are the hard "do not" rules?',
      placeholder: 'e.g. Never make commitments beyond standard booking. Never quote final pricing without an intake call. Defer detailed questions to a partner.',
    }),
    sharedVoiceTone,
  ],
};
