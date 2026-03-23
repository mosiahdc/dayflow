-- Run this in your Supabase SQL editor

-- Add reading-status fields to documents table
alter table documents
  add column if not exists status       text not null default 'queue'
    check (status in ('queue','reading','finished')),
  add column if not exists author       text,
  add column if not exists cover_url    text,
  add column if not exists started_at  timestamptz,
  add column if not exists finished_at timestamptz;

-- Reading-goal table (one row per user per year)
create table if not exists reading_goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  year       integer not null,
  goal       integer not null default 12,
  created_at timestamptz not null default now(),
  unique (user_id, year)
);
alter table reading_goals enable row level security;
create policy "Users manage own goals"
  on reading_goals for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Backfill existing rows that have null status
update documents set status = 'queue' where status is null;

-- Make the documents storage bucket public so cover images can be served
-- Run this in Supabase Dashboard → Storage → documents → Make Public
-- OR run via SQL:
-- update storage.buckets set public = true where id = 'documents';

-- Add updated_at column to track reading activity for streak/weekly stats
alter table documents
  add column if not exists updated_at timestamptz not null default now();

-- Backfill existing rows
update documents set updated_at = coalesce(started_at, created_at) where updated_at = now();
