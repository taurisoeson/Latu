-- Latu andmebaas. Käivita Supabase'is: SQL Editor > New query > kleebi > Run.
create table if not exists public.docs (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.docs enable row level security;

drop policy if exists "own docs select" on public.docs;
drop policy if exists "own docs insert" on public.docs;
drop policy if exists "own docs update" on public.docs;
drop policy if exists "own docs delete" on public.docs;
create policy "own docs select" on public.docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own docs insert" on public.docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own docs update" on public.docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own docs delete" on public.docs for delete to authenticated using ((select auth.uid()) = user_id);
