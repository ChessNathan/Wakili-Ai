import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { AuthRequest } from '../middleware/requireAuth';
import { supabase } from '../lib/supabase';

export const googleRouter = Router();

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/userinfo.email',
];

// 🔗 STEP 1: Generate Google Auth URL
googleRouter.get('/auth-url', (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const state = Buffer.from(
    JSON.stringify({ userId: req.user.id })
  ).toString('base64');

  const url = oauthClient().generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent',
  });

  res.json({ url });
});

// 🔁 STEP 2: Google Callback (NO AUTH REQUIRED)
googleRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  console.log("🔥 FRONTEND_URL:", process.env.FRONTEND_URL);
  const { code, state, error } = req.query;
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error || !code || !state) {
    res.redirect(`${frontend}/settings?google=error&reason=${error || 'missing_params'}`);
    return;
  }

  try {
    // ✅ Extract userId from state (NOT req.user)
    const { userId } = JSON.parse(
      Buffer.from(state as string, 'base64').toString()
    );

    const oauth2 = oauthClient();

    const { tokens } = await oauth2.getToken(code as string);

    if (!tokens.access_token) throw new Error('No access token');

    await supabase.from('google_tokens').upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600000).toISOString(),
      scope: tokens.scope || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    res.redirect(`${frontend}?google=connected`);
  } catch (err) {
    console.error('CALLBACK ERROR:', err);
    res.redirect(`${frontend}/settings?google=error&reason=token_exchange`);
  }
});

// 📊 STEP 3: Check connection status
googleRouter.get('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { data } = await supabase
    .from('google_tokens')
    .select('id,expires_at')
    .eq('user_id', req.user.id)
    .single();

  res.json({
    connected: !!data,
    expires_at: (data as any)?.expires_at || null,
  });
});

// ❌ Disconnect Google
googleRouter.delete('/disconnect', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await supabase.from('google_tokens').delete().eq('user_id', req.user.id);

  res.json({ success: true });
});

// 📄 STEP 4: Create Google Doc
googleRouter.post('/create-doc', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { document_id } = req.body;

  if (!document_id) {
    res.status(400).json({ error: 'document_id required' });
    return;
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .single();

  if (!doc || doc.firm_id !== req.profile?.firm_id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (!doc.content) {
    res.status(400).json({ error: 'Document has no content' });
    return;
  }

  const { data: tokenRow } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', req.user.id)
    .single();

  if (!tokenRow) {
    res.status(400).json({ error: 'Google not connected' });
    return;
  }

  if (!(tokenRow as any).refresh_token) {
    res.status(400).json({
      error: 'Missing refresh token. Please reconnect Google account.',
    });
    return;
  }

  try {
    const oauth2 = oauthClient();

    oauth2.setCredentials({
      access_token: (tokenRow as any).access_token,
      refresh_token: (tokenRow as any).refresh_token,
    });

    // 🔥 AUTO REFRESH TOKEN
    oauth2.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await supabase
          .from('google_tokens')
          .update({
            access_token: tokens.access_token,
            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', req.user!.id);
      }
    });

    const docs = google.docs({ version: 'v1', auth: oauth2 });
    const drive = google.drive({ version: 'v3', auth: oauth2 });

    // 📄 Create document
    const created = await docs.documents.create({
      requestBody: { title: doc.title },
    });

    const docId = created.data.documentId!;

    // ✍️ Insert content
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: doc.content,
            },
          },
        ],
      },
    });

    // 📁 Create/find folder
    let folderId = '';

    const folderRes = await drive.files.list({
      q: "name='Wakili AI' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)',
    });

    if (folderRes.data.files?.length) {
      folderId = folderRes.data.files[0].id!;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: 'Wakili AI',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      folderId = folder.data.id!;
    }

    // Move file to folder
    await drive.files.update({
      fileId: docId,
      addParents: folderId,
      fields: 'id,parents',
    });

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

    const { data: updated } = await supabase
      .from('documents')
      .update({
        google_doc_id: docId,
        google_doc_url: docUrl,
        google_drive_id: docId,
        google_drive_url: `https://drive.google.com/file/d/${docId}/view`,
        google_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', document_id)
      .select()
      .single();

    res.json({ document: updated, doc_url: docUrl });

  } catch (err: any) {
    console.error('CREATE DOC ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});
