import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authRouter } from './routes/auth';
import { documentsRouter } from './routes/documents';
import { casesRouter } from './routes/cases';
import { clientsRouter } from './routes/clients';
import { deadlinesRouter } from './routes/deadlines';
import { aiRouter } from './routes/ai';
import { googleRouter } from './routes/google';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/requireAuth';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security & Parsing ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// ── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Too many AI requests, slow down.' });
app.use(limiter);

// ── Health Check ────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Wakili AI API' }));

// ── Public Routes ───────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/google/callback', googleRouter); // OAuth callback is public

// ── Protected Routes ────────────────────────────────────────
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/cases', requireAuth, casesRouter);
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/deadlines', requireAuth, deadlinesRouter);
app.use('/api/ai', requireAuth, aiLimiter, aiRouter);
app.use('/api/google', requireAuth, googleRouter);

// ── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🏛️  Wakili AI Backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL}\n`);
});

export default app;
