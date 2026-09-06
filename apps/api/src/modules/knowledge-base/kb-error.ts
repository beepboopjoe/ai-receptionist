// Sanitize KB processing errors before they are stored or returned to the UI.
// Vendor bodies (OpenAI 401, raw API keys) must never reach the dashboard.

const LEAK_PATTERNS = [
  /api[_-]?key/i,
  /sk-[a-z0-9]/i,
  /openai/i,
  /unauthorized/i,
  /incorrect api key/i,
  /embeddings call failed/i,
  /integration error/i,
  /bearer /i,
  /stack/i,
];

export const KB_PROCESSING_UNAVAILABLE =
  'Document processing unavailable — contact support. You can try Reprocess.';

export function sanitizeKbErrorMessage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const leaked = LEAK_PATTERNS.some((re) => re.test(raw)) || raw.includes('{') || raw.length > 180;
  if (leaked) return KB_PROCESSING_UNAVAILABLE;
  return raw;
}
