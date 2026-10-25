-- Checks for 20261103000000_data_model.sql (DEC-0054), run by supabase/tests/local.sh after
-- every migration is applied. Each block raises an exception when a rule does not hold, so
-- the script stops at the first failure. Everything runs in one transaction that is rolled
-- back, so the database is left as it was.

\o /dev/null
set client_min_messages = notice;
begin;

-- Two people with a demo account each.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');
insert into public.members (email) values ('a@example.com') on conflict do nothing;

create function pg_temp.as_user(sub text, client text default null) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'email',
    case sub when '11111111-1111-1111-1111-111111111111' then 'a@example.com' else 'b@example.com' end,
    'client_id', client)::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true);
  select set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

-- 1. The browser's writes are copied into the ledger, once each.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.paper_accounts (id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.paper_orders (id, account_id, symbol, side, type, qty, status, placed_on, fill_price, filled_on)
values ('0a000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fx.EUR', 'buy', 'market', 10, 'filled', current_date, 1.1, current_date);
insert into public.paper_fills (account_id, order_id, symbol, side, qty, price, fee, bar_date)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '0a000000-0000-0000-0000-000000000001', 'fx.EUR', 'buy', 10, 1.1, 1, current_date);
select pg_temp.check((select count(*) from public.trade_ledger) = 4, 'ledger has opened, placed, filled and fill rows');
select pg_temp.check((select cash_delta from public.trade_ledger where kind = 'fill') = -12.0, 'a buy fill takes qty * price + fee from cash');

-- 2. A second fill for the same order is refused, and the ledger does not change.
do $$
declare refused boolean := false;
begin
  begin
    insert into public.paper_fills (account_id, order_id, symbol, side, qty, price, fee, bar_date)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '0a000000-0000-0000-0000-000000000001', 'fx.EUR', 'buy', 10, 1.1, 1, current_date);
  exception when unique_violation then refused := true;
  end;
  perform pg_temp.check(refused, 'a second fill for one order is refused');
end $$;
select pg_temp.check((select count(*) from public.trade_ledger where kind = 'fill') = 1, 'the ledger keeps one fill');

-- 3. A status change is recorded once, however often it is saved.
insert into public.paper_orders (id, account_id, symbol, side, type, qty, limit_price, status, placed_on)
values ('0a000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fx.EUR', 'sell', 'limit', 5, 1.3, 'pending', current_date);
update public.paper_orders set status = 'cancelled' where id = '0a000000-0000-0000-0000-000000000002';
update public.paper_orders set status = 'cancelled' where id = '0a000000-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from public.trade_ledger where order_id = '0a000000-0000-0000-0000-000000000002') = 2, 'placed and cancelled, recorded once each');

-- 4. Stricter checks: a filled order needs its price, a fill belongs to its order's account.
do $$
declare refused boolean := false;
begin
  begin
    insert into public.paper_orders (account_id, symbol, side, type, qty, status, placed_on)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fx.EUR', 'buy', 'market', 1, 'filled', current_date);
  exception when check_violation then refused := true;
  end;
  perform pg_temp.check(refused, 'a filled order without a fill price is refused');
end $$;
insert into public.paper_accounts (id) values ('cccccccc-cccc-cccc-cccc-cccccccccccc');
do $$
declare refused boolean := false;
begin
  begin
    insert into public.paper_fills (account_id, order_id, symbol, side, qty, price, bar_date)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '0a000000-0000-0000-0000-000000000002', 'fx.EUR', 'sell', 5, 1.3, current_date);
  exception when foreign_key_violation then refused := true;
  end;
  perform pg_temp.check(refused, 'a fill on another account than its order is refused');
end $$;

-- 5. The ledger is read only, and only your own rows.
do $$
declare refused integer := 0;
begin
  begin insert into public.trade_ledger (user_id, account_id, kind, idempotency_key) values (auth.uid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fill', 'x');
  exception when insufficient_privilege then refused := refused + 1; end;
  begin update public.trade_ledger set cash_delta = 0;
  exception when insufficient_privilege then refused := refused + 1; end;
  begin delete from public.trade_ledger;
  exception when insufficient_privilege then refused := refused + 1; end;
  begin perform public.trade_ledger_append(auth.uid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fill', 'y');
  exception when insufficient_privilege then refused := refused + 1; end;
  perform pg_temp.check(refused = 4, 'people cannot add, change or remove ledger rows');
end $$;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from public.trade_ledger) = 0, 'another person sees none of the ledger');
select pg_temp.as_owner();
select pg_temp.check(not has_schema_privilege('anon', 'parity_private', 'usage') and not has_schema_privilege('authenticated', 'parity_private', 'usage'),
  'the partitions schema is closed to the API roles');
select pg_temp.check(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'parity_private' and c.relkind = 'r' and (not c.relrowsecurity
    or has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))),
  'every partition has row level security and no API grants');
select pg_temp.check((select count(*) from parity_private.trade_ledger_default) = 0, 'the default partition is empty');
select pg_temp.check(public.trade_ledger_maintain(3) = 0, 'partition upkeep can run again and adds nothing');

-- 6. A connected AI app still cannot write directly.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'some-app');
do $$
declare refused boolean := false;
begin
  begin insert into public.trade_layouts (name) values ('x');
  exception when insufficient_privilege then refused := true; end;
  perform pg_temp.check(refused, 'a token issued to an app cannot insert');
end $$;
select pg_temp.check((select count(*) from public.paper_accounts) = 2, 'a token issued to an app still reads its person''s rows');
select pg_temp.as_owner();

-- 7. The advisor rules: every row rule reads the sign-in once per query.
select pg_temp.check(not exists (
  select 1 from pg_policies p where p.schemaname = 'public' and (
    (p.qual like '%auth.uid()%' and lower(p.qual) not like '%select auth.uid()%')
    or (p.qual like '%auth.jwt()%' and lower(p.qual) not like '%select auth.jwt()%')
    or (p.with_check like '%auth.uid()%' and lower(p.with_check) not like '%select auth.uid()%')
    or (p.with_check like '%auth.jwt()%' and lower(p.with_check) not like '%select auth.jwt()%'))),
  'no row rule calls auth.uid() or auth.jwt() once per row');

-- Every foreign key in public has an index that starts with its columns.
select pg_temp.check(not exists (
  select 1 from pg_constraint c
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid
        and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
        and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] <@ c.conkey)),
  'every foreign key has an index');

select pg_temp.check(not has_function_privilege('anon', 'public.prune_old_series()', 'execute')
  and not has_function_privilege('authenticated', 'public.prune_old_series()', 'execute')
  and not has_function_privilege('anon', 'public.prune_search_snapshots()', 'execute')
  and not has_function_privilege('anon', 'public.is_member()', 'execute')
  and has_function_privilege('authenticated', 'public.is_member()', 'execute'),
  'owner-only functions are closed to the API roles');
select pg_temp.check(not has_function_privilege('authenticated', 'public.delete_account_data(uuid, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.delete_account_data(uuid, boolean)', 'execute')
  and has_function_privilege('service_role', 'public.delete_account_data(uuid, boolean)', 'execute'),
  'only the service role and the owner can delete an account''s data');

-- 8. Deleting an account's data.
insert into public.account_deletion_requests (user_id, email) values ('11111111-1111-1111-1111-111111111111', 'a@example.com');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.trade_watchlists (name) values ('mine');
insert into public.academy_progress (course, lesson) values ('c', 'l');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into public.paper_accounts default values;
select pg_temp.as_owner();
select public.delete_account_data('11111111-1111-1111-1111-111111111111');
select pg_temp.check(not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'the login is gone');
select pg_temp.check(
  (select count(*) from public.paper_accounts where user_id = '11111111-1111-1111-1111-111111111111') = 0
  and (select count(*) from public.paper_orders where user_id = '11111111-1111-1111-1111-111111111111') = 0
  and (select count(*) from public.trade_ledger where user_id = '11111111-1111-1111-1111-111111111111') = 0
  and (select count(*) from public.trade_ledger_keys where user_id = '11111111-1111-1111-1111-111111111111') = 0
  and (select count(*) from public.trade_watchlists where user_id = '11111111-1111-1111-1111-111111111111') = 0
  and (select count(*) from public.academy_progress where user_id = '11111111-1111-1111-1111-111111111111') = 0
  and (select count(*) from public.members where email = 'a@example.com') = 0
  and (select count(*) from public.account_deletion_requests) = 0,
  'every row that named the person is gone');
select pg_temp.check((select count(*) from public.paper_accounts where user_id = '22222222-2222-2222-2222-222222222222') = 1
  and (select count(*) from public.trade_ledger where user_id = '22222222-2222-2222-2222-222222222222') = 1,
  'the other person keeps their rows');
select pg_temp.check((select count(*) from public.account_deletion_log where login_deleted and requested_at is not null
  and (rows_removed ->> 'paper_orders')::int = 2 and (rows_removed ->> 'trade_ledger')::int = 7) = 1,
  'the deletion log has the counts and no user id');
select pg_temp.check(not exists (select 1 from information_schema.columns where table_name = 'account_deletion_log' and column_name in ('user_id', 'email')),
  'the deletion log has no column that names a person');

rollback;
