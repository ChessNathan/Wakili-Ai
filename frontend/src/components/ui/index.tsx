import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

/* ── Button ─────────────────────────────────────────────── */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: string;
}

export function Button({ variant = 'ghost', size = 'md', loading, icon, children, style, ...props }: BtnProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 7, fontFamily: 'var(--font-body)',
    fontWeight: 500, cursor: props.disabled || loading ? 'not-allowed' : 'pointer',
    opacity: props.disabled || loading ? 0.55 : 1,
    transition: 'all 0.15s', border: '1px solid transparent',
    padding: size === 'sm' ? '5px 12px' : '8px 18px',
    fontSize: size === 'sm' ? 12 : 13,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--emerald)', color: '#fff', borderColor: 'var(--emerald)' },
    ghost:   { background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' },
    danger:  { background: 'var(--red-dim)', color: 'var(--red)', borderColor: 'rgba(184,64,64,0.25)' },
    gold:    { background: 'var(--gold)', color: 'var(--emerald)', borderColor: 'var(--gold)', fontWeight: 700 },
  };

  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...props}>
      {loading ? <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> : icon && <span>{icon}</span>}
      {children}
    </button>
  );
}

/* ── Badge ──────────────────────────────────────────────── */
interface BadgeProps { label: string; color?: 'green' | 'gold' | 'blue' | 'red' | 'gray'; }
const badgeColors = {
  green: { bg: '#d1fae5', color: '#065f46' },
  gold:  { bg: '#fef3c7', color: '#92400e' },
  blue:  { bg: 'var(--blue-dim)', color: 'var(--blue)' },
  red:   { bg: 'var(--red-dim)', color: 'var(--red)' },
  gray:  { bg: 'var(--cream)', color: 'var(--muted)' },
};

export function Badge({ label, color = 'gray' }: BadgeProps) {
  const c = badgeColors[color];
  return (
    <span style={{ ...c, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

/* ── DocTypeBadge ───────────────────────────────────────── */
const typeColors: Record<string, { bg: string; color: string }> = {
  pleading:      { bg: 'rgba(26,74,58,0.1)',   color: 'var(--emerald)' },
  contract:      { bg: 'rgba(201,168,76,0.15)', color: '#8a6a1a' },
  demand_letter: { bg: 'var(--red-dim)',         color: 'var(--red)' },
  legal_opinion: { bg: 'var(--blue-dim)',         color: 'var(--blue)' },
  affidavit:     { bg: 'rgba(139,92,246,0.1)',  color: '#6d28d9' },
  other:         { bg: 'var(--cream)',           color: 'var(--muted)' },
};

const typeLabels: Record<string, string> = {
  pleading: 'Pleading', contract: 'Contract', demand_letter: 'Demand',
  legal_opinion: 'Opinion', affidavit: 'Affidavit', other: 'Other',
};

export function DocTypeBadge({ type }: { type: string }) {
  const c = typeColors[type] || typeColors.other;
  return (
    <span style={{ ...c, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {typeLabels[type] || type}
    </span>
  );
}

/* ── Input ──────────────────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string; }

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{label}</label>}
      <input
        style={{
          border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
          borderRadius: 8, padding: '9px 12px', fontSize: 13,
          fontFamily: 'var(--font-body)', color: 'var(--ink)', background: '#fff',
          outline: 'none', width: '100%', transition: 'border-color 0.15s',
          ...style,
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
        onBlur={e => (e.target.style.borderColor = error ? 'var(--red)' : 'var(--border)')}
        {...props}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--red)' }}>{error}</span>}
    </div>
  );
}

/* ── Textarea ───────────────────────────────────────────── */
interface TAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; }

export function Textarea({ label, style, ...props }: TAreaProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{label}</label>}
      <textarea
        style={{
          border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px',
          fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--ink)',
          background: '#fff', outline: 'none', resize: 'vertical', lineHeight: 1.6,
          minHeight: 80, transition: 'border-color 0.15s', ...style,
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        {...props}
      />
    </div>
  );
}

/* ── Select ─────────────────────────────────────────────── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; }

export function Select({ label, style, children, ...props }: SelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{label}</label>}
      <select
        style={{
          border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px',
          fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--ink)',
          background: '#fff', outline: 'none', width: '100%', cursor: 'pointer',
          transition: 'border-color 0.15s', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b6459' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 30,
          ...style,
        }}
        {...props}
      >{children}</select>
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────── */
interface ModalProps { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number; }

export function Modal({ open, onClose, title, children, width = 520 }: ModalProps) {
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)', animation: 'fadeIn 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20, lineHeight: 1, padding: '2px 6px', borderRadius: 6, transition: 'all 0.15s' }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

/* ── PageHeader ─────────────────────────────────────────── */
interface PageHeaderProps { title: string; subtitle?: string; actions?: ReactNode; }

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{ height: 'var(--header-h)', background: 'var(--parchment)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, flexShrink: 0 }}>
      <div style={{ flex: 1 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────── */
export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 300 }}>{body}</div>
    </div>
  );
}

/* ── Spinner ────────────────────────────────────────────── */
export function Spinner({ size = 20 }: { size?: number }) {
  return <div style={{ width: size, height: size, border: `2px solid var(--border)`, borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />;
}
