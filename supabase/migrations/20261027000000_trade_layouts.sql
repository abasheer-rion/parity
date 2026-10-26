-- Parity Trade layouts (DEC-0040): each person's named workspace layouts (chart grid,
-- symbols, timeframes, indicators, panel sizes) so they follow the person between
-- devices. Each person reads and writes only their own rows. Additive only: one new
-- table, nothing else changes.

create table if not exists public.trade_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- The layout as the app writes it (web/src/trade/state.ts); the app checks every field on load.
  state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(state) = 'object' and pg_column_size(state) <= 16384),
  position integer not null default 0 check (position between 0 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists trade_layouts_user on public.trade_layouts (user_id, position);

alter table public.trade_layouts enable row level security;

revoke all on public.trade_layouts from anon, authenticated;
grant select, insert, update, delete on public.trade_layouts to authenticated;

drop policy if exists "own layouts" on public.trade_layouts;
create policy "own layouts" on public.trade_layouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
