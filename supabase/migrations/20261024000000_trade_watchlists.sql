-- Trade trackers (DEC-0033): each person's named watchlists and their price and
-- indicator alerts. Alerts are checked in the browser against delayed daily closes and
-- show as in-app notifications; nothing here sends email or places an order. Each person
-- reads and writes only their own rows. Additive only: two new tables, nothing else changes.

create table if not exists public.trade_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Instrument keys from the Terminal export, such as "fx.EUR" or "crypto.BTC".
  items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 200),
  position integer not null default 0 check (position between 0 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists trade_watchlists_user on public.trade_watchlists (user_id, position);

alter table public.trade_watchlists enable row level security;

revoke all on public.trade_watchlists from anon, authenticated;
grant select, insert, update, delete on public.trade_watchlists to authenticated;

drop policy if exists "own watchlists" on public.trade_watchlists;
create policy "own watchlists" on public.trade_watchlists
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.trade_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol text not null check (char_length(symbol) between 1 and 64),
  kind text not null check (kind in (
    'price_above', 'price_below', 'rsi_above', 'rsi_below', 'cross_above_sma', 'cross_below_sma'
  )),
  value numeric null check (value is null or (value > -1e12 and value < 1e12)),
  -- The look-back for RSI or the moving average, in bars.
  param integer null check (param is null or param between 2 and 400),
  active boolean not null default true,
  triggered_at timestamptz null,
  triggered_value numeric null,
  triggered_bar text null check (triggered_bar is null or char_length(triggered_bar) <= 32),
  created_at timestamptz not null default now(),
  -- Price and RSI alerts need a level; RSI levels sit between 0 and 100; RSI and SMA alerts need a look-back.
  check (kind in ('cross_above_sma', 'cross_below_sma') or value is not null),
  check (kind not in ('rsi_above', 'rsi_below') or value between 0 and 100),
  check (kind in ('price_above', 'price_below') or param is not null)
);

create index if not exists trade_alerts_user on public.trade_alerts (user_id, symbol);

alter table public.trade_alerts enable row level security;

revoke all on public.trade_alerts from anon, authenticated;
grant select, insert, update, delete on public.trade_alerts to authenticated;

drop policy if exists "own alerts" on public.trade_alerts;
create policy "own alerts" on public.trade_alerts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
