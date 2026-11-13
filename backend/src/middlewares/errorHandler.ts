import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../core/errors.js';
import { logger } from '../core/logger.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('Ruta no encontrada', 404, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, err.message);
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof MulterError) {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(isTooLarge ? 413 : 400).json({
      success: false,
      error: {
        code: err.code,
        message: isTooLarge
          ? 'El archivo excede el tamaño máximo permitido'
          : 'Error al procesar el archivo adjunto',
      },
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error interno en el servidor',
    },
  });
}
