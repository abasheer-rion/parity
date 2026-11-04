-- Checks for 20261118000000_fill_checks.sql (DEC-0092), run by supabase/tests/local.sh after
-- every migration is applied. Each check raises an exception when a rule does not hold. Runs
-- in one transaction that is rolled back.

\o /dev/null
set client_min_messages = notice;
begin;

insert into auth.users (id, email) values
  ('61111111-1111-1111-1111-111111111111', 'fills-a@example.com'),
  ('62222222-2222-2222-2222-222222222222', 'fills-b@example.com');

create function pg_temp.fc_as(sub text, client text default null) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.fc_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'anon', true);
$$;
create function pg_temp.fc_check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.fc_refused(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when insufficient_privilege or invalid_parameter_value or raise_exception then
  return true;
end $$;
grant execute on function pg_temp.fc_check(boolean, text) to authenticated, anon;
grant execute on function pg_temp.fc_refused(text) to authenticated, anon;

select pg_temp.fc_as('61111111-1111-1111-1111-111111111111');
select pg_temp.fc_check(public.fill_check_take(1000) = 49000, 'a signed-in person can check fills and is told what is left');
select pg_temp.fc_check(pg_temp.fc_refused('select public.fill_check_take(1001)'), 'more than 1,000 fills at once is refused');
select pg_temp.fc_check(pg_temp.fc_refused('select public.fill_check_take(0)'), 'zero fills is refused');
select public.fill_check_take(1000) from generate_series(1, 49);
select pg_temp.fc_check(pg_temp.fc_refused('select public.fill_check_take(1)'), 'the 50,001st fill in a day is refused');
select pg_temp.fc_check(pg_temp.fc_refused('select * from public.fill_check_usage'), 'nobody reads the usage table directly');
select pg_temp.fc_check(pg_temp.fc_refused($q$insert into public.fill_check_usage (user_id, day) values ('61111111-1111-1111-1111-111111111111', '2026-01-01')$q$), 'nobody writes the usage table directly');

select pg_temp.fc_as('62222222-2222-2222-2222-222222222222');
select pg_temp.fc_check(public.fill_check_take(10) = 49990, 'another person has their own allowance');
select public.fill_check_take(1) from generate_series(1, 399);
select pg_temp.fc_check(pg_temp.fc_refused('select public.fill_check_take(1)'), 'the 401st check in a day is refused');

select pg_temp.fc_as('62222222-2222-2222-2222-222222222222', 'some-app');
select pg_temp.fc_check(pg_temp.fc_refused('select public.fill_check_take(1)'), 'a connected AI app cannot use it');

select pg_temp.fc_anon();
select pg_temp.fc_check(pg_temp.fc_refused('select public.fill_check_take(1)'), 'nobody signed out can use it');

reset role;
select pg_temp.fc_check((select count(*) from public.fill_check_usage) = 2, 'one row per person per day, and no fills in it');
select pg_temp.fc_check(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fill_check_usage' and column_name not in ('user_id', 'day', 'requests', 'fills')), 'the table holds counts only');

rollback;
