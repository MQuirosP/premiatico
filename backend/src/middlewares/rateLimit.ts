import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../core/errors.js';
import { buildRedisKey, getRedisClient, REDIS_PREFIXES } from '../core/redis.js';

export function rateLimit(options: {
  keyPrefix: string;
  windowSeconds: number;
  maxRequests: number;
}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const redis = getRedisClient();
    if (!redis) {
      next();
      return;
    }

    const ip = req.ip || 'unknown';
    const key = buildRedisKey(REDIS_PREFIXES.RATE, `${options.keyPrefix}:${ip}`);

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, options.windowSeconds);
      }
      if (current > options.maxRequests) {
        next(
          new AppError(
            'Demasiadas solicitudes. Intentá de nuevo en unos momentos.',
            429,
            'RATE_LIMITED',
          ),
        );
        return;
      }
    } catch {
      // Fail-open if Redis is temporarily unavailable
    }

    next();
  };
}
