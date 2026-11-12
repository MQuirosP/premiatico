import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../core/errors.js';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError('Datos del cuerpo inválidos', parsed.error.flatten().fieldErrors);
        }
        req.body = parsed.data;
      }

      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) {
          throw new ValidationError('Parámetros de consulta inválidos', parsed.error.flatten().fieldErrors);
        }
        req.query = parsed.data;
      }

      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError('Parámetros de ruta inválidos', parsed.error.flatten().fieldErrors);
        }
        req.params = parsed.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
