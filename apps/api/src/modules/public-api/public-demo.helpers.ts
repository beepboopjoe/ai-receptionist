// ============================================================
// Pure helpers for the public homepage call-me widget.
// Kept separate from the Fastify router so tests don't load config/DB.
// ============================================================

/** Spoken persona on homepage call-me / DEMO_TENANT. Paying tenants keep their own name. */
export const DEMO_AGENT_NAME = 'Telfin';

/** Every public call-me dial uses Aurora. Tenants may still pick the other three. */
export const DEMO_DEFAULT_VOICE = 'aurora' as const;

/**
 * Short anti-double-click lock per number. Intentional second submits are
 * allowed after this window — do not use an hour-long lock, and do not
 * auto-redial. DEMO_SKIP_COOLDOWN remains ops-only.
 */
export const DEMO_CALL_ME_NUM_COOLDOWN_SECONDS = 8;

/** NANP: +1 then 10 digits, area code cannot start with 0 or 1. */
export const US_CA_E164 = /^\+1[2-9]\d{9}$/;

const JUNK_EXACT = new Set([
  '1234567890',
  '0123456789',
  '9876543210',
  '0000000000',
  '1111111111',
  '5555555555',
]);

/**
 * Strip formatting and accept 10-digit or 11-digit (leading 1) US/CA numbers.
 * Returns E.164 (+1XXXXXXXXXX) or null if the number is not US/CA.
 */
export function normalizeUsCaPhone(input: string): string | null {
  const digits = (input ?? '').replace(/\D/g, '');
  let national = digits;
  if (national.length === 11 && national.startsWith('1')) {
    national = national.slice(1);
  }
  if (national.length !== 10) return null;
  const e164 = `+1${national}`;
  return US_CA_E164.test(e164) ? e164 : null;
}

/** Fictional / obviously-invalid numbers we refuse to dial. */
export function isJunkDemoNumber(e164: string): boolean {
  const national = e164.replace(/^\+1/, '');
  if (JUNK_EXACT.has(national)) return true;
  if (/^(\d)\1{9}$/.test(national)) return true;
  if (national.slice(3, 6) === '555') return true;
  if (national.startsWith('555')) return true;
  return false;
}

/** Postgres FK violation (e.g. calls.tenant_id → tenants.id). */
export function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23503'
  );
}

/** True for ops/testing flags: `1` / `true` / `yes` (case-insensitive, trimmed). */
export function isTruthyEnv(value: string | undefined | null): boolean {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

/** Redis key globs for the homepage call-me cooldown + daily cap. */
export const DEMO_CALL_ME_KEY_PATTERNS = ['demo:call-me:num:*', 'demo:call-me:day:*'] as const;

/** Minimal ioredis surface so boot-clear is unit-testable without a live Redis. */
export interface DemoCallMeRedis {
  status?: string;
  connect?: () => Promise<unknown>;
  scan: (cursor: string | number, ...args: Array<string | number>) => Promise<[string, string[]]>;
  del: (...keys: string[]) => Promise<number>;
}

/**
 * SCAN+DEL leftover call-me keys. Safe no-op when Redis is empty.
 * Returns the number of keys actually deleted.
 */
export async function scanDelDemoCallMeKeys(redis: DemoCallMeRedis): Promise<number> {
  let deleted = 0;
  for (const pattern of DEMO_CALL_ME_KEY_PATTERNS) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = String(next);
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');
  }
  return deleted;
}

export interface DemoCallMeBootLog {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

/**
 * When `enabled`, connect if Redis is still lazy (`wait`) then SCAN+DEL
 * call-me keys. Never throws — boot must continue if Redis is empty or down.
 */
export async function maybeClearDemoCallMeCooldownsOnBoot(
  enabled: boolean,
  redis: DemoCallMeRedis,
  log?: DemoCallMeBootLog,
): Promise<number> {
  if (!enabled) return 0;
  try {
    if (redis.status === 'wait' && typeof redis.connect === 'function') {
      await redis.connect();
    }
    const deleted = await scanDelDemoCallMeKeys(redis);
    log?.info({ deleted }, 'DEMO_CLEAR_COOLDOWNS_ON_BOOT deleted demo call-me Redis keys');
    return deleted;
  } catch (err) {
    log?.warn({ err }, 'DEMO_CLEAR_COOLDOWNS_ON_BOOT failed — continuing boot');
    return 0;
  }
}

/** Top-level string for logs — Railway often strips nested `err` fields. */
export function errMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Log-safe last-4 of a phone. Empty → `unset`. Never the full number. */
export function maskPhoneLast4(phone: string | undefined | null): string {
  const trimmed = (phone ?? '').trim();
  if (!trimmed) return 'unset';
  return `***${trimmed.slice(-4)}`;
}

/** Cap carrier HTTP bodies so Error.message stays ~2k (Railway / pino). */
export const CARRIER_ERROR_MAX_CHARS = 2000;

export function clipCarrierErrorBody(
  text: string,
  max = CARRIER_ERROR_MAX_CHARS,
): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export interface PublicCallMeDialFailureLog {
  httpStatus: number | null;
  bodyClipped: string;
  apiKeyPresent: boolean;
  apiKeyLen: number;
  apiKeyPrefix: string;
  strippedWhitespace: boolean;
  strippedQuotes: boolean;
  strippedBearerPrefix: boolean;
  keySanitized: boolean;
  connectionIdPresent: boolean;
  fromMasked: string;
}

/**
 * Railway's log ingest (MCP + dashboard filter) only keeps pino `msg`.
 * Put every ops field in the message string AND return them as
 * top-level structured fields so neither path is stripped.
 */
export function formatPublicCallMeDialFailureLog(
  fields: PublicCallMeDialFailureLog,
): { message: string; fields: PublicCallMeDialFailureLog } {
  const httpStatus = fields.httpStatus ?? 'unset';
  const body = fields.bodyClipped || 'empty';
  const prefix = fields.apiKeyPrefix || 'none';
  const message = [
    'Public call-me Telnyx dial failed',
    `httpStatus=${httpStatus}`,
    `apiKeyPresent=${fields.apiKeyPresent}`,
    `apiKeyLen=${fields.apiKeyLen}`,
    `apiKeyPrefix=${prefix}`,
    `keySanitized=${fields.keySanitized}`,
    `strippedQuotes=${fields.strippedQuotes}`,
    `strippedWhitespace=${fields.strippedWhitespace}`,
    `strippedBearerPrefix=${fields.strippedBearerPrefix}`,
    `connectionIdPresent=${fields.connectionIdPresent}`,
    `fromMasked=${fields.fromMasked}`,
    `body=${body}`,
  ].join(' ');
  return { message, fields };
}

const CALL_ME_DIAL_GENERIC =
  "We couldn't place the call right now. Hear a sample instead, or try again in a minute.";
const CALL_ME_DIAL_LOCALHOST =
  "We couldn't place the call because this API's public URL is localhost — the phone network can't reach it. Set APP_URL or API_PUBLIC_URL to the public HTTPS origin.";
const CALL_ME_DIAL_CREDENTIALS =
  "We couldn't place the call — phone credentials look wrong. Hear a sample instead.";
const CALL_ME_DIAL_FROM_CONNECTION =
  "We couldn't place the call — the demo number isn't assigned to this phone connection. Hear a sample instead.";
const CALL_ME_DIAL_VALIDATION =
  "We couldn't place the call — the number or setup didn't pass validation. Hear a sample instead.";

/**
 * Short 502 copy from a carrier Error.message. Never echoes the Telnyx body
 * (keys, connection ids, full numbers).
 */
export function publicCallMeDialFailureMessage(
  errMessage: string,
  opts: { localhostOrigin: boolean },
): string {
  if (opts.localhostOrigin) return CALL_ME_DIAL_LOCALHOST;

  const msg = errMessage.toLowerCase();

  if (/\b401\b/.test(msg) || /\b403\b/.test(msg)) {
    return CALL_ME_DIAL_CREDENTIALS;
  }

  const mentionsFromMismatch =
    msg.includes('invalid from') ||
    msg.includes('from number') ||
    msg.includes("'from'") ||
    msg.includes('"from"') ||
    (msg.includes('from') &&
      (msg.includes('not associated') ||
        msg.includes('not assigned') ||
        msg.includes('not owned') ||
        msg.includes('does not belong')));

  if (msg.includes('connection') || mentionsFromMismatch) {
    return CALL_ME_DIAL_FROM_CONNECTION;
  }

  if (/\b422\b/.test(msg)) {
    return CALL_ME_DIAL_VALIDATION;
  }

  return CALL_ME_DIAL_GENERIC;
}
