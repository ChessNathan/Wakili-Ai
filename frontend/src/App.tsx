import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage }     from './components/pages/LoginPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { DrafterPage }   from './components/pages/DrafterPage';
import { DocumentsPage } from './components/pages/DocumentsPage';
import { CasesPage }     from './components/pages/CasesPage';
import { ClientsPage }   from './components/pages/ClientsPage';
import { DeadlinesPage } from './components/pages/DeadlinesPage';
import { SettingsPage }  from './components/pages/SettingsPage';
import { Spinner } from './components/ui/UI';

function Guard() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, background:'var(--bg)' }}>
      <div style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:700, color:'var(--forest)', letterSpacing:'-0.5px' }}>Wakili AI</div>
      <Spinner size={28} />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Routes>
        <Route path="/"          element={<Navigate to="/dashboard" replace />} />
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
        <Route path="/*"     element={<Guard />} />
      </Routes>
    </AuthProvider>
  );
}
