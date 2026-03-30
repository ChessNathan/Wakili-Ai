import { useState, FormEvent, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Scale, Lock, Mail, User, Building2, Eye, EyeOff, Hash } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Alert, Spinner } from '../ui/UI';

type Mode = 'login' | 'signup' | 'signup_staff';

export function LoginPage() {
  const { signIn, signUp, signUpStaff } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [mode, setMode]         = useState<Mode>('login');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [firmName, setFirmName] = useState('');      // shown after firm_id lookup
  const [lookingUpFirm, setLookingUpFirm] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', fullName: '', firmName: '', firmId: '', role: 'advocate',
  });

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const expired = new URLSearchParams(location.search).get('reason') === 'session_expired';
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Look up firm name when firm_id is typed
  async function lookupFirm(id: string) {
    if (id.length < 36) { setFirmName(''); return; }
    setLookingUpFirm(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/firm-info?firm_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      setFirmName(res.ok ? data.name : '');
      if (!res.ok) setError('Firm not found. Please check the Firm ID.');
    } catch {
      setFirmName('');
    }
    setLookingUpFirm(false);
  }

  function validate(): string | null {
    if (!form.email.includes('@')) return 'Enter a valid email address.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (mode === 'signup' || mode === 'signup_staff') {
      if (!form.fullName.trim()) return 'Full name is required.';
      if (!/[A-Z]/.test(form.password)) return 'Password needs an uppercase letter.';
      if (!/[0-9]/.test(form.password)) return 'Password needs a number.';
    }
    if (mode === 'signup' && !form.firmName.trim()) return 'Firm name is required.';
    if (mode === 'signup_staff' && form.firmId.length < 36) return 'Enter the Firm ID from your firm\'s Settings page.';
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password);
      } else if (mode === 'signup') {
        await signUp(form.email, form.password, form.fullName, form.firmName);
      } else {
        await signUpStaff(form.email, form.password, form.fullName, form.firmId, form.role);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: Mode) { setMode(m); setError(''); setFirmName(''); }

  const titles: Record<Mode, string> = {
    login:        'Welcome back',
    signup:       'Create your firm account',
    signup_staff: 'Join your firm',
  };
  const subtitles: Record<Mode, string> = {
    login:        'Sign in to your Wakili AI workspace.',
    signup:       'Set up your firm and start drafting today.',
    signup_staff: 'Join an existing firm using your Firm ID.',
  };

  return (
    <div style={{ minHeight:'100vh', width:'100vw', display:'flex', background:'var(--bg)' }}>
      {/* Left panel */}
      <div style={{ width:'42%', background:'var(--forest)', display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle at 20% 50%, rgba(201,168,76,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.03) 0%, transparent 50%)', pointerEvents:'none' }} />
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:60 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Scale size={26} color="var(--forest)" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700, color:'#fff', lineHeight:1 }}>Wakili AI</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4, letterSpacing:'0.12em', textTransform:'uppercase' }}>Legal Intelligence</div>
            </div>
          </div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:36, fontWeight:700, color:'#fff', lineHeight:1.25, marginBottom:20 }}>
            Your AI-powered<br />legal workspace
          </h2>
          <p style={{ fontSize:16, color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:48 }}>
            Draft pleadings, contracts, and legal opinions with the power of AI — tailored to Kenyan law.
          </p>
          {['AI document drafting in seconds','Full Kenya law framework','Case & client management','Google Docs integration'].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'rgba(201,168,76,0.2)', border:'1px solid rgba(201,168,76,0.4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--gold)' }} />
              </div>
              <span style={{ fontSize:15, color:'rgba(255,255,255,0.7)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}>
        <div style={{ width:'100%', maxWidth:460, animation:'fadeUp 0.4s ease' }}>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:700, color:'var(--ink)', marginBottom:8 }}>
            {titles[mode]}
          </h1>
          <p style={{ fontSize:16, color:'var(--muted)', marginBottom:32 }}>{subtitles[mode]}</p>

          {expired && (
            <div style={{ marginBottom:20 }}>
              <Alert type="error" message="Your session expired. Please sign in again." />
            </div>
          )}
          {error && (
            <div style={{ marginBottom:20 }}>
              <Alert type="error" message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {/* Staff: firm ID lookup */}
            {mode === 'signup_staff' && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:14, fontWeight:500, color:'var(--ink-2)' }}>
                  Firm ID <span style={{ color:'var(--muted)', fontWeight:400, fontSize:13 }}>(from your firm's Settings page)</span>
                </label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none', display:'flex' }}>
                    <Hash size={16} />
                  </div>
                  <input
                    value={form.firmId}
                    onChange={e => {
                      set('firmId')(e);
                      lookupFirm(e.target.value);
                    }}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={{ border:'1.5px solid var(--border)', borderRadius:9, padding:'11px 14px 11px 42px', fontSize:14, fontFamily:'monospace', color:'var(--ink)', background:'#fff', outline:'none', width:'100%', transition:'border-color 0.15s' }}
                    onFocus={e => { e.target.style.borderColor='var(--forest)'; e.target.style.boxShadow='0 0 0 3px rgba(27,58,45,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; }}
                    disabled={loading}
                  />
                  {lookingUpFirm && (
                    <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }}>
                      <Spinner size={14} color="var(--forest)" />
                    </div>
                  )}
                </div>
                {firmName && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'#D1FAE5', border:'1px solid rgba(22,163,74,0.3)', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#065F46' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#16A34A', flexShrink:0 }} />
                    Joining: <strong>{firmName}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Names */}
            {(mode === 'signup' || mode === 'signup_staff') && (
              <Field icon={<User size={16} />} label="Full Name" type="text" placeholder="Amina Odhiambo" value={form.fullName} onChange={set('fullName')} autoComplete="name" disabled={loading} required />
            )}

            {/* Founder: firm name */}
            {mode === 'signup' && (
              <Field icon={<Building2 size={16} />} label="Firm Name" type="text" placeholder="Odhiambo & Partners" value={form.firmName} onChange={set('firmName')} autoComplete="organization" disabled={loading} required />
            )}

            {/* Staff: role selection */}
            {mode === 'signup_staff' && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:14, fontWeight:500, color:'var(--ink-2)' }}>Your Role</label>
                <select
                  value={form.role}
                  onChange={set('role')}
                  disabled={loading}
                  style={{ border:'1.5px solid var(--border)', borderRadius:9, padding:'11px 14px', fontSize:15, fontFamily:'var(--font-body)', color:'var(--ink)', background:'#fff', outline:'none', cursor:'pointer' }}
                >
                  <option value="advocate">Advocate</option>
                  <option value="associate">Associate</option>
                  <option value="secretary">Secretary</option>
                  <option value="paralegal">Paralegal</option>
                </select>
              </div>
            )}

            <Field icon={<Mail size={16} />} label="Email Address" type="email" placeholder="advocate@firm.co.ke" value={form.email} onChange={set('email')} autoComplete="email" disabled={loading} required />

            <div style={{ position:'relative' }}>
              <Field icon={<Lock size={16} />} label="Password" type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={loading} required />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position:'absolute', right:14, bottom:11, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', display:'flex' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {(mode === 'signup' || mode === 'signup_staff') && (
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>
                Password: 8+ characters, one uppercase letter, one number.
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ background:'var(--forest)', color:'#fff', border:'none', borderRadius:10, padding:'14px', fontSize:16, fontWeight:600, cursor:loading?'not-allowed':'pointer', fontFamily:'var(--font-body)', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:loading?0.7:1, transition:'all 0.15s', marginTop:4 }}>
              {loading && <Spinner size={17} color="#fff" />}
              {loading
                ? (mode==='login' ? 'Signing in…' : 'Creating account…')
                : (mode==='login' ? 'Sign In' : mode==='signup' ? 'Create Firm Account' : 'Join Firm')}
            </button>
          </form>

          <div style={{ marginTop:28, paddingTop:24, borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10, textAlign:'center', fontSize:15, color:'var(--muted)' }}>
            {mode === 'login' ? (
              <div>
                Don't have an account?{' '}
                <button onClick={() => switchMode('signup')} style={{ color:'var(--forest)', fontWeight:600, background:'none', border:'none', cursor:'pointer', fontSize:15, textDecoration:'underline', textUnderlineOffset:2 }}>
                  Create firm account
                </button>
                {' '}·{' '}
                <button onClick={() => switchMode('signup_staff')} style={{ color:'var(--forest)', fontWeight:600, background:'none', border:'none', cursor:'pointer', fontSize:15, textDecoration:'underline', textUnderlineOffset:2 }}>
                  Join existing firm
                </button>
              </div>
            ) : (
              <>
                <div>
                  Already have an account?{' '}
                  <button onClick={() => switchMode('login')} style={{ color:'var(--forest)', fontWeight:600, background:'none', border:'none', cursor:'pointer', fontSize:15, textDecoration:'underline', textUnderlineOffset:2 }}>
                    Sign in
                  </button>
                </div>
                {mode === 'signup' ? (
                  <div style={{ fontSize:14 }}>
                    Joining an existing firm?{' '}
                    <button onClick={() => switchMode('signup_staff')} style={{ color:'var(--forest)', fontWeight:600, background:'none', border:'none', cursor:'pointer', fontSize:14, textDecoration:'underline', textUnderlineOffset:2 }}>
                      Join with Firm ID
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize:14 }}>
                    Creating a new firm?{' '}
                    <button onClick={() => switchMode('signup')} style={{ color:'var(--forest)', fontWeight:600, background:'none', border:'none', cursor:'pointer', fontSize:14, textDecoration:'underline', textUnderlineOffset:2 }}>
                      Register your firm
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, ...props }: { icon: ReactNode; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { icon: _, ...rest } = { icon, ...props };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ fontSize:14, fontWeight:500, color:'var(--ink-2)' }}>{label}</label>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', pointerEvents:'none', display:'flex' }}>{icon}</div>
        <input
          style={{ border:'1.5px solid var(--border)', borderRadius:9, padding:'11px 14px 11px 42px', fontSize:15, fontFamily:'var(--font-body)', color:'var(--ink)', background:props.disabled?'var(--bg)':'#fff', outline:'none', width:'100%', transition:'border-color 0.15s, box-shadow 0.15s' }}
          onFocus={e => { e.target.style.borderColor='var(--forest)'; e.target.style.boxShadow='0 0 0 3px rgba(27,58,45,0.1)'; }}
          onBlur={e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; }}
          {...rest}
        />
      </div>
    </div>
  );
}
