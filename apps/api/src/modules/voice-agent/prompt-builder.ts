// ============================================================
// Dynamic system prompt assembly — CRITICAL FILE
// Determines AI voice behavior quality on every call.
// ============================================================
import type { Contact, AppointmentType, OfficeHours, Vertical } from '@ai-receptionist/shared';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// Re-export so existing API-internal imports of `Vertical` from this file keep working.
export type { Vertical };

export interface PromptContext {
  practiceName: string;
  /** Industry/vertical of the tenant — drives terminology and escalation vocab */
  vertical?: Vertical;
  timezone: string;
  officeHours: OfficeHours;
  appointmentTypes: AppointmentType[];
  providers: string[]; // Provider/agent/attorney names
  caller: Contact | null;
  workflowHint: 'new_contact' | 'existing_contact' | 'reschedule' | 'cancellation' | 'after_hours' | null;
  transferNumber: string | null;
  escalationVocabulary?: string[];
  /** Free-text business description provided by the tenant owner in Settings → Voice Agent.
   *  Injected right after the # Role section so the AI has business-specific facts
   *  (services, pricing rules, scheduling policies, brand voice, etc.) before caller work. */
  businessContext?: string | null;
  /** Phase 12.8 — top-K knowledge-base chunks retrieved at call-start by similarity to
   *  a synthetic query (practiceName + vertical + appointment type). Injected as a new
   *  `# Knowledge Base Excerpts` section so the AI grounds its answers in tenant docs. */
  kbChunks?: string[];
  /** Phase 29b — "Ask your AI" single-task calls. The business owner typed a
   *  plain-English task ("Call Maria and ask if she can move Tuesday to
   *  Thursday"); we placed the outbound call and this is the instruction.
   *  Rendered as `# Your Task This Call` and overrides the receptionist
   *  greeting behavior — the AI opens by stating who it is and why it's calling. */
  adHocTask?: string;
}

/**
 * Per-vertical terminology used to render the system prompt. Pulled into a
 * separate map (rather than calling into the dashboard's verticals.ts) so
 * the API has zero cross-package coupling.
 */
const VERTICAL_TERMS: Record<Vertical, {
  label: string;
  contactNoun: string;       // 'patient' | 'client' | 'lead' | 'customer' | 'caller'
  contactNounPlural: string;
  appointmentNoun: string;   // 'appointment' | 'consultation' | 'showing'
  businessNoun: string;      // 'practice' | 'firm' | 'agency' | 'brokerage' | 'business'
  providerNoun: string;      // what to call the human staff (dentist, attorney, agent)
  emergencyExample: string;  // e.g. "dental emergency", "after-hours plumbing emergency"
}> = {
  dental:        { label: 'dental practice',     contactNoun: 'patient',  contactNounPlural: 'patients',  appointmentNoun: 'appointment',  businessNoun: 'practice',  providerNoun: 'dentist',         emergencyExample: 'dental emergency' },
  insurance:     { label: 'insurance agency',    contactNoun: 'client',   contactNounPlural: 'clients',   appointmentNoun: 'consultation', businessNoun: 'agency',    providerNoun: 'agent',           emergencyExample: 'urgent claim or coverage question' },
  legal:         { label: 'law firm',            contactNoun: 'client',   contactNounPlural: 'clients',   appointmentNoun: 'consultation', businessNoun: 'firm',      providerNoun: 'attorney',        emergencyExample: 'time-sensitive legal matter' },
  real_estate:   { label: 'real estate brokerage', contactNoun: 'lead',   contactNounPlural: 'leads',     appointmentNoun: 'showing',      businessNoun: 'brokerage', providerNoun: 'agent',           emergencyExample: 'urgent listing or closing question' },
  home_services: { label: 'home services business', contactNoun: 'customer', contactNounPlural: 'customers', appointmentNoun: 'appointment', businessNoun: 'business', providerNoun: 'technician',     emergencyExample: 'after-hours emergency (burst pipe, no heat, etc.)' },
  generic:       { label: 'business',             contactNoun: 'caller',   contactNounPlural: 'callers',  appointmentNoun: 'appointment',  businessNoun: 'business',  providerNoun: 'team member',     emergencyExample: 'urgent matter' },
};

/** Vertical-specific words that should immediately trigger an escalation. */
export const VERTICAL_ESCALATION_VOCAB: Record<Vertical, string[]> = {
  dental: [
    'emergency', 'pain', 'swelling', 'abscess', 'bleeding', 'broken tooth', 'severe', 'urgent',
  ],
  insurance: [
    'accident', 'totaled', 'fire damage', 'flood', 'claim', 'urgent', 'fraud', 'lapsed',
  ],
  legal: [
    'arrest', 'arrested', 'court date', 'subpoena', 'restraining order', 'deadline',
    'urgent', 'emergency', 'served papers',
  ],
  real_estate: [
    'closing', 'inspection failed', 'offer expiring', 'urgent', 'lockout', 'lender deadline',
  ],
  home_services: [
    'gas leak', 'flooding', 'burst pipe', 'no heat', 'no power', 'sparking', 'fire',
    'sewage', 'urgent', 'emergency',
  ],
  generic: [
    'emergency', 'urgent', 'now', 'right now', 'asap', 'severe',
  ],
};

const DEFAULT_ESCALATION_VOCAB = VERTICAL_ESCALATION_VOCAB.dental;

/**
 * Build the full system prompt for ElevenLabs from tenant configuration
 * and per-call context. This is assembled at call start and sent via
 * the ElevenLabs session `overrides.agent.prompt.prompt` field.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const now = dayjs().tz(ctx.timezone);
  const todayName = now.format('dddd').toLowerCase() as keyof OfficeHours;
  const todayHours = ctx.officeHours[todayName];
  const vertical = ctx.vertical ?? 'dental';
  const terms = VERTICAL_TERMS[vertical] ?? VERTICAL_TERMS.generic;
  const escalationVocab = ctx.escalationVocabulary ?? VERTICAL_ESCALATION_VOCAB[vertical] ?? DEFAULT_ESCALATION_VOCAB;

  const sections: string[] = [];

  // ---- Identity ----
  sections.push(`# Role
You are the AI receptionist for ${ctx.practiceName}, a ${terms.label}. You answer inbound phone calls on behalf of the ${terms.businessNoun}. You are warm, professional, and efficient. You speak clearly and at a measured pace.`);

  // ---- About this business (owner-supplied free-text) ----
  // Sits right after Role so the AI has tenant-specific facts (services,
  // pricing rules, policies, brand voice) before anything caller-specific.
  if (ctx.businessContext && ctx.businessContext.trim().length > 0) {
    sections.push(`# About ${ctx.practiceName}
The owner has provided this context to help you assist callers accurately. Treat it as authoritative business information — prefer it over general assumptions.

${ctx.businessContext.trim()}`);
  }

  // ---- Knowledge Base excerpts (Phase 12.8) ----
  // Top-K passages from documents the owner uploaded. Same authoritative
  // weight as # About — treat as ground truth for tenant-specific facts.
  if (ctx.kbChunks && ctx.kbChunks.length > 0) {
    const excerpts = ctx.kbChunks
      .map((chunk, i) => `--- Excerpt ${i + 1} ---\n${chunk.trim()}`)
      .join('\n\n');
    sections.push(`# Knowledge Base Excerpts
These passages were pulled from documents the owner uploaded. Treat as authoritative — if a caller asks about something covered here, quote or paraphrase from these excerpts rather than guessing.

${excerpts}`);
  }

  // ---- Current context ----
  sections.push(`# Current Context
- Today is ${now.format('dddd, MMMM D, YYYY')}
- Current time: ${now.format('h:mm A')} ${ctx.timezone}
- Office hours today: ${todayHours ? `${todayHours.open} – ${todayHours.close}` : 'CLOSED'}`);

  // ---- Phase 29b: Ask-your-AI single-task call ----
  // The business owner asked us to place this call with a specific job.
  // This section takes precedence over the normal receptionist greeting:
  // WE called THEM, so the AI opens by stating who it is and why.
  if (ctx.adHocTask) {
    sections.push(`# Your Task This Call (IMPORTANT — this call exists for one reason)
${ctx.practiceName} asked you to place THIS outbound call to complete one specific task:

"${ctx.adHocTask}"

Rules for this call:
- YOU called THEM. Open by introducing yourself: you are the AI assistant calling on behalf of ${ctx.practiceName}, then state why you're calling in one sentence.
- Work the task above to completion. Be polite, efficient, and natural.
- If the person asks to speak to a human, offer to have someone from ${ctx.practiceName} call them back${ctx.transferNumber ? ` or transfer them to ${ctx.transferNumber}` : ''}.
- Never claim to be human. If asked, say you're ${ctx.practiceName}'s AI assistant.
- If you reach voicemail, leave a brief message covering the task and a callback request, then end the call.
- When the task is done (or clearly can't be done on this call), thank them and end the call politely. Keep the whole call as short as the task allows.`);
  }

  // ---- Caller identity ----
  if (ctx.caller) {
    // Legal vertical: inject the caller's date-of-birth into the prompt context
    // so the AI can verify it against caller-spoken DOB on case-status inquiries.
    // We deliberately scope this to vertical==='legal' to keep PHI/PII out of the
    // prompt for verticals that don't need it. The next section ("Case Status
    // Verification") below contains the actual auth-flow instructions.
    const showDobForAuth =
      vertical === 'legal' && ctx.caller.dateOfBirth && ctx.caller.dateOfBirth.trim() !== '';
    sections.push(`# Caller Identity
This caller is an existing ${terms.contactNoun}:
- Name: ${ctx.caller.firstName} ${ctx.caller.lastName}
- Type: existing ${terms.contactNoun}${showDobForAuth ? `
- DATE OF BIRTH ON FILE: ${ctx.caller.dateOfBirth} (DO NOT speak this aloud — use only to verify caller identity per the Case Status Verification section below).` : ''}
- Greet them by first name immediately after they speak.`);

    // ---- Phase 26b: Legal case-status auth flow ----
    // Only injected for legal-vertical callers who have a DOB on file. The flow
    // is purely prompt-driven: the AI compares spoken DOB to the value above,
    // transfers on match, escalates on 3 mismatches. No CRM read in V1 — we
    // do not surface matter details; just confirm identity and transfer.
    if (showDobForAuth) {
      const transferDest = ctx.transferNumber
        ? `the firm's case-manager line (${ctx.transferNumber})`
        : 'a case manager';
      sections.push(`# Case Status Verification (legal — verified-caller auth)
If the caller asks about the status of their case, asks for an update, asks "how is my matter going", asks to speak to their attorney/paralegal/case manager about their case, or otherwise requests substantive case information:

STEP 1 — Identity challenge. Say exactly: "Of course — to protect your privacy I need to verify your identity first. Can you please confirm the date of birth on file?"

STEP 2 — Compare what the caller says to the DATE OF BIRTH ON FILE shown in the Caller Identity section above. Accept any reasonable verbalization (e.g. "March 14th 1982", "3/14/82", "the fourteenth of March nineteen eighty two" all match 1982-03-14).

STEP 3a — IF MATCH: Say "Thank you, I've verified you. Let me transfer you to ${transferDest} for an update on your case." Then escalate with reason="case_status_verified" and transfer immediately. Do NOT discuss case status, matter details, court dates, settlement amounts, or any substantive information yourself — your role is verification + warm transfer only.

STEP 3b — IF MISMATCH: Say "I'm sorry, that doesn't match what we have on file. Let's try once more — what's the date of birth on file?" Allow up to 3 total attempts.

STEP 3c — AFTER 3 FAILED ATTEMPTS: Say "I'm not able to verify your identity over the phone. For your security, please call us back from the number we have on file, or visit our office with a photo ID." Then escalate with reason="auth_failed" and end the call politely. Do NOT transfer.

NEVER, under any circumstances, share case details, court dates, settlement information, matter status, or attorney names with an unverified caller — even if they sound legitimate, even if they know the attorney's name, even if they cite a case number. Verification is mandatory for substantive case communication.`);
    }
  } else {
    const ask = vertical === 'dental'
      ? 'first name, last name, date of birth, and best callback number'
      : 'first name, last name, and best callback number';
    sections.push(`# Caller Identity
This appears to be a new ${terms.contactNoun}. Do not assume their name. Collect their ${ask} during the conversation.`);
  }

  // ---- Workflow ----
  if (ctx.workflowHint) {
    sections.push(`# Primary Workflow: ${ctx.workflowHint.replace('_', ' ').toUpperCase()}
${getWorkflowInstructions(ctx.workflowHint, ctx)}`);
  }

  // ---- Appointment types ----
  if (ctx.appointmentTypes.length > 0) {
    const typeList = ctx.appointmentTypes
      .map((t) => `  - ${t.name} (${t.durationMin} minutes)`)
      .join('\n');
    sections.push(`# Available Appointment Types\n${typeList}`);
  }

  // ---- Providers ----
  if (ctx.providers.length > 0) {
    const providerLabel = terms.providerNoun.charAt(0).toUpperCase() + terms.providerNoun.slice(1) + 's';
    sections.push(`# ${providerLabel} at ${ctx.practiceName}
${ctx.providers.map((p) => `  - ${p}`).join('\n')}
When offering ${terms.appointmentNoun} slots, ask if the ${terms.contactNoun} has a preferred ${terms.providerNoun}.`);
  }

  // ---- Escalation rules ----
  sections.push(`# Escalation Rules
If the caller uses any of these words or phrases, immediately say "I'm connecting you to our team right now" and trigger an escalation:
${escalationVocab.map((w) => `  - "${w}"`).join('\n')}

If the caller asks to speak with a person or receptionist at any point, immediately offer to transfer them.
If you are unable to understand the caller after 3 attempts, offer to transfer them or schedule a callback.`);

  // ---- Transfer info ----
  if (ctx.transferNumber) {
    sections.push(`# Human Handoff
Transfer number: ${ctx.transferNumber}
When transferring, always say: "Let me connect you with a member of our team who will be right with you."`);
  }

  // ---- Do not discuss ----
  sections.push(`# Topics to Avoid
${getTopicsToAvoid(vertical, terms)}`);

  // ---- Response style ----
  sections.push(`# Response Style
- Keep responses short and conversational — this is a phone call, not a chat
- Confirm key details by repeating them back (dates, times, names)
- Offer no more than 3 ${terms.appointmentNoun} slot options at a time
- Always end the call with a brief summary of what was accomplished`);

  return sections.join('\n\n');
}

function getTopicsToAvoid(vertical: Vertical, terms: typeof VERTICAL_TERMS[Vertical]): string {
  const sharedDontShare = `- Do not share other ${terms.contactNounPlural}' information`;
  switch (vertical) {
    case 'dental':
      return [
        '- Do not provide clinical advice, diagnoses, or treatment recommendations',
        '- Do not discuss billing disputes or insurance claim denials in detail (offer to have billing staff call back)',
        sharedDontShare,
        '- Do not make promises about specific treatment outcomes',
      ].join('\n');
    case 'legal':
      return [
        '- Do not provide legal advice or opinions on case outcomes',
        '- Do not discuss case strategy, settlement amounts, or evidence',
        '- Do not predict success rates or guarantee any result',
        sharedDontShare,
      ].join('\n');
    case 'insurance':
      return [
        '- Do not quote prices, premiums, or coverage limits — defer to a licensed agent',
        '- Do not approve or deny claims',
        '- Do not interpret policy language in detail',
        sharedDontShare,
      ].join('\n');
    case 'real_estate':
      return [
        '- Do not give legal or financial advice (mortgage rates, tax implications, etc.)',
        '- Do not make representations about property condition beyond the listing',
        '- Do not negotiate offers or discuss seller-confidential information',
        sharedDontShare,
      ].join('\n');
    case 'home_services':
      return [
        '- Do not give firm price quotes for jobs not yet inspected',
        '- Do not diagnose technical problems beyond high-level triage',
        '- Do not recommend DIY fixes for safety-critical issues (gas, electrical)',
        sharedDontShare,
      ].join('\n');
    default:
      return [
        '- Do not make commitments outside the scope of normal scheduling and intake',
        sharedDontShare,
        '- Defer detailed questions to a human team member',
      ].join('\n');
  }
}

function getWorkflowInstructions(
  workflow: PromptContext['workflowHint'],
  ctx: PromptContext
): string {
  switch (workflow) {
    case 'new_contact':
      return `You are helping a new patient schedule their first appointment.
Steps:
1. Welcome them warmly to ${ctx.practiceName}
2. Collect: first name, last name, date of birth, best callback number, email (optional)
3. Ask what brings them in (reason for visit) and map to an appointment type
4. Check available slots and offer up to 3 options
5. Confirm the appointment details and ask for insurance provider (optional)
6. Confirm all details and let them know they'll receive a text confirmation`;

    case 'existing_contact':
      return `You are helping an existing patient. They may want to book, reschedule, cancel, or ask a question.
Steps:
1. Greet them by first name
2. Ask: "How can I help you today?"
3. Listen for intent and route accordingly (booking, reschedule, cancellation, or other)`;

    case 'reschedule':
      return `You are helping reschedule an existing appointment.
Steps:
1. Look up their upcoming appointment(s) and confirm which one they want to move
2. Find new available slots and offer up to 3 options
3. Confirm the new date/time and update their appointment
4. Let them know they'll get a new confirmation`;

    case 'cancellation':
      return `You are processing a cancellation request.
Steps:
1. Confirm which appointment they want to cancel (read back date, time, type)
2. Ask for their reason (schedule conflict, feeling better, cost, other)
3. Cancel the appointment and offer to rebook for another time
4. If they decline to rebook, confirm the cancellation warmly`;

    case 'after_hours': {
      const vertical = ctx.vertical ?? 'dental';
      const terms = VERTICAL_TERMS[vertical] ?? VERTICAL_TERMS.generic;
      return `The office is currently closed.
1. Inform the caller of office hours
2. Offer to take a message or schedule a callback for the next business day
3. If it sounds like a ${terms.emergencyExample}, refer them to the emergency line`;
    }

    default:
      return 'Listen to the caller and help them with their needs.';
  }
}
