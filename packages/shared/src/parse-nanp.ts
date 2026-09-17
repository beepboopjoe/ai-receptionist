// ============================================================
// Shared US/Canada NANP helpers for dashboard-chat parsers.
// Pure — no I/O. Same E.164 rules as /calls/ai-task and /sms/send.
// ============================================================

export const DIGIT_WORDS: Record<string, string> = {
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

export const NANP_E164_RE = /^\+1[2-9]\d{9}$/;

export const NAME_SKIP = new Set([
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
  'to',
  'from',
  'at',
]);

export interface NanpSpan {
  e164: string;
  start: number;
  end: number;
}

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

function findFormattedSpan(text: string): NanpSpan | null {
  const re = /\+?1?[\s.-]*\(?([2-9]\d{2})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const e164 = normalizeNanp(`${m[1]}${m[2]}${m[3]}`);
    if (e164) return { e164, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

function findSpokenSpan(text: string): NanpSpan | null {
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

/** First typed or spoken NANP in `text`, or null. */
export function findNanpSpan(text: string): NanpSpan | null {
  return findFormattedSpan(text) ?? findSpokenSpan(text);
}

/** Strip “and tell them / goal is …” wrappers from the trailing task. */
export function stripTaskPrefix(raw: string): string {
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

/** First-name guess from “{verb} Maria at …” immediately before the number. */
export function extractFirstNameBefore(before: string, verbRe: RegExp): string | undefined {
  const trimmed = before.trim();
  const m = new RegExp(
    `(?:${verbRe.source})\\s+([A-Za-z][A-Za-z'-]{1,30})(?:\\s+[A-Za-z][A-Za-z'-]{1,30})?\\s*(?:at|on)?\\s*$`,
    'i',
  ).exec(trimmed);
  if (!m) return undefined;
  const first = m[1]!;
  if (NAME_SKIP.has(first.toLowerCase())) return undefined;
  if (DIGIT_WORDS[first.toLowerCase()]) return undefined;
  return first.charAt(0).toUpperCase() + first.slice(1);
}
