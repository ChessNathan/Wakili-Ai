import { useState } from 'react';
import { useSessionGuard } from '../../hooks/useSessionGuard';
import { supabase } from '../../lib/supabase';

export function SessionGuard() {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [countdownRef, setCountdownRef] = useState<ReturnType<typeof setInterval> | null>(null);

  function handleWarning(secs: number) {
    setSecondsLeft(secs);
    setShowWarning(true);
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    setCountdownRef(interval);
  }

  function handleExpired() {
    setShowWarning(false);
    if (countdownRef) clearInterval(countdownRef);
  }

  useSessionGuard({ onWarning: handleWarning, onExpired: handleExpired });

  async function handleStayLoggedIn() {
    await supabase.auth.refreshSession();
    setShowWarning(false);
    if (countdownRef) clearInterval(countdownRef);
  }

  async function handleLogoutNow() {
    setShowWarning(false);
    await supabase.auth.signOut();
  }

  if (!showWarning) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 3000, background: '#fff', border: '1px solid var(--gold-border)', borderRadius: 14, padding: '18px 20px', maxWidth: 340, boxShadow: '0 8px 32px rgba(15,15,15,0.18)', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>⏱️</span>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Session expiring soon</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            Logging out in <strong style={{ color: secondsLeft < 30 ? 'var(--red)' : 'var(--ink)' }}>{secondsLeft}s</strong> due to inactivity.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleStayLoggedIn} style={{ flex: 1, background: 'var(--emerald)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          Stay logged in
        </button>
        <button onClick={handleLogoutNow} style={{ flex: 1, background: 'var(--cream)', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          Log out now
        </button>
      </div>
    </div>
  );
}
