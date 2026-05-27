// ============================================================
// Naive sliding-window chunker.
//
// Splits text into ~500-char chunks with 50-char overlap so a fact
// straddling a chunk boundary appears in both. Char-based for V1;
// upgrade to a token-aware tokenizer (e.g. tiktoken) in 12.8.1
// when we want tighter control of OpenAI embed-input budgets.
//
// Strategy: prefer breaks at paragraph then sentence then space
// boundaries within ±chunkSize/4 of the target, otherwise hard-cut.
// ============================================================

export interface ChunkOptions {
  /** Target chunk size in characters. */
  size?: number;
  /** Overlap between adjacent chunks in characters. */
  overlap?: number;
}

const DEFAULT_SIZE = 500;
const DEFAULT_OVERLAP = 50;

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const size = opts.size ?? DEFAULT_SIZE;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;
  if (size <= 0) throw new Error('chunkText: size must be > 0');
  if (overlap < 0 || overlap >= size) throw new Error('chunkText: 0 <= overlap < size');

  const cleaned = text.trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= size) return [cleaned];

  const chunks: string[] = [];
  const stride = size - overlap;
  let cursor = 0;

  while (cursor < cleaned.length) {
    const end = Math.min(cleaned.length, cursor + size);
    const slice = cleaned.slice(cursor, end);
    if (end < cleaned.length) {
      // Prefer to break at a paragraph → sentence → whitespace boundary in the back third.
      const breakAt = findSoftBreak(slice);
      const adjusted = breakAt !== -1 ? slice.slice(0, breakAt + 1).trimEnd() : slice;
      chunks.push(adjusted);
      cursor += Math.max(stride, breakAt === -1 ? stride : breakAt + 1 - overlap);
    } else {
      const trimmed = slice.trim();
      if (trimmed.length > 0) chunks.push(trimmed);
      break;
    }
  }
  return chunks;
}

function findSoftBreak(s: string): number {
  // Search the back third for a paragraph break, then sentence end, then space.
  const start = Math.floor(s.length * (2 / 3));
  const paragraph = s.lastIndexOf('\n\n');
  if (paragraph >= start) return paragraph;
  const sentence = Math.max(s.lastIndexOf('. '), s.lastIndexOf('! '), s.lastIndexOf('? '));
  if (sentence >= start) return sentence;
  const space = s.lastIndexOf(' ');
  if (space >= start) return space;
  return -1;
}
