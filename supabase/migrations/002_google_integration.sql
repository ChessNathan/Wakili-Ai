-- ============================================================
-- Migration 002 — Google Drive + Docs Integration
-- Run this in your Supabase SQL Editor AFTER 001_init.sql
-- ============================================================

-- Add Google fields to documents table
alter table documents
  add column if not exists google_doc_id     text,        -- Google Docs document ID
  add column if not exists google_doc_url    text,        -- Full Google Docs edit URL
  add column if not exists google_drive_id   text,        -- Google Drive file ID (if exported)
  add column if not exists google_drive_url  text,        -- Google Drive file URL
  add column if not exists google_synced_at  timestamptz; -- Last time content was synced

-- Store per-user Google OAuth tokens securely
create table if not exists google_tokens (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at   timestamptz not null,
  scope        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(user_id)
);

alter table google_tokens enable row level security;

-- Users can only read/write their own tokens
create policy "google_tokens_select" on google_tokens
  for select using (auth.uid() = user_id);

create policy "google_tokens_insert" on google_tokens
  for insert with check (auth.uid() = user_id);

create policy "google_tokens_update" on google_tokens
  for update using (auth.uid() = user_id);

create policy "google_tokens_delete" on google_tokens
  for delete using (auth.uid() = user_id);

-- Index for fast token lookups
create index if not exists google_tokens_user_id_idx on google_tokens(user_id);
create index if not exists documents_google_doc_id_idx on documents(google_doc_id) where google_doc_id is not null;
