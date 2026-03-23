import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import { validateDocUpdate, validateUUIDParam, validate } from '../middleware/validators';
import { requireOwnership } from '../middleware/security';
import { logAudit } from '../lib/logger';

export const documentsRouter = Router();

const ALLOWED_STATUSES = ['draft', 'review', 'final', 'archived'];
const ALLOWED_DOC_TYPES = ['pleading', 'contract', 'demand_letter', 'legal_opinion', 'affidavit', 'other'];

documentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, doc_type, case_id } = req.query;
  const firm_id = req.profile?.firm_id;
  if (!firm_id) return res.status(400).json({ error: 'No firm found' });

  // Whitelist filter values
  if (status && !ALLOWED_STATUSES.includes(status as string))
    return res.status(422).json({ error: 'Invalid status filter' });
  if (doc_type && !ALLOWED_DOC_TYPES.includes(doc_type as string))
    return res.status(422).json({ error: 'Invalid doc_type filter' });

  let query = supabase
    .from('documents')
    .select('*, profiles(full_name, initials), cases(title, ref_number)')
    .eq('firm_id', firm_id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status as string);
  if (doc_type) query = query.eq('doc_type', doc_type as string);
  if (case_id) {
    // Validate UUID format before passing to DB
    if (!/^[0-9a-f-]{36}$/i.test(case_id as string))
      return res.status(422).json({ error: 'Invalid case_id format' });
    query = query.eq('case_id', case_id as string);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch documents' });
  return res.json(data);
});

documentsRouter.get('/:id',
  validateUUIDParam, validate,
  requireOwnership('documents'),
  async (req: AuthRequest, res: Response) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*, profiles(full_name, initials), cases(title, ref_number, court)')
      .eq('id', req.params.id).single();

    if (error) return res.status(404).json({ error: 'Document not found' });
    return res.json(data);
  }
);

documentsRouter.patch('/:id',
  validateDocUpdate, validate,
  requireOwnership('documents'),
  async (req: AuthRequest, res: Response) => {
    const allowed = ['title', 'content', 'status', 'applicable_laws'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0)
      return res.status(422).json({ error: 'No valid fields to update' });

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('documents').update(updates).eq('id', req.params.id).select().single();

    if (error) return res.status(500).json({ error: 'Failed to update document' });
    logAudit('DOCUMENT_UPDATED', req.user!.id, { document_id: req.params.id, fields: Object.keys(updates) });
    return res.json(data);
  }
);

documentsRouter.delete('/:id',
  validateUUIDParam, validate,
  requireOwnership('documents'),
  async (req: AuthRequest, res: Response) => {
    const { error } = await supabase.from('documents').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'Failed to delete document' });
    logAudit('DOCUMENT_DELETED', req.user!.id, { document_id: req.params.id });
    return res.json({ success: true });
  }
);
