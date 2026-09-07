// ============================================================
// xAI / Grok API key sanitization + handshake diagnostics.
//
// Railway / dotenv pastes sometimes wrap XAI_API_KEY in quotes,
// trailing newlines, or a "Bearer " prefix. We used to send
// `Authorization: Bearer ${raw}` unchanged.
//
// Never log `key`. Diagnostics expose only present / length /
// first 4 characters (typically "xai-") and whether cleanup ran.
// ============================================================

export const XAI_LOG_BODY_MAX_CHARS = 500;
export const DEFAULT_GROK_REALTIME_MODEL = 'grok-voice-think-fast-1.0';
export const GROK_REALTIME_BASE = 'wss://api.x.ai/v1/realtime';

/** Degraded-mode sentinel from resolveConfig — not a real xAI key. */
export const XAI_PLACEHOLDER_KEY = 'unconfigured';

export interface XaiApiKeyDiagnostics {
  /** Sanitized secret. NEVER log or serialize this field. */
  key: string;
  apiKeyPresent: boolean;
  apiKeyLen: number;
  /** First 4 chars of the sanitized key (e.g. "xai-"). Empty if missing. */
  apiKeyPrefix: string;
  strippedWhitespace: boolean;
  strippedQuotes: boolean;
  strippedBearerPrefix: boolean;
  /** True when the value is the degraded-mode placeholder, not a real key. */
  placeholder: boolean;
}

/** Log-safe slice of diagnostics — no `key`. */
export type XaiApiKeyLogFields = Omit<XaiApiKeyDiagnostics, 'key'> & {
  keySanitized: boolean;
};

/**
 * Trim, strip one pair of surrounding quotes, strip a leading
 * `Bearer ` prefix. Do not rewrite a non-xai- prefix — we only
 * report it.
 */
export function inspectXaiApiKey(raw: string | undefined | null): XaiApiKeyDiagnostics {
  const original = raw ?? '';
  let key = original.replace(/^\uFEFF/, '');
  let strippedWhitespace = original !== original.trim() || key !== original;
  let strippedQuotes = false;
  let strippedBearerPrefix = false;

  key = key.trim();
  if (key !== original.replace(/^\uFEFF/, '')) {
    strippedWhitespace = true;
  }

  const quoted = stripSurroundingQuotes(key);
  if (quoted.stripped) {
    strippedQuotes = true;
    key = quoted.value;
    const retrim = key.trim();
    if (retrim !== key) {
      strippedWhitespace = true;
      key = retrim;
    }
  }

  const bearer = key.match(/^Bearer\s+/i);
  if (bearer) {
    strippedBearerPrefix = true;
    key = key.slice(bearer[0].length);
    const retrim = key.trim();
    if (retrim !== key) {
      strippedWhitespace = true;
      key = retrim;
    }
    const inner = stripSurroundingQuotes(key);
    if (inner.stripped) {
      strippedQuotes = true;
      key = inner.value.trim();
    }
  }

  const placeholder = key.length > 0 && key.toLowerCase() === XAI_PLACEHOLDER_KEY;
  return {
    key,
    apiKeyPresent: key.length > 0 && !placeholder,
    apiKeyLen: key.length,
    apiKeyPrefix: key.slice(0, 4),
    strippedWhitespace,
    strippedQuotes,
    strippedBearerPrefix,
    placeholder,
  };
}

export function xaiApiKeyLogFields(raw: string | undefined | null): XaiApiKeyLogFields {
  const d = inspectXaiApiKey(raw);
  return {
    apiKeyPresent: d.apiKeyPresent,
    apiKeyLen: d.apiKeyLen,
    apiKeyPrefix: d.apiKeyPrefix,
    strippedWhitespace: d.strippedWhitespace,
    strippedQuotes: d.strippedQuotes,
    strippedBearerPrefix: d.strippedBearerPrefix,
    placeholder: d.placeholder,
    keySanitized: d.strippedWhitespace || d.strippedQuotes || d.strippedBearerPrefix,
  };
}

/**
 * `Authorization` value. Always `Bearer <sanitized>` when a real key
 * is present. Placeholder / empty → empty string (do not send).
 */
export function xaiAuthorizationHeader(raw: string | undefined | null): string {
  const { key, apiKeyPresent } = inspectXaiApiKey(raw);
  return apiKeyPresent ? `Bearer ${key}` : '';
}

export function redactXaiSecrets(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/xai-[A-Za-z0-9_\-]+/g, 'xai-[redacted]');
}

export function clipXaiLogBody(text: string, max = XAI_LOG_BODY_MAX_CHARS): string {
  const cleaned = redactXaiSecrets(text.replace(/\s+/g, ' ').trim());
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

export function resolveGrokRealtimeModel(override?: string | null): string {
  const raw = (override ?? '').trim();
  return raw || DEFAULT_GROK_REALTIME_MODEL;
}

export function buildGrokRealtimeUrl(model?: string | null): string {
  return `${GROK_REALTIME_BASE}?model=${encodeURIComponent(resolveGrokRealtimeModel(model))}`;
}

export function httpStatusFromWsConnectError(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const match = msg.match(/Unexpected server response:\s*(\d{3})/i);
  return match ? Number(match[1]) : null;
}

/**
 * Drain a failed WebSocket upgrade response so we can log a clipped
 * body. Caps bytes and time so a hung socket cannot stall the call.
 */
export function collectLimitedHttpBody(
  res: {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
  },
  maxBytes = 2048,
  timeoutMs = 1500,
): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let n = 0;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    };

    res.on('data', (chunk: unknown) => {
      if (n >= maxBytes) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ''));
      const take = buf.subarray(0, maxBytes - n);
      chunks.push(take);
      n += take.length;
    });
    res.on('end', finish);
    res.on('error', finish);
    setTimeout(finish, timeoutMs);
  });
}

function stripSurroundingQuotes(value: string): { value: string; stripped: boolean } {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return { value: value.slice(1, -1), stripped: true };
    }
  }
  return { value, stripped: false };
}
