import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, Button, EmptyState, Spinner, Modal, Input, Select } from '../ui/index';
import type { Deadline, Case } from '../../types';

const URGENCY_STYLE: Record<string, { dot: string; bg: string; color: string }> = {
  urgent: { dot: '#b84040', bg: '#fde8e8', color: '#b84040' },
  soon:   { dot: '#c9a84c', bg: '#fef3c7', color: '#92400e' },
  normal: { dot: '#4ade80', bg: '#d1fae5', color: '#065f46' },
};

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 864e5);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days}d`;
}

export function DeadlinesPage() {
  const { profile } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [cases, setCases]         = useState<Case[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [creating, setCreating]   = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ title: '', due_date: '', case_id: '', urgency: 'normal' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => { if (profile?.firm_id) { fetchDeadlines(); fetchCases(); } }, [profile?.firm_id]);

  async function fetchDeadlines() {
    if (!profile?.firm_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('deadlines')
      .select('*, cases(title, ref_number)')
      .eq('firm_id', profile.firm_id)
      .eq('done', false)
      .order('due_date', { ascending: true });
    setDeadlines(data || []);
    setLoading(false);
  }

  async function fetchCases() {
    if (!profile?.firm_id) return;
    const { data } = await supabase.from('cases').select('id, title, ref_number').eq('firm_id', profile.firm_id).order('title');
    setCases((data || []) as Case[]);
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.due_date) { setFormError('Title and due date are required.'); return; }
    if (!profile?.firm_id) { setFormError('No firm found.'); return; }
    setCreating(true); setFormError('');

    const { data, error } = await supabase.from('deadlines').insert({
      firm_id: profile.firm_id,
      title: form.title.trim(),
      due_date: form.due_date,
      case_id: form.case_id || null,
      urgency: form.urgency,
      done: false,
    }).select('*, cases(title, ref_number)').single();

    if (error) { setFormError(`Failed: ${error.message}`); }
    else {
      setDeadlines(prev => [...prev, data as Deadline].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
      setShowNew(false);
      setForm({ title: '', due_date: '', case_id: '', urgency: 'normal' });
    }
    setCreating(false);
  }

  async function handleDone(id: string) {
    await supabase.from('deadlines').update({ done: true }).eq('id', id);
    setDeadlines(prev => prev.filter(d => d.id !== id));
  }

  const overdue  = deadlines.filter(d => new Date(d.due_date) < new Date());
  const upcoming = deadlines.filter(d => new Date(d.due_date) >= new Date());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Deadlines"
        subtitle={`${overdue.length > 0 ? `${overdue.length} overdue · ` : ''}${upcoming.length} upcoming`}
        actions={<Button variant="primary" icon="＋" onClick={() => { setShowNew(true); setFormError(''); }}>New Deadline</Button>}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
        ) : deadlines.length === 0 ? (
          <EmptyState icon="📅" title="No deadlines" body="Add deadlines to track filing dates, hearings, and key milestones." />
        ) : (
          <>
            {overdue.length > 0 && <Section title="⚠️ Overdue" items={overdue} cases={cases} onDone={handleDone} overdue />}
            {upcoming.length > 0 && <Section title="📅 Upcoming" items={upcoming} cases={cases} onDone={handleDone} />}
          </>
        )}
      </div>

      <Modal open={showNew} onClose={() => { setShowNew(false); setFormError(''); }} title="New Deadline">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {formError && <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(184,64,64,0.2)', borderRadius: 8, padding: '9px 13px', fontSize: 13, color: 'var(--red)' }}>{formError}</div>}
          <Input label="Title *" value={form.title} onChange={set('title')} placeholder="e.g. File Plaint — Mutua v. KCB" />
          <Input label="Due Date *" type="datetime-local" value={form.due_date} onChange={set('due_date')} />
          <Select label="Urgency" value={form.urgency} onChange={set('urgency')}>
            <option value="normal">Normal</option>
            <option value="soon">Soon</option>
            <option value="urgent">Urgent</option>
          </Select>
          <Select label="Link to Case" value={form.case_id} onChange={set('case_id')}>
            <option value="">— No case —</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.ref_number} · {c.title}</option>)}
          </Select>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button onClick={() => setShowNew(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate}>Add Deadline</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, items, cases, onDone, overdue }: {
  title: string; items: Deadline[]; cases: Case[];
  onDone: (id: string) => void; overdue?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(d => {
          const u = URGENCY_STYLE[d.urgency] || URGENCY_STYLE.normal;
          const until = daysUntil(d.due_date);
          const linkedCase = cases.find(c => c.id === d.case_id);
          return (
            <div key={d.id} style={{ background: '#fff', border: `1px solid ${overdue ? 'rgba(184,64,64,0.25)' : 'var(--border)'}`, borderRadius: 11, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(201,168,76,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: u.dot, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{d.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    📅 {new Date(d.due_date).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {linkedCase && (
                    <span style={{ fontSize: 11, background: 'var(--emerald-dim)', color: 'var(--emerald)', padding: '1px 7px', borderRadius: 4, fontWeight: 500 }}>
                      {linkedCase.ref_number}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: overdue ? 'var(--red)' : u.color, background: overdue ? 'var(--red-dim)' : u.bg, padding: '3px 10px', borderRadius: 8, marginBottom: 8 }}>
                  {until}
                </div>
                <Button size="sm" variant="primary" onClick={() => onDone(d.id)}>✓ Done</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
