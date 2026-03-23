import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).requestId || 'unknown';
  const isProd = process.env.NODE_ENV === 'production';

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    requestId,
    method: req.method,
    path: req.path,
  });

  // Never leak internal error details in production
  const message = isProd ? 'Internal server error' : err.message;

  res.status(500).json({ error: message, requestId });
}
