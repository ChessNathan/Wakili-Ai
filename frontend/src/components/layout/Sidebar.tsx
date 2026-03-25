import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const NAV = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/drafter',   icon: '✍️', label: 'AI Drafter' },
  { to: '/documents', icon: '📁', label: 'Documents' },
  { to: '/cases',     icon: '⚖️', label: 'Cases' },
  { to: '/clients',   icon: '👥', label: 'Clients' },
  { to: '/deadlines', icon: '📅', label: 'Deadlines' },
  { to: '/settings',  icon: '⚙️', label: 'Settings' },
];

const sidebarStyle: React.CSSProperties = {
  width: '242px',
  background: 'var(--emerald)',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  flexShrink: 0,
  position: 'relative',
  zIndex: 10,
  backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 20px,rgba(255,255,255,0.012) 20px,rgba(255,255,255,0.012) 21px)',
};

export function Sidebar() {
  const { profile, firm, signOut } = useAuth();
  const navigate = useNavigate();
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

  useEffect(() => {
    api.google.getStatus()
      .then(s => setGoogleConnected(s.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <aside style={sidebarStyle}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, background: 'var(--gold)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--emerald)', fontSize: 18, flexShrink: 0 }}>W</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#fff', fontSize: 16, letterSpacing: '0.01em', lineHeight: 1 }}>Wakili AI</span>
          <span style={{ fontSize: 9, color: 'var(--gold-light)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3 }}>Legal Intelligence</span>
        </div>
      </div>

      {/* Firm badge */}
      {firm && (
        <div style={{ margin: '12px 12px 0', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{firm.name}</div>
          <div style={{ fontSize: 10, color: 'var(--gold-light)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, background: '#4ade80', borderRadius: '50%', display: 'inline-block' }} />
            {firm.plan.charAt(0).toUpperCase() + firm.plan.slice(1)} Plan
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ padding: '14px 10px 8px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', padding: '0 8px', marginBottom: 6 }}>Workspace</div>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 7, marginBottom: 1,
              border: `1px solid ${isActive ? 'rgba(201,168,76,0.3)' : 'transparent'}`,
              background: isActive ? 'rgba(201,168,76,0.15)' : 'transparent',
              textDecoration: 'none', transition: 'all 0.15s',
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0, opacity: isActive ? 1 : 0.55 }}>{icon}</span>
                <span style={{ fontSize: 13, color: isActive ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: isActive ? 600 : 400 }}>{label}</span>
                {label === 'Settings' && googleConnected !== null && (
                  <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: googleConnected ? '#4ade80' : 'rgba(255,255,255,0.2)', flexShrink: 0, display: 'inline-block' }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Google nudge */}
      {googleConnected === false && (
        <div onClick={() => navigate('/settings')}
          style={{ margin: '0 12px 10px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 9, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ fontSize: 14 }}>🔗</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Connect Google</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Enable Drive & Docs</div>
          </div>
        </div>
      )}

      {/* User footer */}
      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 8, borderRadius: 8 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--gold), var(--emerald-light))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {profile?.initials || profile?.full_name?.slice(0, 2).toUpperCase() || '??'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Advocate'}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'capitalize' }}>{profile?.role?.replace('_', ' ') || 'Member'}</div>
          </div>
          <button onClick={handleSignOut} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, padding: '4px', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer' }}>↩</button>
        </div>
      </div>
    </aside>
  );
}
