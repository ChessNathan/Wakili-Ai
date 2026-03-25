import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { DocTypeBadge, Spinner, PageHeader } from '../ui/index';
import type { Document, Case, Deadline } from '../../types';

export function DashboardPage() {
  const { profile, firm } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs]           = useState<Document[]>([]);
  const [cases, setCases]         = useState<Case[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!profile?.firm_id) { setLoading(false); return; }
    Promise.all([
      supabase.from('documents').select('*').eq('firm_id', profile.firm_id).order('created_at', { ascending: false }).limit(10),
      supabase.from('cases').select('*').eq('firm_id', profile.firm_id).order('created_at', { ascending: false }),
      supabase.from('deadlines').select('*, cases(title, ref_number)').eq('firm_id', profile.firm_id).eq('done', false).order('due_date', { ascending: true }).limit(5),
    ]).then(([d, c, dl]) => {
      setDocs(d.data || []);
      setCases(c.data || []);
      setDeadlines(dl.data || []);
      setLoading(false);
    });
  }, [profile?.firm_id]);

  const activeCases  = cases.filter(c => c.status === 'active').length;
  const draftDocs    = docs.filter(d => d.status === 'draft').length;
  const urgentCount  = deadlines.filter(d => d.urgency === 'urgent').length;
  const weekDocs     = docs.filter(d => new Date(d.created_at) > new Date(Date.now() - 7 * 864e5)).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={36} /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader title="Dashboard" subtitle={firm?.name || 'Wakili AI'} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Greeting banner */}
        <div style={{ background: 'linear-gradient(135deg, var(--emerald) 0%, var(--emerald-mid) 100%)', borderRadius: 16, padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 24px,rgba(255,255,255,0.025) 24px,rgba(255,255,255,0.025) 25px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-display)', fontSize: 80, fontWeight: 700, color: 'rgba(201,168,76,0.12)', userSelect: 'none' }}>W</div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              {greeting}, {profile?.full_name?.split(' ')[0] || 'Advocate'} ⚖️
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
              {activeCases} active case{activeCases !== 1 ? 's' : ''} · {draftDocs} draft{draftDocs !== 1 ? 's' : ''} in progress
              {urgentCount > 0 && <span style={{ color: '#fca5a5', marginLeft: 8 }}>· ⚠️ {urgentCount} urgent deadline{urgentCount !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Active Cases',  value: activeCases, icon: '⚖️', path: '/cases' },
            { label: 'Documents',     value: docs.length, icon: '📄', path: '/documents' },
            { label: 'This Week',     value: weekDocs,    icon: '✍️', path: '/drafter' },
            { label: 'Deadlines',     value: deadlines.length, icon: '📅', path: '/deadlines' },
          ].map(s => (
            <div key={s.label} onClick={() => navigate(s.path)}
              style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(201,168,76,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--gold)', opacity: 0.5 }} />
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { icon: '✍️', label: 'Draft a Document', sub: 'AI-powered legal drafting', path: '/drafter' },
              { icon: '⚖️', label: 'New Case',         sub: 'Open a matter',            path: '/cases' },
              { icon: '👥', label: 'Add Client',       sub: 'Register a new client',    path: '/clients' },
              { icon: '📅', label: 'Set Deadline',     sub: 'Track a filing date',      path: '/deadlines' },
              { icon: '📁', label: 'View Documents',   sub: 'Browse all documents',     path: '/documents' },
              { icon: '⚙️', label: 'Settings',         sub: 'Google Drive & account',   path: '/settings' },
            ].map(a => (
              <div key={a.label} onClick={() => navigate(a.path)}
                style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 11, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--parchment)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fff'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--emerald-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{a.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent docs + deadlines */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)' }}>Recent Documents</div>
              <button onClick={() => navigate('/documents')} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>See all →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {docs.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: '16px 0', textAlign: 'center' }}>No documents yet.</div>
                : docs.slice(0, 5).map(d => (
                <div key={d.id} onClick={() => navigate('/documents')}
                  style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <DocTypeBadge type={d.doc_type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{new Date(d.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  {d.google_doc_id && <span title="Google Doc linked">📝</span>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)' }}>Upcoming Deadlines</div>
              <button onClick={() => navigate('/deadlines')} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>See all →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {deadlines.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: '16px 0', textAlign: 'center' }}>No upcoming deadlines.</div>
                : deadlines.map(d => {
                const diff = Math.ceil((new Date(d.due_date).getTime() - Date.now()) / 864e5);
                const label = diff < 0 ? 'Overdue' : diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff}d`;
                const isOverdue = diff < 0;
                return (
                  <div key={d.id} onClick={() => navigate('/deadlines')}
                    style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOverdue ? '#b84040' : d.urgency === 'urgent' ? '#b84040' : d.urgency === 'soon' ? '#c9a84c' : '#4ade80', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{new Date(d.due_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: isOverdue ? 'var(--red-dim)' : '#d1fae5', color: isOverdue ? 'var(--red)' : '#065f46', flexShrink: 0 }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
