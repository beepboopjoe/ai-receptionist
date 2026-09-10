// ============================================================
// Pure helpers: pull name / business / closed from a demo transcript.
// No DB — unit-tested without Fastify.
// ============================================================

export interface DemoLeadDraft {
  name: string;
  business: string;
  language: string;
  voice: string;
  closed: boolean;
  notes: string;
}

export function emptyDemoLeadDraft(overrides?: Partial<DemoLeadDraft>): DemoLeadDraft {
  return {
    name: '',
    business: '',
    language: 'en',
    voice: 'aurora',
    closed: false,
    notes: '',
    ...overrides,
  };
}

const NAME_RE =
  /(?:my name is|i(?:'| a)?m|this is|it(?:'| i)?s)\s+([A-Za-z][A-Za-z'-]{1,30}(?:\s+[A-Za-z][A-Za-z'-]{1,30})?)/i;
const AGENT_NAME_RE =
  /(?:nice to meet you|good to meet you|thanks(?: again)?),\s+([A-Za-z][A-Za-z'-]{1,30}(?:\s+[A-Za-z][A-Za-z'-]{1,30})?)/i;
const BUSINESS_RE =
  /(?:i (?:run|own|have|operate|work (?:at|for)|manage)|we(?:'| a)?re(?: with| at)?|my (?:business|company|practice|firm|shop|agency|brokerage) is)\s+(.{2,80})/i;

const CLOSED_RE =
  /try free|sign\s*up|i(?:'| wi)ll (?:sign|start|do (?:it|that)|try)|book(?:ed)? (?:a )?(?:demo|follow-?up)|let(?:'| u)s do it|i(?:'| a)m in\b/i;

const ES_RE = /[áéíóúñ¿¡]|hola|gracias|negocio|llamad|cita|sí\b/i;

export function extractDemoLeadFromTranscript(
  lines: Array<{ role?: string; text?: string }>,
  summary?: string | null,
): Pick<DemoLeadDraft, 'name' | 'business' | 'closed' | 'notes'> & { languageHint?: string } {
  const callerText = lines
    .filter((l) => (l.role ?? '') === 'caller' || (l.role ?? '') === 'user')
    .map((l) => l.text ?? '')
    .join(' \n ');
  const agentText = lines
    .filter((l) => (l.role ?? '') === 'agent' || (l.role ?? '') === 'ai')
    .map((l) => l.text ?? '')
    .join(' \n ');
  const blob = [callerText, agentText, summary ?? ''].filter(Boolean).join('\n');

  let name = '';
  const nameMatch = callerText.match(NAME_RE) ?? agentText.match(AGENT_NAME_RE);
  if (nameMatch?.[1]) name = nameMatch[1].trim();

  let business = '';
  const bizMatch = callerText.match(BUSINESS_RE);
  if (bizMatch?.[1]) business = bizMatch[1].replace(/[.?!].*$/, '').trim();

  const closed = CLOSED_RE.test(blob);
  const languageHint = ES_RE.test(callerText) ? 'es' : undefined;
  const clip = (callerText || summary || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const bits: string[] = [];
  if (business) bits.push(`business=${business}`);
  if (closed) bits.push('signaled-ready-to-try');
  if (clip) bits.push(clip);

  return { name, business, closed, notes: bits.join(' · '), ...(languageHint && { languageHint }) };
}
