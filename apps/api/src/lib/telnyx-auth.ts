// ============================================================
// Telnyx API key sanitization + Authorization header.
//
// Railway / dotenv pastes sometimes wrap TELNYX_API_KEY in quotes,
// trailing newlines, or a "Bearer " prefix. We used to send
// `Authorization: Bearer ${raw}` unchanged, which 401s when the
// stored value is `"KEY…"`, `Bearer KEY…`, or `KEY…\n`.
//
// Never log `key`. Diagnostics expose only present / length / first
// 3 characters (typically "KEY") and whether cleanup ran.
// ============================================================

export const TELNYX_LOG_BODY_MAX_CHARS = 500;

export interface TelnyxApiKeyDiagnostics {
  /** Sanitized secret. NEVER log or serialize this field. */
  key: string;
  apiKeyPresent: boolean;
  apiKeyLen: number;
  /** First 3 chars of the sanitized key (e.g. "KEY"). Empty if missing. */
  apiKeyPrefix: string;
  strippedWhitespace: boolean;
  strippedQuotes: boolean;
  strippedBearerPrefix: boolean;
}

/** Log-safe slice of diagnostics — no `key`. */
export type TelnyxApiKeyLogFields = Omit<TelnyxApiKeyDiagnostics, 'key'> & {
  keySanitized: boolean;
};

/**
 * Trim, strip one pair of surrounding quotes, strip a leading
 * `Bearer ` prefix. A key that does not start with `KEY` is kept
 * as-is — Telnyx accepts that shape; we do not rewrite it.
 */
export function inspectTelnyxApiKey(raw: string | undefined | null): TelnyxApiKeyDiagnostics {
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

  return {
    key,
    apiKeyPresent: key.length > 0,
    apiKeyLen: key.length,
    apiKeyPrefix: key.slice(0, 3),
    strippedWhitespace,
    strippedQuotes,
    strippedBearerPrefix,
  };
}

export function telnyxApiKeyLogFields(
  raw: string | undefined | null,
): TelnyxApiKeyLogFields {
  const d = inspectTelnyxApiKey(raw);
  return {
    apiKeyPresent: d.apiKeyPresent,
    apiKeyLen: d.apiKeyLen,
    apiKeyPrefix: d.apiKeyPrefix,
    strippedWhitespace: d.strippedWhitespace,
    strippedQuotes: d.strippedQuotes,
    strippedBearerPrefix: d.strippedBearerPrefix,
    keySanitized: d.strippedWhitespace || d.strippedQuotes || d.strippedBearerPrefix,
  };
}

/**
 * `Authorization` value. Always `Bearer <sanitized>` when a key is
 * present. If the env value already started with `Bearer `, that
 * prefix is stripped first so we never send `Bearer Bearer …`.
 * Empty key → empty string (caller should not send the header).
 */
export function telnyxAuthorizationHeader(raw: string | undefined | null): string {
  const { key } = inspectTelnyxApiKey(raw);
  return key ? `Bearer ${key}` : '';
}

export function clipTelnyxLogBody(
  text: string,
  max = TELNYX_LOG_BODY_MAX_CHARS,
): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export class TelnyxHttpError extends Error {
  readonly httpStatus: number;
  readonly bodyClipped: string;
  readonly path: string;

  constructor(path: string, httpStatus: number, body: string) {
    const bodyClipped = clipTelnyxLogBody(body);
    super(`Carrier ${path} → ${httpStatus}: ${bodyClipped}`);
    this.name = 'TelnyxHttpError';
    this.httpStatus = httpStatus;
    this.bodyClipped = bodyClipped;
    this.path = path;
  }
}

export function telnyxFailureFields(err: unknown): {
  httpStatus: number | null;
  bodyClipped: string;
} {
  if (err instanceof TelnyxHttpError) {
    return { httpStatus: err.httpStatus, bodyClipped: err.bodyClipped };
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/→\s*(\d{3}):\s*([\s\S]*)$/);
  if (match) {
    return {
      httpStatus: Number(match[1]),
      bodyClipped: clipTelnyxLogBody(match[2] ?? ''),
    };
  }
  return { httpStatus: null, bodyClipped: '' };
}

const TELNYX_API = 'https://api.telnyx.com/v2';

export interface TelnyxAuthProbeResult extends TelnyxApiKeyLogFields {
  ok: boolean;
  httpStatus: number | null;
  bodyClipped: string;
  connectionIdPresent: boolean;
}

/**
 * Lightweight Telnyx credential check — GET /v2/balance.
 * Does not place a call. Safe for platform-admin ops.
 */
export async function probeTelnyxAuth(
  apiKeyRaw: string | undefined | null,
  connectionId?: string | undefined | null,
): Promise<TelnyxAuthProbeResult> {
  const fields = telnyxApiKeyLogFields(apiKeyRaw);
  const connectionIdPresent = Boolean(connectionId?.trim());
  const header = telnyxAuthorizationHeader(apiKeyRaw);
  if (!header) {
    return {
      ...fields,
      ok: false,
      httpStatus: null,
      bodyClipped: 'TELNYX_API_KEY is empty',
      connectionIdPresent,
    };
  }

  try {
    const res = await fetch(`${TELNYX_API}/balance`, {
      method: 'GET',
      headers: {
        Authorization: header,
        Accept: 'application/json',
      },
    });
    const bodyClipped = clipTelnyxLogBody(await res.text());
    return {
      ...fields,
      ok: res.ok,
      httpStatus: res.status,
      bodyClipped,
      connectionIdPresent,
    };
  } catch (err) {
    return {
      ...fields,
      ok: false,
      httpStatus: null,
      bodyClipped: clipTelnyxLogBody(err instanceof Error ? err.message : String(err)),
      connectionIdPresent,
    };
  }
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
