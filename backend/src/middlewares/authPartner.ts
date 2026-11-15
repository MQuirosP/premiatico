import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../core/env.js';
import { UnauthorizedError } from '../core/errors.js';

declare global {
  namespace Express {
    interface Request {
      partnerCode?: string;
    }
  }
}

let cachedKeysRaw: string | undefined;
let cachedKeysMap: Record<string, string> = {};

function getPartnerKeysMap(): Record<string, string> {
  if (env.PARTNER_API_KEYS === cachedKeysRaw) {
    return cachedKeysMap;
  }

  cachedKeysRaw = env.PARTNER_API_KEYS;
  if (!env.PARTNER_API_KEYS) {
    cachedKeysMap = {};
    return cachedKeysMap;
  }

  try {
    const parsed = JSON.parse(env.PARTNER_API_KEYS) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          normalized[key.trim().toUpperCase()] = value.trim();
        }
      }
      cachedKeysMap = normalized;
    } else {
      cachedKeysMap = {};
    }
  } catch {
    cachedKeysMap = {};
  }

  return cachedKeysMap;
}

function safeCompareSecret(provided: string, expected: string): boolean {
  const providedDigest = crypto.createHash('sha256').update(provided).digest();
  const expectedDigest = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

export function requirePartnerAuth(req: Request, _res: Response, next: NextFunction): void {
  const partnerIdHeader = req.header('X-Partner-Id')?.trim().toUpperCase();
  const partnerKeyHeader = req.header('X-Partner-Key')?.trim();

  if (!partnerIdHeader || !partnerKeyHeader) {
    throw new UnauthorizedError('Credenciales de canal partner requeridas');
  }

  const keysMap = getPartnerKeysMap();
  const expectedSecret = keysMap[partnerIdHeader];
  if (!expectedSecret || !safeCompareSecret(partnerKeyHeader, expectedSecret)) {
    throw new UnauthorizedError('Credenciales de canal partner inválidas');
  }

  req.partnerCode = partnerIdHeader;
  next();
}
