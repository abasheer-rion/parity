-- Trade charts (DEC-0031): the lines each person draws on a chart (horizontal lines,
-- trend lines and Fibonacci levels), kept per person and per instrument. Each person
-- reads and writes only their own rows. Additive only: a new table, nothing else changes.

create table if not exists public.trade_drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol text not null check (char_length(symbol) between 1 and 64),
  kind text not null check (kind in ('hline', 'trend', 'fib')),
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 1 and 2),
  created_at timestamptz not null default now()
);

create index if not exists trade_drawings_user_symbol on public.trade_drawings (user_id, symbol);

alter table public.trade_drawings enable row level security;

-- Signed-out visitors get nothing; signed-in people get plain row access, no TRUNCATE.
revoke all on public.trade_drawings from anon, authenticated;
grant select, insert, update, delete on public.trade_drawings to authenticated;

drop policy if exists "own drawings" on public.trade_drawings;
create policy "own drawings" on public.trade_drawings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
