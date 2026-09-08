// ============================================================
// Public call-me closer script + lead extraction.
// Used only for homepage / demo dials — not paying-tenant receptionists.
// ============================================================
import { DEMO_AGENT_NAME } from './public-demo.helpers.js';

export const DEMO_SIGNUP_PATH = '/signup?plan=trial';

export interface DemoCloserPromptOpts {
  agentName?: string;
  signupUrl: string;
}

/**
 * Sales-closer talk track for Hear-it-on-your-phone.
 * Not a fake dental/legal front desk.
 */
export function buildDemoCloserPrompt(opts: DemoCloserPromptOpts): string {
  const name = opts.agentName?.trim() || DEMO_AGENT_NAME;
  const signup = opts.signupUrl.trim();

  return `# Role
You are ${name} — the voice of Telfin, an AI call center and receptionist that closes deals, books appointments, and sets the rest up for a business. You handle inbound, follow-up, and SMS the same way a sharp closer would: natural, brief, useful. You are not a dental front desk, not a law-firm intake bot, and not a generic "how can I help you today" receptionist playing pretend.

This call exists because they tapped "Hear it on your phone" on the Telfin site. YOU called THEM.

# Opening
Start with something like: "Hey, this is ${name}…" Then one easy sentence about what you do — you answer the line, follow up, text people, book the appointment, and help close the deal so the business does not drop it. Weave that in. Do not read a feature list.

# Qualify
Ask for, conversationally, one at a time:
1) Their name
2) Their business, if they have one — what they do / the vertical if it helps (dental, legal / personal injury, real estate, home services, insurance, and so on)

Listen. Use their name. If they do not have a business, that is fine — still be useful.

# Close
When they are ready, soft-close toward Try Free: they can start at ${signup}, or you can set a short follow-up demo. One clear ask, then wait. Not spammy. Never pressure twice in a row.

If they want the link, say it slowly: ${signup}

# If they are not ready
Thank them, leave the door open, and wrap up. We still save them as a follow-up lead. Do not invent a booking you cannot keep.

# Style
- Short turns. Phone, not a pitch deck.
- Never claim to be human. If asked, you are ${name}, Telfin's AI.
- No legal, medical, or price quotes. No fake office hours or fake dentists.
- Confirm name and business back once if they gave them, so we capture the lead cleanly.`;
}

export interface DemoLeadDraft {
  firstName: string;
  lastName: string;
  business: string;
  vertical: string;
  language: string;
  interestNotes: string;
  closed: boolean;
}

export function emptyDemoLeadDraft(): DemoLeadDraft {
  return {
    firstName: '',
    lastName: '',
    business: '',
    vertical: '',
    language: 'en',
    interestNotes: '',
    closed: false,
  };
}

const NAME_RE =
  /(?:my name is|i(?:'| a)?m|this is|it(?:'| i)?s)\s+([A-Za-z][A-Za-z'-]{1,30}(?:\s+[A-Za-z][A-Za-z'-]{1,30})?)/i;
const AGENT_NAME_RE =
  /(?:nice to meet you|good to meet you|thanks(?: again)?),\s+([A-Za-z][A-Za-z'-]{1,30})/i;
const BUSINESS_RE =
  /(?:i (?:run|own|have|operate|work (?:at|for)|manage)|we(?:'| a)?re(?: with| at)?|my (?:business|company|practice|firm|shop|agency|brokerage) is)\s+(.{2,80})/i;

const VERTICAL_HINTS: Array<{ re: RegExp; id: string }> = [
  { re: /dent(?:al|ist)|orthodont/i, id: 'dental' },
  { re: /personal injury|\bpi\b|law firm|attorney|lawyer|legal/i, id: 'legal' },
  { re: /real estate|realtor|broker(?:age)?|listing/i, id: 'real_estate' },
  { re: /insur(?:ance|er)|agency|policy|claim/i, id: 'insurance' },
  { re: /plumb|hvac|electr|roof|home service|contractor/i, id: 'home_services' },
];

const CLOSED_RE =
  /try free|sign\s*up|i(?:'| wi)ll (?:sign|start|do (?:it|that)|try)|book(?:ed)? (?:a )?(?:demo|follow-?up)|let(?:'| u)s do it|i(?:'| a)m in\b/i;

const ES_RE = /[áéíóúñ¿¡]|hola|gracias|negocio|llamad|cita|sí\b/i;

export function extractDemoLeadFromTranscript(
  lines: Array<{ role?: string; text?: string }>,
  summary?: string | null,
): DemoLeadDraft {
  const draft = emptyDemoLeadDraft();
  const callerText = lines
    .filter((l) => (l.role ?? '') === 'caller' || (l.role ?? '') === 'user')
    .map((l) => l.text ?? '')
    .join(' \n ');
  const agentText = lines
    .filter((l) => (l.role ?? '') === 'agent' || (l.role ?? '') === 'ai')
    .map((l) => l.text ?? '')
    .join(' \n ');
  const blob = [callerText, agentText, summary ?? ''].filter(Boolean).join('\n');

  const nameMatch = callerText.match(NAME_RE) ?? agentText.match(AGENT_NAME_RE);
  if (nameMatch?.[1]) {
    const parts = nameMatch[1].trim().split(/\s+/);
    draft.firstName = parts[0] ?? '';
    draft.lastName = parts.slice(1).join(' ');
  }

  const bizMatch = callerText.match(BUSINESS_RE);
  if (bizMatch?.[1]) {
    draft.business = bizMatch[1].replace(/[.?!].*$/, '').trim();
  }

  for (const hint of VERTICAL_HINTS) {
    if (hint.re.test(blob)) {
      draft.vertical = hint.id;
      break;
    }
  }

  if (ES_RE.test(callerText)) draft.language = 'es';
  draft.closed = CLOSED_RE.test(blob);
  draft.interestNotes = summarizeInterest(callerText, summary ?? '', draft);
  return draft;
}

function summarizeInterest(callerText: string, summary: string, draft: DemoLeadDraft): string {
  const bits: string[] = [];
  if (draft.business) bits.push(`business=${draft.business}`);
  if (draft.vertical) bits.push(`vertical=${draft.vertical}`);
  if (draft.closed) bits.push('signaled-ready-to-try');
  const clip = (callerText || summary).replace(/\s+/g, ' ').trim().slice(0, 280);
  if (clip) bits.push(clip);
  return bits.join(' · ');
}

const DEMO_LEAD_OPEN = '<!-- demo-call-me-v1 -->';
const DEMO_LEAD_CLOSE = '<!-- /demo-call-me-v1 -->';
const DEMO_LEAD_BLOCK_RE =
  /<!--\s*demo-call-me-v1\s*-->[\s\S]*?<!--\s*\/demo-call-me-v1\s*-->/;

export function formatDemoLeadNotes(params: {
  existing?: string | null;
  phone: string;
  draft: DemoLeadDraft;
}): string {
  const tags = params.draft.closed
    ? 'demo-call-me, closed, follow-up'
    : 'demo-call-me, not-closed, follow-up';
  const displayName = [params.draft.firstName, params.draft.lastName].filter(Boolean).join(' ') || 'unknown';
  const block = [
    DEMO_LEAD_OPEN,
    `tags: ${tags}`,
    `name: ${displayName}`,
    `business: ${params.draft.business || 'unknown'}`,
    `vertical: ${params.draft.vertical || 'unknown'}`,
    `phone: ${params.phone}`,
    `language: ${params.draft.language}`,
    `interest: ${params.draft.interestNotes || 'none'}`,
    `closed: ${params.draft.closed ? 'yes' : 'no'}`,
    DEMO_LEAD_CLOSE,
  ].join('\n');

  const existing = (params.existing ?? '').trim();
  if (!existing) return block;
  if (DEMO_LEAD_BLOCK_RE.test(existing)) return existing.replace(DEMO_LEAD_BLOCK_RE, block);
  return `${existing}\n\n${block}`;
}

export function splitLeadName(draft: DemoLeadDraft): { firstName: string; lastName: string } {
  const first = draft.firstName.trim() || 'Visitor';
  const last = draft.lastName.trim() || 'Lead';
  return { firstName: first, lastName: last };
}
