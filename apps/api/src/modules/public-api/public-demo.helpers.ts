// ============================================================
// Pure helpers for the public homepage call-me widget.
// Kept separate from the Fastify router so tests don't load config/DB.
// ============================================================

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
