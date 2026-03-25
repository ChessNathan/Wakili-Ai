import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { PageHeader, Button, DocTypeBadge, EmptyState, Spinner, Modal, Select } from '../ui/index';
import type { Document, DocType, DocStatus } from '../../types';

const STATUS_COLORS: Record<string, string> = { draft: '#92400e', review: '#3730a3', final: '#065f46', archived: 'var(--muted)' };
const STATUS_BG: Record<string, string> = { draft: '#fef3c7', review: '#e0e7ff', final: '#d1fae5', archived: 'var(--cream)' };

export function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Document | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  useEffect(() => {
    setLoading(true);
    api.documents.list({ doc_type: filterType || undefined, status: filterStatus || undefined })
      .then(setDocs)
      .finally(() => setLoading(false));
  }, [filterType, filterStatus]);

  const filtered = docs.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    await api.documents.delete(id);
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  async function handleStatusChange(id: string, status: string) {
    const updated = await api.documents.update(id, { status: status as DocStatus });
    setDocs(prev => prev.map(d => d.id === id ? updated : d));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Documents"
        subtitle={`${docs.length} document${docs.length !== 1 ? 's' : ''} in your firm`}
      />

      {/* Filters */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--cream)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search documents…"
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', flex: 1, minWidth: 200, background: '#fff', transition: 'border-color 0.15s' }}
          onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterStyle}>
          <option value="">All Types</option>
          <option value="pleading">Pleading</option>
          <option value="contract">Contract</option>
          <option value="demand_letter">Demand Letter</option>
          <option value="legal_opinion">Legal Opinion</option>
          <option value="affidavit">Affidavit</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterStyle}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="review">In Review</option>
          <option value="final">Final</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="📄" title="No documents found" body="Go to AI Drafter to generate your first document." />
        ) : (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 0, borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
              {['Title', 'Type', 'Status', 'Case', 'Author', ''].map((h, i) => (
                <div key={i} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{h}</div>
              ))}
            </div>
            {filtered.map((d, i) => (
              <div
                key={d.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 0, borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div onClick={() => setViewDoc(d)} style={{ padding: '13px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{new Date(d.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center' }}><DocTypeBadge type={d.doc_type} /></div>
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center' }}>
                  <select
                    value={d.status}
                    onChange={e => { e.stopPropagation(); handleStatusChange(d.id, e.target.value); }}
                    style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: 'none', background: STATUS_BG[d.status], color: STATUS_COLORS[d.status], fontWeight: 700, cursor: 'pointer', outline: 'none', textTransform: 'uppercase', letterSpacing: '0.07em' }}
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="final">Final</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.cases?.ref_number || '—'}</span>
                </div>
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.profiles?.initials || '—'}</span>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Button size="sm" onClick={() => setViewDoc(d)}>View</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(d.id)}>🗑</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View modal */}
      <Modal open={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.title || 'Document'} width={720}>
        {viewDoc && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <DocTypeBadge type={viewDoc.doc_type} />
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: STATUS_BG[viewDoc.status], color: STATUS_COLORS[viewDoc.status], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{viewDoc.status}</span>
            </div>
            <div style={{ background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}>
              <pre style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.85, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {viewDoc.content || 'No content.'}
              </pre>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <Button onClick={() => { if (viewDoc.content) navigator.clipboard.writeText(viewDoc.content); }}>📋 Copy</Button>
              <Button variant="primary" onClick={() => setViewDoc(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const filterStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px',
  fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--ink)',
  background: '#fff', outline: 'none', cursor: 'pointer',
};
