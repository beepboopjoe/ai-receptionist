// ============================================================
// Legal-vertical preset content (Phase 26a, 2026-05-30).
//
// Single source of truth for three pieces of legal-specific
// dashboard scaffolding that ship in Phase 26a:
//
//   1. Webhook event presets   → /settings/webhooks
//   2. Outbound campaign templates → /campaigns/new
//   3. Practice-area presets   → /settings/voice-agent
//
// Each surface checks `useVertical().id === 'legal'` and only
// renders these helpers when the tenant is on the legal vertical.
// Keeping all three groups co-located in one file makes copy
// updates one PR, and keeps the page files thin.
// ============================================================

// ── Webhook event presets ─────────────────────────────────────

/**
 * A pre-baked webhook configuration. Clicking "Use this preset"
 * opens the existing CreateEndpointForm pre-populated with
 * `events`, `urlHint` (as the URL placeholder), and `description`.
 * The user still chooses the actual receiving URL.
 */
export interface LegalWebhookPreset {
  id: string;
  title: string;
  /** Plain-English what-it-does for the card subtitle. */
  description: string;
  /** Comma-separated event filter; matches the webhook router's `events` field. */
  events: string;
  /** Suggested URL pattern shown in the form placeholder when this preset is used. */
  urlHint: string;
  /** Pre-filled description text for the webhook row. */
  descriptionPrefill: string;
  /** Practical setup hint shown under the card body. */
  setupHint: string;
}

export const LEGAL_WEBHOOK_PRESETS: readonly LegalWebhookPreset[] = [
  {
    id: 'clio-matter',
    title: 'Create a Clio Matter on intake',
    description:
      'When the AI completes an intake call, fire to a Zapier/Make/n8n webhook that creates a Clio Matter and attaches the call transcript as a Note on the contact.',
    events: 'call.completed,appointment.booked',
    urlHint: 'https://hooks.zapier.com/hooks/catch/.../',
    descriptionPrefill: 'Clio Matter sync — completed intakes',
    setupHint:
      'In Zapier, choose "Webhooks → Catch Hook" as the trigger, then "Clio → Create Matter" as the action. Map the AI summary into the Matter description.',
  },
  {
    id: 'slack-urgent',
    title: 'Slack ping on urgent escalations',
    description:
      'Forward every urgent escalation (court date served, restraining order, jail call, statute-of-limitations flag) into your firm\'s #urgent Slack channel within seconds.',
    events: 'escalation.created',
    urlHint: 'https://hooks.slack.com/services/T.../B.../...',
    descriptionPrefill: 'Slack #urgent — escalations',
    setupHint:
      'In Slack, install "Incoming Webhooks", pick the destination channel, and paste the generated URL here. Every escalation posts as a message with caller info and the AI summary.',
  },
  {
    id: 'conflicts-officer',
    title: 'Email the conflicts officer',
    description:
      'When the AI flags a potential conflict of interest, route a structured email payload to your firm\'s conflicts officer for clearance before any commitment is implied.',
    events: 'escalation.created',
    urlHint: 'https://hooks.zapier.com/hooks/catch/.../',
    descriptionPrefill: 'Conflicts-officer alert — flagged calls',
    setupHint:
      'Easiest path: a Zapier "Webhooks → Email by Zapier" zap that filters on `metadata.reason === "conflict_check"` and emails the conflicts officer with caller name, alleged opposing party, and the AI transcript.',
  },
  {
    id: 'no-show-reschedule',
    title: 'Auto-reschedule no-show consults',
    description:
      'When a scheduled consult is marked no-show, trigger your reschedule workflow (Calendly invite, automated text-back campaign, or follow-up task in your case management system).',
    events: 'appointment.cancelled',
    urlHint: 'https://your-firm.com/api/reschedule-consult',
    descriptionPrefill: 'No-show reschedule worker',
    setupHint:
      'Point this at any HTTPS endpoint that accepts JSON. The payload includes the original appointment time and contact info so you can fire a Calendly reminder or a manual outreach task.',
  },
  {
    id: 'senior-associate-sol',
    title: 'Notify senior associate on SOL risk',
    description:
      'When the AI detects statute-of-limitations urgency on intake ("I was injured two years ago"), notify a senior associate immediately so the matter doesn\'t slip past the deadline.',
    events: 'escalation.created',
    urlHint: 'https://hooks.zapier.com/hooks/catch/.../',
    descriptionPrefill: 'Senior associate — SOL-flagged intakes',
    setupHint:
      'Filter on `metadata.reason === "sol_flagged"` in your Zap. Route to SMS + email so the SOL deadline calculation reaches the assigning partner before EOD.',
  },
  {
    id: 'letter-of-representation',
    title: 'Auto-send Letter of Representation',
    description:
      'When the AI finishes a claim-setup call to an insurance carrier and captures the claim number + adjuster contact info, fire to a webhook that emails/faxes a templated Letter of Representation to the adjuster.',
    events: 'call.completed',
    urlHint: 'https://hooks.zapier.com/hooks/catch/.../',
    descriptionPrefill: 'LOR auto-send — claim-setup outbound',
    setupHint:
      'Filter the Zap on `metadata.campaignType === "claim_setup"`. The payload includes claim number, adjuster name, adjuster email/fax — feed those into a DocuSign or Mailgun template that sends your firm\'s standard LOR with the matter file attached.',
  },
];

// ── Outbound campaign templates ───────────────────────────────

/**
 * A pre-baked campaign starter. Clicking "Use this template" on
 * /campaigns/new pre-fills the form fields the page exposes today:
 * name, voicemailMessage, dial window, retry settings.
 *
 * The actual call script + contact-list filter live downstream of
 * campaign creation (in /campaigns/[id]), so they're left out of
 * these templates for now — Phase 26c lifts those into the template.
 */
export interface LegalCampaignTemplate {
  id: string;
  title: string;
  /** Plain-English what-it-does shown on the card. */
  description: string;
  /** Pre-fills `name` field on the form. */
  campaignName: string;
  /** Pre-fills `voicemailMessage` on the form. Leave empty to skip voicemail. */
  voicemailMessage: string;
  /** Pre-fills dial window (24h HH:MM strings). */
  dialWindowStart: string;
  dialWindowEnd: string;
  maxRetries: number;
  retryDelayMinutes: number;
  maxConcurrentCalls: number;
  /** One-line subtitle hint about who the campaign targets. */
  targetHint: string;
}

export const LEGAL_CAMPAIGN_TEMPLATES: readonly LegalCampaignTemplate[] = [
  {
    id: 'consult-reminder',
    title: 'Consult reminder (24h + 2h)',
    description:
      'AI dials scheduled consultations 24 hours and 2 hours before the appointment. Confirms attendance and reschedules cancellations on the same call.',
    campaignName: 'Consult Reminder — 24h + 2h',
    voicemailMessage:
      "Hi, this is your AI assistant from the firm. I'm calling to remind you about your upcoming consultation. Please call us back at this number if you need to reschedule. Looking forward to meeting with you.",
    dialWindowStart: '09:00',
    dialWindowEnd: '19:00',
    maxRetries: 2,
    retryDelayMinutes: 60,
    maxConcurrentCalls: 5,
    targetHint: 'Targets: contacts with a scheduled consult in the next 24 hours.',
  },
  {
    id: 'engagement-letter-followup',
    title: 'Engagement-letter follow-up',
    description:
      "Reaches out to clients whose retainer is signed but who haven't returned scheduling forms, medical authorizations, or document requests.",
    campaignName: 'Engagement Letter — Document Follow-Up',
    voicemailMessage:
      "Hi, this is your AI assistant from the firm. We're following up on the paperwork we sent you after your retainer was signed. Please call us back when you have a moment to coordinate next steps. Thank you.",
    dialWindowStart: '09:00',
    dialWindowEnd: '17:00',
    maxRetries: 3,
    retryDelayMinutes: 120,
    maxConcurrentCalls: 3,
    targetHint: 'Targets: clients with signed retainer + missing scheduling/document fields.',
  },
  {
    id: 'court-date-reminder',
    title: 'Court-date reminder',
    description:
      'Pulls upcoming hearing dates from Clio or Filevine and confirms the client knows time, courtroom, and what to bring.',
    campaignName: 'Court Date Reminder — 7 days + 1 day',
    voicemailMessage:
      "Hi, this is your AI assistant from the firm calling about your upcoming court date. Please call us back to confirm you have the time, location, and any documents you'll need. Thank you.",
    dialWindowStart: '09:00',
    dialWindowEnd: '19:00',
    maxRetries: 3,
    retryDelayMinutes: 60,
    maxConcurrentCalls: 5,
    targetHint: 'Targets: clients with an upcoming court appearance in the next 7 days.',
  },
  {
    id: 'stale-lead-reactivation',
    title: 'Stale-lead reactivation',
    description:
      'Calls every prospect who inquired but never booked, on a configurable cadence. Dormant pipeline you already paid to acquire becomes signed retainers.',
    campaignName: 'Stale Lead Reactivation',
    voicemailMessage:
      "Hi, this is your AI assistant from the firm. I'm calling to follow up on your earlier inquiry. We'd love to help with your matter if you're still looking for representation. Please call us back at this number. Thank you.",
    dialWindowStart: '09:00',
    dialWindowEnd: '17:00',
    maxRetries: 2,
    retryDelayMinutes: 1440, // once per day
    maxConcurrentCalls: 3,
    targetHint: 'Targets: contacts who inquired 30+ days ago and never booked a consult.',
  },
  {
    id: 'settlement-check-pickup',
    title: 'Settlement-check pickup',
    description:
      'When PI or workers-comp funds clear, the AI calls the client to coordinate signing, disbursement, and final-fee paperwork.',
    campaignName: 'Settlement Check Pickup',
    voicemailMessage:
      "Hi, this is your AI assistant from the firm with good news about your case. Please call us back to coordinate signing your final paperwork and receiving your settlement. Thank you.",
    dialWindowStart: '09:00',
    dialWindowEnd: '17:00',
    maxRetries: 4,
    retryDelayMinutes: 240,
    maxConcurrentCalls: 2,
    targetHint: 'Targets: clients with status="funds_available" on their matter.',
  },
  {
    id: 'past-client-referral',
    title: 'Past-client referral ask',
    description:
      'Polite quarterly outreach to closed-matter clients asking for referrals — the single highest-ROI outbound program for any law firm.',
    campaignName: 'Past-Client Referral Ask — Q1',
    voicemailMessage:
      "Hi, this is your AI assistant from the firm. We're calling to thank you again for trusting us with your matter and ask if you know anyone who could use our help. Please call us back at this number if you'd like to chat. Thank you.",
    dialWindowStart: '10:00',
    dialWindowEnd: '17:00',
    maxRetries: 1,
    retryDelayMinutes: 1440,
    maxConcurrentCalls: 3,
    targetHint: 'Targets: clients with closed matters from the last 24 months.',
  },
  {
    id: 'insurance-claim-setup',
    title: 'Insurance carrier claim setup (PI)',
    description:
      "AI calls the at-fault driver's insurance carrier from the police report, navigates the IVR to claims, opens or locates the file, captures the claim number + adjuster contact info (phone, email, fax), and fires the 'Letter of Representation auto-send' webhook so your LOR goes out same-day.",
    campaignName: 'Carrier Claim Setup — LOR Send',
    voicemailMessage: '', // Carriers don't accept voicemails on this workflow; AI loops to next attempt.
    dialWindowStart: '08:00',
    dialWindowEnd: '17:00',
    maxRetries: 4,
    retryDelayMinutes: 90,
    maxConcurrentCalls: 2,
    targetHint:
      'Targets: new PI matters with a police report attached and no claim number on file yet. Pair with the "Letter of Representation auto-send" webhook so the LOR sends the moment the AI captures the adjuster contact.',
  },
];

// ── Practice-area presets ─────────────────────────────────────

/**
 * A practice-area preset that, when selected, swaps the
 * Business Context block on /settings/voice-agent. The user's
 * other prose around the anchor comment is preserved.
 */
export interface LegalPracticeArea {
  id: string;
  label: string;
  /** Short description shown under the label in the dropdown. */
  shortDescription: string;
  /** The body inserted between the anchor comments. */
  contextBlock: string;
  /** Read-only display: escalation vocab the AI looks for. */
  escalationVocab: readonly string[];
  /** Read-only display: the tone the AI uses on initial greeting. */
  greetingTone: string;
}

/** Anchor tags that wrap a practice-area block in `business_context`.
 *  Pattern mirrors Phase 11's `<!-- agent-curation-v1 -->` so a user
 *  can re-select a practice area without nuking their custom prose. */
export const PRACTICE_AREA_ANCHOR_OPEN = '<!-- legal-practice-area-v1 -->';
export const PRACTICE_AREA_ANCHOR_CLOSE = '<!-- /legal-practice-area-v1 -->';

export const LEGAL_PRACTICE_AREAS: readonly LegalPracticeArea[] = [
  {
    id: 'personal_injury',
    label: 'Personal Injury',
    shortDescription: 'PI intake + carrier claim setup + LOR send workflow.',
    contextBlock: `Practice area: Personal Injury.

INTAKE (inbound calls from prospects):
Capture: incident date, location, injury description, current medical treatment status, at-fault driver name + insurance carrier (if known from police report), prior representation. If the caller mentions the incident happened more than 18 months ago, flag as time-sensitive — statute of limitations may be running out. We do contingency-fee representation; do not quote a fee — defer to an attorney.

CARRIER CLAIM SETUP (outbound calls placed by us to insurance carriers after we've taken the case):
When dialing an at-fault driver's insurance carrier from the police report, navigate the IVR to claims, identify the claim file (open a new one if needed using the loss details from the police report), and capture for the matter file:
  • Claim number
  • Adjuster full name
  • Adjuster direct phone
  • Adjuster email
  • Adjuster fax (still required by many carriers)
  • Carrier claims-mailing address
  • Confirmed loss date + loss location as the carrier has it
Use polite, professional, businesslike tone — the rep is busy and you are calling on behalf of counsel. Identify yourself as "calling on behalf of the law firm representing [client name]" — do NOT imply you are an attorney. After capturing the adjuster contact, hang up cleanly; the firm's Letter of Representation auto-sends to the captured adjuster email/fax via the 'letter-of-representation' webhook.`,
    escalationVocab: ['arrested', 'served papers', 'court date', 'statute of limitations', 'years ago', 'insurance company calling', 'hospital', 'adjuster refusing', 'recorded statement requested'],
    greetingTone: 'Empathetic and unhurried for inbound intake. Professional and businesslike for outbound carrier calls.',
  },
  {
    id: 'family_law',
    label: 'Family Law',
    shortDescription: 'Sensitive divorce/custody intake + hearing reminders.',
    contextBlock: `Practice area: Family Law (divorce, custody, support).
Intake should be especially sensitive — callers are often in distress. Capture: matter type (divorce / custody / support / modification), jurisdiction (state + county), opposing party name (for conflict check), urgent safety concerns. If caller mentions domestic violence, restraining orders, or immediate safety risk, route to on-call attorney immediately.`,
    escalationVocab: ['domestic violence', 'restraining order', 'children unsafe', 'kidnapped', 'fled', 'hearing tomorrow', 'served papers'],
    greetingTone: 'Calm, warm, and patient. Pause if the caller is emotional.',
  },
  {
    id: 'criminal_defense',
    label: 'Criminal Defense',
    shortDescription: 'Urgent jail/court intake; immediate escalation on arrest mentions.',
    contextBlock: `Practice area: Criminal Defense.
Many calls are urgent. Capture: charges (if known), arrest date/time, jurisdiction, custody status (in custody / released on bail / pending court date). If the caller mentions someone currently in custody, an active arrest, or a court date in the next 48 hours, escalate to on-call attorney immediately — do not take routine intake. Jail-call audio quality may be poor; ask the caller to repeat key facts.`,
    escalationVocab: ['arrested', 'in jail', 'in custody', 'court tomorrow', 'court today', 'warrant', 'bail hearing', 'arraignment'],
    greetingTone: 'Direct, calm, no judgment. Speed matters more than warmth on these calls.',
  },
  {
    id: 'immigration',
    label: 'Immigration',
    shortDescription: 'Multilingual intake + USCIS appointment reminders.',
    contextBlock: `Practice area: Immigration.
Many callers prefer Spanish, Arabic, Farsi, Russian, or Armenian — switch language automatically when detected. Capture: matter type (asylum / family petition / employment-based / removal defense / naturalization), country of origin, current immigration status (visa type, expiration date, undocumented), any pending USCIS appointments or court dates. If the caller is in removal proceedings with a hearing in the next 30 days, escalate immediately.`,
    escalationVocab: ['ice', 'detained', 'deportation', 'removal hearing', 'master calendar', 'individual hearing', 'asylum hearing', 'arrested by ice'],
    greetingTone: 'Calm and reassuring. Many callers are anxious about immigration status.',
  },
  {
    id: 'estate_planning',
    label: 'Estate Planning',
    shortDescription: 'Appointment-based; low-urgency cadence.',
    contextBlock: `Practice area: Estate Planning (wills, trusts, probate).
Most calls are appointment-based and not urgent. Capture: matter type (will / trust / probate / power of attorney / advance directive), approximate estate value range (under $1M, $1-5M, over $5M), jurisdiction. For probate intakes, capture date of death and whether the will is being contested. Annual-review outreach to existing clients is a high-value outbound campaign.`,
    escalationVocab: ['contested will', 'litigation', 'dispute', 'emergency power of attorney', 'incapacitated'],
    greetingTone: 'Professional, patient, unhurried. Many callers are recently bereaved.',
  },
  {
    id: 'bankruptcy',
    label: 'Bankruptcy',
    shortDescription: '341-meeting reminders + automatic-stay escalation.',
    contextBlock: `Practice area: Bankruptcy (Chapter 7, 11, 13).
Capture: chapter type if known, approximate debt amount, primary creditor types (credit cards / medical / IRS / mortgage / business), urgent collection activity (lawsuit served, garnishment, foreclosure date). If the caller mentions an active foreclosure sale date or a wage garnishment hearing within 7 days, escalate immediately — the automatic stay is the entire point of urgent filing.`,
    escalationVocab: ['foreclosure', 'garnishment', 'lawsuit served', 'sheriff sale', 'eviction', 'repossession', 'irs levy'],
    greetingTone: 'Calm and non-judgmental. Financial distress is shameful for many callers.',
  },
  {
    id: 'workers_comp',
    label: "Workers' Comp",
    shortDescription: 'First-notice-of-injury intake + IME reminders.',
    contextBlock: `Practice area: Workers' Compensation.
Capture: date of injury, employer name, body parts injured, current medical treatment status, whether the employer has been notified, whether a claim has been filed. If injury was within the last 30 days and no claim has been filed yet, flag as time-sensitive — most states have strict reporting deadlines. We do contingency-fee representation; do not quote a fee.`,
    escalationVocab: ['hospitalized', 'still in pain', 'employer denying', 'fired after injury', 'retaliation', 'ime tomorrow'],
    greetingTone: 'Empathetic, patient. Often callers are recently injured and in pain.',
  },
  {
    id: 'business_law',
    label: 'Business Law',
    shortDescription: 'Consultative tone + contract-review intake.',
    contextBlock: `Practice area: Business Law (contracts, entity formation, M&A, commercial litigation).
Capture: matter type (contract review / formation / dispute / transaction), industry, approximate transaction value or claim amount. Consultative tone — these callers are typically business owners or in-house counsel evaluating outside counsel. Quarterly check-ins with retained corporate clients are a strong outbound campaign.`,
    escalationVocab: ['lawsuit filed', 'cease and desist', 'breach of contract', 'closing tomorrow', 'shutdown'],
    greetingTone: 'Professional and businesslike. Match the caller\'s level of formality.',
  },
  {
    id: 'real_estate_law',
    label: 'Real Estate Law',
    shortDescription: 'Closing-day coordination + title escalation.',
    contextBlock: `Practice area: Real Estate Law (transactions, title, landlord/tenant, zoning).
Capture: matter type (purchase / sale / refinance / title dispute / landlord-tenant / zoning), property address, closing date if known. If caller mentions an active closing day or a title issue blocking a same-week closing, escalate immediately. Landlord/tenant emergencies (lockout, illegal eviction) also need same-day attention.`,
    escalationVocab: ['closing tomorrow', 'closing today', 'title issue', 'illegal eviction', 'lockout', 'hud audit'],
    greetingTone: 'Professional and crisp. Most calls are deadline-driven; respect that.',
  },
];

// ── Helpers ───────────────────────────────────────────────────

/**
 * Replace any existing practice-area anchor block in `existing`
 * with the new preset's contextBlock. If no anchor exists yet,
 * append the new block to the end (with a leading blank line so
 * it visually separates from any custom prose).
 *
 * Returns the new business_context string. Pass the result back
 * into `settingsApi.update({ businessContext })`.
 */
export function applyPracticeAreaToContext(
  existing: string,
  preset: LegalPracticeArea
): string {
  const wrapped = `${PRACTICE_AREA_ANCHOR_OPEN}\n${preset.contextBlock}\n${PRACTICE_AREA_ANCHOR_CLOSE}`;
  const anchorRegex = new RegExp(
    `${escapeRegex(PRACTICE_AREA_ANCHOR_OPEN)}[\\s\\S]*?${escapeRegex(PRACTICE_AREA_ANCHOR_CLOSE)}`,
    'g'
  );
  if (anchorRegex.test(existing)) {
    return existing.replace(anchorRegex, wrapped);
  }
  const sep = existing.trim().length > 0 ? '\n\n' : '';
  return `${existing.trimEnd()}${sep}${wrapped}`;
}

/**
 * Parse the practice-area id back out of a business_context blob,
 * by matching the contextBlock body of any known preset. Returns
 * null when no anchored block is found or the body doesn't match
 * a known preset. Used to seed the dropdown's current selection
 * when the page first mounts.
 */
export function detectPracticeAreaFromContext(existing: string): LegalPracticeArea['id'] | null {
  const anchorRegex = new RegExp(
    `${escapeRegex(PRACTICE_AREA_ANCHOR_OPEN)}\\s*([\\s\\S]*?)\\s*${escapeRegex(PRACTICE_AREA_ANCHOR_CLOSE)}`
  );
  const match = existing.match(anchorRegex);
  if (!match || !match[1]) return null;
  const body = match[1].trim();
  const found = LEGAL_PRACTICE_AREAS.find((p) => p.contextBlock.trim() === body);
  return found?.id ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
