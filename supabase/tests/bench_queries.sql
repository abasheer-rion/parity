-- The hot queries, timed with EXPLAIN (ANALYZE) as a signed-in person with row level
-- security on, the way the browser runs them. Each is run 7 times and the median server
-- time is printed. Writes are rolled back after each run. Used by supabase/tests/bench.sh.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\pset footer off

create or replace function pg_temp.median_ms(p_sql text, p_sub uuid, p_runs integer default 7) returns numeric
language plpgsql as $$
declare
  times numeric[] := '{}';
  j json;
  i integer;
begin
  for i in 1 .. p_runs loop
    begin
      if p_sub is not null then
        perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'email', 'x@example.com')::text, true);
        perform set_config('role', 'authenticated', true);
      end if;
      execute 'explain (analyze, format json) ' || p_sql into j;
      times := times || ((j -> 0 ->> 'Execution Time')::numeric + coalesce((j -> 0 ->> 'Planning Time')::numeric, 0));
      raise exception using errcode = 'P0099';
    exception when sqlstate 'P0099' then null;
    end;
  end loop;
  return round((select percentile_cont(0.5) within group (order by t) from unnest(times) t)::numeric, 2);
end
$$;

-- A typical person: the one with the most orders on their first account.
create temporary table who as
select o.user_id, o.account_id, count(*) n from public.paper_orders o group by 1, 2 order by 3 desc limit 1;
grant select on who to authenticated;

select 'demo tab: fills of an account' as query,
  pg_temp.median_ms(format('select * from public.paper_fills where account_id = %L', (select account_id from who)), (select user_id from who)) as ms
union all select 'demo tab: orders of an account',
  pg_temp.median_ms(format('select * from public.paper_orders where account_id = %L', (select account_id from who)), (select user_id from who))
union all select 'demo tab: positions of an account',
  pg_temp.median_ms(format('select * from public.paper_positions where account_id = %L', (select account_id from who)), (select user_id from who))
union all select 'mcp: open orders count (owner)',
  pg_temp.median_ms(format('select count(*) from public.paper_orders where user_id = %L and status in (''pending'', ''held'')', (select user_id from who)), null)
union all select 'reset account: delete its fills',
  pg_temp.median_ms(format('delete from public.paper_fills where account_id = %L', (select account_id from who)), (select user_id from who), 3)
union all select 'delete a login (cascade, owner)',
  pg_temp.median_ms(format('delete from auth.users where id = %L', (select user_id from who)), null, 3)
union all select 'team badge: own members row',
  pg_temp.median_ms('select * from public.members', (select user_id from who));

\if :{?ledger}
select 'ledger: newest 50 rows of a person' as query,
  pg_temp.median_ms('select * from public.trade_ledger order by recorded_at desc limit 50', (select user_id from who)) as ms
union all select 'ledger: an account''s rows this quarter',
  pg_temp.median_ms(format('select * from public.trade_ledger where account_id = %L and recorded_at > now() - interval ''90 days''', (select account_id from who)), (select user_id from who))
union all select 'delete_account_data (owner)',
  pg_temp.median_ms(format('select public.delete_account_data(%L)', (select user_id from who)), null, 3);
\endif
