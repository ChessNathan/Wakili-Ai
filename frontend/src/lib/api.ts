import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

export const api = {
  ai: {
    draft: (body: { prompt: string; doc_type: string; title?: string; case_id?: string }) =>
      request<{ document: import('../types').Document }>('/api/ai/draft', {
        method: 'POST', body: JSON.stringify(body),
      }),
    refine: (body: { document_id: string; instruction: string }) =>
      request<{ document: import('../types').Document }>('/api/ai/refine', {
        method: 'POST', body: JSON.stringify(body),
      }),
  },
  documents: {
    list: (params?: { status?: string; doc_type?: string; case_id?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<import('../types').Document[]>(`/api/documents${q ? '?' + q : ''}`);
    },
    get: (id: string) => request<import('../types').Document>(`/api/documents/${id}`),
    update: (id: string, body: Partial<import('../types').Document>) =>
      request<import('../types').Document>(`/api/documents/${id}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/api/documents/${id}`, { method: 'DELETE' }),
  },
  cases: {
    list: () => request<import('../types').Case[]>('/api/cases'),
    get: (id: string) => request<import('../types').Case>(`/api/cases/${id}`),
    create: (body: Partial<import('../types').Case>) =>
      request<import('../types').Case>('/api/cases', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<import('../types').Case>) =>
      request<import('../types').Case>(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  clients: {
    list: () => request<import('../types').Client[]>('/api/clients'),
    create: (body: Partial<import('../types').Client>) =>
      request<import('../types').Client>('/api/clients', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<import('../types').Client>) =>
      request<import('../types').Client>(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<{ success: boolean }>(`/api/clients/${id}`, { method: 'DELETE' }),
  },
  deadlines: {
    list: () => request<import('../types').Deadline[]>('/api/deadlines'),
    create: (body: Partial<import('../types').Deadline>) =>
      request<import('../types').Deadline>('/api/deadlines', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<import('../types').Deadline>) =>
      request<import('../types').Deadline>(`/api/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  google: {
    getAuthUrl: () => request<{ url: string }>('/api/google/auth-url'),
    getStatus: () => request<{ connected: boolean; expires_at: string | null }>('/api/google/status'),
    disconnect: () => request<{ success: boolean }>('/api/google/disconnect', { method: 'DELETE' }),
    createDoc: (document_id: string) =>
      request<{ document: import('../types').Document; doc_url: string }>('/api/google/create-doc', {
        method: 'POST', body: JSON.stringify({ document_id }),
      }),
    syncFromDoc: (document_id: string) =>
      request<{ document: import('../types').Document }>('/api/google/sync-from-doc', {
        method: 'POST', body: JSON.stringify({ document_id }),
      }),
    listDriveFiles: () => request<{ files: DriveFile[] }>('/api/google/drive-files'),
  },
};
