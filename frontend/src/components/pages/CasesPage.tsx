import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, Badge, EmptyState, Spinner, Modal, Input, Select, Textarea } from '../ui/index';
import type { Case, Client } from '../../types';

const MATTER_TYPES = ['Wrongful Dismissal','Land Dispute','Commercial Dispute','Judicial Review','Criminal Defence','Divorce / Family','Succession','Debt Recovery','Constitutional Petition','Other'];
const COURTS = ['High Court of Kenya','Employment & Labour Relations Court','Environment and Land Court','Court of Appeal','Supreme Court','Milimani Law Courts','Magistrate Court','Tribunal'];

export function CasesPage() {
  const { profile } = useAuth();
  const [cases, setCases]     = useState<Case[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ title: '', matter_type: '', court: '', client_id: '', notes: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => { if (profile?.firm_id) { fetchCases(); fetchClients(); } }, [profile?.firm_id]);

  async function fetchCases() {
    if (!profile?.firm_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('cases')
      .select('*, clients(name), profiles(full_name, initials)')
      .eq('firm_id', profile.firm_id)
      .order('created_at', { ascending: false });
    setCases((data || []) as Case[]);
    setLoading(false);
  }

  async function fetchClients() {
    if (!profile?.firm_id) return;
    const { data } = await supabase.from('clients').select('id, name').eq('firm_id', profile.firm_id).order('name');
    setClients((data || []) as Client[]);
  }

  const filtered = cases.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || (c.ref_number || '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!form.title.trim() || !form.matter_type) { setFormError('Title and matter type are required.'); return; }
    if (!profile?.firm_id) { setFormError('No firm found.'); return; }
    setCreating(true); setFormError('');

    const year = new Date().getFullYear();
    const ref_number = `WK/${form.matter_type.substring(0, 3).toUpperCase()}/${year}/${Math.floor(Math.random() * 9000) + 1000}`;

    const { data, error } = await supabase.from('cases').insert({
      firm_id: profile.firm_id,
      title: form.title.trim(),
      matter_type: form.matter_type,
      court: form.court || null,
      client_id: form.client_id || null,
      notes: form.notes || null,
      ref_number,
      status: 'active',
    }).select('*, clients(name)').single();

    if (error) { setFormError(`Failed: ${error.message}`); }
    else {
      setCases(prev => [data as Case, ...prev]);
      setShowNew(false);
      setForm({ title: '', matter_type: '', court: '', client_id: '', notes: '' });
    }
    setCreating(false);
  }

  async function toggleStatus(c: Case) {
    const status = c.status === 'active' ? 'closed' : 'active';
    const { data } = await supabase.from('cases').update({ status }).eq('id', c.id).select().single();
    if (data) setCases(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));
  }

  const statusBadge = (s: string) => {
    if (s === 'active') return <Badge label="Active" color="green" />;
    if (s === 'closed') return <Badge label="Closed" color="gray" />;
    return <Badge label="On Hold" color="gold" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Cases"
        subtitle={`${cases.filter(c => c.status === 'active').length} active cases`}
        actions={<Button variant="primary" icon="＋" onClick={() => { setShowNew(true); setFormError(''); }}>New Case</Button>}
      />

      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search cases…"
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', width: '100%', maxWidth: 400, background: '#fff', transition: 'border-color 0.15s' }}
          onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="⚖️" title="No cases yet" body="Create your first case to start tracking matters." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {filtered.map(c => (
              <div key={c.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(201,168,76,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginBottom: 4 }}>{c.ref_number}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{c.title}</div>
                  </div>
                  {statusBadge(c.status)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, background: 'var(--emerald-dim)', color: 'var(--emerald)', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>{c.matter_type}</span>
                  {c.court && <span style={{ fontSize: 11, background: 'var(--cream)', color: 'var(--muted)', padding: '2px 8px', borderRadius: 5 }}>{c.court}</span>}
                </div>
                {(c as any).clients?.name && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>👤</span> {(c as any).clients.name}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted-light)' }}>
                  Opened {new Date(c.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', gap: 6 }}>
                  <Button size="sm" onClick={() => toggleStatus(c)}>
                    {c.status === 'active' ? '✓ Close Case' : '↺ Reopen'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showNew} onClose={() => { setShowNew(false); setFormError(''); }} title="New Case">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {formError && <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(184,64,64,0.2)', borderRadius: 8, padding: '9px 13px', fontSize: 13, color: 'var(--red)' }}>{formError}</div>}
          <Input label="Case Title *" value={form.title} onChange={set('title')} placeholder="e.g. Mutua v. Swift Logistics" />
          <Select label="Matter Type *" value={form.matter_type} onChange={set('matter_type')}>
            <option value="">— Select —</option>
            {MATTER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Select label="Court" value={form.court} onChange={set('court')}>
            <option value="">— Select court —</option>
            {COURTS.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label="Client" value={form.client_id} onChange={set('client_id')}>
            <option value="">— No client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Textarea label="Notes" value={form.notes} onChange={set('notes') as any} placeholder="Brief description of the matter…" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button onClick={() => setShowNew(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate}>Create Case</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
