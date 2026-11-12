import type { NextFunction, Request, Response } from 'express';
import { env } from '../core/env.js';
import { ForbiddenError } from '../core/errors.js';

export async function verifyTurnstile(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY || env.NODE_ENV === 'test') {
    next();
    return;
  }

  const token =
    (req.body?.turnstileToken as string | undefined) ||
    req.header('x-turnstile-token');

  if (!token) {
    next(new ForbiddenError('Verificación anti-bot requerida'));
    return;
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          ...(req.ip ? { remoteip: req.ip } : {}),
        }),
      },
    );

    const data = (await response.json()) as { success?: boolean };
    if (!data.success) {
      next(new ForbiddenError('Verificación Turnstile inválida'));
      return;
    }
    next();
  } catch {
    next(new ForbiddenError('No se pudo validar Turnstile'));
  }
}
