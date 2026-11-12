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

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    redisClient.on('error', (err) => {
      logger.error({ err: err.message }, 'Redis connection error');
    });
  }
  return redisClient;
}
