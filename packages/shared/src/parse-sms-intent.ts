// ============================================================
// Parse a dashboard-chat utterance into a single outbound SMS.
//
// "Text +1… and tell them X / goal Y"
// Also accepts spoken digit words from browser dictation.
// Pure — no I/O. US/Canada NANP only (same as /sms/send).
// ============================================================

import { parseCallIntent, type CallIntentParse } from './parse-call-intent.js';
import {
  extractFirstNameBefore,
  findNanpSpan,
  stripTaskPrefix,
} from './parse-nanp.js';

const TEXT_VERB_RE = /\b(text|sms|txt|texting)\b/i;
const SEND_TEXT_RE = /\bsend\s+(?:a|an|them\s+a)?\s*(text|sms|message)\b/i;
const TEXT_NAME_VERB_RE = /\b(?:text|sms|txt|texting|message)\b/i;

export type SmsIntentFailure = 'no_number' | 'no_task' | 'not_a_text';

export type SmsIntentParse =
  | {
      ok: true;
      to: string;
      task: string;
      firstName?: string;
    }
  | {
      ok: false;
      reason: SmsIntentFailure;
      message: string;
    };

const HELP_TEXT =
  'Try: “Text +1 555-123-4567 and tell them I’m following up about the quote.”';

const HELP_EITHER =
  'I can call or text from your business number. Try: “Call +1 555-123-4567 and tell them I’m following up about the quote,” or “Text +1 555-123-4567 and tell them the same.”';

export function utteranceHasTextVerb(text: string): boolean {
  return TEXT_VERB_RE.test(text) || SEND_TEXT_RE.test(text);
}

export function parseSmsIntent(utterance: string): SmsIntentParse {
  const text = utterance.replace(/\s+/g, ' ').trim();
  if (!text) {
    return { ok: false, reason: 'not_a_text', message: HELP_TEXT };
  }

  const span = findNanpSpan(text);
  const hasTextVerb = utteranceHasTextVerb(text);

  if (!span) {
    if (!hasTextVerb) {
      return {
        ok: false,
        reason: 'not_a_text',
        message: `I can send a text for you. ${HELP_TEXT}`,
      };
    }
    return {
      ok: false,
      reason: 'no_number',
      message: 'Who should I text? Include a US or Canada number, like +1 555-123-4567.',
    };
  }

  const task = stripTaskPrefix(text.slice(span.end));
  if (task.length < 8) {
    return {
      ok: false,
      reason: 'no_task',
      message:
        'What should the text say? Add the goal — for example, “and tell them I’m following up about the quote.”',
    };
  }

  const before = text.slice(0, span.start);
  const firstName =
    extractFirstNameBefore(before, TEXT_NAME_VERB_RE) ??
    extractFirstNameBefore(before, /\bsend\s+(?:a\s+)?(?:text|sms|message)\s+to\b/i);

  return {
    ok: true,
    to: span.e164,
    task: task.slice(0, 320),
    ...(firstName ? { firstName } : {}),
  };
}

export type DashboardIntentKind = 'call' | 'sms';

export type DashboardIntentParse =
  | {
      ok: true;
      kind: DashboardIntentKind;
      to: string;
      task: string;
      firstName?: string;
    }
  | {
      ok: false;
      reason: 'no_number' | 'no_task' | 'not_an_intent';
      message: string;
    };

function firstIntentKind(text: string): DashboardIntentKind | null {
  const textIdx = (() => {
    const a = TEXT_VERB_RE.exec(text);
    const b = SEND_TEXT_RE.exec(text);
    if (a && b) return Math.min(a.index, b.index);
    if (a) return a.index;
    if (b) return b.index;
    return -1;
  })();
  const callIdx = (() => {
    const m = /\b(call|dial|ring|phone)\b/i.exec(text);
    return m ? m.index : -1;
  })();

  if (textIdx >= 0 && callIdx >= 0) return textIdx < callIdx ? 'sms' : 'call';
  if (textIdx >= 0) return 'sms';
  if (callIdx >= 0) return 'call';
  return null;
}

function fromCall(parsed: CallIntentParse): DashboardIntentParse {
  if (parsed.ok) {
    return {
      ok: true,
      kind: 'call',
      to: parsed.to,
      task: parsed.task,
      ...(parsed.firstName ? { firstName: parsed.firstName } : {}),
    };
  }
  if (parsed.reason === 'not_a_call') {
    return { ok: false, reason: 'not_an_intent', message: HELP_EITHER };
  }
  return { ok: false, reason: parsed.reason, message: parsed.message };
}

function fromSms(parsed: SmsIntentParse): DashboardIntentParse {
  if (parsed.ok) {
    return {
      ok: true,
      kind: 'sms',
      to: parsed.to,
      task: parsed.task,
      ...(parsed.firstName ? { firstName: parsed.firstName } : {}),
    };
  }
  if (parsed.reason === 'not_a_text') {
    return { ok: false, reason: 'not_an_intent', message: HELP_EITHER };
  }
  return { ok: false, reason: parsed.reason, message: parsed.message };
}

/**
 * Parse Ask Telfin chat into a call or a text. Verb order wins when both
 * “call” and “text” appear. Billing/help questions are not an intent.
 */
export function parseDashboardIntent(utterance: string): DashboardIntentParse {
  const text = utterance.replace(/\s+/g, ' ').trim();
  if (!text) {
    return { ok: false, reason: 'not_an_intent', message: HELP_EITHER };
  }

  const kind = firstIntentKind(text);
  if (kind === 'sms') return fromSms(parseSmsIntent(text));
  if (kind === 'call') return fromCall(parseCallIntent(text));

  return { ok: false, reason: 'not_an_intent', message: HELP_EITHER };
}
