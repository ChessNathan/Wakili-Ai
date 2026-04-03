import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { generateDocument, SYSTEM_PROMPT, DOC_PROMPTS, DocType } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { body, validationResult } from 'express-validator';
import { logAudit, logger } from '../lib/logger';

export const aiRouter = Router();

const INJECTION = [
  /ignore.*instructions/i,
  /forget.*instructions/i,
  /you are now/i,
  /act as/i,
  /system prompt/i,
  /jailbreak/i,
  /override.*rules/i,
];

// POST /api/ai/draft
aiRouter.post('/draft',
  body('prompt').trim().isLength({ min: 10, max: 5000 }).withMessage('Prompt must be 10–5000 characters'),
  body('doc_type').isIn(['pleading','contract','demand_letter','legal_opinion','affidavit','other']).withMessage('Invalid document type'),
  body('title').optional().trim().isLength({ max: 300 }),
  body('case_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: errors.array()[0].msg }); return; }

    const { prompt, doc_type, case_id, title } = req.body;
    const firmId = req.profile?.firm_id;

    if (!firmId) {
      res.status(400).json({ error: 'No firm linked to your account. Please complete your profile setup.' });
      return;
    }

    for (const p of INJECTION) {
      if (p.test(prompt)) { res.status(400).json({ error: 'Invalid input detected.' }); return; }
    }

    try {
      logger.info('AI draft started', { doc_type, userId: req.user?.id });

      const typePrompt = DOC_PROMPTS[doc_type as DocType] || DOC_PROMPTS.other;
      const fullPrompt = `${typePrompt}\n\nMatter: ${prompt}\n\nProduce the complete document now.`;

      const content = await generateDocument(SYSTEM_PROMPT, fullPrompt);

      const { data: doc, error } = await supabase.from('documents').insert({
        firm_id:    firmId,
        case_id:    case_id || null,
        created_by: req.user!.id,
        title:      title || `${doc_type.replace(/_/g,' ')} — ${new Date().toLocaleDateString('en-KE')}`,
        doc_type,
        content,
        prompt,
        status: 'draft',
      }).select().single();

      if (error) {
        logger.error('DB insert error after AI draft', { error: error.message });
        throw new Error('Failed to save document. Please try again.');
      }

      logAudit('AI_DRAFT', req.user!.id, { doc_type, doc_id: doc.id });
      logger.info('AI draft completed', { doc_id: doc.id, doc_type });
      res.json({ document: doc });
    } catch (err: any) {
      logger.error('AI draft error', { error: err.message, userId: req.user?.id });
      res.status(500).json({ error: err.message || 'Failed to generate document. Please try again.' });
    }
  }
);

// POST /api/ai/analyse
aiRouter.post('/analyse',
  body('document_id').isUUID().withMessage('Invalid document ID'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: errors.array()[0].msg }); return; }

    const { document_id } = req.body;
    const { data: doc, error: docErr } = await supabase
      .from('documents').select('*').eq('id', document_id).single();

    if (docErr || !doc) { res.status(404).json({ error: 'Document not found' }); return; }
    if (doc.firm_id !== req.profile?.firm_id) { res.status(403).json({ error: 'Forbidden' }); return; }
    if (!doc.content || doc.content.trim().length < 50) {
      res.status(400).json({ error: 'Document has too little content to analyse' }); return;
    }

    const analysisPrompt = `You are Wakili AI, a senior Kenyan legal analyst. Analyse the following legal document and return ONLY valid JSON (no markdown, no explanation).

Document title: "${doc.title}"
Document content:
---
${doc.content.slice(0, 8000)}
---

Return this exact JSON shape:
{
  "summary": "2-3 sentence plain-English summary of what this document is about",
  "key_issues": ["Array of up to 5 key legal issues or matters in this document"],
  "legal_risks": ["Array of up to 4 legal risks, weaknesses, or concerns"],
  "recommended_actions": ["Array of up to 5 concrete recommended next steps for the advocate"],
  "case_strength": "one of: strong | moderate | weak | insufficient_info",
  "relevant_laws": ["Array of up to 6 relevant Kenyan statutes, acts, or constitutional provisions"]
}`;

    try {
      const raw = await generateDocument(SYSTEM_PROMPT, analysisPrompt);
      const clean = raw.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(clean);
      logAudit('AI_ANALYSE', req.user!.id, { doc_id: document_id });
      res.json({ analysis });
    } catch (err: any) {
      logger.error('AI analyse error', { error: err.message });
      res.status(500).json({ error: err.message || 'Failed to analyse document.' });
    }
  }
);

// POST /api/ai/refine
aiRouter.post('/refine',
  body('document_id').isUUID().withMessage('Invalid document ID'),
  body('instruction').trim().isLength({ min: 5, max: 2000 }).withMessage('Instruction must be 5–2000 characters'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: errors.array()[0].msg }); return; }

    const { document_id, instruction } = req.body;

    const { data: doc, error: docErr } = await supabase
      .from('documents').select('*').eq('id', document_id).single();

    if (docErr || !doc) { res.status(404).json({ error: 'Document not found' }); return; }
    if (doc.firm_id !== req.profile?.firm_id) { res.status(403).json({ error: 'Forbidden' }); return; }
    if (!doc.content) { res.status(400).json({ error: 'Document has no content to refine' }); return; }

    try {
      const refinePrompt = `You are refining an existing legal document.\n\nCurrent document:\n\n${doc.content}\n\n---\nInstruction: ${instruction}\n\nReturn the complete updated document with the changes applied.`;
      const refined = await generateDocument(SYSTEM_PROMPT, refinePrompt);

      const { data: updated, error: updateErr } = await supabase
        .from('documents')
        .update({ content: refined, updated_at: new Date().toISOString() })
        .eq('id', document_id)
        .select()
        .single();

      if (updateErr) throw new Error('Failed to save refined document.');

      logAudit('AI_REFINE', req.user!.id, { doc_id: document_id });
      res.json({ document: updated });
    } catch (err: any) {
      logger.error('AI refine error', { error: err.message });
      res.status(500).json({ error: err.message || 'Failed to refine document.' });
    }
  }
);
