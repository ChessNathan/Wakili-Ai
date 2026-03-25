import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '', password: '', fullName: '', firmName: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password);
      } else {
        await signUp(form.email, form.password, form.fullName, form.firmName);
      }
      navigate('/drafter');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--emerald)', fontFamily: 'var(--font-body)',
      backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 30px,rgba(255,255,255,0.015) 30px,rgba(255,255,255,0.015) 31px)',
    }}>
      <div style={{
        background: 'var(--parchment)', border: '1px solid var(--border)',
        borderRadius: 16, width: '100%', maxWidth: 420, padding: '36px 36px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'fadeIn 0.4s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 40, height: 40, background: 'var(--emerald)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold)', fontSize: 20 }}>W</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Wakili AI</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Legal Intelligence</div>
          </div>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
          {mode === 'login' ? 'Welcome back' : 'Create your firm account'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
          {mode === 'login' ? 'Sign in to your Wakili AI workspace.' : 'Set up your firm and start drafting in minutes.'}
        </p>

        {error && (
          <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(184,64,64,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'signup' && (
            <>
              <Field label="Full Name" type="text" placeholder="Amina Odhiambo" value={form.fullName} onChange={set('fullName')} required />
              <Field label="Firm Name" type="text" placeholder="Odhiambo & Partners" value={form.firmName} onChange={set('firmName')} required />
            </>
          )}
          <Field label="Email" type="email" placeholder="advocate@firm.co.ke" value={form.email} onChange={set('email')} required />
          <Field label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--emerald)', color: '#fff', border: 'none', borderRadius: 9,
              padding: '11px', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, marginTop: 4, fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            {loading && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button onClick={() => setMode('signup')} style={{ color: 'var(--emerald)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Sign up</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => setMode('login')} style={{ color: 'var(--emerald)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Sign in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{label}</label>
      <input
        style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--ink)', background: '#fff', outline: 'none', transition: 'border-color 0.15s' }}
        onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        {...props}
      />
    </div>
  );
}
