// ── Auth ──────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  firm_id: string | null;
  full_name: string;
  role: 'partner' | 'senior_partner' | 'advocate' | 'paralegal' | 'admin';
  initials: string;
  created_at: string;
}

export interface Firm {
  id: string;
  name: string;
  plan: 'starter' | 'pro' | 'enterprise';
  created_at: string;
}

// ── Documents ─────────────────────────────────────────────
export type DocType = 'pleading' | 'contract' | 'demand_letter' | 'legal_opinion' | 'affidavit' | 'other';
export type DocStatus = 'draft' | 'review' | 'final' | 'archived';

export interface Document {
  id: string;
  firm_id: string;
  case_id: string | null;
  created_by: string | null;
  title: string;
  doc_type: DocType;
  content: string | null;
  prompt: string | null;
  status: DocStatus;
  applicable_laws: string[] | null;
  // Google integration fields
  google_doc_id: string | null;
  google_doc_url: string | null;
  google_drive_id: string | null;
  google_drive_url: string | null;
  google_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  profiles?: { full_name: string; initials: string } | null;
  cases?: { title: string; ref_number: string; court?: string } | null;
}

// ── Cases ────────────────────────────────────────────────
export type CaseStatus = 'active' | 'closed' | 'on_hold';

export interface Case {
  id: string;
  firm_id: string;
  client_id: string | null;
  assigned_to: string | null;
  ref_number: string;
  title: string;
  matter_type: string;
  court: string | null;
  status: CaseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  clients?: { name: string } | null;
  profiles?: { full_name: string; initials: string } | null;
}

// ── Clients ──────────────────────────────────────────────
export interface Client {
  id: string;
  firm_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: 'individual' | 'company';
  notes: string | null;
  created_at: string;
}

// ── Deadlines ────────────────────────────────────────────
export type Urgency = 'urgent' | 'soon' | 'normal';

export interface Deadline {
  id: string;
  firm_id: string;
  case_id: string | null;
  assigned_to: string | null;
  title: string;
  due_date: string;
  urgency: Urgency;
  done: boolean;
  created_at: string;
  // joined
  cases?: { title: string; ref_number: string } | null;
  profiles?: { full_name: string } | null;
}

// ── API ──────────────────────────────────────────────────
export interface ApiError { error: string; }
