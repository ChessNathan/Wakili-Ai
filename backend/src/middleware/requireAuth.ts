import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
  profile?: { firm_id: string; role: string; full_name: string };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Fetch profile for firm context
  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id, role, full_name')
    .eq('id', user.id)
    .single();

  req.user = { id: user.id, email: user.email! };
  req.profile = profile ?? undefined;

  next();
}
