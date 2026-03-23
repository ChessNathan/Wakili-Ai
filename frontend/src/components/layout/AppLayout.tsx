import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
