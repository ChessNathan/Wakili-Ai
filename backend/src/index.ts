import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { authRouter } from './routes/auth';
import { aiRouter } from './routes/ai';
import { documentsRouter, casesRouter, clientsRouter, deadlinesRouter } from './routes/crud';
import { googleRouter, googleCallbackHandler } from './routes/google';
import { requireAuth } from './middleware/requireAuth';
import { logger } from './lib/logger';

const required = ['SUPABASE_URL','SUPABASE_SERVICE_KEY','SUPABASE_ANON_KEY','GEMINI_API_KEY'];
for (const k of required) { if (!process.env[k]) { logger.error(`Missing env: ${k}`); process.exit(1); } }

const app    = express();
const PORT   = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy:false, crossOriginEmbedderPolicy:false, hsts: isProd ? { maxAge:31536000 } : false }));
app.use((_,res,next)=>{ res.removeHeader('X-Powered-By'); next(); });

const allowed = [process.env.FRONTEND_URL||'http://localhost:5173','http://localhost:5173','http://localhost:4173'];
app.use(cors({
  origin:(origin,cb)=>{ if(!origin||allowed.includes(origin)) return cb(null,true); cb(new Error('CORS blocked')); },
  credentials:true, methods:['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders:['Content-Type','Authorization'],
}));

app.use(express.json({ limit:'100kb' }));
app.use(morgan('combined',{ stream:{ write:msg=>logger.info(msg.trim()) } }));
app.use(rateLimit({ windowMs:15*60*1000, max:200, standardHeaders:true, legacyHeaders:false, skip:r=>r.path==='/health' }));
const authLimiter = rateLimit({ windowMs:15*60*1000, max:20, standardHeaders:true, legacyHeaders:false, message:{error:'Too many attempts.'} });
const aiLimiter   = rateLimit({ windowMs:60*1000,    max:20, standardHeaders:true, legacyHeaders:false, message:{error:'AI rate limit.'} });

app.get('/health', (_,res) => res.json({ status:'ok', ts:new Date().toISOString() }));

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);

// Google OAuth callback is PUBLIC — Google redirects here before we have a session cookie.
// Must be registered BEFORE the requireAuth-wrapped /api/google router below.
app.get('/api/google/callback', googleCallbackHandler);

// ── PROTECTED ROUTES ──────────────────────────────────────────────────────────
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/cases',     requireAuth, casesRouter);
app.use('/api/clients',   requireAuth, clientsRouter);
app.use('/api/deadlines', requireAuth, deadlinesRouter);
app.use('/api/ai',        requireAuth, aiLimiter, aiRouter);
app.use('/api/google',    requireAuth, googleRouter);

app.use((_,res) => res.status(404).json({ error:'Not found' }));
app.use((err:Error,_req:any,res:any,_next:any) => {
  logger.error('Unhandled error',{ message:err.message });
  res.status(500).json({ error: isProd?'Internal server error':err.message });
});

const server = app.listen(PORT, () => logger.info('Wakili AI backend running',{ port:PORT, env:process.env.NODE_ENV }));
process.on('SIGTERM', ()=>server.close(()=>process.exit(0)));
process.on('unhandledRejection', reason=>logger.error('Unhandled rejection',{ reason }));
