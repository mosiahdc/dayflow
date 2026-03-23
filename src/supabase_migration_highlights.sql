-- Run this in your Supabase SQL editor

create table if not exists document_highlights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  document_id   uuid not null references documents(id) on delete cascade,
  document_title text not null,
  text          text not null,           -- the highlighted text
  note          text,                    -- optional user annotation
  color         text not null default '#FBBF24', -- highlight colour
  page          integer,                 -- PDF page number (null for EPUB)
  spine_index   integer,                 -- EPUB spine index (null for PDF)
  created_at    timestamptz not null default now()
);

create index if not exists document_highlights_document_id_idx
  on document_highlights(document_id);

create index if not exists document_highlights_user_id_idx
  on document_highlights(user_id);

alter table document_highlights enable row level security;

create policy "Users manage own highlights"
  on document_highlights
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
