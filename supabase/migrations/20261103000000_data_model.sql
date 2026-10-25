-- The data model pass (DEC-0054, REF-0021): faster row rules, an index behind every foreign
-- key and row rule, stricter checks, an append-only trade ledger with idempotency keys, one
-- fill per demo order, and one function that removes everything a person has stored.
--
-- Expand only. No column, table or row that holds user data is dropped or changed. The
-- four indexes dropped (three in section 2, one in section 4) are each covered by a wider
-- new index that starts with the same column. Every statement can run twice (the migration runner can retry).
--
-- Sections
--   1. Row rules that read the sign-in once per query, not once per row (advisor 0003),
--      and functions anon or signed-in callers should not run (advisor 0028/0029).
--   2. Indexes for every foreign key (advisor 0001) and every row rule and hot query.
--   3. Stricter checks on demo trading rows, added NOT VALID and validated when the data
--      allows (it is validated today: the hosted tables hold no orders or fills).
--   4. One fill per order: the idempotency key at the source, so a fill can never be
--      applied twice, even from two open tabs.
--   5. The trade ledger: an append-only, month-partitioned record of every demo account,
--      order and fill event, written by triggers, with an idempotency key per event.
--   6. Account deletion: delete_account_data(user), for the owner or service role.
--
-- Rollback (by hand, in this order, only if something here misbehaves):
--   select cron.unschedule('parity-trade-ledger-partitions');            -- if scheduled
--   drop trigger if exists paper_accounts_ledger on public.paper_accounts;
--   drop trigger if exists paper_orders_ledger on public.paper_orders;
--   drop trigger if exists paper_fills_ledger on public.paper_fills;
--   drop function public.delete_account_data(uuid, boolean);
--   -- The ledger is history; keep it unless it is the cause. To remove it:
--   --   drop table public.trade_ledger cascade; drop table public.trade_ledger_keys;
--   alter table public.paper_fills drop constraint paper_fills_order_account;   -- section 4
--   drop index if exists public.paper_fills_one_per_order;
--   alter table ... drop constraint ... for each check in section 3, and
--   alter table public.paper_orders drop constraint paper_orders_id_user_account.
--   Section 1 and 2 changes are safe to keep; the old policies are in 20261021120000 and
--   20261101090000, and the four old indexes are in 20261024010000.

-- ===================================================================== 1. row rules

-- The team list: a person sees their own row. Same rule, sign-in read once.
drop policy if exists "people see their own team row" on public.members;
create policy "people see their own team row" on public.members
  for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- Deletion requests: same rule, sign-in read once.
drop policy if exists "people file their own deletion request" on public.account_deletion_requests;
create policy "people file their own deletion request" on public.account_deletion_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and email = ((select auth.jwt()) ->> 'email'));

-- AI grants (DEC-0051): only the person's own session changes a grant. Same rules.
drop policy if exists "people change their own ai grants" on public.ai_grants;
create policy "people change their own ai grants" on public.ai_grants
  for insert to authenticated
  with check (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists "people update their own ai grants" on public.ai_grants;
create policy "people update their own ai grants" on public.ai_grants
  for update to authenticated
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'client_id') is null)
  with check (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'client_id') is null);

drop policy if exists "people remove their own ai grants" on public.ai_grants;
create policy "people remove their own ai grants" on public.ai_grants
  for delete to authenticated
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'client_id') is null);

-- Connected apps read but never write directly (DEC-0051). The same restrictive rules as
-- 20261101090000, written so the sign-in is read once per query.
do $$
declare
  t text;
  rule text := '((select auth.jwt()) ->> ''client_id'') is null';
begin
  foreach t in array array[
    'paper_accounts', 'paper_orders', 'paper_fills', 'paper_positions',
    'trade_layouts', 'trade_drawings', 'trade_watchlists', 'trade_alerts',
    'verify_badges', 'verify_dataset', 'account_deletion_requests', 'academy_progress'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "connected apps cannot insert" on public.%I', t);
      execute format('create policy "connected apps cannot insert" on public.%I as restrictive for insert to authenticated with check (%s)', t, rule);
      execute format('drop policy if exists "connected apps cannot update" on public.%I', t);
      execute format('create policy "connected apps cannot update" on public.%I as restrictive for update to authenticated using (%s) with check (%s)', t, rule, rule);
      execute format('drop policy if exists "connected apps cannot delete" on public.%I', t);
      execute format('create policy "connected apps cannot delete" on public.%I as restrictive for delete to authenticated using (%s)', t, rule);
    end if;
  end loop;
end
$$;

-- Supabase grants every new public function to anon and authenticated by default, so
-- "revoke ... from public" alone left these callable through the API.
revoke all on function public.prune_old_series() from public, anon, authenticated;
revoke all on function public.prune_search_snapshots() from public, anon, authenticated;
-- is_member() only means something for a signed-in person.
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- ===================================================================== 2. indexes

-- Demo trading. Child rows point at (account_id, user_id) and (order_id, user_id); each
-- foreign key gets an index with the same leading columns, and user_id gets one so that
-- deleting an account or a login does not read every row of every table.
create index if not exists paper_orders_account_user on public.paper_orders (account_id, user_id);
create index if not exists paper_orders_parent_user on public.paper_orders (parent_id, user_id);
create index if not exists paper_orders_user_status on public.paper_orders (user_id, status);
create index if not exists paper_fills_account_user on public.paper_fills (account_id, user_id);
create index if not exists paper_fills_user on public.paper_fills (user_id);
create index if not exists paper_positions_account_user on public.paper_positions (account_id, user_id);
create index if not exists paper_positions_user on public.paper_positions (user_id);
create index if not exists payment_entitlements_subscription on public.payment_entitlements (subscription_id);

-- Each of these is the first column of a wider index above.
drop index if exists public.paper_orders_account;
drop index if exists public.paper_orders_parent;
drop index if exists public.paper_fills_account;

-- ===================================================================== 3. checks

-- Added NOT VALID (instant, checks new rows only), then validated when every stored row
-- passes. If a stored row fails, the check stays NOT VALID and a notice says so, so this
-- migration can never fail on old data; validate it later by hand after fixing the row.
create or replace function pg_temp.add_check(p_table text, p_name text, p_expr text) returns void
language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conname = p_name and conrelid = ('public.' || p_table)::regclass) then
    execute format('alter table public.%I add constraint %I check (%s) not valid', p_table, p_name, p_expr);
  end if;
  begin
    execute format('alter table public.%I validate constraint %I', p_table, p_name);
  exception when check_violation then
    raise notice '% on % left NOT VALID: some stored rows fail it', p_name, p_table;
  end;
end
$$;

-- A filled order has its price and day; an order that did not fill has neither.
select pg_temp.add_check('paper_orders', 'paper_orders_fill_whole',
  '(status = ''filled'') = (fill_price is not null and filled_on is not null)');
-- Bracket legs have an entry to hang off; an entry or a plain order does not.
select pg_temp.add_check('paper_orders', 'paper_orders_leg_parent',
  '(role in (''take_profit'', ''stop_loss'')) = (parent_id is not null)');
-- Upper bounds, so a bad number cannot overflow the book (the app caps far below these).
select pg_temp.add_check('paper_orders', 'paper_orders_bounds',
  'qty < 1e12 and coalesce(limit_price, 0) < 1e12 and coalesce(stop_price, 0) < 1e12 and coalesce(fill_price, 0) < 1e12');
select pg_temp.add_check('paper_fills', 'paper_fills_bounds',
  'qty < 1e12 and price < 1e12 and fee < 1e12');
select pg_temp.add_check('paper_accounts', 'paper_accounts_cash_bound', 'cash < 1e13');
-- A triggered alert has the value it fired at.
select pg_temp.add_check('trade_alerts', 'trade_alerts_trigger_whole',
  '(triggered_at is null) = (triggered_value is null)');

-- A fill belongs to the same account as its order. paper_orders gets the
-- (id, user_id, account_id) key that the fill's foreign key needs. The columns are in that
-- order so one index on paper_fills serves both this key and (order_id, user_id).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'paper_orders_id_user_account') then
    alter table public.paper_orders add constraint paper_orders_id_user_account unique (id, user_id, account_id);
  end if;
end
$$;

-- ===================================================================== 4. one fill per order

-- The matching code (web/src/lib/paper/matching.ts) fills an order once, in full. A unique
-- index on (order_id, user_id, account_id) makes that a rule, since an order id names one
-- person and one account: a second fill for the same order, from a second open tab or a
-- retried save, is refused instead of moving the cash twice. The same index serves the
-- (order_id, user_id) and (order_id, user_id, account_id) foreign keys, so the old order_id
-- index goes. If stored fills already break the rule, a plain index is made instead and a
-- notice says so.
do $$
begin
  if to_regclass('public.paper_fills_one_per_order') is null and to_regclass('public.paper_fills_order_user_account') is null then
    if exists (select 1 from public.paper_fills group by order_id having count(*) > 1) then
      raise notice 'paper_fills has orders with more than one fill; one fill per order is not enforced yet';
      create index paper_fills_order_user_account on public.paper_fills (order_id, user_id, account_id);
    else
      create unique index paper_fills_one_per_order on public.paper_fills (order_id, user_id, account_id);
    end if;
  end if;
  drop index if exists public.paper_fills_order;
  if not exists (select 1 from pg_constraint where conname = 'paper_fills_order_account') then
    alter table public.paper_fills add constraint paper_fills_order_account
      foreign key (order_id, user_id, account_id) references public.paper_orders (id, user_id, account_id) on delete cascade not valid;
  end if;
  begin
    alter table public.paper_fills validate constraint paper_fills_order_account;
  exception when foreign_key_violation then
    raise notice 'paper_fills_order_account left NOT VALID: some fills name another account than their order';
  end;
end
$$;

-- ===================================================================== 5. the trade ledger

-- Partitions live in a schema the API does not serve, and each one has row level security
-- on and no grants, so a new partition can never be read through /rest/v1 even though
-- Supabase grants new public tables to anon by default.
create schema if not exists parity_private;
revoke all on schema parity_private from public, anon, authenticated;

-- One row per event. Append only: signed-in people may read their own rows and nobody but
-- the database owner may change or remove one (the owner does so only through
-- delete_account_data). Amounts are numeric, never floating point.
create table if not exists public.trade_ledger (
  id bigint generated always as identity,
  recorded_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  kind text not null check (kind in ('account_opened', 'account_reset', 'order_placed', 'order_status', 'fill')),
  -- Unique per person (trade_ledger_keys), so the same event is never recorded twice.
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  order_id uuid,
  symbol text check (char_length(symbol) between 1 and 64),
  side text check (side in ('buy', 'sell')),
  status text check (status in ('held', 'pending', 'filled', 'cancelled', 'rejected')),
  qty numeric check (qty > 0 and qty < 1e12),
  price numeric check (price > 0 and price < 1e12),
  fee numeric check (fee >= 0 and fee < 1e12),
  -- What the event did to the account's cash: negative for a buy, positive for a sell.
  cash_delta numeric not null default 0 check (abs(cash_delta) < 1e13),
  -- The account's cash after a reset or at opening.
  cash_after numeric check (cash_after >= 0 and cash_after < 1e13),
  bar_date date,
  primary key (id, recorded_at)
) partition by range (recorded_at);

create index if not exists trade_ledger_user_time on public.trade_ledger (user_id, recorded_at desc);
create index if not exists trade_ledger_account_time on public.trade_ledger (account_id, recorded_at desc);
create index if not exists trade_ledger_order on public.trade_ledger (order_id) where order_id is not null;

alter table public.trade_ledger enable row level security;
revoke all on public.trade_ledger from public, anon, authenticated, service_role;
grant select on public.trade_ledger to authenticated, service_role;

drop policy if exists "own ledger rows" on public.trade_ledger;
create policy "own ledger rows" on public.trade_ledger
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The idempotency keys. Not partitioned, so the key is unique across all months (a unique
-- index on a partitioned table must include the month).
create table if not exists public.trade_ledger_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  recorded_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

alter table public.trade_ledger_keys enable row level security;
revoke all on public.trade_ledger_keys from public, anon, authenticated;

-- Makes this month's partition and the next p_ahead months, plus a default partition that
-- catches anything outside them (it should stay empty). Safe to run any time.
create or replace function public.trade_ledger_maintain(p_ahead integer default 3)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  m date := date_trunc('month', now())::date;
  i integer;
  part text;
  made integer := 0;
begin
  if to_regclass('parity_private.trade_ledger_default') is null then
    execute 'create table parity_private.trade_ledger_default partition of public.trade_ledger default';
    execute 'alter table parity_private.trade_ledger_default enable row level security';
    execute 'revoke all on parity_private.trade_ledger_default from public, anon, authenticated';
  end if;
  for i in 0 .. greatest(coalesce(p_ahead, 3), 0) loop
    part := format('trade_ledger_y%sm%s', to_char(m + make_interval(months => i), 'YYYY'), to_char(m + make_interval(months => i), 'MM'));
    if to_regclass('parity_private.' || part) is null then
      execute format('create table parity_private.%I partition of public.trade_ledger for values from (%L) to (%L)',
        part, (m + make_interval(months => i))::timestamptz, (m + make_interval(months => i + 1))::timestamptz);
      execute format('alter table parity_private.%I enable row level security', part);
      execute format('revoke all on parity_private.%I from public, anon, authenticated', part);
      made := made + 1;
    end if;
  end loop;
  return made;
end
$$;

revoke all on function public.trade_ledger_maintain(integer) from public, anon, authenticated;

select public.trade_ledger_maintain(3);

-- Records one event once. Returns false when the key was already used.
create or replace function public.trade_ledger_append(
  p_user uuid, p_account uuid, p_kind text, p_key text,
  p_order uuid default null, p_symbol text default null, p_side text default null, p_status text default null,
  p_qty numeric default null, p_price numeric default null, p_fee numeric default null,
  p_cash_delta numeric default 0, p_cash_after numeric default null, p_bar_date date default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.trade_ledger_keys (user_id, idempotency_key) values (p_user, p_key)
  on conflict do nothing;
  if not found then
    return false;
  end if;
  insert into public.trade_ledger (user_id, account_id, kind, idempotency_key, order_id, symbol, side, status,
                                   qty, price, fee, cash_delta, cash_after, bar_date)
  values (p_user, p_account, p_kind, p_key, p_order, p_symbol, p_side, p_status,
          p_qty, p_price, p_fee, coalesce(p_cash_delta, 0), p_cash_after, p_bar_date);
  return true;
end
$$;

revoke all on function public.trade_ledger_append(uuid, uuid, text, text, uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, date)
  from public, anon, authenticated;

-- The triggers. The browser and the MCP server keep writing paper_accounts, paper_orders
-- and paper_fills exactly as before; each change is copied into the ledger.
create or replace function public.paper_accounts_ledger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.trade_ledger_append(new.user_id, new.id, 'account_opened', 'acct:' || new.id || ':open',
      p_cash_after => new.starting_cash);
  elsif new.reset_at is distinct from old.reset_at and new.reset_at is not null then
    perform public.trade_ledger_append(new.user_id, new.id, 'account_reset',
      'acct:' || new.id || ':reset:' || extract(epoch from new.reset_at)::text, p_cash_after => new.starting_cash);
  end if;
  return null;
end
$$;

create or replace function public.paper_orders_ledger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.trade_ledger_append(new.user_id, new.account_id, 'order_placed', 'order:' || new.id || ':placed',
      p_order => new.id, p_symbol => new.symbol, p_side => new.side, p_status => new.status, p_qty => new.qty,
      p_price => coalesce(new.limit_price, new.stop_price));
  end if;
  if (tg_op = 'INSERT' and new.status <> 'pending') or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    perform public.trade_ledger_append(new.user_id, new.account_id, 'order_status', 'order:' || new.id || ':' || new.status,
      p_order => new.id, p_symbol => new.symbol, p_side => new.side, p_status => new.status, p_qty => new.qty,
      p_price => new.fill_price, p_bar_date => new.filled_on);
  end if;
  return null;
end
$$;

create or replace function public.paper_fills_ledger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.trade_ledger_append(new.user_id, new.account_id, 'fill', 'fill:' || new.order_id,
    p_order => new.order_id, p_symbol => new.symbol, p_side => new.side, p_qty => new.qty, p_price => new.price,
    p_fee => new.fee,
    p_cash_delta => case when new.side = 'buy' then -(new.qty * new.price + new.fee) else new.qty * new.price - new.fee end,
    p_bar_date => new.bar_date);
  return null;
end
$$;

revoke all on function public.paper_accounts_ledger() from public, anon, authenticated;
revoke all on function public.paper_orders_ledger() from public, anon, authenticated;
revoke all on function public.paper_fills_ledger() from public, anon, authenticated;

drop trigger if exists paper_accounts_ledger on public.paper_accounts;
create trigger paper_accounts_ledger after insert or update of reset_at on public.paper_accounts
  for each row execute function public.paper_accounts_ledger();
drop trigger if exists paper_orders_ledger on public.paper_orders;
create trigger paper_orders_ledger after insert or update of status on public.paper_orders
  for each row execute function public.paper_orders_ledger();
drop trigger if exists paper_fills_ledger on public.paper_fills;
create trigger paper_fills_ledger after insert on public.paper_fills
  for each row execute function public.paper_fills_ledger();

-- Accounts that exist already get their opening row, so every account has one.
-- They are recorded now (recorded_at is when the ledger learned of the event), so they land
-- in this month's partition and the default partition stays empty.
insert into public.trade_ledger_keys (user_id, idempotency_key)
select a.user_id, 'acct:' || a.id || ':open' from public.paper_accounts a
on conflict do nothing;
insert into public.trade_ledger (user_id, account_id, kind, idempotency_key, cash_after)
select a.user_id, a.id, 'account_opened', 'acct:' || a.id || ':open', a.starting_cash
from public.paper_accounts a
where not exists (select 1 from public.trade_ledger l where l.idempotency_key = 'acct:' || a.id || ':open' and l.user_id = a.user_id);

-- New partitions every night, three months ahead. pg_cron is installed on the hosted
-- project; locally it may not be, and the default partition still catches every row.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('parity-trade-ledger-partitions', '7 0 * * *', 'select public.trade_ledger_maintain(3)');
  end if;
end
$$;

-- ===================================================================== 6. account deletion

-- One row per finished deletion: when, and how many rows went from each table. No user id,
-- email or anything else that names the person.
create table if not exists public.account_deletion_log (
  id bigint generated always as identity primary key,
  requested_at timestamptz,
  deleted_at timestamptz not null default now(),
  login_deleted boolean not null,
  rows_removed jsonb not null check (jsonb_typeof(rows_removed) = 'object')
);

alter table public.account_deletion_log enable row level security;
revoke all on public.account_deletion_log from public, anon, authenticated;

-- Removes everything Parity stores about one person, for "delete my account" (privacy
-- policy, DEC-0054). Run by the owner or the service role, usually for a row in
-- account_deletion_requests:
--
--   select public.delete_account_data('<user id>');          -- data and the login
--   select public.delete_account_data('<user id>', false);   -- data only, keep the login
--
-- Rows that name the person are deleted. Published Verify badges are withdrawn (their
-- numbers wiped, the id kept so old links say "withdrawn"). Payment events keep the Stripe
-- event id with the person removed, because Stripe keeps its own copy. The opt-in Verify
-- dataset never held a user id, so it stays. Product analytics are removed too when the
-- analytics_forget_user(uuid) function exists. Returns how many rows went from each table.
create or replace function public.delete_account_data(p_user uuid, p_delete_login boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  out jsonb := '{}'::jsonb;
  n bigint;
  mail text;
  asked timestamptz;
  login_gone boolean := false;
  t text;
begin
  if p_user is null then
    raise exception 'delete_account_data needs a user id' using errcode = '22023';
  end if;
  select lower(u.email) into mail from auth.users u where u.id = p_user;
  select r.requested_at into asked from public.account_deletion_requests r where r.user_id = p_user;

  update public.verify_badges set user_id = null where user_id = p_user;
  get diagnostics n = row_count; out := out || jsonb_build_object('verify_badges_withdrawn', n);
  update public.payment_events set user_id = null where user_id = p_user;
  get diagnostics n = row_count; out := out || jsonb_build_object('payment_events_unlinked', n);

  -- Children before parents, so every count is the table's own.
  foreach t in array array[
    'paper_fills', 'paper_positions', 'paper_orders', 'paper_accounts',
    'trade_ledger', 'trade_ledger_keys',
    'trade_alerts', 'trade_watchlists', 'trade_drawings', 'trade_layouts',
    'academy_progress', 'ai_grants', 'mcp_calls', 'verify_dataset_quota',
    'payment_entitlements', 'payment_subscriptions', 'payment_customers',
    'account_deletion_requests'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where user_id = $1', t) using p_user;
      get diagnostics n = row_count;
      out := out || jsonb_build_object(t, n);
    end if;
  end loop;

  if mail is not null then
    delete from public.members where email = mail;
    get diagnostics n = row_count; out := out || jsonb_build_object('members', n);
  end if;

  if to_regprocedure('public.analytics_forget_user(uuid)') is not null then
    execute 'select public.analytics_forget_user($1)' using p_user;
    out := out || jsonb_build_object('analytics', 'forgotten');
  end if;

  if p_delete_login then
    begin
      delete from auth.users where id = p_user;
      login_gone := found;
    exception when insufficient_privilege then
      out := out || jsonb_build_object('login', 'not deleted: delete it in the Supabase dashboard');
    end;
  end if;

  insert into public.account_deletion_log (requested_at, login_deleted, rows_removed)
  values (asked, login_gone, out);
  return out || jsonb_build_object('login_deleted', login_gone);
end
$$;

revoke all on function public.delete_account_data(uuid, boolean) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid, boolean) to service_role;
