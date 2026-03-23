import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from './requireAuth';
import { supabase } from '../lib/supabase';
import { logger, logAudit } from '../lib/logger';

// ── Request ID — attach unique ID to every request ───────────
export function attachRequestId(req: Request, res: Response, next: NextFunction) {
  (req as any).requestId = uuidv4();
  res.setHeader('X-Request-ID', (req as any).requestId);
  next();
}

// ── Security Headers (beyond helmet defaults) ────────────────
export function extraSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Remove fingerprinting headers
  res.removeHeader('X-Powered-By');
  next();
}

// ── Sanitise body — strip __proto__, constructor, prototype ──
export function sanitiseBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitise(req.body);
  }
  next();
}

function deepSanitise(obj: any): any {
  if (Array.isArray(obj)) return obj.map(deepSanitise);
  if (obj !== null && typeof obj === 'object') {
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
      clean[key] = deepSanitise(obj[key]);
    }
    return clean;
  }
  return obj;
}

// ── Prompt injection guard — block obvious jailbreak patterns ─
const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/i,
  /forget (everything|all instructions)/i,
  /you are now/i,
  /act as (a|an|if)/i,
  /system prompt/i,
  /\[INST\]|\[\/INST\]/,
  /<\|system\|>|<\|user\|>/i,
  /```system/i,
  /\/\*.*\*\//s,  // block comment injections
];

export function guardPromptInjection(req: AuthRequest, res: Response, next: NextFunction) {
  const { prompt, instruction, title } = req.body;
  const fieldsToCheck = [prompt, instruction, title].filter(Boolean);

  for (const field of fieldsToCheck) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(field)) {
        logAudit('PROMPT_INJECTION_BLOCKED', req.user?.id || 'unknown', {
          pattern: pattern.toString(),
          ip: req.ip,
          path: req.path,
        });
        return res.status(400).json({ error: 'Invalid input detected.' });
      }
    }
  }
  next();
}

// ── Ownership guard — verify resource belongs to user's firm ─
type Table = 'documents' | 'cases' | 'clients' | 'deadlines';

export function requireOwnership(table: Table) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const firmId = req.profile?.firm_id;
    const resourceId = req.params.id;

    if (!firmId || !resourceId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await supabase
      .from(table)
      .select('firm_id')
      .eq('id', resourceId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (data.firm_id !== firmId) {
      logAudit('OWNERSHIP_VIOLATION', req.user?.id || 'unknown', {
        table, resourceId, firmId, resourceFirmId: data.firm_id, ip: req.ip,
      });
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

// ── Role guard ────────────────────────────────────────────────
type Role = 'partner' | 'senior_partner' | 'advocate' | 'paralegal' | 'admin';
const ROLE_RANK: Record<Role, number> = {
  paralegal: 1, advocate: 2, partner: 3, senior_partner: 4, admin: 5,
};

export function requireRole(minRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = (req.profile?.role || 'paralegal') as Role;
    if ((ROLE_RANK[userRole] ?? 0) < (ROLE_RANK[minRole] ?? 99)) {
      logAudit('INSUFFICIENT_ROLE', req.user?.id || 'unknown', {
        required: minRole, actual: userRole, path: req.path,
      });
      return res.status(403).json({ error: `Requires ${minRole} role or above` });
    }
    next();
  };
}

// ── Request logger ────────────────────────────────────────────
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.path}`, {
      status: res.statusCode,
      ms,
      ip: req.ip,
      requestId: (req as any).requestId,
    });
  });
  next();
}

// ── No-cache for API responses ────────────────────────────────
export function noCache(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
}
