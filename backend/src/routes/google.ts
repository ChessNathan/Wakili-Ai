import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const googleRouter = Router();

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

// Helper: get a valid OAuth2 client for a user, auto-refreshing if token is expired
async function getAuthorizedClient(userId: string) {
  const { data: tokenRow, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenRow) throw new Error('Google not connected. Please connect in Settings.');

  const oauth2 = oauthClient();
  oauth2.setCredentials({
    access_token:  tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
  });

  // If token expires within 5 minutes, refresh it proactively
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000 && tokenRow.refresh_token) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      // Persist refreshed token
      await supabase.from('google_tokens').update({
        access_token: credentials.access_token!,
        expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : new Date(Date.now() + 3600000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    } catch (refreshErr) {
      // Refresh failed — user needs to reconnect
      await supabase.from('google_tokens').delete().eq('user_id', userId);
      throw new Error('Google session expired. Please reconnect in Settings.');
    }
  }

  return oauth2;
}

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/userinfo.email',
];

// GET /api/google/auth-url  — generate the OAuth consent URL
googleRouter.get('/auth-url', (req: AuthRequest, res: Response): void => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    res.status(503).json({ error: 'Google OAuth is not configured on this server. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to your environment variables.' });
    return;
  }

  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');
  const url = oauthClient().generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent',   // always show consent so we always get a refresh_token
  });
  res.json({ url });
});

// GET /api/google/callback  — exported separately so index.ts can mount it WITHOUT requireAuth
export async function googleCallbackHandler(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    res.redirect(`${frontend}/settings?google=error&reason=${encodeURIComponent(String(error))}`);
    return;
  }
  if (!code || !state) {
    res.redirect(`${frontend}/settings?google=error&reason=missing_params`);
    return;
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const oauth2 = oauthClient();
    const { tokens } = await oauth2.getToken(code as string);
    if (!tokens.access_token) throw new Error('No access token received from Google');

    await supabase.from('google_tokens').upsert({
      user_id:       userId,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at:    tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600000).toISOString(),
      scope:      tokens.scope || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    res.redirect(`${frontend}/settings?google=connected`);
  } catch (err: any) {
    logger.error('Google callback error', { error: err.message });
    res.redirect(`${frontend}/settings?google=error&reason=${encodeURIComponent(err.message || 'token_exchange')}`);
  }
}

// GET /api/google/status
googleRouter.get('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { data } = await supabase
    .from('google_tokens')
    .select('id,expires_at')
    .eq('user_id', req.user.id)
    .single();

  res.json({ connected: !!data, expires_at: (data as any)?.expires_at || null });
});

// DELETE /api/google/disconnect
googleRouter.delete('/disconnect', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  await supabase.from('google_tokens').delete().eq('user_id', req.user.id);
  res.json({ success: true });
});

// POST /api/google/create-doc  — push a document to Google Docs + Drive
googleRouter.post('/create-doc', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { document_id } = req.body;
  if (!document_id) { res.status(400).json({ error: 'document_id required' }); return; }

  const { data: doc } = await supabase.from('documents').select('*').eq('id', document_id).single();
  if (!doc)                              { res.status(404).json({ error: 'Document not found' }); return; }
  if (doc.firm_id !== req.profile?.firm_id) { res.status(403).json({ error: 'Forbidden' }); return; }
  if (!doc.content)                      { res.status(400).json({ error: 'Document has no content to export' }); return; }

  try {
    const oauth2 = await getAuthorizedClient(req.user.id);
    const docs  = google.docs({ version: 'v1', auth: oauth2 });
    const drive = google.drive({ version: 'v3', auth: oauth2 });

    // Create a blank Google Doc
    const created = await docs.documents.create({ requestBody: { title: doc.title } });
    const docId   = created.data.documentId!;

    // Insert the document content
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{
          insertText: { location: { index: 1 }, text: doc.content },
        }],
      },
    });

    // Find or create "Wakili AI" folder in Drive
    let folderId = '';
    const folderRes = await drive.files.list({
      q: "name='Wakili AI' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)',
    });
    if (folderRes.data.files?.length) {
      folderId = folderRes.data.files[0].id!;
    } else {
      const folder = await drive.files.create({
        requestBody: { name: 'Wakili AI', mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
      });
      folderId = folder.data.id!;
    }

    await drive.files.update({ fileId: docId, addParents: folderId, fields: 'id,parents' });

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

    const { data: updated } = await supabase
      .from('documents')
      .update({
        google_doc_id:    docId,
        google_doc_url:   docUrl,
        google_drive_id:  docId,
        google_drive_url: `https://drive.google.com/file/d/${docId}/view`,
        google_synced_at: new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', document_id)
      .select()
      .single();

    res.json({ document: updated, doc_url: docUrl });
  } catch (err: any) {
    logger.error('Google create-doc error', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to create Google Doc' });
  }
});
