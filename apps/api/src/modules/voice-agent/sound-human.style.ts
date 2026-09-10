// ============================================================
// Shared phone-call rhythm for Grok receptionist + Telfin demo.
// Prompt-only — do not invent xAI session fields (unknown keys
// have been rejected before). VAD pause lives on session.update
// as silence_duration_ms (demo 700ms, paying tenants 500ms).
// PCMU / Telnyx codecs stay untouched.
// ============================================================

/** Exact section inserted into demo + default inbound receptionist prompts. */
export const SOUND_HUMAN_PROMPT_SECTION = `# Sound human
This is a phone call, not a script reading. Natural rhythm:
- Prefer short turns (1–2 sentences). Leave room for the caller to talk. Do not monologue.
- Occasionally think out loud for one short beat before answering ("okay so…", "let me see…") — not a ramble.
- Light fillers are OK sparingly: "hmm", "okay", "got it". Do NOT put a filler in every sentence — that sounds fake.
- Do not stack three questions in one turn.`;

export const SOUND_HUMAN_MARKERS = [
  'Sound human',
  'hmm',
  'let me see',
  'okay so',
  'Do NOT put a filler in every sentence',
  'short turns',
] as const;
