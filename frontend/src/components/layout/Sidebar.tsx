import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, FileText, Briefcase, Users,
  Calendar, Settings, LogOut, Scale, Wifi, WifiOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/drafter',   icon: FileText,        label: 'AI Drafter' },
  { to: '/documents', icon: Briefcase,       label: 'Documents' },
  { to: '/cases',     icon: Scale,           label: 'Cases' },
  { to: '/clients',   icon: Users,           label: 'Clients' },
  { to: '/deadlines', icon: Calendar,        label: 'Deadlines' },
];

export function Sidebar() {
  const { profile, firm, signOut } = useAuth();
  const navigate = useNavigate();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    fetch(`${api}/health`).then(r => setBackendOk(r.ok)).catch(() => setBackendOk(false));
  }, []);

  const avatar = profile?.initials || (profile?.full_name?.slice(0, 2).toUpperCase()) || 'WA';

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'var(--forest)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--forest)', fontSize: 20, flexShrink: 0 }}>W</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1 }}>Wakili AI</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Legal Intelligence</div>
          </div>
        </div>
      </div>

      {/* Firm badge */}
      {firm && (
        <div style={{ margin: '14px 14px 0', padding: '12px 14px', background: 'rgba(255,255,255,0.07)', borderRadius: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firm.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{firm.plan.charAt(0).toUpperCase() + firm.plan.slice(1)} Plan</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '0 10px', marginBottom: 8 }}>Workspace</div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
              borderRadius: 9, marginBottom: 2, textDecoration: 'none', transition: 'all 0.15s',
              background: isActive ? 'rgba(201,168,76,0.15)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(201,168,76,0.25)' : 'transparent'}`,
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={18} color={isActive ? 'var(--gold-light)' : 'rgba(255,255,255,0.45)'} />
                <span style={{ fontSize: 15, color: isActive ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: isActive ? 600 : 400 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '0 10px', marginBottom: 8, marginTop: 18 }}>Account</div>
        <NavLink to="/settings"
          style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 9, marginBottom: 2, textDecoration: 'none', transition: 'all 0.15s', background: isActive ? 'rgba(201,168,76,0.15)' : 'transparent', border: `1px solid ${isActive ? 'rgba(201,168,76,0.25)' : 'transparent'}` })}
        >
          {({ isActive }) => (
            <>
              <Settings size={18} color={isActive ? 'var(--gold-light)' : 'rgba(255,255,255,0.45)'} />
              <span style={{ fontSize: 15, color: isActive ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: isActive ? 600 : 400 }}>Settings</span>
              {backendOk !== null && (
                <span style={{ marginLeft: 'auto' }}>
                  {backendOk
                    ? <Wifi size={13} color="rgba(74,222,128,0.7)" />
                    : <WifiOff size={13} color="rgba(248,113,113,0.7)" />
                  }
                </span>
              )}
            </>
          )}
        </NavLink>
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--forest-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{avatar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Advocate'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{profile?.role?.replace('_', ' ') || 'Member'}</div>
          </div>
          <button onClick={async () => { await signOut(); navigate('/login'); }}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', transition: 'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
