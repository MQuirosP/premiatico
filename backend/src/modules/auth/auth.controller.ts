import type { Request, Response, NextFunction } from 'express';
import { env } from '../../core/env.js';
import { extractAdminToken } from '../../middlewares/authAdmin.js';
import type { LoginInput } from './auth.schema.js';
import { loginAdmin, logoutAdmin } from './auth.service.js';

export async function loginController(
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { admin, token, expiresAt } = await loginAdmin(req.body);

    res.cookie(env.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      expires: expiresAt,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: { admin, token },
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractAdminToken(req);
    await logoutAdmin(token, req.admin?.id);

    res.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: { message: 'Sesión cerrada correctamente' },
    });
  } catch (error) {
    next(error);
  }
}

export function meController(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: { admin: req.admin },
  });
}
