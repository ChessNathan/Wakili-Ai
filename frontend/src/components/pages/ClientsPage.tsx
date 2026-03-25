import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { PageHeader, Button, Badge, EmptyState, Spinner, Modal, Input, Select, Textarea } from '../ui/index';
import type { Client } from '../../types';

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'individual', notes: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.clients.list().then(setClients).finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!form.name) return;
    setCreating(true);
    try {
      const c = await api.clients.create(form as any);
      setClients(prev => [c, ...prev]);
      setShowNew(false);
      setForm({ name: '', email: '', phone: '', type: 'individual', notes: '' });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this client?')) return;
    await api.clients.delete(id);
    setClients(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''} on record`}
        actions={<Button variant="primary" icon="＋" onClick={() => setShowNew(true)}>New Client</Button>}
      />

      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search clients…"
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', width: '100%', maxWidth: 400, background: '#fff', transition: 'border-color 0.15s' }}
          onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="👥" title="No clients yet" body="Add your first client to start managing matters." />
        ) : (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
              {['Name', 'Type', 'Email', 'Phone', ''].map((h, i) => (
                <div key={i} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{h}</div>
              ))}
            </div>
            {filtered.map((c, i) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ padding: '13px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--emerald-dim)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--emerald)', flexShrink: 0 }}>
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
                      {c.notes && <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{c.notes}</div>}
                    </div>
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

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Client">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Full Name / Company Name *" value={form.name} onChange={set('name')} placeholder="e.g. James Kipchoge Mutua" />
          <Select label="Client Type" value={form.type} onChange={set('type')}>
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </Select>
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="client@email.com" />
          <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+254 7XX XXX XXX" />
          <Textarea label="Notes" value={form.notes} onChange={set('notes') as any} placeholder="Any relevant notes about this client…" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button onClick={() => setShowNew(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate}>Add Client</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
