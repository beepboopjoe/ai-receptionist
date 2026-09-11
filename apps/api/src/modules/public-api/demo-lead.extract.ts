// ============================================================
// Pure helpers: pull name / business / email / closed from a demo transcript.
// No DB — unit-tested without Fastify.
// Bare answers after "what's your name?" must still persist (call-me
// callers rarely say "my name is …").
// ============================================================

export interface DemoLeadDraft {
  name: string;
  business: string;
  email: string;
  language: string;
  voice: string;
  closed: boolean;
  notes: string;
}

export function emptyDemoLeadDraft(overrides?: Partial<DemoLeadDraft>): DemoLeadDraft {
  return {
    name: '',
    business: '',
    email: '',
    language: 'en',
    voice: 'aurora',
    closed: false,
    notes: '',
    ...overrides,
  };
}

const NAME_TOKEN = "[A-Za-z][A-Za-z'-]{1,30}";
const NAME_CAPTURE = `(${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?)`;

const NAME_STOP = new Set([
  'a',
  'an',
  'the',
  'calling',
  'good',
  'fine',
  'okay',
  'ok',
  'yeah',
  'yes',
  'yep',
  'no',
  'nah',
  'hi',
  'hey',
  'hello',
  'just',
  'here',
  'telfin',
  'aurora',
  'assistant',
  'representative',
  'receptionist',
  'interested',
  'looking',
  'trying',
  'actually',
  'really',
  'sure',
  'great',
  'thanks',
  'thank',
  'you',
  'please',
  'well',
  'um',
  'uh',
  'hmm',
  'got',
  'it',
  'this',
  'that',
  'from',
  'with',
  'and',
  'but',
  'so',
]);

const NAME_PREFIX_RE = new RegExp(
  `(?:my name(?:'s| is)|i(?:'| a)?m(?!\\s+(?:a|an|the|calling|just|good|fine)\\b)|this is(?!\\s+(?:a|an|the)\\b)|it(?:'| i)?s(?!\\s+(?:a|an|the)\\b)|name(?:'s| is))\\s+${NAME_CAPTURE}`,
  'i',
);

const AGENT_NAME_RE = new RegExp(
  `(?:nice to meet you|good to meet you|great to meet you|pleasure to meet you|thanks(?: again)?|thank you)[,.]?\\s+${NAME_CAPTURE}`,
  'i',
);

const NAME_QUESTION_RE =
  /(?:what(?:'s| is) your name|who (?:am i|have i got) speaking|who(?:'s| is) this|may i (?:ask|have) your name|can i (?:get|ask) your name|your (?:first )?name)/i;

const BIZ_QUESTION_RE =
  /(?:what(?:'s| is) (?:your|the) (?:business|company|practice|shop|firm)|what (?:kind of )?business|what do you do|where do you work|who do you work (?:for|with))/i;

const BUSINESS_RE =
  /(?:i (?:run|own|have|operate|work (?:at|for)|manage)|we(?:'| a)?re(?: with| at)?|my (?:business|company|practice|firm|shop|agency|brokerage) is)\s+(.{2,80})/i;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const CLOSED_RE =
  /try free|sign\s*up|i(?:'| wi)ll (?:sign|start|do (?:it|that)|try)|book(?:ed)? (?:a )?(?:demo|follow-?up)|let(?:'| u)s do it|i(?:'| a)m in\b/i;

const ES_RE = /[áéíóúñ¿¡]|hola|gracias|negocio|llamad|cita|sí\b/i;

function titleCaseWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function cleanPersonName(raw: string): string {
  const stripped = raw.replace(/[^A-Za-z'\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const names: string[] = [];
  for (const token of stripped.split(' ').filter(Boolean)) {
    const lower = token.toLowerCase();
    if (NAME_STOP.has(lower)) {
      if (names.length) break;
      continue;
    }
    if (!new RegExp(`^${NAME_TOKEN}$`).test(token)) {
      if (names.length) break;
      continue;
    }
    names.push(titleCaseWord(token));
    if (names.length >= 2) break;
  }
  if (names.length === 0) return '';
  const joined = names.join(' ');
  return NAME_STOP.has(joined.toLowerCase()) ? '' : joined;
}

export function cleanBusiness(raw: string): string {
  let value = raw.replace(/\s+/g, ' ').replace(/[.?!].*$/, '').trim();
  value = value.replace(
    /^(?:it(?:'s| is)|we(?:'re| are)|i (?:run|own|have|operate|manage|work (?:at|for)))\s+/i,
    '',
  );
  if (value.length < 2 || value.length > 80) return '';
  const lower = value.toLowerCase();
  if (NAME_STOP.has(lower) || lower === 'telfin') return '';
  return value;
}

function isCaller(role: string): boolean {
  return role === 'caller' || role === 'user';
}

function isAgent(role: string): boolean {
  return role === 'agent' || role === 'ai';
}

function nextCallerText(
  lines: Array<{ role?: string; text?: string }>,
  startIdx: number,
): string {
  for (let i = startIdx + 1; i < lines.length; i++) {
    const role = lines[i]?.role ?? '';
    if (isCaller(role)) return (lines[i]?.text ?? '').trim();
    if (isAgent(role)) return '';
  }
  return '';
}

function answerAfterQuestion(
  lines: Array<{ role?: string; text?: string }>,
  questionRe: RegExp,
): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !isAgent(line.role ?? '')) continue;
    if (!questionRe.test(line.text ?? '')) continue;
    const answer = nextCallerText(lines, i);
    if (answer) return answer;
  }
  return '';
}

export function extractDemoLeadFromTranscript(
  lines: Array<{ role?: string; text?: string }>,
  summary?: string | null,
): Pick<DemoLeadDraft, 'name' | 'business' | 'email' | 'closed' | 'notes'> & {
  languageHint?: string;
} {
  const callerText = lines
    .filter((l) => isCaller(l.role ?? ''))
    .map((l) => l.text ?? '')
    .join(' \n ');
  const agentText = lines
    .filter((l) => isAgent(l.role ?? ''))
    .map((l) => l.text ?? '')
    .join(' \n ');
  const blob = [callerText, agentText, summary ?? ''].filter(Boolean).join('\n');

  let name = '';
  const nameMatch = callerText.match(NAME_PREFIX_RE) ?? agentText.match(AGENT_NAME_RE);
  if (nameMatch?.[1]) name = cleanPersonName(nameMatch[1]);

  if (!name) {
    const answer = answerAfterQuestion(lines, NAME_QUESTION_RE);
    if (answer) {
      const prefixed = answer.match(NAME_PREFIX_RE)?.[1] ?? answer;
      name = cleanPersonName(prefixed);
    }
  }

  let business = '';
  const bizMatch = callerText.match(BUSINESS_RE);
  if (bizMatch?.[1]) business = cleanBusiness(bizMatch[1]);

  if (!business) {
    const answer = answerAfterQuestion(lines, BIZ_QUESTION_RE);
    if (answer) {
      const prefixed = answer.match(BUSINESS_RE)?.[1] ?? answer;
      business = cleanBusiness(prefixed);
    }
  }

  if (business && name && business.toLowerCase() === name.toLowerCase()) {
    business = '';
  }

  const emailMatch = blob.match(EMAIL_RE);
  const email = emailMatch?.[0]?.toLowerCase() ?? '';

  const closed = CLOSED_RE.test(blob);
  const languageHint = ES_RE.test(callerText) ? 'es' : undefined;
  const clip = (callerText || summary || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const bits: string[] = [];
  if (business) bits.push(`business=${business}`);
  if (email) bits.push(`email=${email}`);
  if (closed) bits.push('signaled-ready-to-try');
  if (clip) bits.push(clip);

  return {
    name,
    business,
    email,
    closed,
    notes: bits.join(' · '),
    ...(languageHint && { languageHint }),
  };
}
