import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SessionGuard } from '../ui/SessionGuard';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {children}
      </main>
      <SessionGuard />
    </div>
  );
}
