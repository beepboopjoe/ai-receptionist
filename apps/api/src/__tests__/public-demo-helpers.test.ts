// ============================================================
// Pure-function tests for the public call-me phone helpers.
// No Fastify / DB — route behavior is env-gated in production.
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import {
  normalizeUsCaPhone,
  isJunkDemoNumber,
  US_CA_E164,
  isTruthyEnv,
  isForeignKeyViolation,
  scanDelDemoCallMeKeys,
  maybeClearDemoCallMeCooldownsOnBoot,
  type DemoCallMeRedis,
} from '../modules/public-api/public-demo.helpers.js';

describe('normalizeUsCaPhone', () => {
  it.each([
    ['4155551234', '+14155551234'],
    ['14155551234', '+14155551234'],
    ['+1 (415) 555-1234', '+14155551234'],
    ['415-555-1234', '+14155551234'],
    ['(604) 555-0199', '+16045550199'],
  ])('accepts %p → %p', (input, expected) => {
    expect(normalizeUsCaPhone(input)).toBe(expected);
  });

  it.each([
    [''],
    ['5551234'],
    ['+442071838750'],
    ['+1'],
    ['0115551234'], // area code cannot start with 0 or 1
    ['1155551234'],
  ])('rejects %p', (input) => {
    expect(normalizeUsCaPhone(input)).toBeNull();
  });
});

describe('US_CA_E164', () => {
  it('matches normalized E.164', () => {
    expect(US_CA_E164.test('+14155551234')).toBe(true);
    expect(US_CA_E164.test('+10155551234')).toBe(false);
    expect(US_CA_E164.test('14155551234')).toBe(false);
  });
});

describe('isJunkDemoNumber', () => {
  it('flags fictional and sequential numbers', () => {
    expect(isJunkDemoNumber('+15555551234')).toBe(true);
    expect(isJunkDemoNumber('+14155551234')).toBe(true); // 555 exchange
    expect(isJunkDemoNumber('+11234567890')).toBe(true);
    expect(isJunkDemoNumber('+10000000000')).toBe(true);
    expect(isJunkDemoNumber('+11111111111')).toBe(true);
  });

  it('allows a plausible NANP mobile', () => {
    expect(isJunkDemoNumber('+14155551212')).toBe(true); // still 555
    expect(isJunkDemoNumber('+14153211212')).toBe(false);
    expect(isJunkDemoNumber('+16043211212')).toBe(false);
  });
});

describe('isForeignKeyViolation', () => {
  it('detects pg code 23503', () => {
    expect(isForeignKeyViolation({ code: '23503' })).toBe(true);
  });

  it('rejects other inputs', () => {
    expect(isForeignKeyViolation({ code: '23505' })).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation({})).toBe(false);
  });
});

describe('isTruthyEnv', () => {
  it.each(['1', 'true', 'yes', 'TRUE', 'Yes', '  true  ', 'YES'])(
    'treats %p as on',
    (value) => {
      expect(isTruthyEnv(value)).toBe(true);
    },
  );

  it.each(['', '0', 'false', 'no', 'off', '   ', undefined, null])(
    'treats %p as off',
    (value) => {
      expect(isTruthyEnv(value)).toBe(false);
    },
  );
});

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function createFakeRedis(
  initial: Record<string, string>,
  opts?: { pageSize?: number; failScan?: boolean; status?: string },
): DemoCallMeRedis & { store: Map<string, string>; connect: ReturnType<typeof vi.fn> } {
  const store = new Map(Object.entries(initial));
  const pageSize = opts?.pageSize ?? 1000;
  let snapshot: string[] = [];
  return {
    status: opts?.status ?? 'ready',
    store,
    connect: vi.fn().mockResolvedValue(undefined),
    async scan(cursor: string | number, ...args: Array<string | number>) {
      if (opts?.failScan) throw new Error('scan failed');
      const matchIdx = args.indexOf('MATCH');
      const pattern = String(args[matchIdx + 1] ?? '*');
      const regex = globToRegExp(pattern);
      if (cursor === '0' || cursor === 0) {
        snapshot = [...store.keys()].filter((k) => regex.test(k)).sort();
      }
      const start = cursor === '0' || cursor === 0 ? 0 : Number(cursor);
      const slice = snapshot.slice(start, start + pageSize);
      const next = start + pageSize >= snapshot.length ? '0' : String(start + pageSize);
      return [next, slice];
    },
    async del(...keys: string[]) {
      let n = 0;
      for (const k of keys) {
        if (store.delete(k)) n += 1;
      }
      return n;
    },
  };
}

describe('scanDelDemoCallMeKeys', () => {
  it('is a no-op when Redis has no matching keys', async () => {
    const redis = createFakeRedis({ 'unrelated:key': '1' });
    await expect(scanDelDemoCallMeKeys(redis)).resolves.toBe(0);
    expect(redis.store.has('unrelated:key')).toBe(true);
  });

  it('deletes num + day keys and leaves everything else', async () => {
    const redis = createFakeRedis({
      'demo:call-me:num:+14153211212': '1',
      'demo:call-me:num:+16043211212': '1',
      'demo:call-me:day:2026-09-07': '12',
      'campaigns:suggestions:abc': 'cached',
    });
    await expect(scanDelDemoCallMeKeys(redis)).resolves.toBe(3);
    expect([...redis.store.keys()]).toEqual(['campaigns:suggestions:abc']);
  });

  it('pages through SCAN cursors', async () => {
    const redis = createFakeRedis(
      {
        'demo:call-me:num:+14153211001': '1',
        'demo:call-me:num:+14153211002': '1',
        'demo:call-me:num:+14153211003': '1',
        'demo:call-me:day:2026-09-07': '1',
      },
      { pageSize: 2 },
    );
    await expect(scanDelDemoCallMeKeys(redis)).resolves.toBe(4);
    expect(redis.store.size).toBe(0);
  });
});

describe('maybeClearDemoCallMeCooldownsOnBoot', () => {
  it('skips Redis entirely when the flag is off', async () => {
    const scan = vi.fn();
    const redis = { scan, del: vi.fn() } as unknown as DemoCallMeRedis;
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(maybeClearDemoCallMeCooldownsOnBoot(false, redis, log)).resolves.toBe(0);
    expect(scan).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it('connects a lazy client, deletes keys, and logs the count', async () => {
    const redis = createFakeRedis(
      { 'demo:call-me:num:+14153211212': '1' },
      { status: 'wait' },
    );
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(maybeClearDemoCallMeCooldownsOnBoot(true, redis, log)).resolves.toBe(1);
    expect(redis.connect).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalledWith(
      { deleted: 1 },
      'DEMO_CLEAR_COOLDOWNS_ON_BOOT deleted demo call-me Redis keys',
    );
    expect(redis.store.size).toBe(0);
  });

  it('swallows Redis errors so boot continues', async () => {
    const redis = createFakeRedis({}, { failScan: true });
    const log = { info: vi.fn(), warn: vi.fn() };
    await expect(maybeClearDemoCallMeCooldownsOnBoot(true, redis, log)).resolves.toBe(0);
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.info).not.toHaveBeenCalled();
  });
});
