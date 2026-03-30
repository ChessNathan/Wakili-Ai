import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, DocTypeBadge, EmptyState, Spinner, Modal, Alert } from '../ui/UI';
import { FileText, Trash2, Eye, Copy, Printer } from 'lucide-react';
import type { Document, DocStatus } from '../../types';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:    { bg: '#FEF3C7', color: '#92400E' },
  review:   { bg: '#EDE9FE', color: '#5B21B6' },
  final:    { bg: '#D1FAE5', color: '#065F46' },
  archived: { bg: '#F3F4F6', color: '#6B7280' },
};

export function DocumentsPage() {
  const { profile } = useAuth();
  const [docs, setDocs]           = useState<Document[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]       = useState('');
  const [viewDoc, setViewDoc]     = useState<Document | null>(null);
  const fid = profile?.firm_id;

  useEffect(() => { if (fid) load(); }, [fid, filterType, filterStatus]);

  async function load() {
    setLoading(true);
    let q = supabase.from('documents').select('*, profiles(full_name,initials), cases(title,ref_number)').eq('firm_id', fid!).order('created_at', { ascending: false });
    if (filterType) q = q.eq('doc_type', filterType);
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data } = await q;
    setDocs((data || []) as Document[]);
    setLoading(false);
  }

  const filtered = docs.filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()));

  async function handleDelete(id: string) {
    if (!confirm('Delete this document permanently?')) return;
    await supabase.from('documents').delete().eq('id', id);
    setDocs(prev => prev.filter(d => d.id !== id));
    if (viewDoc?.id === id) setViewDoc(null);
  }

  async function handleStatus(id: string, status: string) {
    await supabase.from('documents').update({ status }).eq('id', id);
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status: status as DocStatus } : d));
    if (viewDoc?.id === id) setViewDoc(prev => prev ? { ...prev, status: status as DocStatus } : null);
  }

  const fStyle: React.CSSProperties = { border:'1.5px solid var(--border)', borderRadius:8, padding:'9px 14px', fontSize:14, fontFamily:'var(--font-body)', color:'var(--ink)', background:'#fff', outline:'none', cursor:'pointer', transition:'border-color 0.15s' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <PageHeader title="Documents" subtitle={`${docs.length} document${docs.length!==1?'s':''}`} />

      <div style={{ padding:'14px 28px', borderBottom:'1px solid var(--border)', background:'#fff', display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents…"
          style={{ ...fStyle, flex:1, minWidth:200, cursor:'text' }}
          onFocus={e=>(e.target.style.borderColor='var(--forest)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}
        />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={fStyle}>
          <option value="">All Types</option>
          <option value="pleading">Pleading</option>
          <option value="contract">Contract</option>
          <option value="demand_letter">Demand Letter</option>
          <option value="legal_opinion">Legal Opinion</option>
          <option value="affidavit">Affidavit</option>
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={fStyle}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="review">In Review</option>
          <option value="final">Final</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
        {loading ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
        : filtered.length===0 ? <EmptyState icon={<FileText size={24}/>} title="No documents found" body="Use AI Drafter to generate your first document." />
        : (
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                  {['Title','Type','Status','Case','Author','Actions'].map((h,i)=>(
                    <th key={i} style={{ padding:'12px 20px', textAlign:'left', fontSize:13, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d,i)=>(
                  <tr key={d.id} style={{ borderBottom:i<filtered.length-1?'1px solid var(--border)':'none', transition:'background 0.12s', cursor:'pointer' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--bg)')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{ padding:'14px 20px' }} onClick={()=>setViewDoc(d)}>
                      <div style={{ fontSize:15, fontWeight:500, color:'var(--ink)', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.title}</div>
                      <div style={{ fontSize:13, color:'var(--muted)', marginTop:2 }}>{new Date(d.created_at).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' })}</div>
                    </td>
                    <td style={{ padding:'14px 20px' }}><DocTypeBadge type={d.doc_type}/></td>
                    <td style={{ padding:'14px 20px' }}>
                      <select value={d.status} onChange={e=>{e.stopPropagation();handleStatus(d.id,e.target.value);}}
                        style={{ ...STATUS_STYLE[d.status], fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:20, border:'none', cursor:'pointer', outline:'none', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                        <option value="draft">Draft</option>
                        <option value="review">Review</option>
                        <option value="final">Final</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                    <td style={{ padding:'14px 20px', fontSize:14, color:'var(--muted)' }}>{(d as any).cases?.ref_number || '—'}</td>
                    <td style={{ padding:'14px 20px', fontSize:14, color:'var(--muted)' }}>{(d as any).profiles?.initials || '—'}</td>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', gap:4 }}>
                        <Button variant="ghost" size="sm" leftIcon={<Eye size={14}/>} onClick={()=>setViewDoc(d)}>View</Button>
                        <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14}/>} onClick={()=>handleDelete(d.id)} style={{ color:'var(--red)' }}/>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!viewDoc} onClose={()=>setViewDoc(null)} title={viewDoc?.title||'Document'} width={760}>
        {viewDoc && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
              <DocTypeBadge type={viewDoc.doc_type}/>
              <span style={{ ...STATUS_STYLE[viewDoc.status], fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:20, textTransform:'uppercase', letterSpacing:'0.06em' }}>{viewDoc.status}</span>
              <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                <Button size="sm" variant="secondary" leftIcon={<Copy size={14}/>} onClick={()=>viewDoc.content && navigator.clipboard.writeText(viewDoc.content)}>Copy</Button>
                <Button size="sm" variant="secondary" leftIcon={<Printer size={14}/>} onClick={()=>{const w=window.open('','_blank');if(!w)return;w.document.write(`<html><head><title>${viewDoc.title}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;line-height:1.9;font-size:14px;}pre{white-space:pre-wrap;}</style></head><body><pre>${viewDoc.content}</pre></body></html>`);w.print();}}>Print</Button>
              </div>
            </div>
            <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'28px 32px', maxHeight:'62vh', overflowY:'auto' }}>
              <pre style={{ fontFamily:'var(--font-body)', fontSize:15, lineHeight:1.85, color:'var(--ink)', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                {viewDoc.content || 'No content.'}
              </pre>
            </div>
            {viewDoc.google_doc_url && (
              <div style={{ marginTop:14 }}>
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
