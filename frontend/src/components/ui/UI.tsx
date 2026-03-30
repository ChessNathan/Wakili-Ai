import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

/* ── Spinner ─────────────────────────────────────────────── */
export function Spinner({ size = 20, color = 'var(--forest)' }: { size?: number; color?: string }) {
  return (
    <Loader2 size={size} color={color} style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
  );
}

/* ── Button ──────────────────────────────────────────────── */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const btnBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  gap: 8, borderRadius: 8, fontFamily: 'var(--font-body)', fontWeight: 500,
  transition: 'all 0.15s', border: '1px solid transparent', cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnVariants = {
  primary:   { background: 'var(--forest)',    color: '#fff',                borderColor: 'var(--forest)' },
  secondary: { background: 'var(--surface)',   color: 'var(--ink)',           borderColor: 'var(--border)' },
  ghost:     { background: 'transparent',      color: 'var(--muted)',         borderColor: 'transparent' },
  danger:    { background: 'var(--red-dim)',   color: 'var(--red)',            borderColor: 'rgba(220,38,38,0.2)' },
  gold:      { background: 'var(--gold)',      color: 'var(--forest)',         borderColor: 'var(--gold)', fontWeight: '700' },
};

const btnSizes = {
  sm: { padding: '6px 14px', fontSize: '13px' },
  md: { padding: '9px 18px', fontSize: '15px' },
  lg: { padding: '12px 24px', fontSize: '16px' },
};

export function Button({ variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, children, disabled, style, ...props }: BtnProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      disabled={isDisabled}
      style={{ ...btnBase, ...btnVariants[variant], ...btnSizes[size], opacity: isDisabled ? 0.55 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer', ...style }}
      {...props}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 15} color="currentColor" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

/* ── Badge ───────────────────────────────────────────────── */
const badgeMap = {
  green:  { bg: 'var(--green-dim)',  color: 'var(--green)' },
  gold:   { bg: 'var(--amber-dim)',  color: 'var(--amber)' },
  blue:   { bg: 'var(--blue-dim)',   color: 'var(--blue)' },
  red:    { bg: 'var(--red-dim)',    color: 'var(--red)' },
  purple: { bg: 'var(--purple-dim)', color: 'var(--purple)' },
  gray:   { bg: '#F3F4F6',          color: 'var(--muted)' },
};

export function Badge({ label, color = 'gray' }: { label: string; color?: keyof typeof badgeMap }) {
  const c = badgeMap[color];
  return (
    <span style={{ ...c, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {label}
    </span>
  );
}

/* ── Doc Type Badge ──────────────────────────────────────── */
const docTypeMap: Record<string, { bg: string; color: string; label: string }> = {
  pleading:      { bg: 'var(--forest-dim)', color: 'var(--forest)',  label: 'Pleading' },
  contract:      { bg: 'var(--amber-dim)',  color: 'var(--amber)',   label: 'Contract' },
  demand_letter: { bg: 'var(--red-dim)',    color: 'var(--red)',     label: 'Demand' },
  legal_opinion: { bg: 'var(--blue-dim)',   color: 'var(--blue)',    label: 'Opinion' },
  affidavit:     { bg: 'var(--purple-dim)', color: 'var(--purple)',  label: 'Affidavit' },
  other:         { bg: '#F3F4F6',          color: 'var(--muted)',   label: 'Other' },
};

export function DocTypeBadge({ type }: { type: string }) {
  const d = docTypeMap[type] || docTypeMap.other;
  return <span style={{ ...d, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{d.label}</span>;
}

/* ── Input ───────────────────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string; hint?: string; }

export function Input({ label, error, hint, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</label>}
      <input
        style={{
          border: `1.5px solid ${error ? 'var(--red)' : 'var(--border)'}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 15,
          fontFamily: 'var(--font-body)', color: 'var(--ink)',
          background: props.disabled ? 'var(--bg)' : '#fff',
          outline: 'none', width: '100%', transition: 'border-color 0.15s, box-shadow 0.15s',
          ...style,
        }}
        onFocus={e => { if (!props.disabled) { e.target.style.borderColor = 'var(--forest)'; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,45,0.1)'; }}}
        onBlur={e => { e.target.style.borderColor = error ? 'var(--red)' : 'var(--border)'; e.target.style.boxShadow = 'none'; }}
        {...props}
      />
      {error && <span style={{ fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={13} />{error}</span>}
      {hint && !error && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{hint}</span>}
    </div>
  );
}

/* ── Textarea ────────────────────────────────────────────── */
interface TAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; hint?: string; }

export function Textarea({ label, hint, style, ...props }: TAreaProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</label>}
      <textarea
        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 15, fontFamily: 'var(--font-body)', color: 'var(--ink)', background: '#fff', outline: 'none', resize: 'vertical', lineHeight: 1.6, minHeight: 90, transition: 'border-color 0.15s, box-shadow 0.15s', ...style }}
        onFocus={e => { e.target.style.borderColor = 'var(--forest)'; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,45,0.1)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
        {...props}
      />
      {hint && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{hint}</span>}
    </div>
  );
}

/* ── Select ──────────────────────────────────────────────── */
interface SelProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; }

export function Select({ label, style, children, ...props }: SelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</label>}
      <select
        style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 15, fontFamily: 'var(--font-body)', color: 'var(--ink)', background: '#fff', outline: 'none', width: '100%', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, transition: 'border-color 0.15s', ...style }}
        onFocus={e => { e.target.style.borderColor = 'var(--forest)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
        {...props}
      >{children}</select>
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────── */
interface ModalProps { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number; }

export function Modal({ open, onClose, title, children, width = 540 }: ModalProps) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.15s ease' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-xl)', animation: 'fadeUp 0.2s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 20, lineHeight: 1, transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Page Header ─────────────────────────────────────────── */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={{ height: 'var(--header-h)', background: '#fff', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, flexShrink: 0 }}>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────── */
export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 60, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--forest-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--forest)' }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 15, color: 'var(--muted)', maxWidth: 320, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

/* ── Alert ───────────────────────────────────────────────── */
export function Alert({ type, message }: { type: 'error' | 'success'; message: string }) {
  const isErr = type === 'error';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, background: isErr ? 'var(--red-dim)' : 'var(--green-dim)', border: `1px solid ${isErr ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}`, fontSize: 14, color: isErr ? 'var(--red)' : 'var(--green)' }}>
      {isErr ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
      {message}
    </div>
  );
}

/* ── Card ────────────────────────────────────────────────── */
export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, ...style }}>{children}</div>;
}

/* ── Stat Card ───────────────────────────────────────────── */
export function StatCard({ label, value, icon, accent = 'var(--gold)' }: { label: string; value: number | string; icon: ReactNode; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--forest-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--forest)' }}>{icon}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{value}</div>
    </div>
  );
}
