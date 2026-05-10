// ============================================================
// Call session state — stored in Redis with 2h TTL
// ============================================================
import Redis from 'ioredis';
import { config } from '../../config.js';
import type { CallState } from '@ai-receptionist/shared';

const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const KEY_PREFIX = 'call:';

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    _redis.on('error', (err) => {
      console.error('[redis] Connection error:', err);
    });
  }
  return _redis;
}

function callKey(rcCallId: string): string {
  return `${KEY_PREFIX}${rcCallId}`;
}

export async function saveCallState(state: CallState): Promise<void> {
  await getRedis().set(callKey(state.rcCallId), JSON.stringify(state), 'EX', SESSION_TTL_SECONDS);
}

export async function getCallState(rcCallId: string): Promise<CallState | null> {
  const raw = await getRedis().get(callKey(rcCallId));
  if (!raw) return null;
  return JSON.parse(raw) as CallState;
}

export async function updateCallState(
  rcCallId: string,
  patch: Partial<CallState>
): Promise<CallState | null> {
  const existing = await getCallState(rcCallId);
  if (!existing) return null;
  const updated: CallState = {
    ...existing,
    ...patch,
    lastActivityAt: new Date().toISOString(),
  };
  await saveCallState(updated);
  return updated;
}

export async function deleteCallState(rcCallId: string): Promise<void> {
  await getRedis().del(callKey(rcCallId));
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
