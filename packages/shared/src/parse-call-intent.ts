// ============================================================
// Parse a dashboard-chat utterance into a single outbound call.
//
// "Call +1… and tell them I'm following up about X / goal is Y."
// Also accepts spoken digit words from browser dictation.
// Pure — no I/O. US/Canada NANP only (same as /calls/ai-task).
// ============================================================

const DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

const CALL_VERB_RE = /\b(call|dial|ring|phone)\b/i;
const NANP_E164_RE = /^\+1[2-9]\d{9}$/;
const NAME_SKIP = new Set([
  'the',
  'a',
  'an',
  'this',
  'that',
  'them',
  'him',
  'her',
  'someone',
  'number',
  'plus',
  'my',
  'our',
  'their',
]);

export type CallIntentFailure = 'no_number' | 'no_task' | 'not_a_call';

export type CallIntentParse =
  | {
      ok: true;
      to: string;
      task: string;
      firstName?: string;
    }
  | {
      ok: false;
      reason: CallIntentFailure;
      message: string;
    };

const HELP_CALL =
  'Try: “Call +1 555-123-4567 and tell them I’m following up about the quote.”';

/** Normalize a typed or spoken US/CA number to E.164, or null. */
export function normalizeNanp(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && /^1[2-9]\d{9}$/.test(digits)) return `+${digits}`;
  if (NANP_E164_RE.test(raw.trim())) return raw.trim();
  return null;
}

/** Display +15551234567 as +1 555-123-4567. */
export function formatNanpDisplay(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+1 ${m[1]}-${m[2]}-${m[3]}`;
}

interface Span {
  e164: string;
  start: number;
  end: number;
}

function findFormattedSpan(text: string): Span | null {
  const re = /\+?1?[\s.-]*\(?([2-9]\d{2})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const e164 = normalizeNanp(`${m[1]}${m[2]}${m[3]}`);
    if (e164) return { e164, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

function findSpokenSpan(text: string): Span | null {
  const re = /[a-z0-9+]+/gi;
  const tokens: Array<{ raw: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    tokens.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
  }

  for (let i = 0; i < tokens.length; i++) {
    let j = i;
    if (tokens[j]!.raw.toLowerCase() === 'plus') j++;
    let digits = '';
    const digitStart = j;
    while (j < tokens.length && DIGIT_WORDS[tokens[j]!.raw.toLowerCase()]) {
      digits += DIGIT_WORDS[tokens[j]!.raw.toLowerCase()]!;
      j++;
    }
    if (j === digitStart) continue;

    const slice =
      digits.length >= 11 && digits.startsWith('1') ? digits.slice(0, 11) : digits.slice(0, 10);
    const e164 = normalizeNanp(slice);
    if (!e164) continue;

    let acc = '';
    let last = digitStart - 1;
    for (let k = digitStart; k < j && acc.length < slice.length; k++) {
      acc += DIGIT_WORDS[tokens[k]!.raw.toLowerCase()] ?? '';
      last = k;
    }
    const startTok = tokens[i]!.raw.toLowerCase() === 'plus' ? i : digitStart;
    return { e164, start: tokens[startTok]!.start, end: tokens[last]!.end };
  }
  return null;
}

function stripTaskPrefix(raw: string): string {
  return raw
    .replace(/^[\s,./:;–—-]+/, '')
    .replace(/^(and\s+)?(tell them|say|ask(?:\s+them)?|let them know)\s+/i, '')
    .replace(/^(about|that|to)\s+/i, '')
    .replace(/^goal(?:\s+is)?\s+/i, '')
    .replace(/^\/\s*/, '')
    .trim()
    .replace(/[.,;]+$/, '')
    .trim();
}

function extractFirstName(before: string): string | undefined {
  const m =
    /\b(?:call|dial|ring|phone)\s+([A-Za-z][A-Za-z'-]{1,30})(?:\s+[A-Za-z][A-Za-z'-]{1,30})?\s*(?:at|on)?\s*$/i.exec(
      before.trim(),
    );
  if (!m) return undefined;
  const first = m[1]!;
  if (NAME_SKIP.has(first.toLowerCase())) return undefined;
  if (DIGIT_WORDS[first.toLowerCase()]) return undefined;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Parse a typed or dictated utterance into { to, task } for /calls/ai-task.
 */
export function parseCallIntent(utterance: string): CallIntentParse {
  const text = utterance.replace(/\s+/g, ' ').trim();
  if (!text) {
    return { ok: false, reason: 'not_a_call', message: HELP_CALL };
  }

  const span = findFormattedSpan(text) ?? findSpokenSpan(text);
  const hasCallVerb = CALL_VERB_RE.test(text);

  if (!span) {
    if (!hasCallVerb) {
      return {
        ok: false,
        reason: 'not_a_call',
        message: `I can place a call for you. ${HELP_CALL}`,
      };
    }
    return {
      ok: false,
      reason: 'no_number',
      message: 'Who should I call? Include a US or Canada number, like +1 555-123-4567.',
    };
  }

  const task = stripTaskPrefix(text.slice(span.end));
  if (task.length < 8) {
    return {
      ok: false,
      reason: 'no_task',
      message:
        'What should I say on the call? Add the goal — for example, “and tell them I’m following up about the quote.”',
    };
  }

  const firstName = extractFirstName(text.slice(0, span.start));
  return {
    ok: true,
    to: span.e164,
    task: task.slice(0, 500),
    ...(firstName ? { firstName } : {}),
  };
}
