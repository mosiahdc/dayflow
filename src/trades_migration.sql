-- Create trades table for DayFlow Trading Journey
create table if not exists trades (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  futures       text not null,
  open_time     text,
  close_time    text not null,
  margin_mode   text default 'Cross',
  avg_entry_price  numeric(20, 8) default 0,
  avg_close_price  numeric(20, 8) default 0,
  direction     text not null check (direction in ('Long', 'Short')),
  closing_qty   numeric(20, 8) default 0,
  trading_fee   numeric(20, 8) default 0,
  realized_pnl  numeric(20, 8) default 0,
  status        text default 'All Closed',
  created_at    timestamptz default now()
);

-- Enable Row Level Security
alter table trades enable row level security;

-- RLS policy: users can only see their own trades
create policy "Users can manage their own trades"
  on trades
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast date queries
create index if not exists trades_user_close_time_idx on trades(user_id, close_time);
create index if not exists trades_user_futures_idx on trades(user_id, futures);
