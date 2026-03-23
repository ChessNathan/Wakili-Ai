import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { authRouter }      from './routes/auth';
import { documentsRouter } from './routes/documents';
import { casesRouter }     from './routes/cases';
import { clientsRouter }   from './routes/clients';
import { deadlinesRouter } from './routes/deadlines';
import { aiRouter }        from './routes/ai';
import { googleRouter }    from './routes/google';
import { errorHandler }    from './middleware/errorHandler';
import { requireAuth }     from './middleware/requireAuth';
import {
  attachRequestId, extraSecurityHeaders,
  sanitiseBody, requestLogger, noCache,
} from './middleware/security';
import { logger } from './lib/logger';

// Validate required env vars at startup
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ANTHROPIC_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) { logger.error(`Missing env: ${key}`); process.exit(1); }
}

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(attachRequestId);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));
app.use(extraSecurityHeaders);

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    logger.warn('CORS blocked', { origin });
    cb(new Error('CORS policy violation'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(sanitiseBody);
app.use('/api', noCache);
app.use(requestLogger);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/health',
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many auth attempts. Please wait 15 minutes.' },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'AI rate limit reached. Please wait a moment.' },
});

app.use(globalLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Public
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/google/callback', googleRouter);

// Protected
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/cases',     requireAuth, casesRouter);
app.use('/api/clients',   requireAuth, clientsRouter);
app.use('/api/deadlines', requireAuth, deadlinesRouter);
app.use('/api/ai',        requireAuth, aiLimiter, aiRouter);
app.use('/api/google',    requireAuth, googleRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info('Wakili AI backend started', { port: PORT, env: process.env.NODE_ENV });
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason }));
process.on('uncaughtException', (err) => { logger.error('Uncaught exception', { err }); process.exit(1); });

export default app;
