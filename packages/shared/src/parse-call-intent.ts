// ============================================================
// Parse a dashboard-chat utterance into a single outbound call.
//
// "Call +1… and tell them I'm following up about X / goal is Y."
// Also accepts spoken digit words from browser dictation.
// Pure — no I/O. US/Canada NANP only (same as /calls/ai-task).
// ============================================================

import {
  extractFirstNameBefore,
  findNanpSpan,
  formatNanpDisplay,
  normalizeNanp,
  stripTaskPrefix,
} from './parse-nanp.js';

export { formatNanpDisplay, normalizeNanp } from './parse-nanp.js';

const CALL_VERB_RE = /\b(?:call|dial|ring|phone)\b/i;

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

export function utteranceHasCallVerb(text: string): boolean {
  return CALL_VERB_RE.test(text);
}

/**
 * Parse a typed or dictated utterance into { to, task } for /calls/ai-task.
 */
export function parseCallIntent(utterance: string): CallIntentParse {
  const text = utterance.replace(/\s+/g, ' ').trim();
  if (!text) {
    return { ok: false, reason: 'not_a_call', message: HELP_CALL };
  }

  const span = findNanpSpan(text);
  const hasCallVerb = utteranceHasCallVerb(text);

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

  const firstName = extractFirstNameBefore(text.slice(0, span.start), CALL_VERB_RE);
  return {
    ok: true,
    to: span.e164,
    task: task.slice(0, 500),
    ...(firstName ? { firstName } : {}),
  };
}
