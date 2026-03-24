import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

// Extend Express Request — keep as interface extension so all
// Request fields (body, params, query, headers, ip, path…) are available
export interface AuthRequest extends Request {
  user?: { id: string; email: string };
  profile?: { firm_id: string; role: string; full_name: string };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'] as string | undefined;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  // Basic sanity check before hitting Supabase
  if (!token || token.length < 20 || token.split('.').length !== 3) {
    res.status(401).json({ error: 'Invalid token format' });
    return;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id, role, full_name')
      .eq('id', user.id)
      .single();

    req.user    = { id: user.id, email: user.email! };
    req.profile = profile ?? undefined;

    next();
  } catch (err) {
    logger.error('requireAuth error', { err });
    res.status(401).json({ error: 'Authentication failed' });
  }
}
