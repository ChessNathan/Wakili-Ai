import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import { validateDeadlineCreate, validateUUIDParam, validate } from '../middleware/validators';
import { requireOwnership } from '../middleware/security';
import { logAudit } from '../lib/logger';

export const deadlinesRouter = Router();

deadlinesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const firm_id = req.profile?.firm_id;
  if (!firm_id) return res.status(400).json({ error: 'No firm found' });

  const { data, error } = await supabase
    .from('deadlines')
    .select('*, cases(title, ref_number), profiles(full_name)')
    .eq('firm_id', firm_id).eq('done', false)
    .order('due_date', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to fetch deadlines' });
  return res.json(data);
});

deadlinesRouter.post('/',
  validateDeadlineCreate, validate,
  async (req: AuthRequest, res: Response) => {
    const firm_id = req.profile?.firm_id;
    if (!firm_id) return res.status(400).json({ error: 'No firm found' });

    const { title, due_date, case_id, assigned_to, urgency } = req.body;

    if (case_id) {
      const { data: c } = await supabase.from('cases').select('firm_id').eq('id', case_id).single();
      if (!c || c.firm_id !== firm_id) return res.status(403).json({ error: 'Case not in your firm' });
    }

    const { data, error } = await supabase
      .from('deadlines')
      .insert({ firm_id, title, due_date, case_id, assigned_to, urgency: urgency || 'normal' })
      .select().single();

    if (error) return res.status(500).json({ error: 'Failed to create deadline' });
    logAudit('DEADLINE_CREATED', req.user!.id, { deadline_id: data.id, due_date });
    return res.status(201).json(data);
  }
);

deadlinesRouter.patch('/:id',
  validateUUIDParam, validate,
  requireOwnership('deadlines'),
  async (req: AuthRequest, res: Response) => {
    const allowed = ['done', 'title', 'due_date', 'urgency'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const { data, error } = await supabase
      .from('deadlines').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: 'Failed to update deadline' });
    return res.json(data);
  }
);
