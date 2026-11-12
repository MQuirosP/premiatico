import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AdminRole } from '@prisma/client';
import { env } from '../../core/env.js';
import { UnauthorizedError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { buildRedisKey, getRedisClient, REDIS_PREFIXES } from '../../core/redis.js';
import { recordAuditLog } from '../audit/audit.service.js';
import type { LoginInput } from './auth.schema.js';

export interface SessionPayload {
  adminId: string;
  role: AdminRole;
  jti: string;
  exp: number;
}

export interface AuthenticatedAdmin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

function signToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const encoded = parts[0];
  const signature = parts[1];
  if (!encoded || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', env.SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.adminId || !parsed.jti || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() >= parsed.exp * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function loginAdmin(input: LoginInput): Promise<{
  admin: AuthenticatedAdmin;
  token: string;
  expiresAt: Date;
}> {
  const identifier = (input.identifier ?? input.email ?? '').trim().toLowerCase();
  const adminUser = await prisma.adminUser.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  if (!adminUser || !adminUser.isActive) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const passwordValid = await bcrypt.compare(input.password, adminUser.passwordHash);
  if (!passwordValid) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + env.SESSION_TTL_HOURS * 3600;
  const jti = crypto.randomUUID();

  const token = signToken({
    adminId: adminUser.id,
    role: adminUser.role,
    jti,
    exp: expSeconds,
  });

  await recordAuditLog({
    actorId: adminUser.id,
    action: 'ADMIN_LOGIN',
    entityType: 'AdminUser',
    entityId: adminUser.id,
  });

  return {
    admin: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
    },
    token,
    expiresAt: new Date(expSeconds * 1000),
  };
}

export async function logoutAdmin(token: string | undefined, actorId?: string): Promise<void> {
  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      const redis = getRedisClient();
      if (redis && ttl > 0) {
        const key = buildRedisKey(REDIS_PREFIXES.CACHE, `admin_revoked:${payload.jti}`);
        await redis.set(key, '1', 'EX', ttl).catch(() => undefined);
      }
    }
  }

  if (actorId) {
    await recordAuditLog({
      actorId,
      action: 'ADMIN_LOGOUT',
      entityType: 'AdminUser',
      entityId: actorId,
    });
  }
}

export async function resolveAdminFromToken(token: string): Promise<AuthenticatedAdmin> {
  const payload = verifySessionToken(token);
  if (!payload) {
    throw new UnauthorizedError('Sesión inválida o expirada');
  }

  const redis = getRedisClient();
  if (redis) {
    const revokedKey = buildRedisKey(REDIS_PREFIXES.CACHE, `admin_revoked:${payload.jti}`);
    const isRevoked = await redis.get(revokedKey).catch(() => null);
    if (isRevoked) {
      throw new UnauthorizedError('Sesión cerrada');
    }
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: payload.adminId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!adminUser || !adminUser.isActive) {
    throw new UnauthorizedError('Cuenta administrativa inactiva o inexistente');
  }

  return {
    id: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
  };
}
