import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { api, DriveFile } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, Spinner, EmptyState } from '../ui/index';

export function SettingsPage() {
  const { profile, firm } = useAuth();
  const location = useLocation();
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleExpiry, setGoogleExpiry] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState<'google' | 'firm' | 'account'>('google');

  const checkGoogleStatus = useCallback(async () => {
    try {
      const s = await api.google.getStatus();
      setGoogleConnected(s.connected);
      setGoogleExpiry(s.expires_at);
    } catch {
      setGoogleConnected(false);
    }
  }, []);

  useEffect(() => {
    checkGoogleStatus();
    // Show toast if redirected from Google OAuth
    const params = new URLSearchParams(location.search);
    if (params.get('google') === 'connected') {
      showToast('✅ Google account connected successfully!');
      checkGoogleStatus();
    } else if (params.get('google') === 'error') {
      showToast(`❌ Google connection failed: ${params.get('reason') || 'unknown error'}`);
    }
  }, [location.search, checkGoogleStatus]);

  useEffect(() => {
    if (googleConnected && activeTab === 'google') {
      loadDriveFiles();
    }
  }, [googleConnected, activeTab]);

  async function loadDriveFiles() {
    setLoadingFiles(true);
    try {
      const res = await api.google.listDriveFiles();
      setDriveFiles(res.files);
    } catch {
      setDriveFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await api.google.getAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      showToast(`❌ ${err.message}`);
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect your Google account? Existing Google Docs links will still work.')) return;
    setDisconnecting(true);
    try {
      await api.google.disconnect();
      setGoogleConnected(false);
      setDriveFiles([]);
      showToast('Google account disconnected.');
    } catch (err: any) {
      showToast(`❌ ${err.message}`);
    } finally {
      setDisconnecting(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  const tabs = [
    { id: 'google', label: '🔗 Google Integration' },
    { id: 'firm',   label: '🏛️ Firm Details' },
    { id: 'account', label: '👤 My Account' },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Settings" subtitle="Manage integrations, firm details, and account preferences" />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 2000, animation: 'fadeIn 0.2s ease' }}>
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--cream)', flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '10px 16px', fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400, color: activeTab === t.id ? 'var(--emerald)' : 'var(--muted)', borderBottom: `2px solid ${activeTab === t.id ? 'var(--gold)' : 'transparent'}`, marginBottom: -1, background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* ── GOOGLE TAB ── */}
        {activeTab === 'google' && (
          <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Connection card */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'var(--cream)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <GoogleIcon size={28} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Google Account</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Connect to enable Google Drive storage and Google Docs editing</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {googleConnected === null ? <Spinner /> :
                   googleConnected
                    ? <StatusPill connected />
                    : <StatusPill connected={false} />
                  }
                </div>
              </div>
              <div style={{ padding: '20px 22px' }}>
                {googleConnected === false && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                      Connecting your Google account allows Wakili AI to:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { icon: '📂', title: 'Save to Drive', body: 'All AI drafts saved to a "Wakili AI" folder in your Google Drive' },
                        { icon: '📝', title: 'Edit in Google Docs', body: 'Open any document in Google Docs for full formatting and collaboration' },
                        { icon: '🔄', title: 'Sync Changes', body: 'Pull edits made in Google Docs back into Wakili AI with one click' },
                        { icon: '👥', title: 'Share with Team', body: 'Share documents with colleagues via Google Drive permissions' },
                      ].map(f => (
                        <div key={f.title} style={{ background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{f.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{f.body}</div>
                        </div>
                      ))}
                    </div>
                    <Button variant="primary" loading={connecting} onClick={handleConnect} icon="🔗" style={{ alignSelf: 'flex-start', padding: '10px 22px' }}>
                      Connect Google Account
                    </Button>
                  </div>
                )}

                {googleConnected === true && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px' }}>
                      <span style={{ fontSize: 24 }}>✅</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Google account connected</div>
                        <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                          {googleExpiry ? `Token valid until ${new Date(googleExpiry).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Token active'}
                        </div>
                      </div>
                      <Button variant="danger" size="sm" loading={disconnecting} onClick={handleDisconnect} style={{ marginLeft: 'auto' }}>
                        Disconnect
                      </Button>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button variant="ghost" size="sm" onClick={loadDriveFiles} icon="🔄">Refresh Drive Files</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drive files browser */}
            {googleConnected && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📂</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>Wakili AI Drive Folder</span>
                  </div>
                  <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'underline' }}>
                    Open Drive ↗
                  </a>
                </div>
                <div style={{ padding: '16px' }}>
                  {loadingFiles ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Spinner /></div>
                  ) : driveFiles.length === 0 ? (
                    <EmptyState icon="📄" title="No files yet" body="Documents you generate will appear here after opening in Google Docs." />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {driveFiles.map(f => (
                        <a key={f.id} href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', textDecoration: 'none', transition: 'all 0.15s', background: '#fff' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--parchment)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fff'; }}
                        >
                          <span style={{ fontSize: 20, flexShrink: 0 }}>
                            {f.mimeType.includes('document') ? '📝' : f.mimeType.includes('spreadsheet') ? '📊' : '📄'}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                              Modified {new Date(f.modifiedTime).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: '#1a73e8', fontWeight: 500, flexShrink: 0 }}>Open ↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Google Cloud Console setup guide */}
            <div style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 14, padding: '18px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--emerald)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚙️ Developer Setup — Google Cloud Console
              </div>
              <ol style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 2, paddingLeft: 18 }}>
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1a73e8' }}>console.cloud.google.com</a> → New Project → Name it <strong>Wakili AI</strong></li>
                <li>APIs & Services → Enable API → Enable <strong>Google Drive API</strong> and <strong>Google Docs API</strong></li>
                <li>APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web Application</li>
                <li>Add Authorised redirect URI: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11 }}>https://your-backend.onrender.com/api/google/callback</code></li>
                <li>Copy <strong>Client ID</strong> and <strong>Client Secret</strong> → paste into your backend <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11 }}>.env</code></li>
                <li>OAuth Consent Screen → Add your domain → Add test users (your email)</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── FIRM TAB ── */}
        {activeTab === 'firm' && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>Firm Details</div>
              </div>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <InfoRow label="Firm Name" value={firm?.name || '—'} />
                <InfoRow label="Plan" value={firm ? `${firm.plan.charAt(0).toUpperCase() + firm.plan.slice(1)} Plan` : '—'} />
                <InfoRow label="Firm ID" value={firm?.id || '—'} mono />
                <InfoRow label="Created" value={firm ? new Date(firm.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
              </div>
            </div>
          </div>
        )}

        {/* ── ACCOUNT TAB ── */}
        {activeTab === 'account' && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>My Account</div>
              </div>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--emerald-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                    {profile?.initials || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{profile?.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{profile?.role?.replace('_', ' ')}</div>
                  </div>
                </div>
                <InfoRow label="Role" value={profile?.role?.replace(/_/g, ' ') || '—'} />
                <InfoRow label="User ID" value={profile?.id || '—'} mono />
                <InfoRow label="Member Since" value={profile ? new Date(profile.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: connected ? '#d1fae5' : 'var(--cream)', color: connected ? '#065f46' : 'var(--muted)', border: `1px solid ${connected ? '#a7f3d0' : 'var(--border)'}` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#10b981' : 'var(--muted-light)', display: 'inline-block' }} />
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
