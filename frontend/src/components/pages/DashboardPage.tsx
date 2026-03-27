import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader, StatCard, DocTypeBadge, Spinner } from '../ui/UI';
import { Scale, Users, FileText, Calendar, Plus, ArrowRight } from 'lucide-react';
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
    const fid = profile.firm_id;
    Promise.all([
      supabase.from('documents').select('*').eq('firm_id', fid).order('created_at', { ascending: false }).limit(8),
      supabase.from('cases').select('*').eq('firm_id', fid).order('created_at', { ascending: false }),
      supabase.from('deadlines').select('*, cases(title,ref_number)').eq('firm_id', fid).eq('done', false).order('due_date', { ascending: true }).limit(5),
    ]).then(([d, c, dl]) => {
      setDocs((d.data || []) as Document[]);
      setCases((c.data || []) as Case[]);
      setDeadlines((dl.data || []) as Deadline[]);
    }).finally(() => setLoading(false));
  }, [profile?.firm_id]);

  const activeCases = cases.filter(c => c.status === 'active').length;
  const weekDocs    = docs.filter(d => new Date(d.created_at) > new Date(Date.now() - 7 * 864e5)).length;
  const urgentDl    = deadlines.filter(d => d.urgency === 'urgent').length;
  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Spinner size={32} /></div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <PageHeader title="Dashboard" subtitle={firm?.name || 'Wakili AI'} />

      <div style={{ flex:1, overflowY:'auto', padding:'28px' }}>
        {/* Greeting */}
        <div style={{ background:'var(--forest)', borderRadius:16, padding:'28px 32px', marginBottom:24, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', right:-20, top:-20, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', right:60, bottom:-40, width:120, height:120, borderRadius:'50%', background:'rgba(201,168,76,0.06)', pointerEvents:'none' }} />
          <div style={{ position:'relative' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700, color:'#fff', marginBottom:8 }}>
              {greeting}, {profile?.full_name?.split(' ')[0] || 'Advocate'}
            </div>
            <div style={{ fontSize:15, color:'rgba(255,255,255,0.6)', lineHeight:1.6 }}>
              {activeCases} active case{activeCases !== 1 ? 's' : ''} &nbsp;·&nbsp; {weekDocs} document{weekDocs !== 1 ? 's' : ''} this week
              {urgentDl > 0 && <span style={{ color:'#FCA5A5', marginLeft:8 }}>&nbsp;·&nbsp; {urgentDl} urgent deadline{urgentDl !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          <div onClick={() => navigate('/cases')} style={{ cursor:'pointer' }}>
            <StatCard label="Active Cases" value={activeCases} icon={<Scale size={18} />} accent="var(--forest)" />
          </div>
          <div onClick={() => navigate('/documents')} style={{ cursor:'pointer' }}>
            <StatCard label="Documents" value={docs.length} icon={<FileText size={18} />} accent="var(--gold)" />
          </div>
          <div onClick={() => navigate('/clients')} style={{ cursor:'pointer' }}>
            <StatCard label="Clients" value={0} icon={<Users size={18} />} accent="var(--blue)" />
          </div>
          <div onClick={() => navigate('/deadlines')} style={{ cursor:'pointer' }}>
            <StatCard label="Deadlines" value={deadlines.length} icon={<Calendar size={18} />} accent={urgentDl > 0 ? 'var(--red)' : 'var(--green)'} />
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:13, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)', marginBottom:14 }}>Quick Actions</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[
              { icon:<FileText size={20} />, label:'Draft a Document', sub:'AI-powered legal drafting', path:'/drafter', accent:'var(--forest)' },
              { icon:<Scale size={20} />,    label:'Open a Case',      sub:'Track a new matter',         path:'/cases',    accent:'var(--gold)' },
              { icon:<Users size={20} />,    label:'Add a Client',     sub:'Register new client',        path:'/clients',  accent:'var(--blue)' },
              { icon:<Calendar size={20} />, label:'Set a Deadline',   sub:'Track important dates',      path:'/deadlines', accent:'#7C3AED' },
              { icon:<FileText size={20} />, label:'View Documents',   sub:'Browse all drafts',          path:'/documents', accent:'var(--amber)' },
              { icon:<Plus size={20} />,     label:'Settings',         sub:'Manage integrations',        path:'/settings',  accent:'var(--muted)' },
            ].map(a => (
              <button key={a.path} onClick={() => navigate(a.path)}
                style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all 0.15s', textAlign:'left' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = ''; }}
              >
                <div style={{ width:42, height:42, borderRadius:11, background:`${a.accent}18`, display:'flex', alignItems:'center', justifyContent:'center', color:a.accent, flexShrink:0 }}>{a.icon}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)' }}>{a.label}</div>
                  <div style={{ fontSize:13, color:'var(--muted)', marginTop:2 }}>{a.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent docs + deadlines */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Recent docs */}
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:16, fontWeight:600, color:'var(--ink)' }}>Recent Documents</span>
              <button onClick={() => navigate('/documents')} style={{ display:'flex', alignItems:'center', gap:4, fontSize:14, color:'var(--forest)', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>View all <ArrowRight size={14} /></button>
            </div>
            <div style={{ padding:'8px 0' }}>
              {docs.length === 0 ? (
                <div style={{ padding:'32px 20px', textAlign:'center', fontSize:15, color:'var(--muted)' }}>No documents yet.<br/>Draft your first document.</div>
              ) : docs.slice(0, 5).map(d => (
                <div key={d.id} onClick={() => navigate('/documents')}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', cursor:'pointer', transition:'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <DocTypeBadge type={d.doc_type} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.title}</div>
                    <div style={{ fontSize:13, color:'var(--muted)', marginTop:1 }}>{new Date(d.created_at).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deadlines */}
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:16, fontWeight:600, color:'var(--ink)' }}>Upcoming Deadlines</span>
              <button onClick={() => navigate('/deadlines')} style={{ display:'flex', alignItems:'center', gap:4, fontSize:14, color:'var(--forest)', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>View all <ArrowRight size={14} /></button>
            </div>
            <div style={{ padding:'8px 0' }}>
              {deadlines.length === 0 ? (
                <div style={{ padding:'32px 20px', textAlign:'center', fontSize:15, color:'var(--muted)' }}>No upcoming deadlines.</div>
              ) : deadlines.map(d => {
                const diff = Math.ceil((new Date(d.due_date).getTime() - Date.now()) / 864e5);
                const label = diff < 0 ? 'Overdue' : diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff}d`;
                const isOverdue = diff < 0;
                return (
                  <div key={d.id} onClick={() => navigate('/deadlines')}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', cursor:'pointer', transition:'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <div style={{ width:9, height:9, borderRadius:'50%', background: isOverdue ? 'var(--red)' : d.urgency === 'urgent' ? 'var(--red)' : d.urgency === 'soon' ? 'var(--amber)' : 'var(--green)', flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:500, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.title}</div>
                      <div style={{ fontSize:13, color:'var(--muted)', marginTop:1 }}>{new Date(d.due_date).toLocaleDateString('en-KE', { weekday:'short', day:'numeric', month:'short' })}</div>
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:20, background:isOverdue ? 'var(--red-dim)' : 'var(--green-dim)', color:isOverdue ? 'var(--red)' : 'var(--green)', flexShrink:0 }}>{label}</span>
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
