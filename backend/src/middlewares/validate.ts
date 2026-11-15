import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../core/errors.js';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

function formatZodErrors(prefix: string, err: import('zod').ZodError): string {
  const details = err.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join(' | ');
  return details ? `${prefix}: ${details}` : prefix;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError(
            formatZodErrors('Datos del cuerpo inválidos', parsed.error),
            parsed.error.flatten().fieldErrors,
          );
        }
        req.body = parsed.data;
      }

      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) {
          throw new ValidationError(
            formatZodErrors('Parámetros de consulta inválidos', parsed.error),
            parsed.error.flatten().fieldErrors,
          );
        }
        req.query = parsed.data;
      }

      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError(
            formatZodErrors('Parámetros de ruta inválidos', parsed.error),
            parsed.error.flatten().fieldErrors,
          );
        }
        req.params = parsed.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
