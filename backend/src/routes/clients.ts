import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';

export const clientsRouter = Router();

clientsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const firm_id = req.profile?.firm_id;
  if (!firm_id) return res.status(400).json({ error: 'No firm found' });

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('firm_id', firm_id)
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

clientsRouter.post('/', async (req: AuthRequest, res: Response) => {
  const firm_id = req.profile?.firm_id;
  if (!firm_id) return res.status(400).json({ error: 'No firm found' });

  const { name, email, phone, type, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { data, error } = await supabase
    .from('clients')
    .insert({ firm_id, name, email, phone, type: type || 'individual', notes })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

clientsRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { name, email, phone, type, notes } = req.body;
  const { data, error } = await supabase
    .from('clients')
    .update({ name, email, phone, type, notes })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

clientsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabase.from('clients').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});
