import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { validateSignup, validateLogin, validate } from '../middleware/validators';
import { logAudit } from '../lib/logger';

export const authRouter = Router();

authRouter.post('/signup', validateSignup, validate, async (req: Request, res: Response) => {
  const { email, password, full_name, firm_name } = req.body;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name },
    email_confirm: true,
  });

  if (authError) {
    // Don't reveal whether email already exists
    return res.status(400).json({ error: 'Could not create account. Check your details and try again.' });
  }

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

  logAudit('USER_SIGNUP', authData.user!.id, { email, firm_name, ip: req.ip });
  return res.status(201).json({ message: 'Account created successfully' });
});

authRouter.post('/login', validateLogin, validate, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic error — don't reveal if email exists or not
    logAudit('LOGIN_FAILED', 'unknown', { email, ip: req.ip });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  logAudit('LOGIN_SUCCESS', data.user.id, { email, ip: req.ip });
  return res.json({ session: data.session, user: { id: data.user.id, email: data.user.email } });
});
