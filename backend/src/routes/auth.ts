import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { validateSignup, validateLogin, validate } from '../middleware/validators';
import { logAudit } from '../lib/logger';

export const authRouter = Router();

// POST /api/auth/signup
authRouter.post('/signup', validateSignup, validate, async (req: Request, res: Response): Promise<void> => {
  const { email, password, full_name, firm_name } = req.body;

  // Use anon client for signup — standard Supabase auth flow
  const anonClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  const { data: authData, error: signUpError } = await anonClient.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });

  if (signUpError) {
    logAudit('SIGNUP_FAILED', 'unknown', { email, error: signUpError.message, ip: req.ip });
    res.status(400).json({ error: signUpError.message }); return;
  }

  if (!authData.user) {
    res.status(400).json({ error: 'Signup failed. Please try again.' }); return;
  }

  // Create firm and link to profile using service role
  if (firm_name) {
    const { data: firm } = await supabase
      .from('firms')
      .insert({ name: firm_name, plan: 'pro' })
      .select()
      .single();

    if (firm) {
      await supabase
        .from('profiles')
        .update({ firm_id: (firm as any).id, role: 'senior_partner' })
        .eq('id', authData.user.id);
    }
  }

  logAudit('USER_SIGNUP', authData.user.id, { email, firm_name, ip: req.ip });

  // Auto sign in and return session so user doesn't need to log in separately
  const { data: sessionData, error: signInError } = await anonClient.auth.signInWithPassword({
    email, password,
  });

  if (signInError || !sessionData.session) {
    // Signup worked, just return success — user can log in manually
    res.status(201).json({ message: 'Account created. Please sign in.' }); return;
  }

  res.status(201).json({
    message: 'Account created successfully',
    session: sessionData.session,
    user: { id: authData.user.id, email: authData.user.email },
  });
});

// POST /api/auth/login
authRouter.post('/login', validateLogin, validate, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    logAudit('LOGIN_FAILED', 'unknown', { email, ip: req.ip });
    res.status(401).json({ error: 'Invalid email or password.' }); return;
  }

  logAudit('LOGIN_SUCCESS', data.user.id, { email, ip: req.ip });
  res.json({
    session: data.session,
    user: { id: data.user.id, email: data.user.email },
  });
});
