import { Router, Request, Response } from 'express';
import { supabaseAnon, supabase } from '../lib/supabase';
import { body, validationResult } from 'express-validator';
import { logAudit } from '../lib/logger';

export const authRouter = Router();

const signupValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
  body('full_name').trim().isLength({ min: 2, max: 100 }),
];

authRouter.post('/signup', signupValidation, async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: errors.array()[0].msg }); return;
  }

  const { email, password, full_name, firm_name } = req.body;

  const { data, error } = await supabaseAnon.auth.signUp({
    email, password,
    options: { data: { full_name } },
  });

  if (error) { res.status(400).json({ error: error.message }); return; }
  if (!data.user) { res.status(400).json({ error: 'Signup failed' }); return; }

  // Wait for trigger
  await new Promise(r => setTimeout(r, 1000));

  // Update profile
  const initials = full_name.split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 2);
  await supabase.from('profiles').upsert({ id: data.user.id, full_name, initials, role: 'senior_partner' }, { onConflict: 'id' });

  // Create firm
  if (firm_name?.trim()) {
    const { data: firm } = await supabase.from('firms').insert({ name: firm_name.trim(), plan: 'pro' }).select().single();
    if (firm) await supabase.from('profiles').update({ firm_id: firm.id, role: 'senior_partner' }).eq('id', data.user.id);
  }

  // Auto sign in
  const { data: session, error: signInErr } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (signInErr) { res.status(201).json({ message: 'Account created. Please sign in.' }); return; }

  logAudit('SIGNUP', data.user.id, { email, ip: req.ip });
  res.status(201).json({ session: session.session, user: { id: data.user.id, email } });
});

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { res.status(401).json({ error: 'Invalid email or password' }); return; }

  logAudit('LOGIN', data.user.id, { email, ip: req.ip });
  res.json({ session: data.session, user: { id: data.user.id, email: data.user.email } });
});
