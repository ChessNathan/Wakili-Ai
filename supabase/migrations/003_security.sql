-- ============================================================
-- Migration 003 — Security Hardening
-- Run in Supabase SQL Editor AFTER 001 and 002
-- ============================================================

-- ── Audit Log Table ─────────────────────────────────────────
-- Immutable log of all sensitive actions in the system
create table if not exists audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  event       text not null,
  metadata    jsonb default '{}',
  ip_address  text,
  created_at  timestamptz default now()
);

-- Audit logs are insert-only — no updates or deletes allowed
alter table audit_logs enable row level security;

-- Users can only read their own audit log entries
create policy "audit_logs_select_own" on audit_logs
  for select using (auth.uid() = user_id);

-- No user can delete audit logs (immutable)
-- Only the service role (backend) can insert

-- Index for fast user-based lookups
create index if not exists audit_logs_user_id_idx on audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);
create index if not exists audit_logs_event_idx on audit_logs(event);

-- ── Tighten Profiles RLS ────────────────────────────────────
-- Users can only update their own non-sensitive fields
-- (firm_id and role changes must go through the backend service role)
drop policy if exists "profiles_update" on profiles;

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id)
  with check (
    -- Prevent users from promoting their own role
    role = (select role from profiles where id = auth.uid())
  );

-- ── Add updated_at trigger to profiles ──────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table documents  add column if not exists updated_at timestamptz default now();
alter table cases      add column if not exists updated_at timestamptz default now();
alter table profiles   add column if not exists updated_at timestamptz default now();

create or replace trigger documents_updated_at
  before update on documents
  for each row execute procedure set_updated_at();

create or replace trigger cases_updated_at
  before update on cases
  for each row execute procedure set_updated_at();

-- ── Prevent direct role escalation via Supabase client ──────
-- Users cannot directly update firm_id or role through the client
create or replace function prevent_role_escalation()
returns trigger as $$
begin
  -- Only allow changes to non-sensitive fields via client
  if new.role <> old.role and current_setting('role') <> 'service_role' then
    raise exception 'Role changes must go through the admin API';
  end if;
  if new.firm_id <> old.firm_id and current_setting('role') <> 'service_role' then
    raise exception 'Firm assignment must go through the admin API';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger enforce_role_protection
  before update on profiles
  for each row execute procedure prevent_role_escalation();

-- ── Rate limiting table (optional — for DB-level tracking) ──
create table if not exists rate_limit_log (
  id         bigserial primary key,
  ip_address text not null,
  endpoint   text not null,
  hit_at     timestamptz default now()
);

create index if not exists rate_limit_ip_idx on rate_limit_log(ip_address, hit_at desc);

-- Auto-clean entries older than 1 hour
create or replace function clean_rate_limit_log() returns trigger as $$
begin
  delete from rate_limit_log where hit_at < now() - interval '1 hour';
  return new;
end;
$$ language plpgsql;

create or replace trigger clean_rate_limits
  after insert on rate_limit_log
  for each statement execute procedure clean_rate_limit_log();
