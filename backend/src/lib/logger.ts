import winston from 'winston';

const isProd = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'wakili-ai' },
  transports: [new winston.transports.Console({
    format: isProd ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  })],
});

export function logAudit(event: string, userId: string, meta: Record<string, any> = {}) {
  logger.info(`AUDIT:${event}`, { userId, ...meta });
}
