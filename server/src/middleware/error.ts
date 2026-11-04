import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, 'Server operational error');
    }
    return res.status(err.statusCode).json({
      data: null,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Handle any ZodError that slipped through without being wrapped
  if ((err as any)?.name === 'ZodError' || Array.isArray((err as any)?.issues)) {
    const issues = (err as any).issues || [];
    const details = issues.map((i: any) => ({
      path: Array.isArray(i.path) ? i.path.join('.') : String(i.path || ''),
      message: i.message,
    }));
    return res.status(400).json({
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    });
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled internal error');
  return res.status(500).json({
    data: null,
    error: {
      code: 'INTERNAL',
      message: err.message || 'An internal server error occurred. Please try again later.',
      ...(env.NODE_ENV === 'development' ? { details: err.stack } : {}),
    },
  });
}

