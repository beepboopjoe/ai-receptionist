// ============================================================
// Document parsers — extract plain text from uploaded files.
//
// Phase 12.8 supports PDF (pdf-parse), DOCX (mammoth), TXT/MD
// (utf-8 decode). Anything else → ValidationError so the upload
// route can return a clean 415.
//
// `pdf-parse` footgun: importing the package root runs an internal
// test that reads a bundled sample PDF. We pull from the lib path
// to avoid that side effect.
// ============================================================
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pdf-parse ships no types for the lib subpath.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { ValidationError } from '../../lib/errors.js';

export const SUPPORTED_MIME = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);

export function extensionForMime(mime: string): string {
  switch (mime) {
    case 'application/pdf': return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'docx';
    case 'text/plain': return 'txt';
    case 'text/markdown':
    case 'text/x-markdown': return 'md';
    default: return 'bin';
  }
}

/** Best-effort mime sniff for files served without one (some clients send octet-stream). */
export function sniffMime(filename: string, providedMime: string): string {
  if (providedMime && providedMime !== 'application/octet-stream') return providedMime;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf'))  return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.md'))   return 'text/markdown';
  if (lower.endsWith('.txt'))  return 'text/plain';
  return providedMime || 'application/octet-stream';
}

export async function parseDocument(mime: string, buffer: Buffer): Promise<string> {
  switch (mime) {
    case 'application/pdf':
      return parsePdf(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return parseDocx(buffer);
    case 'text/plain':
    case 'text/markdown':
    case 'text/x-markdown':
      return parseText(buffer);
    default:
      throw new ValidationError(`Unsupported document type: ${mime}`);
  }
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const result = (await pdfParse(buffer)) as { text: string };
  return normalizeWhitespace(result.text);
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeWhitespace(result.value);
}

function parseText(buffer: Buffer): string {
  return normalizeWhitespace(buffer.toString('utf-8'));
}

/** Collapse runs of whitespace; preserve paragraph breaks. Keeps embeddings sane. */
function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
