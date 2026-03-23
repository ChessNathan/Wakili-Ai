import { Router, Response, Request } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import {
  getAuthUrl,
  createOAuthClient,
  createGoogleDoc,
  syncDocFromGoogle,
  listDriveFiles,
  getOAuthClientForUser,
} from '../lib/google';

export const googleRouter = Router();

// ── GET /api/google/auth-url
// Returns the Google OAuth consent URL for the frontend to redirect to
googleRouter.get('/auth-url', (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // State encodes the user ID so we know who to save tokens for
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');
  const url = getAuthUrl(state);
  return res.json({ url });
});

// ── GET /api/google/callback
// Google redirects here after user grants permission
googleRouter.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    return res.redirect(`${frontendUrl}/settings?google=error&reason=${error}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/settings?google=error&reason=missing_params`);
  }

  try {
    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    // Exchange code for tokens
    const oauth2 = createOAuthClient();
    const { tokens } = await oauth2.getToken(code as string);

    if (!tokens.access_token) throw new Error('No access token received');

    // Upsert tokens in Supabase
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    await supabase.from('google_tokens').upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return res.redirect(`${frontendUrl}?google=connected`);
  } catch (err: any) {
    console.error('[Google callback error]', err.message);
    return res.redirect(`${frontendUrl}/settings?google=error&reason=token_exchange`);
  }
});

// ── GET /api/google/status
// Check if the current user has Google connected
googleRouter.get('/status', async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { data } = await supabase
    .from('google_tokens')
    .select('id, expires_at, scope')
    .eq('user_id', req.user.id)
    .single();

  return res.json({ connected: !!data, expires_at: data?.expires_at ?? null });
});

// ── DELETE /api/google/disconnect
// Remove the user's Google tokens
googleRouter.delete('/disconnect', async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // Revoke the token from Google too
  try {
    const auth = await getOAuthClientForUser(req.user.id);
    const creds = await auth.getAccessToken();
    if (creds.token) await auth.revokeToken(creds.token);
  } catch (_) { /* ignore if already expired */ }

  await supabase.from('google_tokens').delete().eq('user_id', req.user.id);
  return res.json({ success: true });
});

// ── POST /api/google/create-doc
// Create a Google Doc from a Wakili AI document
googleRouter.post('/create-doc', async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { document_id } = req.body;
  if (!document_id) return res.status(400).json({ error: 'document_id is required' });

  // Fetch the Wakili document
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .single();

  if (fetchErr || !doc) return res.status(404).json({ error: 'Document not found' });
  if (!doc.content) return res.status(400).json({ error: 'Document has no content yet' });

  try {
    const { docId, docUrl, driveId, driveUrl } = await createGoogleDoc(
      req.user.id,
      doc.title,
      doc.content
    );

    // Save Google IDs back to Supabase
    const { data: updated, error: updateErr } = await supabase
      .from('documents')
      .update({
        google_doc_id: docId,
        google_doc_url: docUrl,
        google_drive_id: driveId,
        google_drive_url: driveUrl,
        google_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', document_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return res.json({ document: updated, doc_url: docUrl });
  } catch (err: any) {
    console.error('[Create Google Doc error]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/google/sync-from-doc
// Pull latest content from Google Docs back into Supabase
googleRouter.post('/sync-from-doc', async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { document_id } = req.body;
  if (!document_id) return res.status(400).json({ error: 'document_id is required' });

  const { data: doc } = await supabase
    .from('documents')
    .select('google_doc_id')
    .eq('id', document_id)
    .single();

  if (!doc?.google_doc_id) {
    return res.status(400).json({ error: 'This document has no linked Google Doc' });
  }

  try {
    const content = await syncDocFromGoogle(req.user.id, doc.google_doc_id);

    const { data: updated, error } = await supabase
      .from('documents')
      .update({
        content,
        google_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', document_id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ document: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/google/drive-files
// List all files in the Wakili AI Drive folder
googleRouter.get('/drive-files', async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const files = await listDriveFiles(req.user.id);
    return res.json({ files });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
