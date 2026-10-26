-- Broker sandbox (DEC-0046): the records behind buying and selling through a broker partner,
-- in DEMO and SANDBOX modes only. Nothing here moves real money. Parity never holds customer
-- money: the partner (Alpaca) holds every account, the cash and the identity checks.
--
--   broker_accounts      one row per person: their sandbox account at the partner
--   broker_onboarding    one row per person: when they sent the sandbox identity form,
--                        accepted the disclosures and the account agreement. No identity
--                        details are stored here, only the times and the agreement version
--   broker_orders        one row per order sent to the partner. (user_id, client_order_id)
--                        is unique: the idempotency key, so an order is never sent twice
--   broker_order_audit   append-only log of every order event (requested, refused, sent,
--                        filled, cancelled, replaced, errors). Nobody can change or delete it
--   ops_warnings         problems the server saw, such as the broker API failing. Team only
--   trading_admins       who may turn on live trading. Empty. Only the database owner can
--                        add a row (SQL editor); no API role can write it
--   trading_switch       one row: whether live trading is enabled, and by which admin.
--                        Written only through set_trading_live(), which checks the admin list
--
-- Access: a signed-in person reads their own rows and nothing else. Only the service role
-- (the Pages Function, on the server) writes, and it can only append to the audit log.
-- Signed-out visitors get nothing. Every table that records orders or accounts refuses
-- mode = 'live' with a check, so live trading also needs a later migration that removes
-- those checks on purpose. Additive only: new tables and functions, nothing else changes.

-- ---------------------------------------------------------------- accounts

create table if not exists public.broker_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('alpaca_broker', 'alpaca_paper')),
  mode text not null default 'sandbox' check (mode = 'sandbox'),
  external_account_id text not null check (length(external_account_id) between 1 and 64),
  status text not null default 'submitted' check (length(status) between 1 and 40),
  funded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.broker_onboarding (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Sandbox forms only: the identity form takes the partner's published test values.
  sandbox boolean not null default true check (sandbox = true),
  kyc_submitted_at timestamptz,
  disclosures_accepted_at timestamptz,
  agreement_accepted_at timestamptz,
  agreement_version text check (agreement_version is null or length(agreement_version) between 1 and 40),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- orders

create table if not exists public.broker_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mode text not null default 'sandbox' check (mode = 'sandbox'),
  provider text not null check (provider in ('alpaca_broker', 'alpaca_paper')),
  client_order_id text not null check (client_order_id ~ '^[A-Za-z0-9_-]{8,48}$'),
  broker_order_id text check (broker_order_id is null or length(broker_order_id) <= 64),
  symbol text not null check (symbol ~ '^[A-Z0-9./]{1,20}$'),
  side text not null check (side in ('buy', 'sell')),
  type text not null check (type in ('market', 'limit', 'stop', 'stop_limit', 'trailing_stop')),
  order_class text not null default 'simple' check (order_class in ('simple', 'bracket')),
  qty numeric check (qty is null or qty > 0),
  notional numeric check (notional is null or notional > 0),
  limit_price numeric check (limit_price is null or limit_price > 0),
  stop_price numeric check (stop_price is null or stop_price > 0),
  take_profit numeric check (take_profit is null or take_profit > 0),
  stop_loss numeric check (stop_loss is null or stop_loss > 0),
  time_in_force text not null check (time_in_force in ('day', 'gtc', 'ioc', 'fok', 'opg', 'cls')),
  status text not null default 'sending' check (length(status) between 1 and 40),
  filled_qty numeric not null default 0 check (filled_qty >= 0),
  filled_avg_price numeric check (filled_avg_price is null or filled_avg_price > 0),
  reason text check (reason is null or length(reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((qty is null) <> (notional is null)),
  unique (user_id, client_order_id)
);

create index if not exists broker_orders_user on public.broker_orders (user_id, created_at desc);
create index if not exists broker_orders_broker_id on public.broker_orders (broker_order_id);

-- ---------------------------------------------------------------- audit (append-only)

create table if not exists public.broker_order_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid not null,
  mode text not null check (mode in ('demo', 'sandbox')),
  provider text check (provider is null or provider in ('alpaca_broker', 'alpaca_paper')),
  event text not null check (event in ('requested', 'refused', 'sent', 'accepted', 'rejected', 'error',
    'duplicate', 'cancel_requested', 'cancelled', 'replace_requested', 'replaced', 'fill', 'status',
    'onboarding', 'funded', 'rate_limited')),
  client_order_id text check (client_order_id is null or length(client_order_id) <= 48),
  broker_order_id text check (broker_order_id is null or length(broker_order_id) <= 64),
  -- The key for a cancel or replace request, so a retried request is recorded and sent once.
  idem_key text check (idem_key is null or idem_key ~ '^[A-Za-z0-9_-]{8,64}$'),
  -- Order fields and short reasons only. Never identity details, never keys.
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 4000)
);

create index if not exists broker_order_audit_user on public.broker_order_audit (user_id, at desc);
create unique index if not exists broker_order_audit_idem on public.broker_order_audit (user_id, idem_key)
  where idem_key is not null;

create or replace function public.broker_order_audit_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'broker_order_audit is append-only';
end
$$;

revoke all on function public.broker_order_audit_append_only() from public, anon, authenticated;

drop trigger if exists broker_order_audit_append_only on public.broker_order_audit;
create trigger broker_order_audit_append_only before update or delete on public.broker_order_audit
  for each row execute function public.broker_order_audit_append_only();
drop trigger if exists broker_order_audit_no_truncate on public.broker_order_audit;
create trigger broker_order_audit_no_truncate before truncate on public.broker_order_audit
  for each statement execute function public.broker_order_audit_append_only();

-- ---------------------------------------------------------------- warnings

create table if not exists public.ops_warnings (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  source text not null check (source ~ '^[a-z0-9_.-]{1,40}$'),
  severity text not null check (severity in ('info', 'warn', 'error')),
  message text not null check (length(message) between 1 and 300),
  -- Status codes and short reasons only, never keys or personal data.
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 2000)
);

create index if not exists ops_warnings_at on public.ops_warnings (at desc);

-- ---------------------------------------------------------------- the live switch

create table if not exists public.trading_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 200)
);

create table if not exists public.trading_switch (
  id smallint primary key default 1 check (id = 1),
  live_enabled boolean not null default false,
  set_by uuid,
  set_at timestamptz,
  note text check (note is null or length(note) <= 300)
);

insert into public.trading_switch (id, live_enabled) values (1, false) on conflict (id) do nothing;

-- Whoever writes the row, live_enabled = true needs set_by to be on the admin list. This runs
-- for every role, the service role and the database owner included.
create or replace function public.trading_switch_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.live_enabled and (new.set_by is null
      or not exists (select 1 from public.trading_admins a where a.user_id = new.set_by)) then
    raise exception 'live trading can only be enabled by a trading admin';
  end if;
  return new;
end
$$;

revoke all on function public.trading_switch_guard() from public, anon, authenticated;

drop trigger if exists trading_switch_guard on public.trading_switch;
create trigger trading_switch_guard before insert or update on public.trading_switch
  for each row execute function public.trading_switch_guard();

-- The only way to change the switch from the API: a signed-in trading admin, as themselves.
create or replace function public.set_trading_live(p_enabled boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from public.trading_admins a where a.user_id = me) then
    raise exception 'only a trading admin can change the live switch' using errcode = '42501';
  end if;
  update public.trading_switch
     set live_enabled = coalesce(p_enabled, false), set_by = me, set_at = now(), note = left(p_note, 300)
   where id = 1;
end
$$;

revoke all on function public.set_trading_live(boolean, text) from public, anon;
grant execute on function public.set_trading_live(boolean, text) to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.broker_accounts enable row level security;
alter table public.broker_onboarding enable row level security;
alter table public.broker_orders enable row level security;
alter table public.broker_order_audit enable row level security;
alter table public.ops_warnings enable row level security;
alter table public.trading_admins enable row level security;
alter table public.trading_switch enable row level security;

revoke all on public.broker_accounts, public.broker_onboarding, public.broker_orders,
  public.broker_order_audit, public.ops_warnings, public.trading_admins, public.trading_switch
  from anon, authenticated;

grant select on public.broker_accounts, public.broker_onboarding, public.broker_orders,
  public.broker_order_audit to authenticated;
grant select on public.ops_warnings, public.trading_switch to authenticated;

drop policy if exists "people read their own broker account" on public.broker_accounts;
create policy "people read their own broker account" on public.broker_accounts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "people read their own onboarding" on public.broker_onboarding;
create policy "people read their own onboarding" on public.broker_onboarding
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "people read their own broker orders" on public.broker_orders;
create policy "people read their own broker orders" on public.broker_orders
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "people read their own order audit" on public.broker_order_audit;
create policy "people read their own order audit" on public.broker_order_audit
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "team reads warnings" on public.ops_warnings;
create policy "team reads warnings" on public.ops_warnings
  for select to authenticated using ((select public.is_team()));

-- Nobody reads the admin list through the API. The rule says so on purpose.
drop policy if exists "nobody reads trading admins" on public.trading_admins;
create policy "nobody reads trading admins" on public.trading_admins
  for select to authenticated using (false);

drop policy if exists "team reads the live switch" on public.trading_switch;
create policy "team reads the live switch" on public.trading_switch
  for select to authenticated using ((select public.is_team()));

-- The service role (the Pages Function) writes accounts, onboarding and orders, appends to
-- the audit log and the warnings, and reads the switch and the admin list. It cannot change
-- or delete audit rows, add admins, or write the switch.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on public.broker_accounts, public.broker_onboarding, public.broker_orders,
      public.broker_order_audit, public.ops_warnings, public.trading_admins, public.trading_switch
      from service_role;
    grant select, insert, update on public.broker_accounts, public.broker_onboarding, public.broker_orders to service_role;
    grant select, insert on public.broker_order_audit, public.ops_warnings to service_role;
    grant select on public.trading_admins, public.trading_switch to service_role;
  end if;
end
$$;
