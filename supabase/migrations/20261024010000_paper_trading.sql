-- Demo accounts for paper trading (DEC-0033): virtual money, delayed daily prices, no real
-- orders. Four tables: the account (cash, fee and slippage settings, an attached strategy
-- for forward testing), its orders, its fills and its positions. The matching runs in the
-- browser (web/src/lib/paper/matching.ts); this is a practice account, not an exchange.
--
-- Each person reads and writes only their own rows. Child rows point at their account
-- with (account_id, user_id), so a row can never hang off someone else's account, and
-- they go when the account goes. Additive only: new tables, nothing else changes.

create table if not exists public.paper_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Demo account' check (char_length(name) between 1 and 80),
  starting_cash numeric not null default 100000 check (starting_cash > 0 and starting_cash <= 1000000000),
  cash numeric not null default 100000 check (cash >= 0),
  fee_bps numeric not null default 1 check (fee_bps between 0 and 1000),
  fee_min numeric not null default 1 check (fee_min between 0 and 1000),
  slippage_bps numeric not null default 5 check (slippage_bps between 0 and 1000),
  -- Strategy forward testing: a strategy from the research report, or a draft spec that
  -- is not in the nightly run yet. Its forward curve is read from the nightly report.
  strategy_source text check (strategy_source in ('report', 'draft')),
  strategy_key text check (char_length(strategy_key) <= 120),
  strategy_name text check (char_length(strategy_name) <= 200),
  strategy_spec jsonb check (strategy_spec is null or (jsonb_typeof(strategy_spec) = 'object' and pg_column_size(strategy_spec) <= 20000)),
  strategy_start date,
  strategy_capital numeric check (strategy_capital > 0 and strategy_capital <= 1000000000),
  strategy_attached_at timestamptz,
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  constraint paper_accounts_strategy_whole check ((strategy_source is null) = (strategy_start is null) and (strategy_source is null) = (strategy_capital is null)),
  constraint paper_accounts_id_user unique (id, user_id)
);

create index if not exists paper_accounts_user on public.paper_accounts (user_id);

create table if not exists public.paper_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  symbol text not null check (char_length(symbol) between 1 and 64),
  side text not null check (side in ('buy', 'sell')),
  type text not null check (type in ('market', 'limit', 'stop', 'stop_limit', 'trailing_stop')),
  qty numeric not null check (qty > 0),
  limit_price numeric check (limit_price > 0),
  stop_price numeric check (stop_price > 0),
  trail_pct numeric check (trail_pct > 0 and trail_pct < 100),
  status text not null check (status in ('held', 'pending', 'filled', 'cancelled', 'rejected')),
  role text check (role in ('entry', 'take_profit', 'stop_loss')),
  parent_id uuid,
  oco_group uuid,
  triggered boolean not null default false,
  trail_ref numeric check (trail_ref > 0),
  placed_at timestamptz not null default now(),
  placed_on date not null,
  checked_through date,
  fill_price numeric check (fill_price > 0),
  filled_on date,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  constraint paper_orders_id_user unique (id, user_id),
  constraint paper_orders_account foreign key (account_id, user_id) references public.paper_accounts (id, user_id) on delete cascade,
  constraint paper_orders_parent foreign key (parent_id, user_id) references public.paper_orders (id, user_id) on delete cascade,
  constraint paper_orders_prices check (
    (type in ('limit', 'stop_limit')) = (limit_price is not null)
    and (type in ('stop', 'stop_limit')) = (stop_price is not null)
    and (type = 'trailing_stop') = (trail_pct is not null))
);

create index if not exists paper_orders_account on public.paper_orders (account_id);
create index if not exists paper_orders_parent on public.paper_orders (parent_id);

create table if not exists public.paper_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  order_id uuid not null,
  symbol text not null check (char_length(symbol) between 1 and 64),
  side text not null check (side in ('buy', 'sell')),
  qty numeric not null check (qty > 0),
  price numeric not null check (price > 0),
  fee numeric not null default 0 check (fee >= 0),
  bar_date date not null,
  realized_pnl numeric,
  created_at timestamptz not null default now(),
  constraint paper_fills_account foreign key (account_id, user_id) references public.paper_accounts (id, user_id) on delete cascade,
  constraint paper_fills_order foreign key (order_id, user_id) references public.paper_orders (id, user_id) on delete cascade
);

create index if not exists paper_fills_account on public.paper_fills (account_id);
create index if not exists paper_fills_order on public.paper_fills (order_id);

create table if not exists public.paper_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  symbol text not null check (char_length(symbol) between 1 and 64),
  qty numeric not null check (qty > 0),
  avg_cost numeric not null check (avg_cost >= 0),
  realized numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint paper_positions_account foreign key (account_id, user_id) references public.paper_accounts (id, user_id) on delete cascade,
  constraint paper_positions_one unique (account_id, symbol)
);

alter table public.paper_accounts enable row level security;
alter table public.paper_orders enable row level security;
alter table public.paper_fills enable row level security;
alter table public.paper_positions enable row level security;

-- Signed-out visitors get nothing; signed-in people get plain row access, no TRUNCATE.
revoke all on public.paper_accounts, public.paper_orders, public.paper_fills, public.paper_positions from anon, authenticated;
grant select, insert, update, delete on public.paper_accounts, public.paper_orders, public.paper_fills, public.paper_positions to authenticated;

drop policy if exists "own paper accounts" on public.paper_accounts;
create policy "own paper accounts" on public.paper_accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own paper orders" on public.paper_orders;
create policy "own paper orders" on public.paper_orders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own paper fills" on public.paper_fills;
create policy "own paper fills" on public.paper_fills
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own paper positions" on public.paper_positions;
create policy "own paper positions" on public.paper_positions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
