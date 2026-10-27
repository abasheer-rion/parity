-- Checks for 20261115000000_broker_sandbox.sql (DEC-0046), run by supabase/tests/local.sh after
-- every migration is applied. Each check raises an exception when a rule does not hold. Runs
-- in one transaction that is rolled back.

\o /dev/null
set client_min_messages = notice;
begin;

insert into auth.users (id, email) values
  ('41111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('42222222-2222-2222-2222-222222222222', 'b@example.com'),
  ('43333333-3333-3333-3333-333333333333', 'admin@example.com');

create function pg_temp.bk_as(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.bk_service() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  select set_config('role', 'service_role', true);
$$;
create function pg_temp.bk_owner() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'postgres', true);
$$;
create function pg_temp.bk_check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
-- True when the statement fails: no rights, a check, a unique key or a trigger.
create function pg_temp.bk_fails(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end $$;

-- The service role writes orders and appends to the audit log.
select pg_temp.bk_service();
insert into public.broker_orders (user_id, provider, client_order_id, symbol, side, type, qty, time_in_force)
  values ('41111111-1111-1111-1111-111111111111', 'alpaca_paper', 'key-aaaa-0001', 'SPY', 'buy', 'market', 1, 'day');
select pg_temp.bk_check(pg_temp.bk_fails($$insert into public.broker_orders (user_id, provider, client_order_id, symbol, side, type, qty, time_in_force)
  values ('41111111-1111-1111-1111-111111111111', 'alpaca_paper', 'key-aaaa-0001', 'SPY', 'buy', 'market', 1, 'day')$$), 'the same idempotency key cannot be stored twice');
select pg_temp.bk_check(pg_temp.bk_fails($$insert into public.broker_orders (user_id, mode, provider, client_order_id, symbol, side, type, qty, time_in_force)
  values ('41111111-1111-1111-1111-111111111111', 'live', 'alpaca_broker', 'key-live-0001', 'SPY', 'buy', 'market', 1, 'day')$$), 'a live order row is refused');
select pg_temp.bk_check(pg_temp.bk_fails($$insert into public.broker_orders (user_id, provider, client_order_id, symbol, side, type, qty, notional, time_in_force)
  values ('41111111-1111-1111-1111-111111111111', 'alpaca_paper', 'key-both-0001', 'SPY', 'buy', 'market', 1, 100, 'day')$$), 'quantity and notional together are refused');
insert into public.broker_order_audit (user_id, mode, provider, event, client_order_id)
  values ('41111111-1111-1111-1111-111111111111', 'sandbox', 'alpaca_paper', 'requested', 'key-aaaa-0001'),
         ('42222222-2222-2222-2222-222222222222', 'sandbox', 'alpaca_paper', 'requested', 'key-bbbb-0001');
insert into public.broker_order_audit (user_id, mode, event, idem_key) values ('41111111-1111-1111-1111-111111111111', 'sandbox', 'cancel_requested', 'cancel-key-01');
select pg_temp.bk_check(pg_temp.bk_fails($$insert into public.broker_order_audit (user_id, mode, event, idem_key) values ('41111111-1111-1111-1111-111111111111', 'sandbox', 'cancel_requested', 'cancel-key-01')$$), 'a cancel key is recorded once');
select pg_temp.bk_check(pg_temp.bk_fails($$insert into public.broker_order_audit (user_id, mode, event) values ('41111111-1111-1111-1111-111111111111', 'live', 'requested')$$), 'a live audit row is refused');
select pg_temp.bk_check(pg_temp.bk_fails('update public.broker_order_audit set event = ''status'''), 'the service role cannot change the audit log');
select pg_temp.bk_check(pg_temp.bk_fails('delete from public.broker_order_audit'), 'the service role cannot delete from the audit log');
select pg_temp.bk_check(pg_temp.bk_fails('insert into public.trading_admins (user_id) values (''41111111-1111-1111-1111-111111111111'')'), 'the service role cannot add a trading admin');
select pg_temp.bk_check(pg_temp.bk_fails('update public.trading_switch set live_enabled = true'), 'the service role cannot flip the switch');
insert into public.ops_warnings (source, severity, message) values ('broker', 'error', 'Alpaca answered 500');

-- The database owner cannot bypass the audit log or the admin list either.
select pg_temp.bk_owner();
select pg_temp.bk_check(pg_temp.bk_fails('delete from public.broker_order_audit'), 'even the owner cannot delete audit rows');
select pg_temp.bk_check(pg_temp.bk_fails('update public.trading_switch set live_enabled = true, set_by = ''41111111-1111-1111-1111-111111111111'''), 'live needs set_by on the admin list');
select pg_temp.bk_check(pg_temp.bk_fails('update public.trading_switch set live_enabled = true, set_by = null'), 'live needs a set_by');

-- People read their own rows only, and write nothing.
select pg_temp.bk_as('41111111-1111-1111-1111-111111111111');
select pg_temp.bk_check((select count(*) from public.broker_orders) = 1, 'a person sees their own order');
select pg_temp.bk_check((select count(*) from public.broker_order_audit) = 2, 'a person sees their own audit rows');
select pg_temp.bk_check((select count(*) from public.ops_warnings) = 0, 'a non-team person sees no warnings');
select pg_temp.bk_check(pg_temp.bk_fails($$insert into public.broker_orders (user_id, provider, client_order_id, symbol, side, type, qty, time_in_force)
  values ('41111111-1111-1111-1111-111111111111', 'alpaca_paper', 'key-self-0001', 'SPY', 'buy', 'market', 1, 'day')$$), 'a person cannot write an order row');
select pg_temp.bk_check(pg_temp.bk_fails($$insert into public.broker_order_audit (user_id, mode, event) values ('41111111-1111-1111-1111-111111111111', 'sandbox', 'fill')$$), 'a person cannot write the audit log');
select pg_temp.bk_check(pg_temp.bk_fails($$insert into public.broker_onboarding (user_id) values ('41111111-1111-1111-1111-111111111111')$$), 'a person cannot write their onboarding row');
select pg_temp.bk_check(pg_temp.bk_fails('select public.set_trading_live(true)'), 'a non-admin cannot flip the switch');
select pg_temp.bk_check(pg_temp.bk_fails('select count(*) from public.trading_admins'), 'a person cannot read the admin list');

select pg_temp.bk_as('42222222-2222-2222-2222-222222222222');
select pg_temp.bk_check((select count(*) from public.broker_orders) = 0, 'someone else sees no orders');
select pg_temp.bk_check((select count(*) from public.broker_order_audit) = 1, 'someone else sees only their own audit row');

-- An admin added by the owner can flip the switch, and the row names them.
select pg_temp.bk_owner();
insert into public.trading_admins (user_id, note) values ('43333333-3333-3333-3333-333333333333', 'test');
-- Without a second factor, or through an AI app token, even an admin is refused.
select pg_temp.bk_as('43333333-3333-3333-3333-333333333333');
select pg_temp.bk_check(pg_temp.bk_fails('select public.set_trading_live(true)'), 'an admin without a second factor cannot flip the switch');
select set_config('request.jwt.claims', json_build_object('sub', '43333333-3333-3333-3333-333333333333', 'role', 'authenticated', 'aal', 'aal2', 'client_id', 'some-app')::text, true);
select pg_temp.bk_check(pg_temp.bk_fails('select public.set_trading_live(true)'), 'an AI app token of an admin cannot flip the switch');
select set_config('request.jwt.claims', json_build_object('sub', '43333333-3333-3333-3333-333333333333', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select public.set_trading_live(true, 'test');
select pg_temp.bk_owner();
select pg_temp.bk_check((select live_enabled and set_by = '43333333-3333-3333-3333-333333333333' from public.trading_switch where id = 1), 'an admin turns the switch on as themselves');

select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '', true);
select pg_temp.bk_check(pg_temp.bk_fails('select count(*) from public.broker_orders'), 'signed out: no orders');
select pg_temp.bk_check(pg_temp.bk_fails('select public.set_trading_live(true)'), 'signed out: no switch');

rollback;
\o
\echo broker_sandbox: all checks passed
