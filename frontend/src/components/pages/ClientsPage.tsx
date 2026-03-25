import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, Badge, EmptyState, Spinner, Modal, Input, Select, Textarea } from '../ui/index';
import type { Client } from '../../types';

export function ClientsPage() {
  const { profile } = useAuth();
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'individual', notes: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => { if (profile?.firm_id) fetchClients(); }, [profile?.firm_id]);

  async function fetchClients() {
    if (!profile?.firm_id) return;
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('clients').select('*')
      .eq('firm_id', profile.firm_id)
      .order('name');
    if (err) setError(err.message);
    else setClients(data || []);
    setLoading(false);
  }

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!profile?.firm_id) { setFormError('No firm found. Please complete your profile.'); return; }
    setCreating(true); setFormError('');
    const { data, error: err } = await supabase
      .from('clients')
      .insert({
        firm_id: profile.firm_id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        type: form.type,
        notes: form.notes.trim() || null,
      })
      .select().single();

    if (err) {
      setFormError(`Failed to save: ${err.message}`);
    } else {
      setClients(prev => [...prev, data as Client].sort((a, b) => a.name.localeCompare(b.name)));
      setShowNew(false);
      setForm({ name: '', email: '', phone: '', type: 'individual', notes: '' });
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this client? This cannot be undone.')) return;
    const { error: err } = await supabase.from('clients').delete().eq('id', id);
    if (err) alert(`Failed to delete: ${err.message}`);
    else setClients(prev => prev.filter(c => c.id !== id));
  }

  if (!profile?.firm_id) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PageHeader title="Clients" subtitle="Manage your firm's clients" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>No firm linked to your account</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Please sign out and sign up again with a firm name.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''} on record`}
        actions={<Button variant="primary" icon="＋" onClick={() => { setShowNew(true); setFormError(''); }}>New Client</Button>}
      />

      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search clients by name or email…"
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', width: '100%', maxWidth: 400, background: '#fff', transition: 'border-color 0.15s' }}
          onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      {error && (
        <div style={{ margin: '12px 24px', background: 'var(--red-dim)', border: '1px solid rgba(184,64,64,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)' }}>
          {error} — <button onClick={fetchClients} style={{ color: 'var(--red)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Retry</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="👥" title={search ? 'No clients match your search' : 'No clients yet'} body="Add your first client to start managing matters." />
        ) : (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
              {['Name', 'Type', 'Email', 'Phone', ''].map((h, i) => (
                <div key={i} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{h}</div>
              ))}
            </div>
            {filtered.map((c, i) => (
              <div key={c.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--emerald-dim)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--emerald)', flexShrink: 0 }}>
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
                    {c.notes && <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{c.notes}</div>}
                  </div>
                </div>
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center' }}>
                  <Badge label={c.type} color={c.type === 'company' ? 'blue' : 'gray'} />
                </div>
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.email || '—'}</span>
                </div>
                <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{c.phone || '—'}</span>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(c.id)}>🗑</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showNew} onClose={() => { setShowNew(false); setFormError(''); }} title="New Client">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {formError && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(184,64,64,0.2)', borderRadius: 8, padding: '9px 13px', fontSize: 13, color: 'var(--red)' }}>
              {formError}
            </div>
          )}
          <Input label="Full Name / Company Name *" value={form.name} onChange={set('name')} placeholder="e.g. James Kipchoge Mutua" />
          <Select label="Client Type" value={form.type} onChange={set('type')}>
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </Select>
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="client@email.com" />
          <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+254 7XX XXX XXX" />
          <Textarea label="Notes" value={form.notes} onChange={set('notes') as any} placeholder="Any relevant notes about this client…" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button onClick={() => { setShowNew(false); setFormError(''); }}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate}>Save Client</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
