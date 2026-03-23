import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export const authRouter = Router();

// POST /api/auth/signup
authRouter.post('/signup', async (req: Request, res: Response) => {
  const { email, password, full_name, firm_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password, and full_name are required' });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name },
    email_confirm: true,
  });

  if (authError) return res.status(400).json({ error: authError.message });

  // Create firm if provided
  if (firm_name && authData.user) {
    const { data: firm } = await supabase
      .from('firms')
      .insert({ name: firm_name, plan: 'pro' })
      .select()
      .single();

    if (firm) {
      await supabase
        .from('profiles')
        .update({ firm_id: firm.id, role: 'senior_partner' })
        .eq('id', authData.user.id);
    }
  }

  return res.status(201).json({ user: authData.user });
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  return res.json({ session: data.session, user: data.user });
});
