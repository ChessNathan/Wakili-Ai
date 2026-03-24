import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { validateSignup, validateLogin, validate } from '../middleware/validators';
import { logAudit } from '../lib/logger';

export const authRouter = Router();

authRouter.post('/signup', validateSignup, validate, async (req: Request, res: Response): Promise<void> => {
  const { email, password, full_name, firm_name } = req.body;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email, password,
    user_metadata: { full_name },
    email_confirm: true,
  });

  if (authError) {
    res.status(400).json({ error: 'Could not create account. Check your details and try again.' }); return;
  }

  if (firm_name && authData.user) {
    const { data: firm } = await supabase
      .from('firms').insert({ name: firm_name, plan: 'pro' }).select().single();
    if (firm) {
      await supabase.from('profiles')
        .update({ firm_id: (firm as any).id, role: 'senior_partner' })
        .eq('id', authData.user.id);
    }
  }

  logAudit('USER_SIGNUP', authData.user!.id, { email, ip: req.ip });
  res.status(201).json({ message: 'Account created successfully' });
});

authRouter.post('/login', validateLogin, validate, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    logAudit('LOGIN_FAILED', 'unknown', { email, ip: req.ip });
    res.status(401).json({ error: 'Invalid email or password.' }); return;
  }
  logAudit('LOGIN_SUCCESS', data.user.id, { email, ip: req.ip });
  res.json({ session: data.session, user: { id: data.user.id, email: data.user.email } });
});
