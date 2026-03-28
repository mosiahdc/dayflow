-- Add skip_reason to habit_entries for "missed habit reason" feature
alter table habit_entries
  add column if not exists skip_reason text;
