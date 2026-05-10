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
  workflowHint: 'new_patient' | 'existing_patient' | 'reschedule' | 'cancellation' | 'after_hours' | null;
  transferNumber: string | null;
  escalationVocabulary?: string[];
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

  // ---- Current context ----
  sections.push(`# Current Context
- Today is ${now.format('dddd, MMMM D, YYYY')}
- Current time: ${now.format('h:mm A')} ${ctx.timezone}
- Office hours today: ${todayHours ? `${todayHours.open} – ${todayHours.close}` : 'CLOSED'}`);

  // ---- Caller identity ----
  if (ctx.caller) {
    sections.push(`# Caller Identity
This caller is an existing ${terms.contactNoun}:
- Name: ${ctx.caller.firstName} ${ctx.caller.lastName}
- Type: existing ${terms.contactNoun}
- Greet them by first name immediately after they speak.`);
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
    case 'new_patient':
      return `You are helping a new patient schedule their first appointment.
Steps:
1. Welcome them warmly to ${ctx.practiceName}
2. Collect: first name, last name, date of birth, best callback number, email (optional)
3. Ask what brings them in (reason for visit) and map to an appointment type
4. Check available slots and offer up to 3 options
5. Confirm the appointment details and ask for insurance provider (optional)
6. Confirm all details and let them know they'll receive a text confirmation`;

    case 'existing_patient':
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
