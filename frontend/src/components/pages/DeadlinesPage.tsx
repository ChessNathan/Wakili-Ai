import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, EmptyState, Spinner, Modal, Input, Select, Alert } from '../ui/UI';
import { Calendar, CheckCircle, Plus, AlertTriangle, Clock } from 'lucide-react';
import type { Deadline } from '../../types';

function daysLabel(dt: string) {
  const d = Math.ceil((new Date(dt).getTime() - Date.now()) / 864e5);
  if (d < 0) return 'Overdue';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `${d} days`;
}

export function DeadlinesPage() {
  const { profile } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [cases, setCases]         = useState<{id:string;title:string;ref_number:string}[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [creating, setCreating]   = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ title:'', due_date:'', case_id:'', urgency:'normal' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setForm(f=>({...f,[k]:e.target.value}));
  const fid = profile?.firm_id;

  useEffect(() => { if (fid) { load(); loadCases(); } }, [fid]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('deadlines').select('*, cases(title,ref_number)').eq('firm_id', fid!).eq('done', false).order('due_date', { ascending: true });
    setDeadlines((data||[]) as Deadline[]);
    setLoading(false);
  }

  async function loadCases() {
    const { data } = await supabase.from('cases').select('id, title, ref_number').eq('firm_id', fid!).order('title');
    setCases(data||[]);
  }

  async function handleCreate() {
    if (!form.title.trim()||!form.due_date) { setFormError('Title and due date are required.'); return; }
    setCreating(true); setFormError('');
    const { data, error } = await supabase.from('deadlines').insert({
      firm_id: fid, title: form.title.trim(), due_date: form.due_date,
      case_id: form.case_id||null, urgency: form.urgency, done: false,
    }).select('*, cases(title,ref_number)').single();
    if (error) { setFormError(error.message); setCreating(false); return; }
    setDeadlines(prev => [...prev, data as Deadline].sort((a,b) => new Date(a.due_date).getTime()-new Date(b.due_date).getTime()));
    setShowNew(false); setForm({ title:'', due_date:'', case_id:'', urgency:'normal' });
    setCreating(false);
  }

  async function markDone(id: string) {
    await supabase.from('deadlines').update({ done: true }).eq('id', id);
    setDeadlines(prev => prev.filter(d => d.id !== id));
  }

  const overdue  = deadlines.filter(d => new Date(d.due_date) < new Date());
  const upcoming = deadlines.filter(d => new Date(d.due_date) >= new Date());

  function Section({ title, items, isOverdue }: { title: string; items: Deadline[]; isOverdue?: boolean }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          {isOverdue ? <AlertTriangle size={16} color="var(--red)"/> : <Clock size={16} color="var(--muted)"/>}
          <span style={{ fontSize:14, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:isOverdue?'var(--red)':'var(--muted)' }}>{title}</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {items.map(d => {
            const diff = Math.ceil((new Date(d.due_date).getTime()-Date.now())/864e5);
            const isOv = diff < 0;
            const dotColor = isOv ? 'var(--red)' : d.urgency==='urgent' ? 'var(--red)' : d.urgency==='soon' ? 'var(--amber)' : 'var(--green)';
            const label = daysLabel(d.due_date);
            const labelBg = isOv ? 'var(--red-dim)' : d.urgency==='urgent' ? 'var(--red-dim)' : d.urgency==='soon' ? 'var(--amber-dim)' : 'var(--green-dim)';
            const labelColor = isOv ? 'var(--red)' : d.urgency==='urgent' ? 'var(--red)' : d.urgency==='soon' ? 'var(--amber)' : 'var(--green)';
            return (
              <div key={d.id} style={{ background:'#fff', border:`1px solid ${isOv?'rgba(220,38,38,0.2)':'var(--border)'}`, borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:16, boxShadow:'var(--shadow-sm)', transition:'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--shadow-md)';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--shadow-sm)';e.currentTarget.style.transform='';}}
              >
                <div style={{ width:10, height:10, borderRadius:'50%', background:dotColor, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:16, fontWeight:600, color:'var(--ink)' }}>{d.title}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4, flexWrap:'wrap' }}>
                    <span style={{ fontSize:14, color:'var(--muted)' }}>
                      {new Date(d.due_date).toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'long',year:'numeric'})}
                      {' at '}
                      {new Date(d.due_date).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}
                    </span>
                    {(d as any).cases?.ref_number && (
                      <span style={{ fontSize:13, background:'var(--forest-dim)', color:'var(--forest)', padding:'2px 8px', borderRadius:6, fontWeight:500 }}>{(d as any).cases.ref_number}</span>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                  <span style={{ fontSize:13, fontWeight:700, padding:'5px 12px', borderRadius:20, background:labelBg, color:labelColor }}>{label}</span>
                  <Button size="sm" variant="primary" leftIcon={<CheckCircle size={14}/>} onClick={()=>markDone(d.id)}>Done</Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <PageHeader title="Deadlines"
        subtitle={`${overdue.length>0?`${overdue.length} overdue · `:''}${upcoming.length} upcoming`}
        actions={<Button variant="primary" leftIcon={<Plus size={16}/>} onClick={()=>{setShowNew(true);setFormError('');}}>New Deadline</Button>}
      />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
        {loading ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
        : deadlines.length===0 ? <EmptyState icon={<Calendar size={24}/>} title="No deadlines" body="Add deadlines to track filing dates, hearings, and key milestones." />
        : (
          <>
            {overdue.length>0 && <Section title="Overdue" items={overdue} isOverdue/>}
            {upcoming.length>0 && <Section title="Upcoming" items={upcoming}/>}
          </>
        )}
      </div>
      <Modal open={showNew} onClose={()=>{setShowNew(false);setFormError('');}} title="New Deadline">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {formError && <Alert type="error" message={formError}/>}
          <Input label="Title *" value={form.title} onChange={set('title')} placeholder="e.g. File Plaint — Mutua v. KCB" />
          <Input label="Due Date & Time *" type="datetime-local" value={form.due_date} onChange={set('due_date')} />
          <Select label="Urgency" value={form.urgency} onChange={set('urgency')}>
            <option value="normal">Normal</option>
            <option value="soon">Soon</option>
            <option value="urgent">Urgent</option>
          </Select>
          <Select label="Link to Case (optional)" value={form.case_id} onChange={set('case_id')}>
            <option value="">No case linked</option>
            {cases.map(c=><option key={c.id} value={c.id}>{c.ref_number} · {c.title}</option>)}
          </Select>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
            <Button variant="secondary" onClick={()=>setShowNew(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate} leftIcon={<Plus size={15}/>}>Add Deadline</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
