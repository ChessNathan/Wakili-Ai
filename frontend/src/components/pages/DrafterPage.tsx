import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Button, PageHeader, Select, DocTypeBadge, Spinner, Alert } from '../ui/UI';
import { Sparkles, RefreshCw, Copy, Printer, ChevronRight, FileText, ExternalLink } from 'lucide-react';
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
  pleading:      ['Wrongful dismissal — Employment Act s.41','Land trespass — Land Act 2012','Breach of contract — Commercial Court','Judicial review of admin decision'],
  contract:      ['Employment contract — permanent position','Commercial lease agreement','Service Level Agreement','Share purchase agreement'],
  demand_letter: ['Outstanding debt payment','Vacate premises — landlord demand','Cease and desist — IP infringement','Breach of employment terms'],
  legal_opinion: ['Enforceability of arbitration clause','Directors liability under Companies Act 2015','Land ownership dispute','Employment termination compliance'],
  affidavit:     ['Supporting affidavit — injunction','Verifying affidavit — petition','Affidavit of service','Affidavit in support of application'],
  other:         ['Custom legal document'],
};

const STATUS_STYLE: Record<string,{bg:string;color:string}> = {
  draft:{bg:'#FEF3C7',color:'#92400E'}, review:{bg:'#EDE9FE',color:'#5B21B6'},
  final:{bg:'#D1FAE5',color:'#065F46'}, archived:{bg:'#F3F4F6',color:'#6B7280'},
};

export function DrafterPage() {
  const { profile } = useAuth();
  const [docType, setDocType] = useState<DocType>('pleading');
  const [prompt, setPrompt]   = useState('');
  const [title, setTitle]     = useState('');
  const [caseId, setCaseId]   = useState('');
  const [cases, setCases]     = useState<Pick<Case,'id'|'title'|'ref_number'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [doc, setDoc]         = useState<Document | null>(null);
  const [error, setError]     = useState('');
  const [recent, setRecent]   = useState<Document[]>([]);
  const [showRefine, setShowRefine] = useState(false);
  const fid = profile?.firm_id;

  useEffect(() => {
    if (!fid) return;
    supabase.from('cases').select('id,title,ref_number').eq('firm_id',fid).order('title').then(({data})=>setCases((data||[]) as any));
    supabase.from('documents').select('*').eq('firm_id',fid).order('created_at',{ascending:false}).limit(8).then(({data})=>setRecent((data||[]) as Document[]));
  }, [fid]);

  async function generate() {
    if (!prompt.trim()||!fid) return;
    setLoading(true); setError(''); setDoc(null);
    try {
      const res = await api.ai.draft({prompt,doc_type:docType,title:title||undefined,case_id:caseId||undefined});
      setDoc(res.document);
      setRecent(prev=>[res.document,...prev.slice(0,7)]);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function refine() {
    if (!doc||!instruction.trim()) return;
    setRefining(true);
    try {
      const res = await api.ai.refine({document_id:doc.id,instruction});
      setDoc(res.document); setInstruction(''); setShowRefine(false);
      setRecent(prev=>prev.map(d=>d.id===res.document.id?res.document:d));
    } catch(e:any) { setError(e.message); }
    finally { setRefining(false); }
  }

  async function changeStatus(status:string) {
    if (!doc) return;
    await supabase.from('documents').update({status}).eq('id',doc.id);
    setDoc({...doc,status:status as any});
    setRecent(prev=>prev.map(d=>d.id===doc.id?{...d,status:status as any}:d));
  }

  function print() {
    if (!doc?.content) return;
    const w=window.open('','_blank'); if(!w) return;
    w.document.write(`<html><head><title>${doc.title}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;line-height:1.9;font-size:14px;}pre{white-space:pre-wrap;}</style></head><body><pre>${doc.content}</pre></body></html>`);
    w.print();
  }

  if (!fid) return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <PageHeader title="AI Document Drafter" subtitle="Powered by Gemini · Kenya Law"/>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
        <div style={{fontSize:18,fontWeight:600,color:'var(--ink)'}}>No firm linked to your account</div>
        <div style={{fontSize:15,color:'var(--muted)'}}>Sign out and sign up again with a firm name.</div>
      </div>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <PageHeader title="AI Document Drafter" subtitle="Powered by Gemini · Kenya Law Framework"
        actions={<Button variant="secondary" onClick={()=>{setDoc(null);setPrompt('');setTitle('');}}>New Draft</Button>}
      />
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* Left - recent */}
        <div style={{width:272,flexShrink:0,borderRight:'1px solid var(--border)',overflowY:'auto',background:'#fff',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'16px 18px',borderBottom:'1px solid var(--border)'}}>
            <div style={{fontSize:13,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--muted)'}}>Recent Documents</div>
          </div>
          <div style={{flex:1,padding:'8px 10px',overflowY:'auto'}}>
            {recent.length===0 ? (
              <div style={{padding:'28px 12px',textAlign:'center',fontSize:14,color:'var(--muted)',lineHeight:1.7}}>
                <FileText size={32} color="var(--muted-light)" style={{margin:'0 auto 10px'}}/>
                No documents yet.<br/>Generate your first draft.
              </div>
            ) : recent.map(d=>(
              <button key={d.id} onClick={()=>setDoc(d)}
                style={{width:'100%',textAlign:'left',padding:'10px 12px',borderRadius:9,border:`1px solid ${doc?.id===d.id?'var(--gold-border)':'transparent'}`,background:doc?.id===d.id?'var(--gold-pale)':'transparent',cursor:'pointer',marginBottom:4,transition:'all 0.15s'}}
                onMouseEnter={e=>{if(doc?.id!==d.id)e.currentTarget.style.background='var(--bg)';}}
                onMouseLeave={e=>{if(doc?.id!==d.id)e.currentTarget.style.background='transparent';}}
              >
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                  <DocTypeBadge type={d.doc_type}/>
                  {d.google_doc_id&&<ExternalLink size={11} color="var(--blue)"/>}
                </div>
                <div style={{fontSize:13,fontWeight:500,color:'var(--ink)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3}}>{d.title}</div>
                <div style={{fontSize:12,color:'var(--muted)'}}>{new Date(d.created_at).toLocaleDateString('en-KE',{day:'numeric',month:'short'})}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Center - drafter */}
        <div style={{flex:1,overflowY:'auto',padding:'24px',display:'flex',flexDirection:'column',gap:18}}>
          {/* Builder */}
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--border)',background:'var(--forest)',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:32,height:32,borderRadius:8,background:'rgba(201,168,76,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Sparkles size={17} color="var(--gold-light)"/>
              </div>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:'#fff'}}>AI Document Drafter</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:2}}>Kenya Law Framework · Gemini AI</div>
              </div>
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,background:'rgba(74,222,128,0.15)',padding:'5px 12px',borderRadius:20}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'#4ADE80',animation:'pulse 2s infinite'}}/>
                <span style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontWeight:500}}>Active</span>
              </div>
            </div>

            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--border)',background:'var(--bg)'}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Document Type</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
                {DOC_TYPES.map(t=>(
                  <button key={t.value} onClick={()=>{setDocType(t.value);setPrompt('');}}
                    style={{padding:'8px 16px',borderRadius:8,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all 0.15s',border:`1.5px solid ${docType===t.value?'var(--forest)':'var(--border)'}`,background:docType===t.value?'var(--forest)':'#fff',color:docType===t.value?'#fff':'var(--ink)'}}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Quick Start</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                {QUICK[docType].map(q=>(
                  <button key={q} onClick={()=>setPrompt(q)}
                    style={{padding:'5px 12px',borderRadius:6,fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)',background:prompt===q?'var(--forest-dim)':'transparent',color:'var(--forest)',border:'1px solid var(--gold-border)',transition:'all 0.12s',fontWeight:prompt===q?600:400,display:'flex',alignItems:'center',gap:4}}>
                    <ChevronRight size={11}/>{q}
                  </button>
                ))}
              </div>
            </div>

            <div style={{padding:'20px 22px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 220px',gap:16,marginBottom:16}}>
                <div>
                  <label style={{fontSize:14,fontWeight:500,color:'var(--ink-2)',display:'block',marginBottom:6}}>Title <span style={{color:'var(--muted)'}}>(optional)</span></label>
                  <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Plaint — Mutua v. KCB Bank"
                    style={{width:'100%',border:'1.5px solid var(--border)',borderRadius:8,padding:'10px 14px',fontSize:15,fontFamily:'var(--font-body)',outline:'none',transition:'border-color 0.15s'}}
                    onFocus={e=>{e.target.style.borderColor='var(--forest)';e.target.style.boxShadow='0 0 0 3px rgba(27,58,45,0.1)';}}
                    onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none';}}
                  />
                </div>
                <Select label="Link to Case" value={caseId} onChange={e=>setCaseId(e.target.value)}>
                  <option value="">No case linked</option>
                  {cases.map(c=><option key={c.id} value={c.id}>{c.ref_number} · {c.title}</option>)}
                </Select>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:14,fontWeight:500,color:'var(--ink-2)',display:'block',marginBottom:6}}>Describe the Matter *</label>
                <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={5}
                  placeholder="Describe the matter in detail: parties involved, relevant facts, legal basis, court, relief sought, key dates…"
                  style={{width:'100%',border:'1.5px solid var(--border)',borderRadius:8,padding:'12px 14px',fontSize:15,fontFamily:'var(--font-body)',outline:'none',resize:'vertical',lineHeight:1.6,transition:'border-color 0.15s',minHeight:110}}
                  onFocus={e=>{e.target.style.borderColor='var(--forest)';e.target.style.boxShadow='0 0 0 3px rgba(27,58,45,0.1)';}}
                  onBlur={e=>{e.target.style.borderColor='var(--border)';e.target.style.boxShadow='none';}}
                  onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey))generate();}}
                />
                <div style={{fontSize:13,color:'var(--muted)',marginTop:5}}>Press ⌘+Enter to generate</div>
              </div>
              {error&&<div style={{marginBottom:14}}><Alert type="error" message={error}/></div>}
              <Button variant="gold" size="lg" loading={loading} onClick={generate} disabled={!prompt.trim()}
                leftIcon={<Sparkles size={18}/>} style={{width:'100%'}}>
                {loading?'Generating document…':'Generate Document'}
              </Button>
            </div>
          </div>

          {/* Output */}
          {(loading||doc)&&(
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-sm)',animation:'fadeUp 0.3s ease'}}>
              <div style={{padding:'13px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                {doc&&(
                  <>
                    <DocTypeBadge type={doc.doc_type}/>
                    <span style={{fontSize:16,fontWeight:600,color:'var(--ink)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.title}</span>
                    <select value={doc.status} onChange={e=>changeStatus(e.target.value)}
                      style={{...STATUS_STYLE[doc.status],fontSize:12,fontWeight:600,padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',outline:'none',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                      <option value="draft">Draft</option>
                      <option value="review">In Review</option>
                      <option value="final">Final</option>
                      <option value="archived">Archived</option>
                    </select>
                  </>
                )}
                {doc&&(
                  <div style={{display:'flex',gap:8}}>
                    <Button size="sm" variant="secondary" leftIcon={<RefreshCw size={13}/>} onClick={()=>setShowRefine(!showRefine)}>Refine</Button>
                    <Button size="sm" variant="secondary" leftIcon={<Copy size={13}/>} onClick={()=>doc.content&&navigator.clipboard.writeText(doc.content)}>Copy</Button>
                    <Button size="sm" variant="secondary" leftIcon={<Printer size={13}/>} onClick={print}>Print</Button>
                  </div>
                )}
              </div>
              {doc?.google_doc_url&&(
                <div style={{padding:'10px 20px',borderBottom:'1px solid var(--border)',background:'#EFF6FF',display:'flex',alignItems:'center',gap:10}}>
                  <ExternalLink size={15} color="var(--blue)"/>
                  <span style={{fontSize:14,color:'var(--blue)',fontWeight:500}}>Linked to Google Docs</span>
                  <a href={doc.google_doc_url} target="_blank" rel="noopener noreferrer" style={{marginLeft:'auto'}}>
                    <Button size="sm" variant="secondary">Open in Google Docs →</Button>
                  </a>
                </div>
              )}
              {showRefine&&doc&&(
                <div style={{padding:'13px 20px',borderBottom:'1px solid var(--border)',background:'#FFFBEB',display:'flex',gap:10,alignItems:'center'}}>
                  <input value={instruction} onChange={e=>setInstruction(e.target.value)}
                    placeholder='e.g. "Add quantum of damages section" or "Make tone more formal"'
                    style={{flex:1,border:'1.5px solid var(--gold-border)',borderRadius:8,padding:'9px 14px',fontSize:14,fontFamily:'var(--font-body)',outline:'none',background:'#fff'}}
                    onKeyDown={e=>e.key==='Enter'&&refine()}
                  />
                  <Button variant="gold" size="sm" loading={refining} onClick={refine} leftIcon={<Sparkles size={14}/>}>Refine</Button>
                  <Button variant="ghost" size="sm" onClick={()=>setShowRefine(false)}>Cancel</Button>
                </div>
              )}
              <div style={{padding:'32px 40px',minHeight:320}}>
                {loading ? (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:'60px 0'}}>
                    <Spinner size={36} color="var(--forest)"/>
                    <div style={{fontFamily:'var(--font-display)',fontSize:18,color:'var(--ink)',fontWeight:600}}>Drafting your document…</div>
                    <div style={{fontSize:14,color:'var(--muted)'}}>Applying Kenya law framework · This may take 15–30 seconds</div>
                  </div>
                ) : doc?.content ? (
                  <pre style={{fontFamily:'var(--font-body)',fontSize:15,lineHeight:1.9,color:'var(--ink)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
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
