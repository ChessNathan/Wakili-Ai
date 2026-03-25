import { google } from 'googleapis';
import { supabase } from './supabase';

// ── OAuth2 Client ────────────────────────────────────────────
export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Required scopes
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',   // Create/manage files created by the app
  'https://www.googleapis.com/auth/documents',     // Read/write Google Docs
  'https://www.googleapis.com/auth/userinfo.email',
];

// ── Generate Auth URL ────────────────────────────────────────
export function getAuthUrl(state: string): string {
  const oauth2 = createOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    state,
    prompt: 'consent', // Always prompt to ensure refresh_token is returned
  });
}

// ── Load tokens for a user from Supabase ────────────────────
export async function getOAuthClientForUser(userId: string) {
  const { data: tokenRow, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenRow) {
    throw new Error('Google account not connected. Please connect Google first.');
  }

  const oauth2 = createOAuthClient();
  oauth2.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: new Date(tokenRow.expires_at).getTime(),
  });

  // Auto-refresh if expired
  oauth2.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await supabase.from('google_tokens').update({
        access_token: tokens.access_token,
        expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : new Date(Date.now() + 3600 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    }
  });

  return oauth2;
}

// ── Create Google Doc from text content ─────────────────────
export async function createGoogleDoc(
  userId: string,
  title: string,
  content: string
): Promise<{ docId: string; docUrl: string; driveId: string; driveUrl: string }> {
  const auth = await getOAuthClientForUser(userId);
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  // 1. Create empty Google Doc
  const doc = await docs.documents.create({
    requestBody: { title },
  });

  const docId = doc.data.documentId!;

  // 2. Write content into the doc using batchUpdate
  //    We format it with paragraphs split by newline
  const lines = content.split('\n');
  const requests: any[] = [];

  // Insert text from bottom-up to preserve indices
  // First insert all text as one block, then apply styles
  const fullText = content;

  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  });

  // Style the first line as a heading if it looks like a title
  const firstLine = lines.find(l => l.trim().length > 0) || '';
  if (firstLine.length > 0 && firstLine.length < 120) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: firstLine.length + 1 },
        paragraphStyle: { namedStyleType: 'HEADING_2' },
        fields: 'namedStyleType',
      },
    });
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  });

  // 3. Move to Wakili AI folder in Drive (create folder if needed)
  const folderId = await getOrCreateWakiliFolderInDrive(drive);

  await drive.files.update({
    fileId: docId,
    addParents: folderId,
    fields: 'id, parents',
  });

  // 4. Build URLs
  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
  const driveUrl = `https://drive.google.com/file/d/${docId}/view`;

  return { docId, docUrl, driveId: docId, driveUrl };
}

// ── Get or create "Wakili AI" folder in Drive ───────────────
async function getOrCreateWakiliFolderInDrive(drive: any): Promise<string> {
  // Search for existing folder
  const res = await drive.files.list({
    q: "name='Wakili AI' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: 'Wakili AI',
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return folder.data.id!;
}

// ── Sync Google Doc content back to Supabase ────────────────
export async function syncDocFromGoogle(
  userId: string,
  googleDocId: string
): Promise<string> {
  const auth = await getOAuthClientForUser(userId);
  const docs = google.docs({ version: 'v1', auth });

  const doc = await docs.documents.get({ documentId: googleDocId });

  // Extract plain text from the doc
  let text = '';
  const content = doc.data.body?.content || [];
  for (const el of content) {
    if (el.paragraph?.elements) {
      for (const elem of el.paragraph.elements) {
        if (elem.textRun?.content) text += elem.textRun.content;
      }
    }
  }

  return text;
}

// ── List files from Wakili AI Drive folder ──────────────────
export async function listDriveFiles(userId: string) {
  const auth = await getOAuthClientForUser(userId);
  const drive = google.drive({ version: 'v3', auth });

  const folderId = await getOrCreateWakiliFolderInDrive(drive);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });

  return res.data.files || [];
}
