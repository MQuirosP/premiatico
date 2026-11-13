import type { NextFunction, Request, Response } from 'express';
import { AdminRole } from '@prisma/client';
import { env } from '../core/env.js';
import { ForbiddenError, UnauthorizedError } from '../core/errors.js';
import { resolveAdminFromToken, type AuthenticatedAdmin } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
    }
  }
}

export function extractAdminToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
  if (cookieToken) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return undefined;
}

export async function requireAdminAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractAdminToken(req);
    if (!token) {
      throw new UnauthorizedError('Autenticación administrativa requerida');
    }
    req.admin = await resolveAdminFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdminRole(...allowedRoles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      next(new UnauthorizedError('Autenticación administrativa requerida'));
      return;
    }
    if (!allowedRoles.includes(req.admin.role)) {
      next(new ForbiddenError('No tienes permisos para realizar esta acción'));
      return;
    }
    next();
  };
}
