import { supabase } from './supabase';
import type { Document, Case, Client, Deadline } from '../types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...opts.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

export const api = {
  ai: {
    draft: (b: { prompt: string; doc_type: string; title?: string; case_id?: string }) =>
      req<{ document: Document }>('/api/ai/draft', { method: 'POST', body: JSON.stringify(b) }),
    refine: (b: { document_id: string; instruction: string }) =>
      req<{ document: Document }>('/api/ai/refine', { method: 'POST', body: JSON.stringify(b) }),
  },
  documents: {
    list: (p?: { status?: string; doc_type?: string }) => {
      const qs = new URLSearchParams(p as any).toString();
      return req<Document[]>(`/api/documents${qs ? '?' + qs : ''}`);
    },
    update: (id: string, b: Partial<Document>) =>
      req<Document>(`/api/documents/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
    delete: (id: string) =>
      req<{ success: boolean }>(`/api/documents/${id}`, { method: 'DELETE' }),
  },
  cases: {
    list: () => req<Case[]>('/api/cases'),
    create: (b: Partial<Case>) => req<Case>('/api/cases', { method: 'POST', body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Case>) =>
      req<Case>(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  },
  clients: {
    list: () => req<Client[]>('/api/clients'),
    create: (b: Partial<Client>) => req<Client>('/api/clients', { method: 'POST', body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Client>) =>
      req<Client>(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
    delete: (id: string) => req<{ success: boolean }>(`/api/clients/${id}`, { method: 'DELETE' }),
  },
  deadlines: {
    list: () => req<Deadline[]>('/api/deadlines'),
    create: (b: Partial<Deadline>) =>
      req<Deadline>('/api/deadlines', { method: 'POST', body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Deadline>) =>
      req<Deadline>(`/api/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  },
};
