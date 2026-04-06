import { useState, useEffect, useRef, useCallback, DragEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import {
  PageHeader, Button, DocTypeBadge, EmptyState, Spinner, Modal, Alert,
} from '../ui/UI';
import {
  FileText, Trash2, Eye, Copy, Printer, Upload, HardDrive, Bell,
  Sparkles, X, Check, ChevronRight, AlertCircle, Search, Calendar,
  User, Briefcase, BookOpen, TrendingUp, Shield, Lightbulb, RefreshCw,
} from 'lucide-react';
import type { Document, DocStatus, Case, Client, Deadline } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExtractedMeta {
  client_name: string | null;
  document_title: string | null;
  case_number: string | null;
}

interface AIAnalysis {
  summary: string;
  key_issues: string[];
  legal_risks: string[];
  recommended_actions: string[];
  case_strength: 'strong' | 'moderate' | 'weak' | 'insufficient_info';
  relevant_laws: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:    { bg: '#FEF3C7', color: '#92400E' },
  review:   { bg: '#EDE9FE', color: '#5B21B6' },
  final:    { bg: '#D1FAE5', color: '#065F46' },
  archived: { bg: '#F3F4F6', color: '#6B7280' },
};

const STRENGTH_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  strong:            { bg: '#D1FAE5', color: '#065F46',  label: '💪 Strong Case'       },
  moderate:          { bg: '#FEF3C7', color: '#92400E',  label: '⚖️ Moderate Case'     },
  weak:              { bg: '#FEE2E2', color: '#991B1B',  label: '⚠️ Weak Case'         },
  insufficient_info: { bg: '#F3F4F6', color: '#6B7280',  label: '❓ Insufficient Info' },
};

const DRIVE_ICONS: Record<string, string> = {
  'application/vnd.google-apps.document':      '📝',
  'application/pdf':                           '📄',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📃',
  'application/msword':                        '📃',
  'application/vnd.google-apps.spreadsheet':  '📊',
  default:                                     '📁',
};
const driveIcon = (mime: string) => DRIVE_ICONS[mime] || DRIVE_ICONS.default;

const fStyle: React.CSSProperties = {
  border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 14px',
  fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--ink)',
  background: '#fff', outline: 'none', cursor: 'pointer', transition: 'border-color 0.15s',
};

// Upload file via backend (multipart)
async function uploadFile(file: File, firmId: string, token: string, base: string) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('firm_id', firmId);
  const res = await fetch(`${base}/api/upload/document`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'Upload failed');
  return json as { document: Document; extracted_metadata: ExtractedMeta };
}

// ─── Drag-and-drop zone ───────────────────────────────────────────────────────
function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setOver(false);
    const accepted = Array.from(e.dataTransfer.files).filter(f =>
      ['application/pdf', 'application/msword',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'text/plain'].includes(f.type),
    );
    if (accepted.length) onFiles(accepted);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      style={{
        border: `2px dashed ${over ? 'var(--forest)' : 'var(--border)'}`,
        borderRadius: 14, padding: '36px 24px', textAlign: 'center',
        background: over ? '#f0fdf4' : 'var(--bg)', cursor: 'pointer',
        transition: 'all 0.15s', marginBottom: 24,
      }}
    >
      <Upload size={32} color={over ? 'var(--forest)' : 'var(--muted)'}
        style={{ display: 'block', margin: '0 auto 10px' }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
        {over ? 'Drop to upload' : 'Drag & drop documents here'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        PDF, Word (.docx), or plain text · or{' '}
        <span style={{ color: 'var(--forest)', fontWeight: 600 }}>browse files</span>
      </div>
      <input ref={ref} type="file" multiple accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); }}
      />
    </div>
  );
}

// ─── Drive file picker modal ──────────────────────────────────────────────────
function DrivePickerModal({
  open, onClose, onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (fileId: string, mimeType: string, fileName: string) => void;
}) {
  const [files, setFiles]       = useState<any[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [err, setErr]           = useState('');

  const load = useCallback(async (q = '', pageToken?: string) => {
    setLoading(true); setErr('');
    try {
      const res = await api.google.driveFiles(q || undefined, pageToken);
      setFiles(prev => pageToken ? [...prev, ...(res.files || [])] : (res.files || []));
      setNextPage(res.nextPageToken);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) { setFiles([]); setSearch(''); setNextPage(null); load(); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { setFiles([]); setNextPage(null); load(search); }, 350);
    return () => clearTimeout(t);
  }, [search, open]);

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Import from Google Drive" width={560}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents, PDFs, Word files…"
            style={{ ...fStyle, width: '100%', paddingLeft: 34, boxSizing: 'border-box', cursor: 'text' }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          Shows Google Docs, PDFs, Word documents and spreadsheets
        </div>
      </div>
      {err && (
        <div style={{ marginBottom: 8 }}>
          <Alert type="error" message={err} />
          <button onClick={() => setErr('')} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>Dismiss</button>
        </div>
      )}
      <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        {loading && !files.length
          ? <div style={{ padding: 32, textAlign: 'center' }}><Spinner size={24} /></div>
          : files.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No files found</div>
            : files.map((f, i) => (
              <div key={f.id} onClick={() => onImport(f.id, f.mimeType || '', f.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderBottom: i < files.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <span style={{ fontSize: 20 }}>{driveIcon(f.mimeType || '')}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {new Date(f.modifiedTime).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--muted)" />
              </div>
            ))
        }
        {nextPage && (
          <div style={{ padding: 10, textAlign: 'center' }}>
            <Button variant="ghost" size="sm" onClick={() => load(search, nextPage)} loading={loading}>Load more</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Metadata confirmation modal ──────────────────────────────────────────────
function MetaConfirmModal({
  open, meta, cases, clients, loading, onConfirm, onClose,
}: {
  open: boolean;
  meta: ExtractedMeta;
  cases: Case[];
  clients: Client[];
  loading: boolean;
  onConfirm: (data: { title: string; client_id: string | null; case_id: string | null }) => void;
  onClose: () => void;
}) {
  const [title, setTitle]    = useState(meta.document_title || '');
  const [clientId, setClient] = useState('');
  const [caseId, setCase]     = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(meta.document_title || '');
    if (meta.client_name) {
      const n = meta.client_name.toLowerCase();
      const m = clients.find(c => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
      setClient(m?.id || '');
    } else { setClient(''); }
    if (meta.case_number) {
      const n = meta.case_number.toLowerCase().replace(/\s/g, '');
      const m = cases.find(c => c.ref_number.toLowerCase().replace(/\s/g, '').includes(n));
      setCase(m?.id || '');
    } else { setCase(''); }
  }, [open, meta, clients, cases]);

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Confirm Document Details" width={480}>
      <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 16px' }}>
        AI-detected metadata below. Confirm or adjust before saving.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Document Title</span>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...fStyle, cursor: 'text' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <User size={13} style={{ display: 'inline', marginRight: 4 }} />Client
            {meta.client_name && <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>· detected: "{meta.client_name}"</span>}
          </span>
          <select value={clientId} onChange={e => setClient(e.target.value)} style={fStyle}>
            <option value="">— No client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            <Briefcase size={13} style={{ display: 'inline', marginRight: 4 }} />Case
            {meta.case_number && <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>· detected: "{meta.case_number}"</span>}
          </span>
          <select value={caseId} onChange={e => setCase(e.target.value)} style={fStyle}>
            <option value="">— No case —</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.ref_number} — {c.title}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" loading={loading} leftIcon={<Check size={14} />}
          onClick={() => onConfirm({ title: title.trim() || 'Untitled', client_id: clientId || null, case_id: caseId || null })}>
          Save Document
        </Button>
      </div>
    </Modal>
  );
}

// ─── Reminder modal ───────────────────────────────────────────────────────────
function ReminderModal({
  open, cases, onSave, onClose,
}: {
  open: boolean;
  cases: Case[];
  onSave: (r: Partial<Deadline>) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle]     = useState('');
  const [dueDate, setDueDate] = useState('');
  const [urgency, setUrgency] = useState<'urgent' | 'soon' | 'normal'>('normal');
  const [caseId, setCase]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => { if (open) { setTitle(''); setDueDate(''); setUrgency('normal'); setCase(''); setErr(''); } }, [open]);

  async function save() {
    if (!title.trim()) { setErr('Please enter a reminder title'); return; }
    if (!dueDate)       { setErr('Please select a due date'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({ title: title.trim(), due_date: dueDate, urgency, case_id: caseId || null, done: false });
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Set Reminder" width={440}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, marginBottom: 16, border: '1px solid #bbf7d0' }}>
        <Bell size={16} color="var(--forest)" />
        <span style={{ fontSize: 13, color: '#065F46' }}>Create a deadline reminder for this document.</span>
      </div>
      {err && <Alert type="error" message={err} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Reminder Title *</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. File response by deadline"
            style={{ ...fStyle, cursor: 'text' }} />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Due Date *</span>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...fStyle, cursor: 'text' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Urgency</span>
            <select value={urgency} onChange={e => setUrgency(e.target.value as any)} style={fStyle}>
              <option value="normal">🟢 Normal</option>
              <option value="soon">🟡 Soon</option>
              <option value="urgent">🔴 Urgent</option>
            </select>
          </label>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Link to Case (optional)</span>
          <select value={caseId} onChange={e => setCase(e.target.value)} style={fStyle}>
            <option value="">— No case —</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.ref_number} — {c.title}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" leftIcon={<Bell size={14} />} onClick={save} loading={saving}>Set Reminder</Button>
      </div>
    </Modal>
  );
}

// ─── AI Analysis side panel ────────────────────────────────────────────────────
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ color: 'var(--forest)' }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function AIAnalysisPanel({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  const run = useCallback(async () => {
    if (!doc.content || doc.content.trim().length < 50) { setErr('Document has too little content to analyse.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await (api.ai as any).analyseDocument(doc.id);
      setAnalysis(res.analysis);
    } catch (e: any) { setErr(e.message || 'Analysis failed'); }
    finally { setLoading(false); }
  }, [doc.id]);

  useEffect(() => { run(); }, [doc.id]);

  const strength = analysis ? STRENGTH_STYLE[analysis.case_strength] : null;

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
      background: '#fff', borderLeft: '1px solid var(--border)',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.09)',
      display: 'flex', flexDirection: 'column', zIndex: 1000,
    }}>
      <div style={{
        padding: '18px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--forest)', color: '#fff',
      }}>
        <Sparkles size={18} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>AI Case Analyser</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 0' }}>
            <Spinner size={32} />
            <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>Analysing against Kenyan law…</div>
          </div>
        )}
        {err && !loading && (
          <div>
            <Alert type="error" message={err} />
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={13} />} onClick={run} style={{ marginTop: 8 }}>Retry</Button>
          </div>
        )}
        {analysis && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {strength && (
              <div style={{ ...strength, borderRadius: 10, padding: '12px 16px', fontWeight: 700, fontSize: 14, textAlign: 'center', border: `1px solid ${strength.color}` }}>
                {strength.label}
              </div>
            )}

            <Section icon={<BookOpen size={15} />} title="Summary">
              <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7, margin: 0 }}>{analysis.summary}</p>
            </Section>

            {analysis.key_issues?.length > 0 && (
              <Section icon={<AlertCircle size={15} />} title="Key Legal Issues">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {analysis.key_issues.map((issue, i) => (
                    <li key={i} style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.65, marginBottom: 4 }}>{issue}</li>
                  ))}
                </ul>
              </Section>
            )}

            {analysis.legal_risks?.length > 0 && (
              <Section icon={<Shield size={15} />} title="Legal Risks">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {analysis.legal_risks.map((risk, i) => (
                    <li key={i} style={{ fontSize: 14, color: '#991B1B', lineHeight: 1.65, marginBottom: 4 }}>{risk}</li>
                  ))}
                </ul>
              </Section>
            )}

            {analysis.recommended_actions?.length > 0 && (
              <Section icon={<Lightbulb size={15} />} title="Recommended Actions">
                {analysis.recommended_actions.map((action, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '8px 12px',
                    background: '#f0fdf4', borderRadius: 8, marginBottom: 6, border: '1px solid #bbf7d0',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)', minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{action}</span>
                  </div>
                ))}
              </Section>
            )}

            {analysis.relevant_laws?.length > 0 && (
              <Section icon={<TrendingUp size={15} />} title="Relevant Kenyan Laws">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {analysis.relevant_laws.map((law, i) => (
                    <span key={i} style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20, background: '#EDE9FE', color: '#5B21B6' }}>{law}</span>
                  ))}
                </div>
              </Section>
            )}

            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={13} />} onClick={run}>Re-analyse</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function DocumentsPage() {
  const { profile } = useAuth();
  const [docs, setDocs]                 = useState<Document[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterType, setFilterType]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]             = useState('');
  const [viewDoc, setViewDoc]           = useState<Document | null>(null);
  const [cases, setCases]               = useState<Case[]>([]);
  const [clients, setClients]           = useState<Client[]>([]);

  const [driveOpen, setDriveOpen]           = useState(false);
  const [importingDrive, setImportingDrive] = useState(false);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);

  const [pendingMeta, setPendingMeta]   = useState<ExtractedMeta | null>(null);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [savingMeta, setSavingMeta]     = useState(false);

  const [reminderDocId, setReminderDocId] = useState<string | null>(null);
  const [analysingDoc, setAnalysingDoc]   = useState<Document | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fid  = profile?.firm_id;
  const BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => { if (fid) { load(); loadMeta(); } }, [fid, filterType, filterStatus]);

  async function load() {
    setLoading(true);
    let q = supabase.from('documents').select('*, profiles(full_name,initials), cases(title,ref_number)').eq('firm_id', fid!).order('created_at', { ascending: false });
    if (filterType)   q = q.eq('doc_type', filterType);
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data } = await q;
    setDocs((data || []) as Document[]);
    setLoading(false);
  }

  async function loadMeta() {
    const [c, cl] = await Promise.all([api.cases.list(), api.clients.list()]);
    setCases(c); setClients(cl);
  }

  const filtered = docs.filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()));

  async function handleDelete(id: string) {
    if (!confirm('Delete this document permanently?')) return;
    await supabase.from('documents').delete().eq('id', id);
    setDocs(prev => prev.filter(d => d.id !== id));
    if (viewDoc?.id === id)     setViewDoc(null);
    if (analysingDoc?.id === id) setAnalysingDoc(null);
  }

  async function handleStatus(id: string, status: string) {
    await supabase.from('documents').update({ status }).eq('id', id);
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status: status as DocStatus } : d));
    if (viewDoc?.id === id) setViewDoc(prev => prev ? { ...prev, status: status as DocStatus } : null);
  }

  // ── File drop/browse ──────────────────────────────────────────────────────
  async function handleFileDrop(files: File[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !fid) return;
    setUploadingNames(files.map(f => f.name));
    try {
      if (files.length === 1) {
        const res = await uploadFile(files[0], fid, session.access_token, BASE);
        setPendingDocId(res.document.id);
        setPendingMeta(res.extracted_metadata);
      } else {
        for (const file of files) {
          const res = await uploadFile(file, fid, session.access_token, BASE);
          setDocs(prev => [res.document, ...prev]);
        }
        setAlert({ type: 'success', msg: `${files.length} files uploaded successfully` });
      }
    } catch (e: any) {
      setAlert({ type: 'error', msg: e.message || 'Upload failed' });
    } finally { setUploadingNames([]); }
  }

  // ── Drive import ──────────────────────────────────────────────────────────
  async function handleDriveImport(fileId: string, mimeType: string) {
    setDriveOpen(false); setImportingDrive(true);
    try {
      const res = await (api.google as any).importFromDrive(fileId, undefined, mimeType);
      setPendingDocId(res.document.id);
      setPendingMeta(res.extracted_metadata);
    } catch (e: any) {
      setAlert({ type: 'error', msg: e.message || 'Drive import failed' });
    } finally { setImportingDrive(false); }
  }

  // ── Meta confirmation ─────────────────────────────────────────────────────
  async function handleMetaConfirm({ title, client_id, case_id }: {
    title: string; client_id: string | null; case_id: string | null;
  }) {
    if (!pendingDocId) return;
    setSavingMeta(true);
    try {
      const { data: updated } = await supabase.from('documents')
        .update({ title, case_id, updated_at: new Date().toISOString() })
        .eq('id', pendingDocId)
        .select('*, profiles(full_name,initials), cases(title,ref_number)')
        .single();
      if (updated) {
        setDocs(prev => {
          const exists = prev.find(d => d.id === pendingDocId);
          return exists ? prev.map(d => d.id === pendingDocId ? updated as Document : d) : [updated as Document, ...prev];
        });
      }
      setPendingMeta(null); setPendingDocId(null);
      setAlert({ type: 'success', msg: 'Document saved successfully' });
    } catch (e: any) {
      setAlert({ type: 'error', msg: e.message });
    } finally { setSavingMeta(false); }
  }

  // ── Reminder ──────────────────────────────────────────────────────────────
  async function handleReminderSave(reminder: Partial<Deadline>) {
    const created = await api.deadlines.create({ ...reminder, firm_id: fid! } as any);
    setReminderDocId(null);
    setAlert({ type: 'success', msg: `Reminder "${created.title}" set for ${new Date(created.due_date).toLocaleDateString('en-KE')}` });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Documents" subtitle={`${docs.length} document${docs.length !== 1 ? 's' : ''}`} />

      {alert && (
        <div style={{ padding: '8px 28px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}><Alert type={alert.type} message={alert.msg} /></div>
          <button onClick={() => setAlert(null)}
            style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {(uploadingNames.length > 0 || importingDrive) && (
        <div style={{ padding: '6px 28px 0' }}>
          <div style={{ background: '#EDE9FE', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Spinner size={16} />
            <span style={{ fontSize: 13, color: '#5B21B6' }}>
              {importingDrive ? 'Importing from Google Drive…' : `Uploading ${uploadingNames.join(', ')}…`}
            </span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        padding: '14px 28px', borderBottom: '1px solid var(--border)', background: '#fff',
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
      }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
          style={{ ...fStyle, flex: 1, minWidth: 200, cursor: 'text' }}
          onFocus={e => (e.target.style.borderColor = 'var(--forest)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={fStyle}>
          <option value="">All Types</option>
          <option value="pleading">Pleading</option>
          <option value="contract">Contract</option>
          <option value="demand_letter">Demand Letter</option>
          <option value="legal_opinion">Legal Opinion</option>
          <option value="affidavit">Affidavit</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={fStyle}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="review">In Review</option>
          <option value="final">Final</option>
          <option value="archived">Archived</option>
        </select>
        <Button variant="secondary" size="sm" leftIcon={<HardDrive size={14} />} onClick={() => setDriveOpen(true)}>
          Import from Drive
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', paddingRight: analysingDoc ? 448 : 28 }}>
        <DropZone onFiles={handleFileDrop} />

        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
          : filtered.length === 0
            ? <EmptyState icon={<FileText size={24} />} title="No documents found" body="Drag & drop a file above, import from Drive, or use the AI Drafter." />
            : (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {['Title', 'Type', 'Status', 'Case', 'Author', 'Actions'].map((h, i) => (
                        <th key={i} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d, i) => (
                      <tr key={d.id}
                        style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <td style={{ padding: '14px 20px', cursor: 'pointer' }} onClick={() => setViewDoc(d)}>
                          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                            {new Date(d.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px' }}><DocTypeBadge type={d.doc_type} /></td>
                        <td style={{ padding: '14px 20px' }}>
                          <select value={d.status}
                            onChange={e => { e.stopPropagation(); handleStatus(d.id, e.target.value); }}
                            style={{ ...STATUS_STYLE[d.status], fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', outline: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <option value="draft">Draft</option>
                            <option value="review">Review</option>
                            <option value="final">Final</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 14, color: 'var(--muted)' }}>{(d as any).cases?.ref_number || '—'}</td>
                        <td style={{ padding: '14px 20px', fontSize: 14, color: 'var(--muted)' }}>{(d as any).profiles?.initials || '—'}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <Button variant="ghost" size="sm" leftIcon={<Eye size={13} />} onClick={() => setViewDoc(d)}>View</Button>
                            <Button variant="ghost" size="sm" leftIcon={<Sparkles size={13} />}
                              style={{ color: analysingDoc?.id === d.id ? 'var(--forest)' : undefined }}
                              onClick={() => setAnalysingDoc(analysingDoc?.id === d.id ? null : d)}>
                              Analyse
                            </Button>
                            <Button variant="ghost" size="sm" leftIcon={<Bell size={13} />}
                              onClick={() => setReminderDocId(d.id)} />
                            <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />}
                              onClick={() => handleDelete(d.id)} style={{ color: 'var(--red)' }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {/* Modals */}
      <DrivePickerModal open={driveOpen} onClose={() => setDriveOpen(false)} onImport={handleDriveImport} />

      <MetaConfirmModal
        open={!!pendingMeta}
        meta={pendingMeta || { client_name: null, document_title: null, case_number: null }}
        cases={cases} clients={clients} loading={savingMeta}
        onConfirm={handleMetaConfirm}
        onClose={() => { setPendingMeta(null); setPendingDocId(null); load(); }}
      />

      <ReminderModal
        open={!!reminderDocId}
        cases={cases}
        onSave={handleReminderSave}
        onClose={() => setReminderDocId(null)}
      />

      {analysingDoc && <AIAnalysisPanel doc={analysingDoc} onClose={() => setAnalysingDoc(null)} />}

      {/* Document view modal */}
      <Modal open={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.title || 'Document'} width={760}>
        {viewDoc && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <DocTypeBadge type={viewDoc.doc_type} />
              <span style={{ ...STATUS_STYLE[viewDoc.status], fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{viewDoc.status}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <Button size="sm" variant="secondary" leftIcon={<Bell size={13} />}
                  onClick={() => { setViewDoc(null); setReminderDocId(viewDoc.id); }}>Remind</Button>
                <Button size="sm" variant="secondary" leftIcon={<Sparkles size={13} />}
                  style={{ color: 'var(--forest)' }}
                  onClick={() => { setViewDoc(null); setAnalysingDoc(viewDoc); }}>Analyse</Button>
                <Button size="sm" variant="secondary" leftIcon={<Copy size={14} />}
                  onClick={() => viewDoc.content && navigator.clipboard.writeText(viewDoc.content)}>Copy</Button>
                <Button size="sm" variant="secondary" leftIcon={<Printer size={14} />}
                  onClick={() => {
                    const w = window.open('', '_blank');
                    if (!w) return;
                    w.document.write(`<html><head><title>${viewDoc.title}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;line-height:1.9;font-size:14px;}pre{white-space:pre-wrap;}</style></head><body><pre>${viewDoc.content}</pre></body></html>`);
                    w.print();
                  }}>Print</Button>
              </div>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '28px 32px', maxHeight: '62vh', overflowY: 'auto' }}>
              <pre style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.85, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {viewDoc.content || 'No content.'}
              </pre>
            </div>
            {viewDoc.google_doc_url && (
              <div style={{ marginTop: 14 }}>
                <a href={viewDoc.google_doc_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">Open in Google Docs →</Button>
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
