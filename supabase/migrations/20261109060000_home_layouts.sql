-- The product home's widget layout, one row per person (DEC-0075): which widgets are shown, in
-- what order, which are collapsed or hidden, and how many sessions in a row each one went
-- unused (Home collapses a widget nobody clicks). Only the person can read or write their row.
--
-- Additive only: one new table, its policy and a size check. Nothing else changes.

create table if not exists public.home_layouts (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  layout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- A layout is a small object: nine widget ids in a few short lists.
  constraint home_layouts_shape check (jsonb_typeof(layout) = 'object' and pg_column_size(layout) <= 4096)
);

alter table public.home_layouts enable row level security;

revoke all on public.home_layouts from anon, authenticated;
grant select, insert, update, delete on public.home_layouts to authenticated;

drop policy if exists "own home layout" on public.home_layouts;
create policy "own home layout" on public.home_layouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
