import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import styles from './Sidebar.module.css';

const NAV_TOP = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/drafter',   icon: '✍️', label: 'AI Drafter' },
  { to: '/documents', icon: '📁', label: 'Documents' },
  { to: '/cases',     icon: '⚖️', label: 'Cases' },
  { to: '/clients',   icon: '👥', label: 'Clients' },
  { to: '/deadlines', icon: '📅', label: 'Deadlines' },
];

const NAV_BOTTOM = [
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

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
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>W</div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>Wakili AI</span>
          <span className={styles.logoSub}>Legal Intelligence</span>
        </div>
      </div>

      {/* Firm badge */}
      {firm && (
        <div className={styles.firmBadge}>
          <div className={styles.firmName}>{firm.name}</div>
          <div className={styles.firmPlan}>
            <span className={styles.dot} />
            {firm.plan.charAt(0).toUpperCase() + firm.plan.slice(1)} Plan
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navLabel}>Workspace</div>
        {NAV_TOP.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>{icon}</span>
            <span className={styles.navText}>{label}</span>
          </NavLink>
        ))}

        <div className={styles.navLabel} style={{ marginTop: 14 }}>System</div>

        {/* Google status row */}
        <NavLink to="/settings"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.navIcon}>⚙️</span>
          <span className={styles.navText}>Settings</span>
          {googleConnected !== null && (
            <span style={{
              marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%',
              background: googleConnected ? '#4ade80' : 'rgba(255,255,255,0.2)',
              flexShrink: 0, title: googleConnected ? 'Google connected' : 'Google not connected',
            }} title={googleConnected ? 'Google connected' : 'Connect Google'} />
          )}
        </NavLink>
      </nav>

      {/* Google connect nudge if not connected */}
      {googleConnected === false && (
        <div className={styles.googleNudge} onClick={() => navigate('/settings')}>
          <span style={{ fontSize: 14 }}>🔗</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Connect Google</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Enable Drive & Docs</div>
          </div>
        </div>
      )}

      {/* User footer */}
      <div className={styles.footer}>
        <div className={styles.userRow}>
          <div className={styles.avatar}>
            {profile?.initials || profile?.full_name?.slice(0, 2).toUpperCase() || '??'}
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{profile?.full_name || 'Advocate'}</div>
            <div className={styles.userRole}>{profile?.role?.replace('_', ' ') || 'Member'}</div>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut} title="Sign out">↩</button>
        </div>
      </div>
    </aside>
  );
}
