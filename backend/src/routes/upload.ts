import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { generateJSON } from '../lib/gemini';
import * as fs from 'fs';
import * as os from 'os';

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ok = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ].includes(file.mimetype);
    cb(null, ok);
  },
});

// ── Local text extraction (no AI quota used) ──────────────────────────────────
async function extractText(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'text/plain') {
      return fs.readFileSync(filePath, 'utf8');
    }
    if (mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const buffer   = fs.readFileSync(filePath);
      const data     = await pdfParse(buffer);
      return data.text || '';
    }
    if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const mammoth = require('mammoth');
      const result  = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    }
  } catch (err: any) {
    logger.warn('Text extraction failed', { error: err.message });
  }
  return '';
}

// ── Metadata extraction using shared generateJSON (Gemini → Anthropic → OpenAI) ──
async function extractMetadata(text: string, fileName: string) {
  if (!text || text.trim().length < 30) {
    return { client_name: null, document_title: fileName, case_number: null };
  }

  const prompt = `You are a Kenyan legal document parser. Extract from this text and return ONLY valid JSON, no markdown:
- "document_title": The formal title. If not found, use: "${fileName}".
- "client_name": The primary client or plaintiff full name. null if not found.
- "case_number": Any court cause/case number e.g. "HCCC No. 45 of 2024". null if not found.

Text (first 3000 chars):
---
${text.slice(0, 3000)}
---

Return only: {"document_title":"...","client_name":"...","case_number":"..."}`;

  const result = await generateJSON(prompt);
  if (!result) return { client_name: null, document_title: fileName, case_number: null };

  return {
    client_name:    result.client_name    || null,
    document_title: result.document_title || fileName,
    case_number:    result.case_number    || null,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const uploadRouter = Router();

uploadRouter.post(
  '/document',
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!req.file) { res.status(400).json({ error: 'No file uploaded or unsupported file type (PDF, DOCX, or TXT only)' }); return; }

    const firmId = req.profile?.firm_id || req.body.firm_id;
    if (!firmId) { res.status(400).json({ error: 'No firm linked to your account' }); return; }

    const filePath = req.file.path;
    try {
      const text     = await extractText(filePath, req.file.mimetype);
      const fileName = req.file.originalname;
      const meta     = await extractMetadata(text, fileName);

      const { data: doc, error } = await supabase.from('documents').insert({
        firm_id:    firmId,
        created_by: req.user.id,
        title:      meta.document_title || fileName,
        doc_type:   'other',
        content:    text.trim(),
        status:     'draft',
        source:     'uploaded',
        file_name:  fileName,
        file_size:  req.file.size,
      }).select().single();

      if (error) throw new Error(error.message);

      res.status(201).json({ document: doc, extracted_metadata: meta });
    } catch (err: any) {
      logger.error('upload error', { error: err.message });
      res.status(500).json({ error: err.message || 'Upload failed' });
    } finally {
      try { fs.unlinkSync(filePath); } catch {}
    }
  },
);
