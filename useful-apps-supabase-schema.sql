-- Useful Apps Supabase setup
-- Project: Useful apps
-- Project ID: pmyqsieamfohrywdpora
--
-- This creates a single app-state table for the current local-first app.
-- For production multi-user access, replace the anon policy with Supabase Auth
-- and row-level policies scoped to authenticated users and initiative orgs.

create table if not exists public.useful_apps_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.useful_apps_state enable row level security;

drop policy if exists "useful_apps_state_anon_read" on public.useful_apps_state;
drop policy if exists "useful_apps_state_anon_upsert" on public.useful_apps_state;

create policy "useful_apps_state_anon_read"
on public.useful_apps_state
for select
to anon
using (id = 'default');

create policy "useful_apps_state_anon_upsert"
on public.useful_apps_state
for all
to anon
using (id = 'default')
with check (id = 'default');

insert into public.useful_apps_state (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;
