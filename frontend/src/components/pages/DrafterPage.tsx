import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button, PageHeader, Select, DocTypeBadge, Spinner } from '../ui/index';
import { GoogleDocButton } from '../ui/GoogleDocButton';
import type { Document, Case, DocType } from '../../types';

const DOC_TYPES: { value: DocType; label: string; icon: string }[] = [
  { value: 'pleading',      label: 'Pleading',      icon: '⚖️' },
  { value: 'contract',      label: 'Contract',      icon: '📋' },
  { value: 'demand_letter', label: 'Demand Letter', icon: '📬' },
  { value: 'legal_opinion', label: 'Legal Opinion', icon: '📜' },
  { value: 'affidavit',     label: 'Affidavit',     icon: '✍️' },
];

const QUICK_PROMPTS: Record<DocType, string[]> = {
  pleading:      ['Wrongful dismissal — Employment Act s.41', 'Land trespass — Land Act 2012', 'Breach of contract — Commercial Court', 'Judicial review of admin decision'],
  contract:      ['Employment contract — permanent position', 'Commercial lease agreement', 'Service Level Agreement (SLA)', 'Share purchase agreement'],
  demand_letter: ['Outstanding debt payment demand', 'Vacate premises — landlord demand', 'Cease and desist — IP infringement', 'Breach of employment terms'],
  legal_opinion: ['Enforceability of arbitration clause', 'Directors liability under Companies Act', 'Land ownership dispute analysis', 'Employment termination compliance'],
  affidavit:     ['Supporting affidavit — interlocutory injunction', 'Verifying affidavit — petition', 'Affidavit of service', 'Affidavit in support of application'],
  other:         ['Custom legal document'],
};

const STATUS_COLORS: Record<string, string> = { draft: '#92400e', review: '#3730a3', final: '#065f46', archived: 'var(--muted)' };
const STATUS_BG: Record<string, string>     = { draft: '#fef3c7', review: '#e0e7ff', final: '#d1fae5', archived: 'var(--cream)' };

export function DrafterPage() {
  const [docType, setDocType]             = useState<DocType>('pleading');
  const [prompt, setPrompt]               = useState('');
  const [title, setTitle]                 = useState('');
  const [caseId, setCaseId]               = useState('');
  const [cases, setCases]                 = useState<Case[]>([]);
  const [loading, setLoading]             = useState(false);
  const [refining, setRefining]           = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [doc, setDoc]                     = useState<Document | null>(null);
  const [error, setError]                 = useState('');
  const [recentDocs, setRecentDocs]       = useState<Document[]>([]);
  const [showRefine, setShowRefine]       = useState(false);

  useEffect(() => {
    api.cases.list().then(setCases).catch(() => {});
    api.documents.list().then(d => setRecentDocs(d.slice(0, 6))).catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true); setError(''); setDoc(null);
    try {
      const res = await api.ai.draft({ prompt, doc_type: docType, title: title || undefined, case_id: caseId || undefined });
      setDoc(res.document);
      setRecentDocs(prev => [res.document, ...prev.slice(0, 5)]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!doc || !refineInstruction.trim()) return;
    setRefining(true);
    try {
      const res = await api.ai.refine({ document_id: doc.id, instruction: refineInstruction });
      setDoc(res.document);
      setRefineInstruction(''); setShowRefine(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefining(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!doc) return;
    const updated = await api.documents.update(doc.id, { status: status as any });
    setDoc(updated);
  }

  function handlePrint() {
    if (!doc?.content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>${doc.title}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;line-height:1.8;font-size:14px;}pre{white-space:pre-wrap;}</style></head><body><pre>${doc.content}</pre></body></html>`);
    win.print();
  }

  function handleCopy() {
    if (doc?.content) navigator.clipboard.writeText(doc.content);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="AI Document Drafter"
        subtitle="Powered by Claude · Kenya Law Framework"
        actions={<Button variant="primary" icon="＋" onClick={() => { setDoc(null); setPrompt(''); setTitle(''); }}>New Draft</Button>}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT: Recent docs */}
        <div style={{ width: 290, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Total Docs', value: recentDocs.length },
              { label: 'This Week',  value: recentDocs.filter(d => new Date(d.created_at) > new Date(Date.now() - 7*864e5)).length },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--gold)', opacity: 0.5 }} />
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: 10 }}>Recent Documents</div>
            {recentDocs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No documents yet.<br />Generate your first draft! ✨</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {recentDocs.map(d => (
                  <div key={d.id} onClick={() => setDoc(d)}
                    style={{ background: '#fff', border: `1px solid ${doc?.id === d.id ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 9, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 5 }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = doc?.id === d.id ? 'var(--gold)' : 'var(--border)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                      <DocTypeBadge type={d.doc_type} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {d.google_doc_id && <span title="Google Doc linked" style={{ fontSize: 12 }}>📝</span>}
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: STATUS_BG[d.status], color: STATUS_COLORS[d.status], textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d.status}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {d.profiles?.full_name} · {new Date(d.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Drafter */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Draft builder card */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to right, var(--cream), #fff)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--emerald)', color: 'var(--gold-light)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6 }}>
                <span style={{ width: 6, height: 6, background: 'var(--gold)', borderRadius: '50%', animation: 'pulse 2s infinite', display: 'inline-block' }} />
                AI Active
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>New Draft</span>
            </div>

            {/* Doc type chips */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 10 }}>Document Type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {DOC_TYPES.map(t => (
                  <button key={t.value} onClick={() => { setDocType(t.value); setPrompt(''); }}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', background: docType === t.value ? 'var(--emerald)' : '#fff', color: docType === t.value ? '#fff' : 'var(--ink)', border: `1px solid ${docType === t.value ? 'var(--emerald)' : 'var(--border)'}`, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginTop: 12, marginBottom: 8 }}>Quick Start</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {QUICK_PROMPTS[docType].map(p => (
                  <button key={p} onClick={() => setPrompt(p)}
                    style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', background: prompt === p ? 'var(--gold-dim)' : 'transparent', color: 'var(--emerald)', border: '1px solid var(--gold-border)', transition: 'all 0.12s' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Document Title (optional)</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Plaint — Mutua v. KCB Bank"
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', transition: 'border-color 0.15s' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
                <div style={{ width: 200 }}>
                  <Select label="Link to Case" value={caseId} onChange={e => setCaseId(e.target.value)}>
                    <option value="">— No case —</option>
                    {cases.map(c => <option key={c.id} value={c.id}>{c.ref_number} · {c.title}</option>)}
                  </Select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Describe the Matter</label>
                  <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                    placeholder="Describe the matter in detail. Include parties, relevant facts, legal basis, relief sought..."
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', lineHeight: 1.6, transition: 'border-color 0.15s' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                  />
                </div>
                <button onClick={handleGenerate} disabled={loading || !prompt.trim()}
                  style={{ background: 'var(--gold)', color: 'var(--emerald)', border: 'none', borderRadius: 9, padding: '0 22px', height: 102, cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: loading || !prompt.trim() ? 0.6 : 1, transition: 'all 0.15s', minWidth: 88 }}>
                  {loading ? <Spinner size={22} /> : <span style={{ fontSize: 22 }}>✦</span>}
                  {loading ? 'Drafting...' : 'Generate'}
                  {!loading && <span style={{ fontSize: 9, opacity: 0.7 }}>⌘ Enter</span>}
                </button>
              </div>

              {error && (
                <div style={{ marginTop: 10, background: 'var(--red-dim)', border: '1px solid rgba(184,64,64,0.2)', borderRadius: 7, padding: '9px 13px', fontSize: 13, color: 'var(--red)' }}>{error}</div>
              )}
            </div>
          </div>

          {/* Output card */}
          {(loading || doc) && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', animation: 'fadeIn 0.3s ease' }}>

              {/* Toolbar */}
              <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', background: 'var(--cream)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {doc && (
                  <>
                    <DocTypeBadge type={doc.doc_type} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                    <select value={doc.status} onChange={e => handleStatusChange(e.target.value)}
                      style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: 'none', background: STATUS_BG[doc.status], color: STATUS_COLORS[doc.status], fontWeight: 700, cursor: 'pointer', outline: 'none', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      <option value="draft">Draft</option>
                      <option value="review">In Review</option>
                      <option value="final">Final</option>
                      <option value="archived">Archived</option>
                    </select>
                  </>
                )}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {doc && (
                    <>
                      <Button size="sm" onClick={() => setShowRefine(!showRefine)} icon="✏️">Refine</Button>
                      <Button size="sm" onClick={handleCopy} icon="📋">Copy</Button>
                      <Button size="sm" onClick={handlePrint} icon="🖨️">Print</Button>
                    </>
                  )}
                </div>
              </div>

              {/* Google Docs row */}
              {doc && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', flexShrink: 0 }}>Google Docs</span>
                  <GoogleDocButton document={doc} onUpdate={updated => { setDoc(updated); setRecentDocs(prev => prev.map(d => d.id === updated.id ? updated : d)); }} />
                </div>
              )}

              {/* Refine bar */}
              {showRefine && doc && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--gold-dim)', display: 'flex', gap: 8 }}>
                  <input value={refineInstruction} onChange={e => setRefineInstruction(e.target.value)}
                    placeholder='e.g. "Add section on quantum of damages" or "Make tone more formal"'
                    style={{ flex: 1, border: '1px solid var(--gold-border)', borderRadius: 7, padding: '7px 12px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', background: '#fff' }}
                    onKeyDown={e => e.key === 'Enter' && handleRefine()}
                  />
                  <Button variant="gold" size="sm" loading={refining} onClick={handleRefine}>Refine ✦</Button>
                  <Button size="sm" onClick={() => setShowRefine(false)}>Cancel</Button>
                </div>
              )}

              {/* Document content */}
              <div style={{ padding: '28px 36px', minHeight: 300 }}>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '60px 0' }}>
                    <Spinner size={36} />
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--muted)' }}>Drafting your document…</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-light)' }}>Applying Kenya law framework</div>
                  </div>
                ) : doc?.content ? (
                  <pre style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.85, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {doc.content}
                  </pre>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
