import { Router, Response, Request } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';
import {
  getAuthUrl, createOAuthClient, createGoogleDoc,
  syncDocFromGoogle, listDriveFiles, getOAuthClientForUser,
} from '../lib/google';

export const googleRouter = Router();

googleRouter.get('/auth-url', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');
  res.json({ url: getAuthUrl(state) });
});

googleRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';

  if (error) { res.redirect(`${frontendUrl}/settings?google=error&reason=${error}`); return; }
  if (!code || !state) { res.redirect(`${frontendUrl}/settings?google=error&reason=missing_params`); return; }

  try {
    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const oauth2 = createOAuthClient();
    const { tokens } = await oauth2.getToken(code as string);
    if (!tokens.access_token) throw new Error('No access token received');

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

    res.redirect(`${frontendUrl}?google=connected`);
  } catch (err) {
    res.redirect(`${frontendUrl}/settings?google=error&reason=token_exchange`);
  }
});

googleRouter.get('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { data } = await supabase
    .from('google_tokens').select('id, expires_at, scope').eq('user_id', req.user.id).single();
  res.json({ connected: !!data, expires_at: (data as any)?.expires_at ?? null });
});

googleRouter.delete('/disconnect', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const auth = await getOAuthClientForUser(req.user.id);
    const creds = await auth.getAccessToken();
    if (creds.token) await auth.revokeToken(creds.token);
  } catch (_) { /* ignore */ }
  await supabase.from('google_tokens').delete().eq('user_id', req.user.id);
  res.json({ success: true });
});

googleRouter.post('/create-doc', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { document_id } = req.body;
  if (!document_id) { res.status(400).json({ error: 'document_id is required' }); return; }

  const { data: doc } = await supabase.from('documents').select('*').eq('id', document_id).single();
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
  if (!(doc as any).content) { res.status(400).json({ error: 'Document has no content yet' }); return; }

  try {
    const { docId, docUrl, driveId, driveUrl } = await createGoogleDoc(
      req.user.id, (doc as any).title, (doc as any).content
    );
    const { data: updated, error } = await supabase
      .from('documents')
      .update({ google_doc_id: docId, google_doc_url: docUrl, google_drive_id: driveId, google_drive_url: driveUrl, google_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', document_id).select().single();
    if (error) throw error;
    res.json({ document: updated, doc_url: docUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

googleRouter.post('/sync-from-doc', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { document_id } = req.body;
  if (!document_id) { res.status(400).json({ error: 'document_id is required' }); return; }

  const { data: doc } = await supabase.from('documents').select('google_doc_id').eq('id', document_id).single();
  if (!(doc as any)?.google_doc_id) { res.status(400).json({ error: 'No linked Google Doc' }); return; }

  try {
    const content = await syncDocFromGoogle(req.user.id, (doc as any).google_doc_id);
    const { data: updated, error } = await supabase
      .from('documents')
      .update({ content, google_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', document_id).select().single();
    if (error) throw error;
    res.json({ document: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

googleRouter.get('/drive-files', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const files = await listDriveFiles(req.user.id);
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
