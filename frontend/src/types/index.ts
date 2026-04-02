export interface User { id: string; email: string; }
export interface Profile { id: string; firm_id: string | null; full_name: string; role: string; initials: string; created_at: string; updated_at: string; }
export interface Firm { id: string; name: string; plan: string; invite_code?: string; created_at: string; }

export type DocType   = 'pleading' | 'contract' | 'demand_letter' | 'legal_opinion' | 'affidavit' | 'other';
export type DocStatus = 'draft' | 'review' | 'final' | 'archived';
export type CaseStatus = 'active' | 'closed' | 'on_hold';
export type Urgency   = 'urgent' | 'soon' | 'normal';

export interface Document {
  id: string; firm_id: string; case_id: string | null; created_by: string | null;
  title: string; doc_type: DocType; content: string | null; prompt: string | null;
  status: DocStatus; applicable_laws: string[] | null;
  google_doc_id: string | null; google_doc_url: string | null;
  google_drive_id: string | null; google_drive_url: string | null; google_synced_at: string | null;
  created_at: string; updated_at: string;
  profiles?: { full_name: string; initials: string } | null;
  cases?: { title: string; ref_number: string } | null;
}

export interface Case {
  id: string; firm_id: string; client_id: string | null; assigned_to: string | null;
  ref_number: string; title: string; matter_type: string; court: string | null;
  status: CaseStatus; notes: string | null; created_at: string; updated_at: string;
  clients?: { name: string } | null;
  profiles?: { full_name: string; initials: string } | null;
}

export interface Client {
  id: string; firm_id: string; name: string; email: string | null;
  phone: string | null; type: 'individual' | 'company'; notes: string | null; created_at: string;
}

export interface Deadline {
  id: string; firm_id: string; case_id: string | null; assigned_to: string | null;
  title: string; due_date: string; urgency: Urgency; done: boolean; created_at: string;
  cases?: { title: string; ref_number: string } | null;
}
