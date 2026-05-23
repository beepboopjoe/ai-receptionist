// ============================================================
// Curation Wizard — synth + parse utilities.
//
// We wrap the wizard's output in HTML-comment anchor lines so we
// can round-trip:
//   • synthesize() — turn answers into a sectioned text block
//     wrapped in <!-- agent-curation-v1 --> markers
//   • parseContextToAnswers() — pull the block out of an
//     existing business_context string and split it back into a
//     {questionId: answer} map for pre-filling the wizard
//
// Custom prose outside the markers is preserved on save — a user
// can append their own notes below the curation block and they'll
// survive a re-run of the wizard.
// ============================================================
import type { CurationQuestion } from './agent-curation-questions';

const OPEN = '<!-- agent-curation-v1 -->';
const CLOSE = '<!-- /agent-curation-v1 -->';
// Regex variants for replacement / detection.
const BLOCK_RE = /<!--\s*agent-curation-v1\s*-->[\s\S]*?<!--\s*\/agent-curation-v1\s*-->/;

/**
 * Turn a {questionId: answer} map into a sectioned markdown block
 * wrapped in anchor comments. Empty answers are skipped entirely.
 * If `existing` already contains a curation block, replace it in
 * place; otherwise append to the end (preserving any prose the
 * user wrote outside the block).
 */
export function synthesizeContext(
  questions: CurationQuestion[],
  answers: Record<string, string>,
  existing: string
): string {
  const sections = questions
    .map((q) => {
      const a = (answers[q.id] ?? '').trim();
      if (!a) return null;
      return `## ${q.sectionTitle}\n${a}`;
    })
    .filter(Boolean)
    .join('\n\n');

  if (sections.length === 0) {
    // Nothing answered — remove any existing block, leave prose as-is.
    return existing.replace(BLOCK_RE, '').trim();
  }

  const block = `${OPEN}\n${sections}\n${CLOSE}`;

  if (BLOCK_RE.test(existing)) {
    return existing.replace(BLOCK_RE, block);
  }
  return existing.trim() ? `${existing.trim()}\n\n${block}` : block;
}

/**
 * Extract the curation block from an existing business_context string
 * and split it back into a {questionId: answer} map. Returns {} when
 * no block is found (first-time wizard run).
 *
 * Section matching is by `sectionTitle` — must be byte-identical to
 * the question's sectionTitle in the question definitions file. This
 * is why we treat sectionTitle as a stable contract: changing one
 * silently breaks the round-trip for existing tenants.
 */
export function parseContextToAnswers(
  questions: CurationQuestion[],
  existing: string
): Record<string, string> {
  const match = existing.match(BLOCK_RE);
  if (!match) return {};
  // Strip the OPEN/CLOSE wrappers; what's left is the inner content.
  const inner = match[0]
    .replace(OPEN, '')
    .replace(CLOSE, '')
    .trim();

  // Split on lines that start with '## '. Each chunk after a heading
  // belongs to that heading. We walk the lines once for clarity.
  const lines = inner.split('\n');
  const answers: Record<string, string> = {};
  let currentTitle: string | null = null;
  let buffer: string[] = [];

  function flush() {
    if (currentTitle === null) return;
    const text = buffer.join('\n').trim();
    const q = questions.find((qq) => qq.sectionTitle === currentTitle);
    if (q && text.length > 0) {
      answers[q.id] = text;
    }
    buffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith('## ')) {
      flush();
      currentTitle = line.slice(3).trim();
      continue;
    }
    if (currentTitle !== null) {
      buffer.push(line);
    }
  }
  flush();

  return answers;
}
