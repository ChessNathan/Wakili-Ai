import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { generateDocument, SYSTEM_PROMPT, DOC_PROMPTS, DocType } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { body, validationResult } from 'express-validator';
import { logAudit, logger } from '../lib/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateWithOpenAI } from '../lib/openai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── Resilient JSON generation: tries Gemini models then OpenAI ───────────────
async function generateJSON(prompt: string, fallbackValue: any): Promise<any> {
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];
  for (const modelName of models) {
    try {
      const model  = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.1, maxOutputTokens: 1024 } });
      const result = await model.generateContent(prompt);
      const raw    = result.response.text().trim().replace(/```json|```/g, '').trim();
      return JSON.parse(raw);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('404') || msg.includes('not found') || msg.includes('deprecated')) {
        logger.warn('Gemini model failed for JSON gen', { model: modelName, error: msg.slice(0, 120) });
        continue;
      }
      throw err;
    }
  }
  // Fallback to OpenAI
  try {
    const raw    = await generateWithOpenAI('You are a legal JSON generator. Return only valid JSON, no markdown.', prompt);
    const clean  = raw.trim().replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return fallbackValue;
  }
}

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

    const prompt = `You are Wakili AI, a senior Kenyan legal analyst. Analyse this legal document and return ONLY valid JSON (no markdown, no extra text).

Document title: "${doc.title}"
Content (first 6000 chars):
---
${doc.content.slice(0, 6000)}
---

Return exactly this JSON shape:
{
  "summary": "2-3 sentence plain-English summary",
  "key_issues": ["up to 5 key legal issues or matters"],
  "legal_risks": ["up to 4 legal risks or weaknesses"],
  "recommended_actions": ["up to 5 concrete recommended next steps for the advocate"],
  "case_strength": "one of: strong | moderate | weak | insufficient_info",
  "relevant_laws": ["up to 6 relevant Kenyan statutes or constitutional provisions"]
}`;

    const fallback = {
      summary: 'Analysis could not be completed at this time.',
      key_issues: [], legal_risks: [], recommended_actions: [],
      case_strength: 'insufficient_info', relevant_laws: [],
    };

    try {
      const analysis = await generateJSON(prompt, fallback);
      // Ensure all required keys exist
      const safe = {
        summary:              analysis.summary              || fallback.summary,
        key_issues:           Array.isArray(analysis.key_issues)           ? analysis.key_issues           : [],
        legal_risks:          Array.isArray(analysis.legal_risks)          ? analysis.legal_risks          : [],
        recommended_actions:  Array.isArray(analysis.recommended_actions)  ? analysis.recommended_actions  : [],
        case_strength:        ['strong','moderate','weak','insufficient_info'].includes(analysis.case_strength) ? analysis.case_strength : 'insufficient_info',
        relevant_laws:        Array.isArray(analysis.relevant_laws)        ? analysis.relevant_laws        : [],
      };
      logAudit('AI_ANALYSE', req.user!.id, { doc_id: document_id });
      res.json({ analysis: safe });
    } catch (err: any) {
      logger.error('AI analyse error', { error: err.message });
      res.status(500).json({ error: 'Analysis failed. Please try again shortly.' });
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
