import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { generateJSON } from '../lib/gemini';

// Uses the shared generateJSON (Gemini → Anthropic → OpenAI fallback chain)
async function extractDocumentMetadata(text: string, fileName: string): Promise<{
  client_name: string | null;
  document_title: string | null;
  case_number: string | null;
}> {
  if (!text || text.trim().length < 30) {
    return { client_name: null, document_title: fileName, case_number: null };
  }
  const prompt = `You are a Kenyan legal document parser. Return ONLY valid JSON, no markdown:
- "document_title": The formal document title. If not found, use: "${fileName}".
- "client_name": The primary client or plaintiff full name. null if not found.
- "case_number": Any court cause/case number e.g. "HCCC No. 45 of 2024". null if not found.

Document text (first 3000 chars):
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

export const googleRouter = Router();

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

async function getAuthorizedClient(userId: string) {
  const { data: tokenRow, error } = await supabase
    .from('google_tokens').select('*').eq('user_id', userId).single();

  if (error || !tokenRow) throw new Error('Google not connected. Please connect in Settings.');

  const oauth2 = oauthClient();
  oauth2.setCredentials({
    access_token:  tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
  });

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000 && tokenRow.refresh_token) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      await supabase.from('google_tokens').update({
        access_token: credentials.access_token!,
        expires_at:   credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : new Date(Date.now() + 3600000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    } catch {
      await supabase.from('google_tokens').delete().eq('user_id', userId);
      throw new Error('Google session expired. Please reconnect in Settings.');
    }
  }
  return oauth2;
}

async function getOrCreateFolder(drive: any): Promise<string> {
  const folderRes = await drive.files.list({
    q: "name='Wakili AI' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id)',
  });
  if (folderRes.data.files?.length) return folderRes.data.files[0].id!;
  const folder = await drive.files.create({
    requestBody: { name: 'Wakili AI', mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  return folder.data.id!;
}

const SCOPES = [
  'https://www.googleapis.com/auth/drive',          // full Drive access — needed to list/read all user files
  'https://www.googleapis.com/auth/documents',       // read/write Google Docs
  'https://www.googleapis.com/auth/userinfo.email',  // identify the user
];

// ── AUTH URL ────────────────────────────────────────────────
googleRouter.get('/auth-url', (req: AuthRequest, res: Response): void => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    res.status(503).json({ error: 'Google OAuth not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI to environment.' });
    return;
  }
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');
  const url   = oauthClient().generateAuthUrl({ access_type: 'offline', scope: SCOPES, state, prompt: 'consent' });
  res.json({ url });
});

// ── OAUTH CALLBACK (public — no requireAuth) ────────────────
export async function googleCallbackHandler(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (error) { res.redirect(`${frontend}/settings?google=error&reason=${encodeURIComponent(String(error))}`); return; }
  if (!code || !state) { res.redirect(`${frontend}/settings?google=error&reason=missing_params`); return; }
  try {
    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const oauth2     = oauthClient();
    const { tokens } = await oauth2.getToken(code as string);
    if (!tokens.access_token) throw new Error('No access token received');
    await supabase.from('google_tokens').upsert({
      user_id:       userId,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at:    tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      scope:         tokens.scope || null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });
    res.redirect(`${frontend}/settings?google=connected`);
  } catch (err: any) {
    logger.error('Google callback error', { error: err.message });
    res.redirect(`${frontend}/settings?google=error&reason=${encodeURIComponent(err.message || 'token_exchange')}`);
  }
}

// ── STATUS ──────────────────────────────────────────────────
googleRouter.get('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { data } = await supabase.from('google_tokens').select('id,expires_at').eq('user_id', req.user.id).single();
  res.json({ connected: !!data, expires_at: (data as any)?.expires_at || null });
});

// ── DISCONNECT ──────────────────────────────────────────────
googleRouter.delete('/disconnect', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  await supabase.from('google_tokens').delete().eq('user_id', req.user.id);
  res.json({ success: true });
});

// ── EXPORT TO GOOGLE DOCS ───────────────────────────────────
googleRouter.post('/create-doc', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { document_id } = req.body;
  if (!document_id) { res.status(400).json({ error: 'document_id required' }); return; }

  const { data: doc } = await supabase.from('documents').select('*').eq('id', document_id).single();
  if (!doc)                                 { res.status(404).json({ error: 'Document not found' }); return; }
  if (doc.firm_id !== req.profile?.firm_id) { res.status(403).json({ error: 'Forbidden' }); return; }
  if (!doc.content)                         { res.status(400).json({ error: 'Document has no content' }); return; }

  try {
    const oauth2    = await getAuthorizedClient(req.user.id);
    const docsApi   = google.docs({ version: 'v1', auth: oauth2 });
    const driveApi  = google.drive({ version: 'v3', auth: oauth2 });

    const created = await docsApi.documents.create({ requestBody: { title: doc.title } });
    const docId   = created.data.documentId!;

    await docsApi.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: [{ insertText: { location: { index: 1 }, text: doc.content } }] },
    });

    const folderId = await getOrCreateFolder(driveApi);
    await driveApi.files.update({ fileId: docId, addParents: folderId, fields: 'id,parents' });

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    const { data: updated } = await supabase.from('documents').update({
      google_doc_id: docId, google_doc_url: docUrl,
      google_drive_id: docId, google_drive_url: `https://drive.google.com/file/d/${docId}/view`,
      google_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', document_id).select().single();

    res.json({ document: updated, doc_url: docUrl });
  } catch (err: any) {
    logger.error('create-doc error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to create Google Doc' });
  }
});

// ── SYNC BACK FROM GOOGLE DOCS → WAKILI ────────────────────
// Reads the current content of a linked Google Doc and saves it back to Wakili
googleRouter.post('/sync-from-doc', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { document_id } = req.body;
  if (!document_id) { res.status(400).json({ error: 'document_id required' }); return; }

  const { data: doc } = await supabase.from('documents').select('*').eq('id', document_id).single();
  if (!doc)                                 { res.status(404).json({ error: 'Document not found' }); return; }
  if (doc.firm_id !== req.profile?.firm_id) { res.status(403).json({ error: 'Forbidden' }); return; }
  if (!doc.google_doc_id)                   { res.status(400).json({ error: 'Document not linked to Google Docs' }); return; }

  try {
    const oauth2  = await getAuthorizedClient(req.user.id);
    const docsApi = google.docs({ version: 'v1', auth: oauth2 });

    const gdoc = await docsApi.documents.get({ documentId: doc.google_doc_id });
    const body  = gdoc.data.body;

    // Extract plain text from the Google Doc body
    let text = '';
    for (const el of body?.content || []) {
      if (el.paragraph) {
        for (const elem of el.paragraph.elements || []) {
          if (elem.textRun?.content) text += elem.textRun.content;
        }
      }
    }

    const { data: updated } = await supabase.from('documents').update({
      content:          text.trim(),
      google_synced_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }).eq('id', document_id).select().single();

    res.json({ document: updated });
  } catch (err: any) {
    logger.error('sync-from-doc error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to sync from Google Docs' });
  }
});

// ── PUSH EDITS TO GOOGLE DOCS ───────────────────────────────
// Overwrites the linked Google Doc with the current Wakili content
googleRouter.post('/push-to-doc', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { document_id } = req.body;
  if (!document_id) { res.status(400).json({ error: 'document_id required' }); return; }

  const { data: doc } = await supabase.from('documents').select('*').eq('id', document_id).single();
  if (!doc)                                 { res.status(404).json({ error: 'Document not found' }); return; }
  if (doc.firm_id !== req.profile?.firm_id) { res.status(403).json({ error: 'Forbidden' }); return; }
  if (!doc.google_doc_id)                   { res.status(400).json({ error: 'Document not linked to Google Docs' }); return; }
  if (!doc.content)                         { res.status(400).json({ error: 'No content to push' }); return; }

  try {
    const oauth2  = await getAuthorizedClient(req.user.id);
    const docsApi = google.docs({ version: 'v1', auth: oauth2 });

    // Get doc to find end index
    const gdoc     = await docsApi.documents.get({ documentId: doc.google_doc_id });
    const endIndex = (gdoc.data.body?.content?.slice(-1)[0]?.endIndex || 2) - 1;

    // Clear existing content and replace
    const requests: any[] = [];
    if (endIndex > 1) {
      requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
    }
    requests.push({ insertText: { location: { index: 1 }, text: doc.content } });

    await docsApi.documents.batchUpdate({ documentId: doc.google_doc_id, requestBody: { requests } });

    await supabase.from('documents').update({
      google_synced_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }).eq('id', document_id);

    res.json({ success: true });
  } catch (err: any) {
    logger.error('push-to-doc error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to push to Google Docs' });
  }
});

// ── LIST DRIVE FILES ────────────────────────────────────────
// Lists Google Docs in the user's Drive for import
googleRouter.get('/drive-files', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const oauth2    = await getAuthorizedClient(req.user.id);
    const driveApi  = google.drive({ version: 'v3', auth: oauth2 });

    const search   = (req.query.q as string) || '';
    const pageToken = (req.query.pageToken as string) || undefined;

    // Include Google Docs, PDFs, Word documents, and spreadsheets
    let q = "(mimeType='application/vnd.google-apps.document' or mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/msword') and trashed=false";
    if (search) q += ` and name contains '${search.replace(/'/g, "\\'")}'`;

    const result = await driveApi.files.list({
      q,
      fields: 'nextPageToken, files(id, name, modifiedTime, webViewLink, mimeType)',
      orderBy: 'modifiedTime desc',
      pageSize: 30,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      corpora: 'user',
      ...(pageToken ? { pageToken } : {}),
    });

    res.json({
      files:         result.data.files || [],
      nextPageToken: result.data.nextPageToken || null,
    });
  } catch (err: any) {
    logger.error('drive-files error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to list Drive files' });
  }
});

// ── IMPORT FROM DRIVE ───────────────────────────────────────
// Pulls a Google Doc's content and saves it as a new Wakili document
googleRouter.post('/import-from-drive', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { google_file_id, title, mimeType } = req.body;
  if (!google_file_id) { res.status(400).json({ error: 'google_file_id required' }); return;}

  const firmId = req.profile?.firm_id;
  if (!firmId) { res.status(400).json({ error: 'No firm linked to your account' }); return; }

  try {
    const oauth2   = await getAuthorizedClient(req.user.id);
    const driveApi = google.drive({ version: 'v3', auth: oauth2 });

    // Get file metadata
    const meta = await driveApi.files.get({
      fileId: google_file_id,
      fields: 'id, name, webViewLink, modifiedTime, mimeType',
      supportsAllDrives: true,
    });

    const fileName    = meta.data.name || 'Imported Document';
    const fileMime    = mimeType || meta.data.mimeType || '';
    const docUrl      = meta.data.webViewLink || '';
    let   text        = '';
    let   googleDocId: string | null = null;
    let   googleDocUrl: string | null = null;

    if (fileMime === 'application/vnd.google-apps.document') {
      // ── Google Doc: use Docs API ────────────────────────────
      const docsApi = google.docs({ version: 'v1', auth: oauth2 });
      const gdoc    = await docsApi.documents.get({ documentId: google_file_id });
      for (const el of gdoc.data.body?.content || []) {
        if (el.paragraph) {
          for (const elem of el.paragraph.elements || []) {
            if (elem.textRun?.content) text += elem.textRun.content;
          }
        }
      }
      googleDocId  = google_file_id;
      googleDocUrl = docUrl || `https://docs.google.com/document/d/${google_file_id}/edit`;

    } else if (fileMime === 'application/pdf' ||
               fileMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
               fileMime === 'application/msword') {
      // ── PDF / Word: download the raw binary, then parse locally ───
      // files.export() only works for Google Workspace native files (Docs/Sheets/Slides).
      // For real PDFs and Word files stored in Drive we must download with alt=media.
      const tmpPath = require('path').join(require('os').tmpdir(), `drive-${Date.now()}-${fileName}`);
      try {
        const dlRes = await driveApi.files.get(
          { fileId: google_file_id, alt: 'media', supportsAllDrives: true },
          { responseType: 'arraybuffer' },
        );
        const buffer = Buffer.from(dlRes.data as ArrayBuffer);
        require('fs').writeFileSync(tmpPath, buffer);

        if (fileMime === 'application/pdf') {
          const pdfParse = require('pdf-parse');
          const parsed   = await pdfParse(buffer);
          text = parsed.text || '';
        } else {
          const mammoth = require('mammoth');
          const result  = await mammoth.extractRawText({ path: tmpPath });
          text = result.value || '';
        }
      } finally {
        try { require('fs').unlinkSync(tmpPath); } catch {}
      }

    } else {
      // ── Unknown type: attempt Google export to plain text (only works for Workspace files) ──
      try {
        const exported = await driveApi.files.export(
          { fileId: google_file_id, mimeType: 'text/plain' },
          { responseType: 'text' },
        );
        text = (exported.data as string) || '';
      } catch {
        text = `[File: ${fileName} — content could not be extracted]`;
      }
    }

    // Auto-detect metadata from content using Gemini
    const extracted = await extractDocumentMetadata(text, fileName);
    const docTitle  = title || extracted.document_title || fileName;

    const { data: doc, error } = await supabase.from('documents').insert({
      firm_id:          firmId,
      created_by:       req.user.id,
      title:            docTitle,
      doc_type:         'other',
      content:          text.trim(),
      status:           'draft',
      source:           'drive_import',
      file_name:        fileName,
      google_doc_id:    googleDocId,
      google_doc_url:   googleDocUrl,
      google_drive_id:  google_file_id,
      google_drive_url: docUrl,
      google_synced_at: new Date().toISOString(),
    }).select().single();

    if (error) throw new Error(error.message);

    res.status(201).json({
      document: doc,
      extracted_metadata: {
        client_name:    extracted.client_name,
        document_title: docTitle,
        case_number:    extracted.case_number,
      },
    });
  } catch (err: any) {
    logger.error('import-from-drive error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to import from Drive' });
  }
});
