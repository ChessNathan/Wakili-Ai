import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { anthropic, KENYA_LEGAL_SYSTEM_PROMPT, DOC_TYPE_PROMPTS, DocType } from '../lib/anthropic';
import { supabase } from '../lib/supabase';
import { validateDraft, validateRefine, validate } from '../middleware/validators';
import { guardPromptInjection, requireOwnership } from '../middleware/security';
import { logAudit } from '../lib/logger';

export const aiRouter = Router();

// POST /api/ai/draft
aiRouter.post('/draft',
  validateDraft, validate, guardPromptInjection,
  async (req: AuthRequest, res: Response) => {
    const { prompt, doc_type, case_id, title } = req.body;

    if (!req.profile?.firm_id) {
      return res.status(400).json({ error: 'User has no firm. Please set up your firm first.' });
    }

    // Verify case belongs to firm if provided
    if (case_id) {
      const { data: caseRow } = await supabase
        .from('cases').select('firm_id').eq('id', case_id).single();
      if (!caseRow || caseRow.firm_id !== req.profile.firm_id) {
        return res.status(403).json({ error: 'Case not found in your firm.' });
      }
    }

    try {
      const typePrompt = DOC_TYPE_PROMPTS[doc_type as DocType] || DOC_TYPE_PROMPTS.other;

      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: KENYA_LEGAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `${typePrompt}\n\nMatter details:\n${prompt}\n\nProduce the complete document now.` }],
      });

      const content = message.content[0].type === 'text' ? message.content[0].text : '';

      const { data: doc, error } = await supabase
        .from('documents')
        .insert({
          firm_id: req.profile.firm_id,
          case_id: case_id || null,
          created_by: req.user!.id,
          title: title || `${doc_type} — ${new Date().toLocaleDateString('en-KE')}`,
          doc_type, content, prompt, status: 'draft',
        })
        .select().single();

      if (error) throw error;

      logAudit('AI_DRAFT_CREATED', req.user!.id, { doc_type, doc_id: doc.id });
      return res.json({ document: doc });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to generate document. Please try again.' });
    }
  }
);

// POST /api/ai/refine — verify ownership before allowing refinement
aiRouter.post('/refine',
  validateRefine, validate, guardPromptInjection,
  async (req: AuthRequest, res: Response) => {
    const { document_id, instruction } = req.body;
    const firmId = req.profile?.firm_id;

    // Ownership check inline — doc must belong to user's firm
    const { data: doc, error: fetchError } = await supabase
      .from('documents').select('*').eq('id', document_id).single();

    if (fetchError || !doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.firm_id !== firmId) return res.status(403).json({ error: 'Forbidden' });

    try {
      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: KENYA_LEGAL_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Here is the current document:\n\n${doc.content}` },
          { role: 'assistant', content: 'I have reviewed the document.' },
          { role: 'user', content: `Please refine it with this instruction: ${instruction}` },
        ],
      });

      const refined = message.content[0].type === 'text' ? message.content[0].text : '';

      const { data: updated, error } = await supabase
        .from('documents')
        .update({ content: refined, updated_at: new Date().toISOString() })
        .eq('id', document_id).select().single();

      if (error) throw error;

      logAudit('AI_REFINE', req.user!.id, { document_id });
      return res.json({ document: updated });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to refine document. Please try again.' });
    }
  }
);
