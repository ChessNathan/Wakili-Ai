import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── Multer (disk storage so we can stream PDF/DOCX) ───────────────────────────
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

// ── Text extraction ───────────────────────────────────────────────────────────
async function extractText(filePath: string, mimeType: string): Promise<string> {
  if (mimeType === 'text/plain') {
    return fs.readFileSync(filePath, 'utf8');
  }

  if (
    mimeType === 'application/pdf' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    // Send to Gemini as a file document for extraction
    const fileData = fs.readFileSync(filePath);
    const base64   = fileData.toString('base64');
    const model    = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result   = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: mimeType as any,
        },
      },
      'Extract and return ALL text content from this document exactly as written. Do not summarise — return the full text.',
    ]);
    return result.response.text().trim();
  }

  return '';
}

// ── Metadata extraction ───────────────────────────────────────────────────────
async function extractMetadata(text: string, fileName: string) {
  const snippet = text.slice(0, 4000);
  const prompt  = `You are a Kenyan legal document parser. Extract the following from this document and return ONLY valid JSON, no markdown:
- "document_title": The formal title (e.g. "Plaint", "Sale Agreement"). If not found, use: "${fileName}".
- "client_name": The primary client or plaintiff's full name. null if not found.
- "case_number": Any court cause/case number (e.g. "HCCC No. 45 of 2024"). null if not found.

Document text:
---
${snippet}
---

Return only: {"document_title":"...","client_name":"...","case_number":"..."}`;

  try {
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return {
      client_name:    parsed.client_name    || null,
      document_title: parsed.document_title || fileName,
      case_number:    parsed.case_number    || null,
    };
  } catch {
    return { client_name: null, document_title: fileName, case_number: null };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
export const uploadRouter = Router();

// POST /api/upload/document  (multipart)
uploadRouter.post(
  '/document',
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!req.file) { res.status(400).json({ error: 'No file uploaded or unsupported type' }); return; }

    const firmId = req.profile?.firm_id || req.body.firm_id;
    if (!firmId) { res.status(400).json({ error: 'No firm linked to your account' }); return; }

    const filePath = req.file.path;
    try {
      // Extract text
      const text = await extractText(filePath, req.file.mimetype);

      // Extract metadata
      const fileName = req.file.originalname;
      const meta     = await extractMetadata(text, fileName);
      const docTitle = meta.document_title || fileName;

      // Save to DB
      const { data: doc, error } = await supabase.from('documents').insert({
        firm_id:    firmId,
        created_by: req.user.id,
        title:      docTitle,
        doc_type:   'other',
        content:    text.trim(),
        status:     'draft',
      }).select().single();

      if (error) throw new Error(error.message);

      res.status(201).json({
        document: doc,
        extracted_metadata: meta,
      });
    } catch (err: any) {
      logger.error('upload error', { error: err.message });
      res.status(500).json({ error: err.message || 'Upload failed' });
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(filePath); } catch {}
    }
  },
);
