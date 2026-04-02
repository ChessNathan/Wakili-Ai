import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, Spinner } from '../ui/UI';
import { Settings, User, Building2, Globe, CheckCircle, XCircle, ExternalLink, Copy, Check } from 'lucide-react';

export function SettingsPage() {
  const { profile, firm } = useAuth();
  const location = useLocation();
  const [googleConnected, setGoogleConnected]   = useState<boolean | null>(null);
  const [checkingGoogle, setCheckingGoogle]     = useState(true);
  const [toast, setToast]                        = useState('');
  const [tab, setTab]                            = useState<'integrations' | 'firm' | 'account'>('integrations');
  const [copiedFirmId, setCopiedFirmId]          = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    checkGoogle();
    const p = new URLSearchParams(location.search);
    if (p.get('google') === 'connected') showToast('Google account connected!');
    else if (p.get('google') === 'error')  showToast('Google connection failed: ' + decodeURIComponent(p.get('reason') || 'unknown error'));
  }, []);

  async function checkGoogle() {
    setCheckingGoogle(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setGoogleConnected(false); setCheckingGoogle(false); return; }
      const res  = await fetch(`${apiUrl}/api/google/status`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      setGoogleConnected(data.connected);
    } catch {
      setGoogleConnected(false);
    }
    setCheckingGoogle(false);
  }

  async function connectGoogle() {
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res  = await fetch(`${apiUrl}/api/google/auth-url`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      if (!res.ok) { showToast('Error: ' + (data.error || 'Could not get Google auth URL')); return; }
      window.location.href = data.url;
    } catch (e: any) {
      showToast('Error: ' + e.message);
    }
  }

  async function disconnectGoogle() {
    if (!confirm('Disconnect Google account?')) return;
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`${apiUrl}/api/google/disconnect`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
      setGoogleConnected(false);
      showToast('Google account disconnected.');
    } catch (e: any) {
      showToast('Error: ' + e.message);
    }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 5000); }

  function copyFirmId() {
    if (!firm?.id) return;
    navigator.clipboard.writeText(firm.id);
    setCopiedFirmId(true);
    setTimeout(() => setCopiedFirmId(false), 2000);
    showToast('Firm ID copied to clipboard!');
  }

  const TABS = [
    { id: 'integrations' as const, label: 'Integrations', icon: <Globe size={15} /> },
    { id: 'firm'         as const, label: 'Firm Details',  icon: <Building2 size={15} /> },
    { id: 'account'      as const, label: 'My Account',    icon: <User size={15} /> },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <PageHeader title="Settings" subtitle="Manage integrations and account preferences" />

      {toast && (
        <div style={{ position:'fixed', top:20, right:20, background:'var(--forest)', color:'#fff', borderRadius:10, padding:'12px 20px', fontSize:14, boxShadow:'var(--shadow-lg)', zIndex:2000, animation:'fadeUp 0.2s ease', maxWidth:400 }}>
          {toast}
        </div>
      )}

      <div style={{ display:'flex', gap:4, padding:'0 28px', borderBottom:'1px solid var(--border)', background:'#fff', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'14px 16px', fontSize:15, fontWeight:tab===t.id?600:400, color:tab===t.id?'var(--forest)':'var(--muted)', borderBottom:`2px solid ${tab===t.id?'var(--gold)':'transparent'}`, marginBottom:-1, background:'none', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font-body)' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'28px' }}>

        {/* ── INTEGRATIONS ── */}
        {tab === 'integrations' && (
          <div style={{ maxWidth:680, display:'flex', flexDirection:'column', gap:20 }}>

            {/* Google OAuth card */}
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:'#F8F9FA', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:17, fontWeight:600, color:'var(--ink)' }}>Google Workspace</div>
                  <div style={{ fontSize:14, color:'var(--muted)', marginTop:3 }}>Save to Google Drive and edit in Google Docs</div>
                </div>
                {checkingGoogle ? <Spinner size={20} /> : (
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, background:googleConnected?'var(--green-dim)':'#F3F4F6', border:`1px solid ${googleConnected?'rgba(22,163,74,0.2)':'var(--border)'}` }}>
                    {googleConnected
                      ? <CheckCircle size={14} color="var(--green)" />
                      : <XCircle size={14} color="var(--muted)" />}
                    <span style={{ fontSize:13, fontWeight:600, color:googleConnected?'var(--green)':'var(--muted)' }}>
                      {googleConnected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ padding:'22px 24px' }}>
                {!googleConnected ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      {[
                        { t:'Save to Drive',        b:'Documents auto-saved to Wakili AI folder' },
                        { t:'Edit in Google Docs',  b:'Full Google Docs editing experience' },
                        { t:'Sync Changes',         b:'Pull edits back into Wakili AI' },
                        { t:'Team Sharing',         b:'Share via Google Drive permissions' },
                      ].map(f => (
                        <div key={f.t} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                          <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:4 }}>{f.t}</div>
                          <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.5 }}>{f.b}</div>
                        </div>
                      ))}
                    </div>
                    <Button variant="primary" onClick={connectGoogle} leftIcon={<ExternalLink size={15} />} style={{ alignSelf:'flex-start' }}>
                      Connect Google Account
                    </Button>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    <div style={{ background:'var(--green-dim)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:10, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                      <CheckCircle size={20} color="var(--green)" />
                      <div>
                        <div style={{ fontSize:15, fontWeight:600, color:'var(--green)' }}>Google account connected</div>
                        <div style={{ fontSize:13, color:'var(--green)', marginTop:2, opacity:0.8 }}>Drive and Docs integration is active</div>
                      </div>
                    </div>
                    <Button variant="danger" size="sm" onClick={disconnectGoogle}>Disconnect</Button>
                  </div>
                )}
              </div>
            </div>

            {/* Setup guide
            <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:14, padding:'20px 24px' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#92400E', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <Settings size={16} />Google Cloud Console Setup
              </div>
              <ol style={{ fontSize:14, color:'var(--ink)', lineHeight:2.2, paddingLeft:20, margin:0 }}>
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color:'#1A73E8', fontWeight:500 }}>console.cloud.google.com</a> → New Project → <strong>Wakili AI</strong></li>
                <li>APIs & Services → Enable <strong>Google Drive API</strong> and <strong>Google Docs API</strong></li>
                <li>Credentials → Create <strong>OAuth 2.0 Client ID</strong> → Web Application</li>
                <li>
                  Add these <strong>Authorized Redirect URIs</strong> (both):
                  <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:4 }}>
                    <code style={{ background:'#FEF3C7', padding:'3px 10px', borderRadius:5, fontSize:13, display:'block' }}>https://your-backend.onrender.com/api/google/callback</code>
                    <code style={{ background:'#FEF3C7', padding:'3px 10px', borderRadius:5, fontSize:13, display:'block' }}>http://localhost:3001/api/google/callback</code>
                  </div>
                </li>
                <li>Add <strong>GOOGLE_CLIENT_ID</strong>, <strong>GOOGLE_CLIENT_SECRET</strong>, <strong>GOOGLE_REDIRECT_URI</strong> to Render env vars</li>
                <li style={{ color:'#92400E', fontWeight:600 }}>⚠ The redirect URI in Render must EXACTLY match what's in Google Cloud Console — including no trailing slash</li>
              </ol>
            </div>
          </div>
        )}*/}

        {/* ── FIRM DETAILS ── */}
        {tab === 'firm' && (
          <div style={{ maxWidth:580 }}>
            {/* Staff invite banner */}
            {firm && (
              <div style={{ background:'linear-gradient(135deg, var(--forest) 0%, #2D6A4F 100%)', borderRadius:14, padding:'20px 24px', marginBottom:20, color:'#fff' }}>
                <div style={{ fontSize:13, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', opacity:0.6, marginBottom:8 }}>
                  Invite Staff to Your Firm
                </div>
                <div style={{ fontSize:15, opacity:0.85, marginBottom:14, lineHeight:1.5 }}>
                  Share your Firm ID with colleagues (secretaries, associates, paralegals) so they can register and join <strong>{firm.name}</strong>.
                </div>
                <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <code style={{ flex:1, fontSize:13, color:'#fff', wordBreak:'break-all', fontFamily:'monospace', letterSpacing:'0.02em' }}>
                    {firm.id}
                  </code>
                  <button
                    onClick={copyFirmId}
                    style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:8, padding:'8px 14px', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, fontFamily:'var(--font-body)', flexShrink:0, transition:'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                  >
                    {copiedFirmId ? <Check size={14} /> : <Copy size={14} />}
                    {copiedFirmId ? 'Copied!' : 'Copy ID'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', background:'var(--bg)' }}>
                <div style={{ fontSize:17, fontWeight:600, color:'var(--ink)' }}>Firm Details</div>
              </div>
              <div style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:0 }}>
                {[
                  { l:'Firm Name', v: firm?.name || '—' },
                  { l:'Plan',      v: firm ? `${firm.plan.charAt(0).toUpperCase() + firm.plan.slice(1)} Plan` : '—' },
                  { l:'Firm ID',   v: firm?.id || '—', mono: true },
                  { l:'Created',   v: firm ? new Date(firm.created_at).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' }) : '—' },
                ].map((r, i, arr) => (
                  <div key={r.l} style={{ paddingBottom:14, paddingTop:i===0?0:14, borderBottom:i<arr.length-1?'1px solid var(--border)':'none' }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>{r.l}</div>
                    <div style={{ fontSize:r.mono?13:16, color:'var(--ink)', fontFamily:r.mono?'monospace':'var(--font-body)', wordBreak:'break-all' }}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MY ACCOUNT ── */}
        {tab === 'account' && (
          <div style={{ maxWidth:540 }}>
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', background:'var(--bg)' }}>
                <div style={{ fontSize:17, fontWeight:600, color:'var(--ink)' }}>My Account</div>
              </div>
              <div style={{ padding:'22px 24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:22 }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,var(--gold),var(--forest-light))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {profile?.initials || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize:20, fontWeight:700, color:'var(--ink)' }}>{profile?.full_name}</div>
                    <div style={{ fontSize:14, color:'var(--muted)', marginTop:3, textTransform:'capitalize' }}>
                      {profile?.role?.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {[
                    { l:'Firm',         v: firm?.name || '—' },
                    { l:'Role',         v: profile?.role?.replace(/_/g,' ') || '—' },
                    { l:'User ID',      v: profile?.id || '—', mono: true },
                    { l:'Member Since', v: profile ? new Date(profile.created_at).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' }) : '—' },
                  ].map((r, i, arr) => (
                    <div key={r.l} style={{ paddingBottom:12, paddingTop:i===0?0:12, borderBottom:i<arr.length-1?'1px solid var(--border)':'none' }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>{r.l}</div>
                      <div style={{ fontSize:r.mono?13:15, color:'var(--ink)', fontFamily:r.mono?'monospace':'var(--font-body)', wordBreak:'break-all', textTransform:r.mono?'none':'capitalize' }}>{r.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
