import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { Document } from '../../types';

interface Props {
  document: Document;
  onUpdate: (updated: Document) => void;
}

export function GoogleDocButton({ document, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.google.getStatus()
      .then(s => setGoogleConnected(s.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  async function handleConnectGoogle() {
    try {
      const { url } = await api.google.getAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateDoc() {
    if (!document.content) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.google.createDoc(document.id);
      onUpdate(res.document);
      // Open the doc in a new tab
      window.open(res.doc_url, '_blank');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncBack() {
    setSyncing(true);
    setError('');
    try {
      const res = await api.google.syncFromDoc(document.id);
      onUpdate(res.document);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  if (googleConnected === null) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Error */}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--red)', background: 'var(--red-dim)', padding: '6px 10px', borderRadius: 6 }}>
          {error}
        </div>
      )}

      {/* Not connected */}
      {!googleConnected && (
        <button onClick={handleConnectGoogle} style={btnStyle('#fff', '#1a1a1a', '#dadce0')}>
          <GoogleIcon />
          Connect Google
        </button>
      )}

      {/* Connected, no doc yet */}
      {googleConnected && !document.google_doc_id && (
        <button onClick={handleCreateDoc} disabled={loading || !document.content} style={btnStyle('#fff', '#1a1a1a', '#dadce0', loading || !document.content)}>
          {loading
            ? <Spin />
            : <GoogleDocsIcon />
          }
          {loading ? 'Creating Doc…' : 'Open in Google Docs'}
        </button>
      )}

      {/* Doc already exists */}
      {googleConnected && document.google_doc_id && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <a
            href={document.google_doc_url!}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...btnStyle('#1a73e8', '#fff', '#1a73e8'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <GoogleDocsIcon color="#fff" />
            Edit in Google Docs ↗
          </a>
          <button onClick={handleSyncBack} disabled={syncing} style={btnStyle('#fff', '#1a1a1a', '#dadce0', syncing)}>
            {syncing ? <Spin /> : '↓'}
            {syncing ? 'Syncing…' : 'Pull Changes'}
          </button>
        </div>
      )}

      {/* Last synced */}
      {document.google_synced_at && (
        <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#34a853' }}>●</span>
          Synced {new Date(document.google_synced_at).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, color: string, border: string, disabled = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
    fontFamily: 'var(--font-body)', cursor: disabled ? 'not-allowed' : 'pointer',
    background: bg, color, border: `1px solid ${border}`,
    opacity: disabled ? 0.6 : 1, transition: 'all 0.15s', whiteSpace: 'nowrap',
  };
}

function Spin() {
  return <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />;
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function GoogleDocsIcon({ color = '#4285F4' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill={color === '#fff' ? 'rgba(255,255,255,0.9)' : '#4285F4'}/>
      <path d="M14 2v6h6" fill={color === '#fff' ? 'rgba(255,255,255,0.5)' : '#a8c7fa'}/>
      <path d="M8 13h8M8 16h5" stroke={color === '#fff' ? 'rgba(26,115,232,0.8)' : 'white'} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
