import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const REDIS_PREFIXES = {
  CACHE: 'premiatico:cache:',
  RATE: 'premiatico:rate:',
  JOBS: 'premiatico:jobs:',
} as const;

export type RedisPrefix = (typeof REDIS_PREFIXES)[keyof typeof REDIS_PREFIXES];

export function buildRedisKey(prefix: RedisPrefix, key: string): string {
  return `${prefix}${key}`;
}

let redisClient: Redis | null = null;
let lastRedisErrorLogAt = 0;

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 1_000, 30_000),
    });
    redisClient.on('error', (err) => {
      const now = Date.now();
      if (now - lastRedisErrorLogAt >= 30_000) {
        lastRedisErrorLogAt = now;
        logger.error({ err: err.message }, 'Redis connection error');
      }
    });
  }
  return redisClient;
}
