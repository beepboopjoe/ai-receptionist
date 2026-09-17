// ============================================================
// Inbound SMS keywords — STOP/HELP (carrier norms) and
// vertical escalation vocab (same list the voice agent uses).
// Pure — no I/O. Do not treat this as TCPA/10DLC certification.
// ============================================================

const STOP_WORDS = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
]);

const HELP_WORDS = new Set(['help', 'info']);

export const SMS_OPT_OUT_MARKER = '[sms-opt-out]';

export function normalizeSmsKeyword(body: string): string {
  return body.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** True when the inbound body is a standard opt-out keyword (whole message). */
export function isSmsStopKeyword(body: string): boolean {
  const t = normalizeSmsKeyword(body).replace(/[!.]+$/g, '');
  return STOP_WORDS.has(t);
}

/** True when the inbound body is HELP / INFO (whole message). */
export function isSmsHelpKeyword(body: string): boolean {
  const t = normalizeSmsKeyword(body).replace(/[!.]+$/g, '');
  return HELP_WORDS.has(t);
}

export function notesHaveSmsOptOut(notes: string | null | undefined): boolean {
  return (notes ?? '').includes(SMS_OPT_OUT_MARKER);
}

export function withSmsOptOutNotes(notes: string | null | undefined): string {
  if (notesHaveSmsOptOut(notes)) return notes ?? SMS_OPT_OUT_MARKER;
  const existing = (notes ?? '').trim();
  return existing ? `${existing}\n${SMS_OPT_OUT_MARKER}` : SMS_OPT_OUT_MARKER;
}

/** Case-insensitive substring match against voice-agent escalation vocab. */
export function inboundMatchesEscalationVocab(body: string, vocab: string[]): boolean {
  const lower = body.toLowerCase();
  return vocab.some((word) => word.length >= 3 && lower.includes(word.toLowerCase()));
}
