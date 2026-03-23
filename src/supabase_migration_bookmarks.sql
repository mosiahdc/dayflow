-- Run this in your Supabase SQL editor
-- Creates the document_bookmarks table with RLS

create table if not exists document_bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  label       text not null,
  page        integer,          -- PDF: 1-based page number (null for EPUB)
  cfi         text,             -- EPUB: CFI location string (null for PDF)
  created_at  timestamptz not null default now(),
  constraint page_or_cfi check (page is not null or cfi is not null)
);

-- Index for fast per-document lookups
create index if not exists document_bookmarks_document_id_idx
  on document_bookmarks(document_id);

-- Row-level security: users can only see/edit their own bookmarks
alter table document_bookmarks enable row level security;

create policy "Users manage own bookmarks"
  on document_bookmarks
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
