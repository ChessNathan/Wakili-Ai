import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';

// ── DOCUMENTS ────────────────────────────────────────────────
export const documentsRouter = Router();

documentsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.json([]); return; }
  const { status, doc_type } = req.query;
  let q = supabase.from('documents').select('*, profiles(full_name,initials), cases(title,ref_number)').eq('firm_id', fid).order('created_at', { ascending: false });
  if (status) q = q.eq('status', status as string);
  if (doc_type) q = q.eq('doc_type', doc_type as string);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

documentsRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const { data: existing } = await supabase.from('documents').select('firm_id').eq('id', req.params.id).single();
  if (!existing || existing.firm_id !== fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const allowed = ['title','content','status','applicable_laws','google_doc_id','google_doc_url','google_drive_id','google_drive_url','google_synced_at'];
  const updates: any = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  const { data } = await supabase.from('documents').update(updates).eq('id', req.params.id).select().single();
  res.json(data);
});

documentsRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const { data: existing } = await supabase.from('documents').select('firm_id').eq('id', req.params.id).single();
  if (!existing || existing.firm_id !== fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  await supabase.from('documents').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// ── CASES ────────────────────────────────────────────────────
export const casesRouter = Router();

casesRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.json([]); return; }
  const { data } = await supabase.from('cases').select('*, clients(name), profiles(full_name,initials)').eq('firm_id', fid).order('created_at', { ascending: false });
  res.json(data || []);
});

casesRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(400).json({ error: 'No firm' }); return; }
  const { title, matter_type, court, client_id, notes } = req.body;
  if (!title || !matter_type) { res.status(400).json({ error: 'Title and matter type required' }); return; }
  const ref_number = `WK/${matter_type.substring(0,3).toUpperCase()}/${new Date().getFullYear()}/${Math.floor(Math.random()*9000)+1000}`;
  const { data, error } = await supabase.from('cases').insert({ firm_id: fid, title, matter_type, court: court||null, client_id: client_id||null, notes: notes||null, ref_number, assigned_to: req.user!.id }).select('*, clients(name)').single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

casesRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const { data: existing } = await supabase.from('cases').select('firm_id').eq('id', req.params.id).single();
  if (!existing || existing.firm_id !== fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const allowed = ['title','matter_type','court','status','notes'];
  const updates: any = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  const { data } = await supabase.from('cases').update(updates).eq('id', req.params.id).select().single();
  res.json(data);
});

// ── CLIENTS ──────────────────────────────────────────────────
export const clientsRouter = Router();

clientsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.json([]); return; }
  const { data } = await supabase.from('clients').select('*').eq('firm_id', fid).order('name');
  res.json(data || []);
});

clientsRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(400).json({ error: 'No firm' }); return; }
  const { name, email, phone, type, notes } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const { data, error } = await supabase.from('clients').insert({ firm_id: fid, name: name.trim(), email: email||null, phone: phone||null, type: type||'individual', notes: notes||null }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

clientsRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const { data: existing } = await supabase.from('clients').select('firm_id').eq('id', req.params.id).single();
  if (!existing || existing.firm_id !== fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const { name, email, phone, type, notes } = req.body;
  const { data } = await supabase.from('clients').update({ name, email, phone, type, notes }).eq('id', req.params.id).select().single();
  res.json(data);
});

clientsRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const { data: existing } = await supabase.from('clients').select('firm_id').eq('id', req.params.id).single();
  if (!existing || existing.firm_id !== fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  await supabase.from('clients').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// ── DEADLINES ────────────────────────────────────────────────
export const deadlinesRouter = Router();

deadlinesRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.json([]); return; }
  const { data } = await supabase.from('deadlines').select('*, cases(title,ref_number)').eq('firm_id', fid).eq('done', false).order('due_date', { ascending: true });
  res.json(data || []);
});

deadlinesRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(400).json({ error: 'No firm' }); return; }
  const { title, due_date, case_id, urgency } = req.body;
  if (!title || !due_date) { res.status(400).json({ error: 'Title and due date required' }); return; }
  const { data, error } = await supabase.from('deadlines').insert({ firm_id: fid, title, due_date, case_id: case_id||null, urgency: urgency||'normal', done: false }).select('*, cases(title,ref_number)').single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

deadlinesRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const fid = req.profile?.firm_id; if (!fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const { data: existing } = await supabase.from('deadlines').select('firm_id').eq('id', req.params.id).single();
  if (!existing || existing.firm_id !== fid) { res.status(403).json({ error: 'Forbidden' }); return; }
  const { done, title, due_date, urgency } = req.body;
  const updates: any = {};
  if (done !== undefined) updates.done = done;
  if (title) updates.title = title;
  if (due_date) updates.due_date = due_date;
  if (urgency) updates.urgency = urgency;
  const { data } = await supabase.from('deadlines').update(updates).eq('id', req.params.id).select().single();
  res.json(data);
});
