import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
  profile?: { firm_id: string; role: string; full_name: string };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }

  const { data: profile } = await supabase
    .from('profiles').select('firm_id, role, full_name').eq('id', user.id).single();

  req.user    = { id: user.id, email: user.email! };
  req.profile = profile || undefined;
  next();
}
