import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './components/pages/LoginPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { DrafterPage } from './components/pages/DrafterPage';
import { DocumentsPage } from './components/pages/DocumentsPage';
import { CasesPage } from './components/pages/CasesPage';
import { ClientsPage } from './components/pages/ClientsPage';
import { DeadlinesPage } from './components/pages/DeadlinesPage';
import { SettingsPage } from './components/pages/SettingsPage';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--parchment)', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--emerald)' }}>Wakili AI</div>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/drafter"   element={<DrafterPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/cases"     element={<CasesPage />} />
        <Route path="/clients"   element={<ClientsPage />} />
        <Route path="/deadlines" element={<DeadlinesPage />} />
        <Route path="/settings"  element={<SettingsPage />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}
