import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import { validateCaseCreate, validateCaseUpdate, validateUUIDParam, validate } from '../middleware/validators';
import { requireOwnership } from '../middleware/security';
import { logAudit } from '../lib/logger';

export const casesRouter = Router();

casesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const firm_id = req.profile?.firm_id;
  if (!firm_id) return res.status(400).json({ error: 'No firm found' });

  const { data, error } = await supabase
    .from('cases')
    .select('*, clients(name), profiles(full_name, initials)')
    .eq('firm_id', firm_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to fetch cases' });
  return res.json(data);
});

casesRouter.get('/:id',
  validateUUIDParam, validate,
  requireOwnership('cases'),
  async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase
      .from('cases')
      .select('*, clients(name, email, phone), profiles(full_name, initials)')
      .eq('id', req.params.id).single();

    if (error) return res.status(404).json({ error: 'Case not found' });
    return res.json(data);
  }
);

casesRouter.post('/',
  validateCaseCreate, validate,
  async (req: AuthRequest, res: Response) => {
    const firm_id = req.profile?.firm_id;
    if (!firm_id) return res.status(400).json({ error: 'No firm found' });

    const { title, matter_type, court, client_id, assigned_to, notes } = req.body;

    // Verify client belongs to firm if supplied
    if (client_id) {
      const { data: client } = await supabase.from('clients').select('firm_id').eq('id', client_id).single();
      if (!client || client.firm_id !== firm_id) return res.status(403).json({ error: 'Client not in your firm' });
    }

    const year = new Date().getFullYear();
    const ref_number = `WK/${matter_type.substring(0, 3).toUpperCase()}/${year}/${Math.floor(Math.random() * 9000) + 1000}`;

    const { data, error } = await supabase
      .from('cases')
      .insert({ firm_id, title, matter_type, court, client_id, assigned_to, notes, ref_number })
      .select().single();

    if (error) return res.status(500).json({ error: 'Failed to create case' });
    logAudit('CASE_CREATED', req.user!.id, { case_id: data.id, matter_type });
    return res.status(201).json(data);
  }
);

casesRouter.patch('/:id',
  validateCaseUpdate, validate,
  requireOwnership('cases'),
  async (req: AuthRequest, res: Response) => {
    const allowed = ['title', 'matter_type', 'court', 'status', 'notes', 'assigned_to'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('cases').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: 'Failed to update case' });
    return res.json(data);
  }
);
