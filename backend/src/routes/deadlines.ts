import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';

export const deadlinesRouter = Router();

deadlinesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const firm_id = req.profile?.firm_id;
  if (!firm_id) return res.status(400).json({ error: 'No firm found' });

  const { data, error } = await supabase
    .from('deadlines')
    .select(`*, cases(title, ref_number), profiles(full_name)`)
    .eq('firm_id', firm_id)
    .eq('done', false)
    .order('due_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

deadlinesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const firm_id = req.profile?.firm_id;
  if (!firm_id) return res.status(400).json({ error: 'No firm found' });

  const { title, due_date, case_id, assigned_to, urgency } = req.body;
  if (!title || !due_date) return res.status(400).json({ error: 'title and due_date required' });

  const { data, error } = await supabase
    .from('deadlines')
    .insert({ firm_id, title, due_date, case_id, assigned_to, urgency: urgency || 'normal' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

deadlinesRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { done, title, due_date, urgency } = req.body;
  const { data, error } = await supabase
    .from('deadlines')
    .update({ done, title, due_date, urgency })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});
