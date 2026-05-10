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

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
