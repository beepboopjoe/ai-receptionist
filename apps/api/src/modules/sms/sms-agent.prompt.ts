// ============================================================
// SMS receptionist system prompt — same vertical brain as voice:
// business context, office hours, escalation vocab, lead capture.
// Output is JSON so the inbound loop can reply / lead / escalate.
// ============================================================
import type { Contact, OfficeHours, Vertical } from '@ai-receptionist/shared';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { VERTICAL_ESCALATION_VOCAB } from '../voice-agent/prompt-builder.js';
import {
  afterHoursHoldReplyEs,
  normalizeSpokenLanguage,
  smsLanguagePromptBlock,
  type SpokenLanguage,
} from '../voice-agent/spoken-language.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const VERTICAL_TERMS: Record<
  Vertical,
  { label: string; contactNoun: string; businessNoun: string }
> = {
  dental: { label: 'dental practice', contactNoun: 'patient', businessNoun: 'practice' },
  insurance: { label: 'insurance agency', contactNoun: 'client', businessNoun: 'agency' },
  legal: { label: 'law firm', contactNoun: 'client', businessNoun: 'firm' },
  real_estate: { label: 'real estate brokerage', contactNoun: 'lead', businessNoun: 'brokerage' },
  home_services: { label: 'home services business', contactNoun: 'customer', businessNoun: 'business' },
  generic: { label: 'business', contactNoun: 'caller', businessNoun: 'business' },
};

export interface SmsPromptContext {
  practiceName: string;
  vertical: Vertical;
  timezone: string;
  officeHours: OfficeHours | Record<string, unknown>;
  transferNumber: string | null;
  businessContext?: string | null;
  contact: Pick<Contact, 'firstName' | 'lastName'> | null;
  afterHours: boolean;
  thread: Array<{ direction: 'inbound' | 'outbound'; body: string }>;
  inboundBody: string;
  spokenLanguage?: SpokenLanguage | string;
}

export interface SmsAgentDecision {
  reply: string;
  action: 'reply' | 'escalate' | 'lead' | 'hold';
  escalateReason?: string;
  priority?: 'normal' | 'urgent';
  firstName?: string;
  lastName?: string;
  notes?: string;
}

const HOLD_TEMPLATE =
  'Thanks — our office is closed right now. We’ll follow up during business hours. If this is urgent, reply URGENT.';

export function afterHoursHoldReply(practiceName: string, spokenLanguage?: SpokenLanguage | string): string {
  const mode = normalizeSpokenLanguage(spokenLanguage);
  if (mode === 'es') return afterHoursHoldReplyEs(practiceName);
  return `Thanks for texting ${practiceName}. ${HOLD_TEMPLATE}`;
}

export function buildSmsSystemPrompt(ctx: SmsPromptContext): string {
  const now = dayjs().tz(ctx.timezone);
  const vertical = ctx.vertical ?? 'generic';
  const terms = VERTICAL_TERMS[vertical] ?? VERTICAL_TERMS.generic;
  const vocab = VERTICAL_ESCALATION_VOCAB[vertical] ?? VERTICAL_ESCALATION_VOCAB.generic;

  const threadLines = ctx.thread
    .slice(-8)
    .map((m) => `${m.direction === 'inbound' ? 'Them' : 'You'}: ${m.body}`)
    .join('\n');

  const about = ctx.businessContext?.trim()
    ? `\n# About ${ctx.practiceName}\n${ctx.businessContext.trim()}\n`
    : '';

  const identity = ctx.contact
    ? `Existing ${terms.contactNoun}: ${ctx.contact.firstName} ${ctx.contact.lastName}`.trim()
    : `New ${terms.contactNoun} — not on file yet. If they give a name, capture it.`;

  return `You are the SMS receptionist for ${ctx.practiceName}, a ${terms.label}. You text from the business number (not a personal inbox). Warm, concise, professional. Never claim to be human. Never name infrastructure vendors.

# Current context
- Today: ${now.format('dddd, MMMM D, YYYY')} ${now.format('h:mm A')} ${ctx.timezone}
- Office is ${ctx.afterHours ? 'CLOSED (after hours / holiday)' : 'OPEN'}
- Transfer / staff line: ${ctx.transferNumber ?? 'not set'}
- ${identity}
${about}
# Escalation vocabulary
If their text uses any of these, set action="escalate" and priority="urgent":
${vocab.map((w) => `- "${w}"`).join('\n')}

# What you can do
- answer common questions from About / general ${terms.businessNoun} knowledge
- capture a new lead (name) when they are new
- escalate emergencies or “speak to a person” requests
- after hours: still reply, but say the office is closed unless it is urgent (then escalate)

${smsLanguagePromptBlock(normalizeSpokenLanguage(ctx.spokenLanguage))}

# Rules
- Reply in one SMS, max 320 characters. No markdown, no emoji walls.
- Do not quote prices unless they appear in About.
- Do not promise legal/medical outcomes.
- Do not invent TCPA, 10DLC, or “registered campaign” claims.
- If you cannot help, say a teammate will follow up${ctx.transferNumber ? ` or they can call ${ctx.transferNumber}` : ''}.
- Output ONLY JSON (no markdown fences) with this shape:
{"reply":"string","action":"reply"|"escalate"|"lead"|"hold","escalateReason":"optional","priority":"normal"|"urgent","firstName":"optional","lastName":"optional","notes":"optional"}

# Recent thread
${threadLines || '(no prior messages)'}

# Latest inbound
${ctx.inboundBody}`;
}

function asTrimmedString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

/** Parse model JSON into a decision. Returns null if unusable. */
export function parseSmsAgentDecision(raw: string): SmsAgentDecision | null {
  const clipped = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = clipped.indexOf('{');
  const end = clipped.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(clipped.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const rec = parsed as Record<string, unknown>;
  const reply = asTrimmedString(rec.reply, 320) ?? '';
  const actionRaw = typeof rec.action === 'string' ? rec.action.toLowerCase() : 'reply';
  const action: SmsAgentDecision['action'] =
    actionRaw === 'escalate' || actionRaw === 'lead' || actionRaw === 'hold' || actionRaw === 'reply'
      ? actionRaw
      : 'reply';
  if (!reply && action === 'reply') return null;

  const priority = rec.priority === 'urgent' ? 'urgent' : rec.priority === 'normal' ? 'normal' : undefined;
  return {
    reply,
    action,
    ...(asTrimmedString(rec.escalateReason, 200) ? { escalateReason: asTrimmedString(rec.escalateReason, 200) } : {}),
    ...(priority ? { priority } : {}),
    ...(asTrimmedString(rec.firstName, 40) ? { firstName: asTrimmedString(rec.firstName, 40) } : {}),
    ...(asTrimmedString(rec.lastName, 40) ? { lastName: asTrimmedString(rec.lastName, 40) } : {}),
    ...(asTrimmedString(rec.notes, 400) ? { notes: asTrimmedString(rec.notes, 400) } : {}),
  };
}
