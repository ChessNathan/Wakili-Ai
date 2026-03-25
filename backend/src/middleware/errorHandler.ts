import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as any).requestId || 'unknown';
  const isProd    = process.env.NODE_ENV === 'production';

  logger.error('Unhandled error', {
    message: err.message,
    stack: isProd ? undefined : err.stack,
    requestId,
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    error: isProd ? 'Internal server error' : err.message,
    requestId,
  });
}
