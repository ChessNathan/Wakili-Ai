import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, Badge, EmptyState, Spinner, Modal, Input, Select, Textarea, Alert } from '../ui/UI';
import { Scale, Plus, CheckCircle, RefreshCw } from 'lucide-react';
import type { Case, Client } from '../../types';

const MATTER_TYPES = ['Wrongful Dismissal','Land Dispute','Commercial Dispute','Judicial Review','Criminal Defence','Divorce & Family','Succession','Debt Recovery','Constitutional Petition','Employment','Contract Dispute','Other'];
const COURTS = ['High Court of Kenya','Employment & Labour Relations Court','Environment and Land Court','Court of Appeal','Supreme Court of Kenya','Milimani Law Courts','Magistrate Court','Small Claims Court','Tribunal'];

export function CasesPage() {
  const { profile } = useAuth();
  const [cases, setCases]     = useState<Case[]>([]);
  const [clients, setClients] = useState<Pick<Client,'id'|'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ title:'', matter_type:'', court:'', client_id:'', notes:'' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f => ({...f,[k]:e.target.value}));
  const fid = profile?.firm_id;

  useEffect(() => { if (fid) { load(); loadClients(); } }, [fid]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('cases').select('*, clients(name)').eq('firm_id', fid!).order('created_at', { ascending: false });
    setCases((data || []) as Case[]);
    setLoading(false);
  }

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id, name').eq('firm_id', fid!).order('name');
    setClients(data || []);
  }

  const filtered = cases.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || (c.ref_number||'').includes(search));

  async function handleCreate() {
    if (!form.title.trim() || !form.matter_type) { setFormError('Title and matter type are required.'); return; }
    setCreating(true); setFormError('');
    const ref_number = `WK/${form.matter_type.substring(0,3).toUpperCase()}/${new Date().getFullYear()}/${Math.floor(Math.random()*9000)+1000}`;
    const { data, error } = await supabase.from('cases').insert({
      firm_id: fid, title: form.title.trim(), matter_type: form.matter_type,
      court: form.court||null, client_id: form.client_id||null,
      notes: form.notes||null, ref_number, status: 'active',
    }).select('*, clients(name)').single();
    if (error) { setFormError(error.message); setCreating(false); return; }
    setCases(prev => [data as Case, ...prev]);
    setShowNew(false); setForm({ title:'', matter_type:'', court:'', client_id:'', notes:'' });
    setCreating(false);
  }

  async function toggleStatus(c: Case) {
    const status = c.status === 'active' ? 'closed' : 'active';
    await supabase.from('cases').update({ status }).eq('id', c.id);
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <PageHeader title="Cases" subtitle={`${cases.filter(c=>c.status==='active').length} active cases`}
        actions={<Button variant="primary" leftIcon={<Plus size={16}/>} onClick={()=>{setShowNew(true);setFormError('');}}>New Case</Button>}
      />
      <div style={{ padding:'14px 28px', borderBottom:'1px solid var(--border)', background:'#fff', flexShrink:0 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title or reference number…"
          style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'10px 16px', fontSize:15, fontFamily:'var(--font-body)', outline:'none', width:'100%', maxWidth:400, background:'var(--bg)', transition:'border-color 0.15s' }}
          onFocus={e=>(e.target.style.borderColor='var(--forest)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}
        />
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
        {loading ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
        : filtered.length===0 ? <EmptyState icon={<Scale size={24}/>} title="No cases yet" body="Create your first case to start tracking matters." />
        : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:16 }}>
            {filtered.map(c => (
              <div key={c.id} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'20px', boxShadow:'var(--shadow-sm)', transition:'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--shadow-md)';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--shadow-sm)';e.currentTarget.style.transform='';}}
              >
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:12, fontFamily:'monospace', color:'var(--muted)', marginBottom:6, letterSpacing:'0.04em' }}>{c.ref_number}</div>
                    <div style={{ fontSize:16, fontWeight:600, color:'var(--ink)', lineHeight:1.3 }}>{c.title}</div>
                  </div>
                  {c.status==='active' ? <Badge label="Active" color="green"/> : <Badge label="Closed" color="gray"/>}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                  <Badge label={c.matter_type} color="blue" />
                  {c.court && <span style={{ fontSize:13, color:'var(--muted)', background:'var(--bg)', padding:'3px 10px', borderRadius:20 }}>{c.court}</span>}
                </div>
                {(c as any).clients?.name && (
                  <div style={{ fontSize:14, color:'var(--muted)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                    <Scale size={13}/> {(c as any).clients.name}
                  </div>
                )}
                <div style={{ fontSize:13, color:'var(--muted-light)', marginBottom:14 }}>
                  Opened {new Date(c.created_at).toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}
                </div>
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                  <Button size="sm" variant="secondary" leftIcon={c.status==='active' ? <CheckCircle size={14}/> : <RefreshCw size={14}/>} onClick={()=>toggleStatus(c)}>
                    {c.status==='active' ? 'Close Case' : 'Reopen Case'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={showNew} onClose={()=>{setShowNew(false);setFormError('');}} title="New Case">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {formError && <Alert type="error" message={formError}/>}
          <Input label="Case Title *" value={form.title} onChange={set('title')} placeholder="e.g. Mutua v. Swift Logistics" />
          <Select label="Matter Type *" value={form.matter_type} onChange={set('matter_type')}>
            <option value="">Select matter type…</option>
            {MATTER_TYPES.map(m=><option key={m} value={m}>{m}</option>)}
          </Select>
          <Select label="Court" value={form.court} onChange={set('court')}>
            <option value="">Select court…</option>
            {COURTS.map(c=><option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label="Client (optional)" value={form.client_id} onChange={set('client_id')}>
            <option value="">No client linked</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Textarea label="Notes" value={form.notes} onChange={set('notes') as any} placeholder="Brief description of the matter…" />
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
            <Button variant="secondary" onClick={()=>setShowNew(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate} leftIcon={<Plus size={15}/>}>Create Case</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
