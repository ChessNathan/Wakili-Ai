import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [mode, setMode]       = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm] = useState({ email: '', password: '', fullName: '', firmName: '' });

  const sessionExpired = new URLSearchParams(location.search).get('reason') === 'session_expired';
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function validateForm(): string | null {
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'Please enter a valid email address.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (mode === 'signup') {
      if (!form.fullName.trim()) return 'Full name is required.';
      if (!/[A-Z]/.test(form.password)) return 'Password must contain an uppercase letter.';
      if (!/[0-9]/.test(form.password)) return 'Password must contain a number.';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validateForm();
    if (err) { setError(err); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password);
      } else {
        await signUp(form.email, form.password, form.fullName, form.firmName);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100vw',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--emerald)', fontFamily: 'var(--font-body)',
      backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 30px,rgba(255,255,255,0.015) 30px,rgba(255,255,255,0.015) 31px)',
      padding: '20px', boxSizing: 'border-box',
    }}>
      <div style={{
        background: 'var(--parchment)', border: '1px solid var(--border)',
        borderRadius: 18, width: '100%', maxWidth: 440,
        padding: '40px 40px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        animation: 'fadeIn 0.4s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, background: 'var(--emerald)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)', fontSize: 22, flexShrink: 0 }}>W</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>Wakili AI</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3 }}>Legal Intelligence · Kenya</div>
          </div>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          {mode === 'login' ? 'Welcome back' : 'Create your firm account'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.5 }}>
          {mode === 'login' ? 'Sign in to your Wakili AI workspace.' : 'Set up your firm and start drafting in minutes.'}
        </p>

        {sessionExpired && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 18, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>⏱️</span> Your session expired. Please sign in again.
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(184,64,64,0.25)', borderRadius: 9, padding: '11px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
          {mode === 'signup' && (
            <>
              <Field label="Full Name" type="text" placeholder="Amina Odhiambo" value={form.fullName} onChange={set('fullName')} required autoComplete="name" disabled={loading} />
              <Field label="Firm Name" type="text" placeholder="Odhiambo & Partners" value={form.firmName} onChange={set('firmName')} autoComplete="organization" disabled={loading} />
            </>
          )}
          <Field label="Email" type="email" placeholder="advocate@firm.co.ke" value={form.email} onChange={set('email')} required autoComplete="email" disabled={loading} />
          <Field label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={loading} />

          {mode === 'signup' && (
            <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--cream)', borderRadius: 8, padding: '9px 13px', lineHeight: 1.6 }}>
              8+ characters · one uppercase letter · one number
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            background: loading ? 'var(--emerald-mid)' : 'var(--emerald)',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '13px', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-display)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.15s', marginTop: 4, letterSpacing: '0.02em',
          }}>
            {loading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />}
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); }}
                style={{ color: 'var(--emerald)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); }}
                style={{ color: 'var(--emerald)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                Sign in
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 11, color: 'var(--muted-light)' }}>
          🔒 Secured · Kenya Law Framework · Supabase Cloud
        </div>
      </div>
    </div>
  );
}

function Field({ label, disabled, ...props }: { label: string; disabled?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{label}</label>
      <input disabled={disabled}
        style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--ink)', background: disabled ? 'var(--cream)' : '#fff', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s', width: '100%', boxSizing: 'border-box', opacity: disabled ? 0.7 : 1 }}
        onFocus={e => { if (!disabled) { e.target.style.borderColor = 'var(--gold)'; e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.12)'; }}}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
        {...props}
      />
    </div>
  );
}
