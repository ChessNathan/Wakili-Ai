import winston from 'winston';
import path from 'path';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'wakili-ai' },
  transports: [
    // Always log to console
    new winston.transports.Console({
      format: isProd ? json() : combine(colorize(), simple()),
    }),
  ],
});

// Audit logger — separate stream for security events
export const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(timestamp(), json()),
  defaultMeta: { type: 'AUDIT' },
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    }),
  ],
});

export function logAudit(event: string, userId: string, meta: Record<string, any> = {}) {
  auditLogger.info(event, { userId, ...meta, ts: new Date().toISOString() });
}
