// ============================================================
// Process health / readiness probes.
//
// /health is liveness: the Node process is up. Cheap, no I/O.
// /health/ready is readiness: Postgres + Redis are reachable.
//
// Redis uses ioredis with `maxRetriesPerRequest: null` (BullMQ
// requirement) and `lazyConnect: true`. A bare `await redis.ping()`
// therefore HANGS FOREVER when Redis is down — the command sits in
// the offline queue and never settles. Railway's deploy probe
// (`healthcheckPath` in railway.toml) used to hit /health/ready and
// time out, so the service never became routable.
//
// Every I/O check here is raced against a short timeout.
// ============================================================

export const HEALTH_PROBE_TIMEOUT_MS = 1500;

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export type ProbeResult = 'ok' | string;

/** Run a dependency check; never hangs, never throws. */
export async function probe(
  label: string,
  fn: () => Promise<unknown>,
  timeoutMs = HEALTH_PROBE_TIMEOUT_MS
): Promise<ProbeResult> {
  try {
    await withTimeout(Promise.resolve().then(fn), timeoutMs, label);
    return 'ok';
  } catch (err) {
    return err instanceof Error ? err.message : 'fail';
  }
}

export interface RedisLike {
  status: string;
  ping: () => Promise<string>;
  connect: () => Promise<unknown>;
}

/**
 * Probe Redis without hanging on the BullMQ offline queue.
 * - `ready` → timed ping
 * - `wait` (lazyConnect, never opened) → timed connect, then ping
 * - any other status → immediate degraded string (no command sent)
 */
export async function probeRedis(
  redis: RedisLike,
  timeoutMs = HEALTH_PROBE_TIMEOUT_MS
): Promise<ProbeResult> {
  try {
    if (redis.status !== 'ready') {
      if (redis.status === 'wait') {
        await withTimeout(Promise.resolve(redis.connect()), timeoutMs, 'redis.connect');
      } else {
        return `not_ready:${redis.status}`;
      }
    }
    const pong = await withTimeout(redis.ping(), timeoutMs, 'redis.ping');
    return pong === 'PONG' ? 'ok' : `unexpected: ${String(pong)}`;
  } catch (err) {
    return err instanceof Error ? err.message : 'fail';
  }
}

export function livenessBody(): { status: 'ok'; timestamp: string; version: string } {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
}
