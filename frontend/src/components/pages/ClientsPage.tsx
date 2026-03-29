import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, Badge, EmptyState, Spinner, Modal, Input, Select, Textarea, Alert } from '../ui/UI';
import { Users, Trash2, Plus, Building2, User } from 'lucide-react';
import type { Client } from '../../types';

export function ClientsPage() {
  const { profile } = useAuth();
  const [clients, setClients]     = useState<Client[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showNew, setShowNew]     = useState(false);
  const [creating, setCreating]   = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name:'', email:'', phone:'', type:'individual', notes:'' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f => ({...f, [k]: e.target.value}));

  const fid = profile?.firm_id;

  useEffect(() => { if (fid) load(); }, [fid]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').eq('firm_id', fid!).order('name');
    setClients((data || []) as Client[]);
    setLoading(false);
  }

  const filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.email||'').toLowerCase().includes(search.toLowerCase()));

  async function handleCreate() {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!fid) { setFormError('No firm linked. Please sign out and sign up again.'); return; }
    setCreating(true); setFormError('');
    const { data, error } = await supabase.from('clients').insert({
      firm_id: fid, name: form.name.trim(),
      email: form.email || null, phone: form.phone || null,
      type: form.type, notes: form.notes || null,
    }).select().single();
    if (error) { setFormError(error.message); setCreating(false); return; }
    setClients(prev => [...prev, data as Client].sort((a,b) => a.name.localeCompare(b.name)));
    setShowNew(false); setForm({ name:'', email:'', phone:'', type:'individual', notes:'' });
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this client?')) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    setClients(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <PageHeader title="Clients" subtitle={`${clients.length} client${clients.length!==1?'s':''} on record`}
        actions={<Button variant="primary" leftIcon={<Plus size={16}/>} onClick={()=>{setShowNew(true);setFormError('');}}>New Client</Button>}
      />

      <div style={{ padding:'14px 28px', borderBottom:'1px solid var(--border)', background:'#fff', flexShrink:0 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients by name or email…"
          style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'10px 16px', fontSize:15, fontFamily:'var(--font-body)', outline:'none', width:'100%', maxWidth:400, transition:'border-color 0.15s', background:'var(--bg)' }}
          onFocus={e=>(e.target.style.borderColor='var(--forest)')} onBlur={e=>(e.target.style.borderColor='var(--border)')}
        />
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
        {!fid ? (
          <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10, padding:'16px 20px', fontSize:15, color:'#92400E' }}>
            No firm linked to your account. Please sign out and sign up again with a firm name.
          </div>
        ) : loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users size={24}/>} title="No clients yet" body="Add your first client to start managing their matters." />
        ) : (
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                  {['Client', 'Type', 'Email', 'Phone', ''].map((h,i) => (
                    <th key={i} style={{ padding:'12px 20px', textAlign:'left', fontSize:13, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i<filtered.length-1 ? '1px solid var(--border)' : 'none', transition:'background 0.12s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--bg)')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{ padding:'14px 20px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--forest-dim)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--forest)', fontWeight:700, fontSize:14, flexShrink:0 }}>
                          {c.name.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)' }}>{c.name}</div>
                          {c.notes && <div style={{ fontSize:13, color:'var(--muted)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'14px 20px' }}><Badge label={c.type === 'company' ? 'Company' : 'Individual'} color={c.type==='company' ? 'blue' : 'gray'} /></td>
                    <td style={{ padding:'14px 20px', fontSize:14, color:'var(--muted)' }}>{c.email || '—'}</td>
                    <td style={{ padding:'14px 20px', fontSize:14, color:'var(--muted)', fontFamily:'monospace' }}>{c.phone || '—'}</td>
                    <td style={{ padding:'14px 16px' }}>
                      <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14}/>} onClick={()=>handleDelete(c.id)} style={{ color:'var(--red)' }}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showNew} onClose={()=>{setShowNew(false);setFormError('');}} title="New Client">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {formError && <Alert type="error" message={formError} />}
          <Input label="Full Name / Company Name *" value={form.name} onChange={set('name')} placeholder="e.g. James Kipchoge Mutua" />
          <Select label="Client Type" value={form.type} onChange={set('type')}>
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </Select>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="client@email.com" />
            <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+254 7XX XXX XXX" />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={set('notes') as any} placeholder="Any relevant notes…" />
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
            <Button variant="secondary" onClick={()=>setShowNew(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate} leftIcon={<Plus size={15}/>}>Save Client</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
