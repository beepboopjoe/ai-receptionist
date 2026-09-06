// ============================================================
// Shared Redis client singleton
// Used by BullMQ queues, session-manager, csv-import progress, etc.
// ============================================================
import Redis from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[redis] Connection error:', err);
});

// ============================================================
// Safe cache helpers.
//
// The shared client uses `maxRetriesPerRequest: null` (required by BullMQ),
// which means when Redis is unreachable, commands sit in the offline queue
// and never settle — so a plain `await redis.get(...).catch(...)` HANGS
// forever instead of erroring. That turns any Redis-backed cache read on a
// request hot-path (analytics overview, campaign suggestions, …) into a hung
// request the moment Redis has an outage.
//
// These helpers degrade to a cache-miss instead of hanging: they skip Redis
// unless the connection is actually `ready`, and race every op against a short
// timeout as a belt-and-suspenders guard against a connected-but-stalled node.
// ============================================================
const CACHE_OP_TIMEOUT_MS = 500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), ms)),
  ]);
}

/** Read a cached value, or null on miss / Redis unavailable. Never throws, never hangs. */
export async function cacheGet(key: string): Promise<string | null> {
  if (redis.status !== 'ready') return null;
  try {
    return await withTimeout(redis.get(key), CACHE_OP_TIMEOUT_MS);
  } catch {
    return null;
  }
}

/** Best-effort cache write with TTL (seconds). Silently no-ops when Redis is unavailable. */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (redis.status !== 'ready') return;
  try {
    await withTimeout(redis.set(key, value, 'EX', ttlSeconds), CACHE_OP_TIMEOUT_MS);
  } catch {
    /* best-effort */
  }
}

/** Best-effort cache invalidation. Silently no-ops when Redis is unavailable. */
export async function cacheDel(key: string): Promise<void> {
  if (redis.status !== 'ready') return;
  try {
    await withTimeout(redis.del(key), CACHE_OP_TIMEOUT_MS);
  } catch {
    /* best-effort */
  }
}

/**
 * INCR + set TTL on first increment. Returns the new count, or null when
 * Redis is unavailable (callers should fail open or closed explicitly).
 */
export async function cacheIncr(key: string, ttlSeconds: number): Promise<number | null> {
  if (redis.status !== 'ready') return null;
  try {
    const count = await withTimeout(redis.incr(key), CACHE_OP_TIMEOUT_MS);
    if (count === 1) {
      await withTimeout(redis.expire(key, ttlSeconds), CACHE_OP_TIMEOUT_MS);
    }
    return count;
  } catch {
    return null;
  }
}

/** SET NX with TTL. true = key was set, false = already existed, null = Redis down. */
export async function cacheSetNx(key: string, value: string, ttlSeconds: number): Promise<boolean | null> {
  if (redis.status !== 'ready') return null;
  try {
    const result = await withTimeout(redis.set(key, value, 'EX', ttlSeconds, 'NX'), CACHE_OP_TIMEOUT_MS);
    return result === 'OK';
  } catch {
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
