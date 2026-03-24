import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import { validateClientCreate, validateUUIDParam, validate } from '../middleware/validators';
import { requireOwnership } from '../middleware/security';
import { logAudit } from '../lib/logger';

export const clientsRouter = Router();

clientsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const firm_id = req.profile?.firm_id;
  if (!firm_id) { res.status(400).json({ error: 'No firm found' }); return; }
  const { data, error } = await supabase.from('clients').select('*').eq('firm_id', firm_id).order('name');
  if (error) { res.status(500).json({ error: 'Failed to fetch clients' }); return; }
  res.json(data);
});

clientsRouter.post('/',
  validateClientCreate, validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const firm_id = req.profile?.firm_id;
    if (!firm_id) { res.status(400).json({ error: 'No firm found' }); return; }
    const { name, email, phone, type, notes } = req.body;
    const { data, error } = await supabase
      .from('clients')
      .insert({ firm_id, name, email, phone, type: type || 'individual', notes })
      .select().single();
    if (error) { res.status(500).json({ error: 'Failed to create client' }); return; }
    logAudit('CLIENT_CREATED', req.user!.id, { client_id: (data as any).id });
    res.status(201).json(data);
  }
);

clientsRouter.patch('/:id',
  validateUUIDParam, validate,
  requireOwnership('clients'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { name, email, phone, type, notes } = req.body;
    const { data, error } = await supabase
      .from('clients').update({ name, email, phone, type, notes }).eq('id', req.params['id']).select().single();
    if (error) { res.status(500).json({ error: 'Failed to update client' }); return; }
    res.json(data);
  }
);

clientsRouter.delete('/:id',
  validateUUIDParam, validate,
  requireOwnership('clients'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { error } = await supabase.from('clients').delete().eq('id', req.params['id']);
    if (error) { res.status(500).json({ error: 'Failed to delete client' }); return; }
    logAudit('CLIENT_DELETED', req.user!.id, { client_id: req.params['id'] });
    res.json({ success: true });
  }
);
