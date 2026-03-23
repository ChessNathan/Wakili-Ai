import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';

export const documentsRouter = Router();

// GET /api/documents
documentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, doc_type, case_id } = req.query;
  const firm_id = req.profile?.firm_id;
  if (!firm_id) return res.status(400).json({ error: 'No firm found' });

  let query = supabase
    .from('documents')
    .select(`*, profiles(full_name, initials), cases(title, ref_number)`)
    .eq('firm_id', firm_id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (doc_type) query = query.eq('doc_type', doc_type);
  if (case_id) query = query.eq('case_id', case_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// GET /api/documents/:id
documentsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('documents')
    .select(`*, profiles(full_name, initials), cases(title, ref_number, court)`)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Document not found' });
  return res.json(data);
});

// PATCH /api/documents/:id
documentsRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  const allowed = ['title', 'content', 'status', 'applicable_laws'];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// DELETE /api/documents/:id
documentsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabase.from('documents').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});
