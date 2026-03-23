-- ============================================================
-- Wakili AI — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── FIRMS ──────────────────────────────────────────────────
create table firms (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  plan        text not null default 'pro' check (plan in ('starter','pro','enterprise')),
  created_at  timestamptz default now()
);

-- ── PROFILES (extends Supabase auth.users) ─────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  firm_id     uuid references firms(id) on delete set null,
  full_name   text not null,
  role        text not null default 'advocate' check (role in ('partner','senior_partner','advocate','paralegal','admin')),
  initials    text,
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', 'NU'), 2))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── CLIENTS ────────────────────────────────────────────────
create table clients (
  id          uuid primary key default uuid_generate_v4(),
  firm_id     uuid not null references firms(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  type        text default 'individual' check (type in ('individual','company')),
  notes       text,
  created_at  timestamptz default now()
);

-- ── CASES ──────────────────────────────────────────────────
create table cases (
  id              uuid primary key default uuid_generate_v4(),
  firm_id         uuid not null references firms(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  assigned_to     uuid references profiles(id) on delete set null,
  ref_number      text unique,
  title           text not null,
  matter_type     text not null,  -- e.g. 'Wrongful Dismissal', 'Land Dispute'
  court           text,           -- e.g. 'ELRC Nairobi', 'High Court'
  status          text default 'active' check (status in ('active','closed','on_hold')),
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── DOCUMENTS ──────────────────────────────────────────────
create table documents (
  id              uuid primary key default uuid_generate_v4(),
  firm_id         uuid not null references firms(id) on delete cascade,
  case_id         uuid references cases(id) on delete set null,
  created_by      uuid references profiles(id) on delete set null,
  title           text not null,
  doc_type        text not null check (doc_type in ('pleading','contract','demand_letter','legal_opinion','affidavit','other')),
  content         text,           -- the AI-generated document content
  prompt          text,           -- the user's original prompt
  status          text default 'draft' check (status in ('draft','review','final','archived')),
  applicable_laws text[],         -- array of statute references
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── DEADLINES ──────────────────────────────────────────────
create table deadlines (
  id          uuid primary key default uuid_generate_v4(),
  firm_id     uuid not null references firms(id) on delete cascade,
  case_id     uuid references cases(id) on delete cascade,
  assigned_to uuid references profiles(id) on delete set null,
  title       text not null,
  due_date    timestamptz not null,
  urgency     text default 'normal' check (urgency in ('urgent','soon','normal')),
  done        boolean default false,
  created_at  timestamptz default now()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table firms      enable row level security;
alter table profiles   enable row level security;
alter table clients    enable row level security;
alter table cases      enable row level security;
alter table documents  enable row level security;
alter table deadlines  enable row level security;

-- Profiles: users can read/update their own
create policy "profiles_select" on profiles for select using (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Firms: members of a firm can read their firm
create policy "firms_select" on firms for select
  using (id in (select firm_id from profiles where id = auth.uid()));

-- Clients: firm members only
create policy "clients_select" on clients for select
  using (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "clients_insert" on clients for insert
  with check (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "clients_update" on clients for update
  using (firm_id in (select firm_id from profiles where id = auth.uid()));

-- Cases: firm members only
create policy "cases_select" on cases for select
  using (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "cases_insert" on cases for insert
  with check (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "cases_update" on cases for update
  using (firm_id in (select firm_id from profiles where id = auth.uid()));

-- Documents: firm members only
create policy "documents_select" on documents for select
  using (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "documents_insert" on documents for insert
  with check (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "documents_update" on documents for update
  using (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "documents_delete" on documents for delete
  using (firm_id in (select firm_id from profiles where id = auth.uid()));

-- Deadlines: firm members only
create policy "deadlines_select" on deadlines for select
  using (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "deadlines_insert" on deadlines for insert
  with check (firm_id in (select firm_id from profiles where id = auth.uid()));
create policy "deadlines_update" on deadlines for update
  using (firm_id in (select firm_id from profiles where id = auth.uid()));

-- ── SEED DATA (optional demo) ──────────────────────────────
-- Uncomment to insert demo firm after creating your first user

-- insert into firms (id, name, plan) values
--   ('00000000-0000-0000-0000-000000000001', 'Odhiambo & Partners', 'pro');

-- update profiles set
--   firm_id  = '00000000-0000-0000-0000-000000000001',
--   full_name = 'Amina Odhiambo',
--   role      = 'senior_partner',
--   initials  = 'AO'
-- where id = auth.uid();
