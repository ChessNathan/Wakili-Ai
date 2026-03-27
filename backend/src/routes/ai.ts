import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { generateDocument, SYSTEM_PROMPT, DOC_PROMPTS, DocType } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { body, validationResult } from 'express-validator';
import { logAudit, logger } from '../lib/logger';

export const aiRouter = Router();

const INJECTION = [/ignore.*instructions/i, /forget.*instructions/i, /you are now/i, /act as/i, /system prompt/i];

aiRouter.post('/draft',
  body('prompt').trim().isLength({ min: 10, max: 5000 }),
  body('doc_type').isIn(['pleading','contract','demand_letter','legal_opinion','affidavit','other']),
  body('title').optional().trim().isLength({ max: 300 }),
  body('case_id').optional().isUUID(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: errors.array()[0].msg }); return; }

    const { prompt, doc_type, case_id, title } = req.body;
    const firmId = req.profile?.firm_id;
    if (!firmId) { res.status(400).json({ error: 'No firm linked to your account' }); return; }

    for (const p of INJECTION) {
      if (p.test(prompt)) { res.status(400).json({ error: 'Invalid input' }); return; }
    }

    try {
      const typePrompt = DOC_PROMPTS[doc_type as DocType] || DOC_PROMPTS.other;
      const content = await generateDocument(SYSTEM_PROMPT, `${typePrompt}\n\nMatter: ${prompt}\n\nProduce the complete document.`);

      const { data: doc, error } = await supabase.from('documents').insert({
        firm_id: firmId,
        case_id: case_id || null,
        created_by: req.user!.id,
        title: title || `${doc_type} — ${new Date().toLocaleDateString('en-KE')}`,
        doc_type, content, prompt, status: 'draft',
      }).select().single();

      if (error) throw error;
      logAudit('AI_DRAFT', req.user!.id, { doc_type });
      res.json({ document: doc });
    } catch (err: any) {
      logger.error('AI draft error', { error: err.message });
      res.status(500).json({ error: 'Failed to generate document. Please try again.' });
    }
  }
);

aiRouter.post('/refine',
  body('document_id').isUUID(),
  body('instruction').trim().isLength({ min: 5, max: 2000 }),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: errors.array()[0].msg }); return; }

    const { document_id, instruction } = req.body;
    const { data: doc } = await supabase.from('documents').select('*').eq('id', document_id).single();
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
    if (doc.firm_id !== req.profile?.firm_id) { res.status(403).json({ error: 'Forbidden' }); return; }

    try {
      const refined = await generateDocument(SYSTEM_PROMPT,
        `Current document:\n\n${doc.content}\n\n---\nInstruction: ${instruction}\n\nReturn the complete updated document.`
      );
      const { data: updated } = await supabase.from('documents')
        .update({ content: refined, updated_at: new Date().toISOString() })
        .eq('id', document_id).select().single();
      res.json({ document: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to refine document' });
    }
  }
);
