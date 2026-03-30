import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api, DriveFile } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Button, PageHeader, Select, DocTypeBadge, Spinner, Alert } from '../ui/UI';
import {
  Sparkles, RefreshCw, Copy, Printer, ChevronRight, FileText,
  ExternalLink, Upload, Download, CloudUpload, CloudDownload,
  Edit3, Check, X, Search, HardDrive, Save, Eye,
} from 'lucide-react';
import type { Document, Case, DocType } from '../../types';

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'pleading',      label: 'Pleading' },
  { value: 'contract',      label: 'Contract' },
  { value: 'demand_letter', label: 'Demand Letter' },
  { value: 'legal_opinion', label: 'Legal Opinion' },
  { value: 'affidavit',     label: 'Affidavit' },
  { value: 'other',         label: 'Other' },
];

const QUICK: Record<DocType, string[]> = {
  pleading:      ['Wrongful dismissal — Employment Act s.41', 'Land trespass — Land Act 2012', 'Breach of contract — Commercial Court', 'Judicial review of admin decision'],
  contract:      ['Employment contract — permanent position', 'Commercial lease agreement', 'Service Level Agreement', 'Share purchase agreement'],
  demand_letter: ['Outstanding debt payment', 'Vacate premises — landlord demand', 'Cease and desist — IP infringement', 'Breach of employment terms'],
  legal_opinion: ['Enforceability of arbitration clause', 'Directors liability under Companies Act 2015', 'Land ownership dispute', 'Employment termination compliance'],
  affidavit:     ['Supporting affidavit — injunction', 'Verifying affidavit — petition', 'Affidavit of service', 'Affidavit in support of application'],
  other:         ['Custom legal document'],
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:    { bg: '#FEF3C7', color: '#92400E' },
  review:   { bg: '#EDE9FE', color: '#5B21B6' },
  final:    { bg: '#D1FAE5', color: '#065F46' },
  archived: { bg: '#F3F4F6', color: '#6B7280' },
};

// ── Drive Import Modal ───────────────────────────────────────
function DriveImportModal({ onClose, onImport }: { onClose: () => void; onImport: (doc: Document) => void }) {
  const [files, setFiles]           = useState<DriveFile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [importing, setImporting]   = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [nextPage, setNextPage]     = useState<string | null>(null);
  const [error, setError]           = useState('');

  const loadFiles = useCallback(async (q?: string, page?: string) => {
    setLoading(true); setError('');
    try {
      const res = await api.google.driveFiles(q, page);
      setFiles(prev => page ? [...prev, ...res.files] : res.files);
      setNextPage(res.nextPageToken);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  async function handleImport(file: DriveFile) {
    setImporting(file.id); setError('');
    try {
      const res = await api.google.importFromDrive(file.id, file.name);
      onImport(res.document);
      onClose();
    } catch (e: any) { setError(e.message); setImporting(null); }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadFiles(search || undefined);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardDrive size={20} color="#3B82F6" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Import from Google Drive</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Select a Google Doc to import into Wakili AI</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={20} /></button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search your Google Docs…"
            style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }} />
          <Button type="submit" variant="secondary" size="sm" leftIcon={<Search size={14} />}>Search</Button>
        </form>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {error && <div style={{ padding: '12px 24px' }}><Alert type="error" message={error} /></div>}
          {loading && files.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
              <Spinner size={22} /> <span style={{ color: 'var(--muted)', fontSize: 14 }}>Loading your Drive files…</span>
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No Google Docs found.</div>
          ) : (
            <>
              {files.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={18} color="#3B82F6" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Modified {new Date(f.modifiedTime).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, textDecoration: 'none' }}>
                      <ExternalLink size={13} />
                    </a>
                    <Button size="sm" variant="primary" loading={importing === f.id} onClick={() => handleImport(f)} leftIcon={<Download size={13} />}>
                      Import
                    </Button>
                  </div>
                </div>
              ))}
              {nextPage && (
                <div style={{ padding: '14px 24px', textAlign: 'center' }}>
                  <Button variant="secondary" size="sm" loading={loading} onClick={() => loadFiles(search || undefined, nextPage)}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline Document Editor ───────────────────────────────────
function DocEditor({
  doc, onSave, onClose,
}: {
  doc: Document;
  onSave: (updated: Document) => void;
  onClose: () => void;
}) {
  const [content, setContent]   = useState(doc.content || '');
  const [title, setTitle]       = useState(doc.title);
  const [saving, setSaving]     = useState(false);
  const [pushing, setPushing]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const saveTimer               = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  }, [content]);

  // Autosave after 2 seconds of inactivity
  const scheduleAutosave = useCallback((newContent: string, newTitle: string) => {
    clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(() => saveToWakili(newContent, newTitle, true), 2000);
  }, []);

  async function saveToWakili(c: string, t: string, auto = false) {
    if (!auto) setSaving(true);
    setError('');
    try {
      const updated = await api.documents.update(doc.id, { content: c, title: t });
      onSave(updated as Document);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { setError(e.message); }
    finally { if (!auto) setSaving(false); }
  }

  async function pushToGoogle() {
    setPushing(true); setError('');
    try {
      // Save locally first, then push
      await api.documents.update(doc.id, { content, title });
      await api.google.pushToDoc(doc.id);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { setError(e.message); }
    finally { setPushing(false); }
  }

  async function pullFromGoogle() {
    setSyncing(true); setError('');
    try {
      const res = await api.google.syncFromDoc(doc.id);
      setContent(res.document.content || '');
      onSave(res.document);
    } catch (e: any) { setError(e.message); }
    finally { setSyncing(false); }
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    scheduleAutosave(e.target.value, title);
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    scheduleAutosave(content, e.target.value);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* Editor topbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '6px 10px', borderRadius: 7 }}>
          <X size={16} /> Close
        </button>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Editable title */}
        <input value={title} onChange={handleTitleChange}
          style={{ flex: 1, fontSize: 16, fontWeight: 600, color: 'var(--ink)', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', minWidth: 0 }}
          placeholder="Document title…" />

        {/* Status indicator */}
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>
            <Check size={14} /> Saved
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Save manually */}
          <Button size="sm" variant="secondary" loading={saving} leftIcon={<Save size={13} />}
            onClick={() => saveToWakili(content, title)}>
            Save
          </Button>

          {/* Google Docs controls — only if linked */}
          {doc.google_doc_id && (
            <>
              <Button size="sm" variant="secondary" loading={syncing}
                leftIcon={<CloudDownload size={13} />} onClick={pullFromGoogle}
                title="Pull latest changes from Google Docs into Wakili">
                Pull from Docs
              </Button>
              <Button size="sm" variant="secondary" loading={pushing}
                leftIcon={<CloudUpload size={13} />} onClick={pushToGoogle}
                title="Push your Wakili edits to the linked Google Doc">
                Push to Docs
              </Button>
            </>
          )}

          {/* Open in Google Docs */}
          {doc.google_doc_url && (
            <a href={doc.google_doc_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button size="sm" variant="secondary" leftIcon={<ExternalLink size={13} />}>Open in Google Docs</Button>
            </a>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 24px', background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
          <Alert type="error" message={error} />
        </div>
      )}

      {/* Google sync info bar */}
      {doc.google_doc_id && (
        <div style={{ background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#1E40AF' }}>
          <ExternalLink size={14} />
          <span>Linked to Google Docs</span>
          {doc.google_synced_at && (
            <span style={{ color: '#60A5FA' }}>
              · Last synced {new Date(doc.google_synced_at).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span style={{ marginLeft: 'auto', color: '#93C5FD', fontSize: 12 }}>
            Pull = Google Docs → Wakili &nbsp;|&nbsp; Push = Wakili → Google Docs
          </span>
        </div>
      )}

      {/* Editor area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 860 }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="Start typing your document here…"
            style={{
              width: '100%', border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 15, lineHeight: 2.0, color: 'var(--ink)',
              background: 'transparent', minHeight: 600,
              letterSpacing: '0.01em',
            }}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                saveToWakili(content, title);
              }
            }}
          />
        </div>
      </div>

      {/* Word count footer */}
      <div style={{ background: '#fff', borderTop: '1px solid var(--border)', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
        <span>{content.trim().split(/\s+/).filter(Boolean).length} words</span>
        <span>{content.length} characters</span>
        <span style={{ marginLeft: 'auto' }}>⌘+S to save</span>
      </div>
    </div>
  );
}

// ── Main DrafterPage ─────────────────────────────────────────
export function DrafterPage() {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  const [docType, setDocType]   = useState<DocType>('pleading');
  const [prompt, setPrompt]     = useState('');
  const [title, setTitle]       = useState('');
  const [caseId, setCaseId]     = useState('');
  const [cases, setCases]       = useState<Pick<Case, 'id' | 'title' | 'ref_number'>[]>([]);
  const [loading, setLoading]   = useState(false);
  const [refining, setRefining] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [doc, setDoc]           = useState<Document | null>(null);
  const [error, setError]       = useState('');
  const [recent, setRecent]     = useState<Document[]>([]);
  const [showRefine, setShowRefine]     = useState(false);
  const [exportingGoogle, setExportingGoogle] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<boolean | null>(null);
  const [showDriveModal, setShowDriveModal]   = useState(false);
  const [editingDoc, setEditingDoc]           = useState<Document | null>(null);
  const [view, setView]         = useState<'generate' | 'preview'>('generate');

  const fid = profile?.firm_id;

  useEffect(() => {
    if (!fid) return;
    supabase.from('cases').select('id,title,ref_number').eq('firm_id', fid).order('title')
      .then(({ data }) => setCases((data || []) as any));
    supabase.from('documents').select('*').eq('firm_id', fid).order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setRecent((data || []) as Document[]));
    api.google.status().then(s => setGoogleStatus(s.connected)).catch(() => setGoogleStatus(false));
  }, [fid]);

 
    async function generate() {
  if (!fid) return;

  // ✅ Validate FIRST
  if (!prompt.trim()) {
    setError("Please describe the matter before generating.");
    return;
  }

  setLoading(true);
  setError('');
  setDoc(null);
  setView('preview');

  try {
    const res = await api.ai.draft({
      prompt,
      doc_type: docType,
      title: title || undefined,
      case_id: caseId || undefined
    });

    setDoc(res.document);
    setRecent(prev => [res.document, ...prev.slice(0, 11)]);
  } catch (e: any) {
    setError(e.message);
    setView('generate');
  } finally {
    setLoading(false);
  }
}
  async function refine() {
    if (!doc || !instruction.trim()) return;
    setRefining(true);
    try {
      const res = await api.ai.refine({ document_id: doc.id, instruction });
      setDoc(res.document); setInstruction(''); setShowRefine(false);
      setRecent(prev => prev.map(d => d.id === res.document.id ? res.document : d));
    } catch (e: any) { setError(e.message); }
    finally { setRefining(false); }
  }

  async function changeStatus(status: string) {
    if (!doc) return;
    await supabase.from('documents').update({ status }).eq('id', doc.id);
    const updated = { ...doc, status: status as any };
    setDoc(updated);
    setRecent(prev => prev.map(d => d.id === doc.id ? updated : d));
  }

  async function exportToGoogle() {
    if (!doc) return;
    if (!googleStatus) {
      if (confirm('Google not connected. Go to Settings to connect?')) navigate('/settings');
      return;
    }
    setExportingGoogle(true); setError('');
    try {
      const res = await api.google.createDoc(doc.id);
      setDoc(res.document);
      setRecent(prev => prev.map(d => d.id === res.document.id ? res.document : d));
    } catch (e: any) { setError(e.message); }
    finally { setExportingGoogle(false); }
  }

  function handleDocSaved(updated: Document) {
    setDoc(updated);
    setRecent(prev => prev.map(d => d.id === updated.id ? updated : d));
  }

  function handleImported(imported: Document) {
    setDoc(imported);
    setRecent(prev => [imported, ...prev.slice(0, 11)]);
    setView('preview');
  }

  function print() {
    if (!doc?.content) return;
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<html><head><title>${doc.title}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;line-height:1.9;font-size:14px;}pre{white-space:pre-wrap;}</style></head><body><pre>${doc.content}</pre></body></html>`);
    w.document.close(); w.print();
  }

  if (!fid) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="AI Document Drafter" subtitle="Powered by Gemini · Kenya Law" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>No firm linked to your account</div>
        <div style={{ fontSize: 15, color: 'var(--muted)' }}>Please complete your profile setup.</div>
      </div>
    </div>
  );

  return (
    <>
      {editingDoc && (
        <DocEditor
          doc={editingDoc}
          onSave={updated => { handleDocSaved(updated); setEditingDoc(updated); }}
          onClose={() => setEditingDoc(null)}
        />
      )}

      {showDriveModal && googleStatus && (
        <DriveImportModal
          onClose={() => setShowDriveModal(false)}
          onImport={handleImported}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <PageHeader
          title="AI Document Drafter"
          subtitle="Powered by Gemini · Kenya Law Framework"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              {googleStatus && (
                <Button variant="secondary" size="sm" leftIcon={<HardDrive size={14} />}
                  onClick={() => setShowDriveModal(true)}>
                  Import from Drive
                </Button>
              )}
              <Button variant="secondary" onClick={() => { setDoc(null); setPrompt(''); setTitle(''); setView('generate'); }}>
                New Draft
              </Button>
            </div>
          }
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Left sidebar: recent docs ── */}
          <div style={{ width: 268, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Documents</div>
              {googleStatus !== false && (
                <button onClick={() => googleStatus ? setShowDriveModal(true) : navigate('/settings')}
                  title={googleStatus ? 'Import from Google Drive' : 'Connect Google to import'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: googleStatus ? 'var(--forest)' : 'var(--muted)', padding: 4, borderRadius: 5 }}>
                  <HardDrive size={14} />
                </button>
              )}
            </div>
            <div style={{ flex: 1, padding: '6px 8px', overflowY: 'auto' }}>
              {recent.length === 0 ? (
                <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                  <FileText size={28} color="var(--muted-light)" style={{ margin: '0 auto 10px' }} />
                  No documents yet.
                </div>
              ) : recent.map(d => (
                <button key={d.id} onClick={() => { setDoc(d); setView('preview'); }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, border: `1px solid ${doc?.id === d.id ? 'var(--gold-border)' : 'transparent'}`, background: doc?.id === d.id ? 'var(--gold-pale)' : 'transparent', cursor: 'pointer', marginBottom: 3, transition: 'all 0.12s' }}
                  onMouseEnter={e => { if (doc?.id !== d.id) e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={e => { if (doc?.id !== d.id) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <DocTypeBadge type={d.doc_type} />
                    {d.google_doc_id && <ExternalLink size={10} color="var(--blue)" />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(d.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Center panel ── */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* View toggle when a doc is loaded */}
            {doc && !loading && (
              <div style={{ display: 'flex', gap: 2, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
                {(['generate', 'preview'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: view === v ? 600 : 400, fontFamily: 'var(--font-body)', background: view === v ? 'var(--forest)' : 'transparent', color: view === v ? '#fff' : 'var(--muted)', transition: 'all 0.15s' }}>
                    {v === 'generate' ? '✦ Generate' : '⬜ Preview & Edit'}
                  </button>
                ))}
              </div>
            )}

            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

              {/* ── GENERATE VIEW ── */}
              {view === 'generate' && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14,  boxShadow: 'var(--shadow-sm)' }}>
                  {/* Header */}
                  <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', background: 'var(--forest)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={17} color="var(--gold-light)" />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>AI Document Drafter</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>Kenya Law Framework · Gemini AI</div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(74,222,128,0.15)', padding: '4px 12px', borderRadius: 20 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', animation: 'pulse 2s infinite' }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Active</span>
                    </div>
                  </div>

                  {/* Doc type */}
                  <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Document Type</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                      {DOC_TYPES.map(t => (
                        <button key={t.value} onClick={() => { setDocType(t.value); setPrompt(''); }}
                          style={{ padding: '7px 15px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s', border: `1.5px solid ${docType === t.value ? 'var(--forest)' : 'var(--border)'}`, background: docType === t.value ? 'var(--forest)' : '#fff', color: docType === t.value ? '#fff' : 'var(--ink)' }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Quick Start</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {QUICK[docType].map(q => (
                        <button key={q} onClick={() => setPrompt(q)}
                          style={{ padding: '5px 11px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', background: prompt === q ? 'var(--forest-dim)' : 'transparent', color: 'var(--forest)', border: '1px solid var(--gold-border)', transition: 'all 0.12s', fontWeight: prompt === q ? 600 : 400, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <ChevronRight size={10} />{q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form */}
                  <div style={{ 
                          padding: '20px 22px',
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          overflowY: 'auto'   // ✅ ADD THIS
                        }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 14, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 5 }}>Title <span style={{ color: 'var(--muted)' }}>(optional)</span></label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Plaint — Mutua v. KCB Bank"
                          style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}
                          onFocus={e => { e.target.style.borderColor = 'var(--forest)'; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,45,0.08)'; }}
                          onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }} />
                      </div>
                      <Select label="Link to Case" value={caseId} onChange={e => setCaseId(e.target.value)}>
                        <option value="">No case linked</option>
                        {cases.map(c => <option key={c.id} value={c.id}>{c.ref_number} · {c.title}</option>)}
                      </Select>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 5 }}>Describe the Matter *</label>
                      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5}
                        placeholder="Describe the matter in detail: parties involved, relevant facts, legal basis, court, relief sought, key dates…"
                        style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', lineHeight: 1.6, minHeight: 100, boxSizing: 'border-box' }}
                        onFocus={e => { e.target.style.borderColor = 'var(--forest)'; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,45,0.08)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); }} />
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Press ⌘+Enter to generate</div>
                    </div>

                    {error && <div style={{ marginBottom: 12 }}><Alert type="error" message={error} /></div>}

                    
                    <div style={{ marginTop: 16  }}>
  <Button variant="gold"
    size="lg"
    loading={loading}
    onClick={generate}
    leftIcon={<Sparkles size={17} />}
    style={{ width: '100%' }}
  >
    {loading ? 'Generating document…' : 'Generate Document'} Generate Do
  </Button>
</div>
                  </div>
                </div>
              )}

              {/* ── PREVIEW VIEW ── */}
              {view === 'preview' && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', animation: 'fadeUp 0.25s ease' }}>

                  {/* Toolbar */}
                  <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {doc && (
                      <>
                        <DocTypeBadge type={doc.doc_type} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>

                        <select value={doc.status} onChange={e => changeStatus(e.target.value)}
                          style={{ ...STATUS_STYLE[doc.status], fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', outline: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <option value="draft">Draft</option>
                          <option value="review">In Review</option>
                          <option value="final">Final</option>
                          <option value="archived">Archived</option>
                        </select>

                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Open full editor */}
                          <Button size="sm" variant="primary" leftIcon={<Edit3 size={13} />} onClick={() => setEditingDoc(doc)}>
                            Edit
                          </Button>

                          <Button size="sm" variant="secondary" leftIcon={<RefreshCw size={13} />} onClick={() => setShowRefine(!showRefine)}>
                            Refine
                          </Button>
                          <Button size="sm" variant="secondary" leftIcon={<Copy size={13} />}
                            onClick={() => doc.content && navigator.clipboard.writeText(doc.content)}>
                            Copy
                          </Button>
                          <Button size="sm" variant="secondary" leftIcon={<Printer size={13} />} onClick={print}>
                            Print
                          </Button>

                          {/* Export to Google Docs */}
                          {!doc.google_doc_id ? (
                            <Button size="sm" variant="secondary" leftIcon={<Upload size={13} />}
                              loading={exportingGoogle} onClick={exportToGoogle}
                              style={{ background: googleStatus ? undefined : '#FEF3C7', borderColor: googleStatus ? undefined : '#FCD34D' }}>
                              {googleStatus ? 'Export to Docs' : 'Connect Google →'}
                            </Button>
                          ) : (
                            <a href={doc.google_doc_url!} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                              <Button size="sm" variant="secondary" leftIcon={<ExternalLink size={13} />}>
                                Open in Docs
                              </Button>
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Google sync bar */}
                  {doc?.google_doc_id && (
                    <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)', background: '#EFF6FF', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <ExternalLink size={13} color="var(--blue)" />
                      <span style={{ color: 'var(--blue)', fontWeight: 500 }}>Linked to Google Docs</span>
                      {doc.google_synced_at && (
                        <span style={{ color: '#93C5FD', fontSize: 12 }}>
                          · Synced {new Date(doc.google_synced_at).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <Button size="sm" variant="secondary" leftIcon={<Edit3 size={12} />} onClick={() => setEditingDoc(doc)}>
                          Edit in Wakili
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Refine bar */}
                  {showRefine && doc && (
                    <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: '#FFFBEB', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={instruction} onChange={e => setInstruction(e.target.value)}
                        placeholder='e.g. "Add quantum of damages" or "Make tone more formal"'
                        style={{ flex: 1, border: '1.5px solid var(--gold-border)', borderRadius: 8, padding: '8px 13px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', background: '#fff' }}
                        onKeyDown={e => e.key === 'Enter' && refine()} />
                      <Button variant="gold" size="sm" loading={refining} onClick={refine} leftIcon={<Sparkles size={13} />}>Refine</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowRefine(false)}>Cancel</Button>
                    </div>
                  )}

                  {/* Document content */}
                  <div style={{ padding: '36px 48px', minHeight: 360 }}>
                    {loading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '60px 0' }}>
                        <Spinner size={36} color="var(--forest)" />
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)', fontWeight: 600 }}>Drafting your document…</div>
                        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Applying Kenya law framework · This may take 20–40 seconds</div>
                      </div>
                    ) : doc?.content ? (
                      <>
                        <pre style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 14, lineHeight: 2.0, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                          {doc.content}
                        </pre>
                        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                          <Button variant="primary" leftIcon={<Edit3 size={15} />} onClick={() => setEditingDoc(doc)}>
                            Open Full Editor
                          </Button>
                          {!doc.google_doc_id && googleStatus && (
                            <Button variant="secondary" leftIcon={<Upload size={15} />} loading={exportingGoogle} onClick={exportToGoogle}>
                              Export to Google Docs
                            </Button>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
