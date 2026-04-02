import { Router, Request, Response } from 'express';
import { supabaseAnon, supabase } from '../lib/supabase';
import { body, validationResult } from 'express-validator';
import { logAudit } from '../lib/logger';
import { requireAuth } from '../middleware/requireAuth';
import { AuthRequest } from '../middleware/requireAuth';

export const authRouter = Router();

const passwordRules = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Z]/).withMessage('Password needs an uppercase letter')
  .matches(/[0-9]/).withMessage('Password needs a number');

// ── POST /api/auth/signup  — founder creates firm ──────────────────────────────
authRouter.post('/signup',
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid email'),
  passwordRules,
  body('full_name').trim().isLength({ min: 2, max: 100 }).withMessage('Full name is required'),
  body('firm_name').trim().isLength({ min: 1 }).withMessage('Firm name is required for founder accounts'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: errors.array()[0].msg }); return; }

    const { email, password, full_name, firm_name } = req.body;

    const { data, error } = await supabaseAnon.auth.signUp({
      email, password,
      options: { data: { full_name } },
    });
    if (error) { res.status(400).json({ error: error.message }); return; }
    if (!data.user) { res.status(400).json({ error: 'Signup failed' }); return; }

    // Wait for DB trigger to create profile
    await new Promise(r => setTimeout(r, 1200));

    const uid      = data.user.id;
    const initials = full_name.trim().split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 2);

    // Create firm
    const { data: firm, error: firmErr } = await supabase
      .from('firms').insert({ name: firm_name.trim(), plan: 'pro' }).select().single();
    if (firmErr || !firm) { res.status(500).json({ error: 'Failed to create firm' }); return; }

    // Update profile
    await supabase.from('profiles').upsert({
      id: uid, full_name, initials,
      firm_id: firm.id, role: 'senior_partner',
    }, { onConflict: 'id' });

    // Auto sign-in
    const { data: session, error: signInErr } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (signInErr) { res.status(201).json({ message: 'Account created. Please sign in.' }); return; }

    logAudit('SIGNUP', uid, { email, firm_id: firm.id, ip: req.ip });
    res.status(201).json({ session: session.session, user: { id: uid, email }, firm });
  }
);

// ── POST /api/auth/signup-staff  — staff joins an existing firm ────────────────
// Staff provide the firm's invite code (= firm ID, shown in Settings > Firm Details).
// The firm must already exist. Staff get role 'advocate' by default.
authRouter.post('/signup-staff',
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid email'),
  passwordRules,
  body('full_name').trim().isLength({ min: 2, max: 100 }).withMessage('Full name is required'),
  body('firm_id').isUUID().withMessage('A valid Firm ID is required to join a firm'),
  body('role').optional().isIn(['advocate','associate','secretary','paralegal']).withMessage('Invalid role'),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: errors.array()[0].msg }); return; }

    const { email, password, full_name, firm_id, role } = req.body;

    // Verify firm exists
    const { data: firm, error: firmErr } = await supabase
      .from('firms').select('id,name').eq('id', firm_id).single();
    if (firmErr || !firm) {
      res.status(400).json({ error: 'Firm not found. Please check the Firm ID and try again.' });
      return;
    }

    const { data, error } = await supabaseAnon.auth.signUp({
      email, password,
      options: { data: { full_name } },
    });
    if (error) { res.status(400).json({ error: error.message }); return; }
    if (!data.user) { res.status(400).json({ error: 'Signup failed' }); return; }

    await new Promise(r => setTimeout(r, 1200));

    const uid      = data.user.id;
    const initials = full_name.trim().split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 2);
    const assignedRole = role || 'advocate';

    await supabase.from('profiles').upsert({
      id: uid, full_name, initials,
      firm_id: firm.id, role: assignedRole,
    }, { onConflict: 'id' });

    const { data: session, error: signInErr } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (signInErr) { res.status(201).json({ message: 'Account created. Please sign in.' }); return; }

    logAudit('SIGNUP_STAFF', uid, { email, firm_id: firm.id, role: assignedRole, ip: req.ip });
    res.status(201).json({ session: session.session, user: { id: uid, email }, firm });
  }
);

// ── POST /api/auth/login ───────────────────────────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { res.status(401).json({ error: 'Invalid email or password' }); return; }

  logAudit('LOGIN', data.user.id, { email, ip: req.ip });
  res.json({ session: data.session, user: { id: data.user.id, email: data.user.email } });
});

// ── GET /api/auth/firm-info?firm_id=xxx  — public lookup so staff can verify firm before signup
authRouter.get('/firm-info', async (req: Request, res: Response): Promise<void> => {
  const { firm_id } = req.query;
  if (!firm_id || typeof firm_id !== 'string') {
    res.status(400).json({ error: 'firm_id query parameter required' }); return;
  }
  const { data: firm } = await supabase
    .from('firms').select('id,name,plan').eq('id', firm_id).single();
  if (!firm) { res.status(404).json({ error: 'Firm not found' }); return; }
  // Return limited info only
  res.json({ id: firm.id, name: firm.name });
});

// ── GET /api/auth/me — return current user's profile + firm
authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', req.user.id).single();
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

  let firm = null;
  if (profile.firm_id) {
    const { data: f } = await supabase.from('firms').select('*').eq('id', profile.firm_id).single();
    firm = f;
  }

  res.json({ user: req.user, profile, firm });
});
