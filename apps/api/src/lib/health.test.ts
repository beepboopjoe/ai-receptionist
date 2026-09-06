// ============================================================
// Health-probe helpers — never hang, degrade cleanly.
// Guards the Railway deploy-probe hang (ioredis offline queue).
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import { probe, probeRedis, withTimeout, HEALTH_PROBE_TIMEOUT_MS } from './health.js';

describe('withTimeout', () => {
  it('resolves when the promise wins', async () => {
    await expect(withTimeout(Promise.resolve(42), 50, 'fast')).resolves.toBe(42);
  });

  it('rejects with a labeled timeout when the promise never settles', async () => {
    const hung = new Promise<never>(() => { /* never settles */ });
    await expect(withTimeout(hung, 20, 'hung-op')).rejects.toThrow('hung-op timeout after 20ms');
  });
});

describe('probe', () => {
  it('returns ok when the check succeeds', async () => {
    await expect(probe('db', async () => 1)).resolves.toBe('ok');
  });

  it('returns the error message when the check throws', async () => {
    await expect(
      probe('db', async () => {
        throw new Error('ECONNREFUSED');
      })
    ).resolves.toBe('ECONNREFUSED');
  });

  it('returns a timeout string instead of hanging', async () => {
    const result = await probe('redis', () => new Promise(() => { /* hang */ }), 20);
    expect(result).toBe('redis timeout after 20ms');
  });
});

describe('probeRedis', () => {
  it('pings when status is ready', async () => {
    const redis = {
      status: 'ready',
      ping: vi.fn().mockResolvedValue('PONG'),
      connect: vi.fn(),
    };
    await expect(probeRedis(redis)).resolves.toBe('ok');
    expect(redis.connect).not.toHaveBeenCalled();
    expect(redis.ping).toHaveBeenCalledOnce();
  });

  it('connects then pings when status is wait (lazyConnect)', async () => {
    const redis = {
      status: 'wait',
      ping: vi.fn().mockResolvedValue('PONG'),
      connect: vi.fn().mockResolvedValue(undefined),
    };
    await expect(probeRedis(redis)).resolves.toBe('ok');
    expect(redis.connect).toHaveBeenCalledOnce();
  });

  it('does not send a command when reconnecting (would hang)', async () => {
    const redis = {
      status: 'reconnecting',
      ping: vi.fn(),
      connect: vi.fn(),
    };
    await expect(probeRedis(redis)).resolves.toBe('not_ready:reconnecting');
    expect(redis.ping).not.toHaveBeenCalled();
    expect(redis.connect).not.toHaveBeenCalled();
  });

  it('times out a hung ping instead of stalling the probe', async () => {
    const redis = {
      status: 'ready',
      ping: () => new Promise<string>(() => { /* hang — ioredis offline queue */ }),
      connect: vi.fn(),
    };
    const result = await probeRedis(redis, 20);
    expect(result).toBe('redis.ping timeout after 20ms');
  });

  it('reports unexpected ping payloads', async () => {
    const redis = {
      status: 'ready',
      ping: vi.fn().mockResolvedValue('NOPE'),
      connect: vi.fn(),
    };
    await expect(probeRedis(redis)).resolves.toBe('unexpected: NOPE');
  });

  it('uses the default probe timeout constant', () => {
    expect(HEALTH_PROBE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(HEALTH_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });
});
