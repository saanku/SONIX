-- Run once in the Supabase SQL editor. Account libraries are isolated by RLS.
create table if not exists public.libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"favorites":[],"playlists":[],"history":[],"tracks":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint library_object check (jsonb_typeof(data) = 'object')
);
alter table public.libraries enable row level security;
revoke all on public.libraries from anon;
grant select, insert, update, delete on public.libraries to authenticated;
drop policy if exists "Own library only" on public.libraries;
create policy "Own library only" on public.libraries for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
