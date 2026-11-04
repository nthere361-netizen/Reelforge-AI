import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

interface ValidationTargets {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

export function validate(schemas: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err: any) {
      if (err instanceof ZodError || err?.name === 'ZodError' || Array.isArray(err?.issues)) {
        const issues = err.issues || [];
        const details = issues.map((i: any) => ({
          path: Array.isArray(i.path) ? i.path.join('.') : String(i.path || ''),
          message: i.message,
        }));
        return next(
          new AppError('VALIDATION_ERROR', 400, 'Request validation failed', details)
        );
      }
      next(err);
    }
  };
}

