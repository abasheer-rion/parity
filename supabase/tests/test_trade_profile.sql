-- Checks for 20261112000000_trade_profile.sql, run by supabase/tests/local.sh after every
-- migration is applied. Each check raises an exception when a rule does not hold. Runs in one
-- transaction that is rolled back. Every refusal check has a positive control next to it (the
-- same row IS visible to its owner), so a check cannot pass on an empty read.

\o /dev/null
set client_min_messages = notice;
begin;

-- A opted in (qualifies this week), B opted in (qualifies, better), C not opted in (would
-- qualify), D opted in with too few trades.
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('b2222222-2222-2222-2222-222222222222', 'b@example.com'),
  ('c3333333-3333-3333-3333-333333333333', 'c@example.com'),
  ('d4444444-4444-4444-4444-444444444444', 'd@example.com');

create function pg_temp.tp_as(sub text, client text default null) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.tp_owner() returns void language sql as $$
  select set_config('role', 'none', true);
  select set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.tp_check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
-- The SQLSTATE the statement fails with, or null when it runs.
create function pg_temp.tp_err(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
create function pg_temp.tp_near(a double precision, b double precision) returns boolean language sql as $$
  select a is not null and abs(a - b) < 1e-6 $$;
-- One closed trade (a sell with a realized P&L) or an opening buy (pnl null), each with its order.
create function pg_temp.tp_fill(p_user uuid, p_account uuid, p_day date, p_pnl numeric, p_fee numeric default 1)
returns void language plpgsql as $$
declare o uuid := gen_random_uuid();
begin
  insert into public.paper_orders (id, user_id, account_id, symbol, side, type, qty, status, placed_on, fill_price, filled_on)
  values (o, p_user, p_account, 'TEST', case when p_pnl is null then 'buy' else 'sell' end, 'market', 1, 'filled', p_day, 100, p_day);
  insert into public.paper_fills (user_id, account_id, order_id, symbol, side, qty, price, fee, bar_date, realized_pnl)
  values (p_user, p_account, o, 'TEST', case when p_pnl is null then 'buy' else 'sell' end, 1, 100, p_fee, p_day, p_pnl);
end $$;

insert into public.paper_accounts (id, user_id, starting_cash, cash) values
  ('a0000000-0000-0000-0000-00000000000a', 'a1111111-1111-1111-1111-111111111111', 100000, 100000),
  ('b0000000-0000-0000-0000-00000000000b', 'b2222222-2222-2222-2222-222222222222', 50000, 50000),
  ('c0000000-0000-0000-0000-00000000000c', 'c3333333-3333-3333-3333-333333333333', 10000, 10000),
  ('d0000000-0000-0000-0000-00000000000d', 'd4444444-4444-4444-4444-444444444444', 10000, 10000);

-- A, capital 100000. This week: day -3 +1000 +500, day -2 -3000, day -1 +2000 -100.
-- 5 trades, 3 wins, daily P&L 1500, -3000, 1900 => returns .015, -.03, .019.
-- total_return .004; win_rate .6; mean .0013333, sample sd .0272090, risk_adjusted
-- .0013333 / .0272090 * sqrt(3) = .0848762; equity 101500, 98500, 100400 => max drawdown
-- 3000 / 101500 = .0295567. Fees of 1 per fill are already inside realized_pnl.
-- Outside this week: day -7 (on the edge, excluded) -50 and day -20 +5000 (month and all).
-- One opening buy (pnl null) that is not a closed trade.
select pg_temp.tp_fill('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', current_date - 3, 1000);
select pg_temp.tp_fill('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', current_date - 3, 500);
select pg_temp.tp_fill('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', current_date - 2, -3000);
select pg_temp.tp_fill('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', current_date - 1, 2000);
select pg_temp.tp_fill('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', current_date - 1, -100);
select pg_temp.tp_fill('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', current_date - 7, -50);
select pg_temp.tp_fill('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', current_date - 20, 5000);
select pg_temp.tp_fill('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-00000000000a', current_date - 1, null);
-- B, capital 50000: day -2 +500 +500, day -1 +250 -100 +100 => returns .02, .005;
-- risk_adjusted .0125 / .0106066 * sqrt(2) = 1.6666667 (beats A).
select pg_temp.tp_fill('b2222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000000b', current_date - 2, 500);
select pg_temp.tp_fill('b2222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000000b', current_date - 2, 500);
select pg_temp.tp_fill('b2222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000000b', current_date - 1, 250);
select pg_temp.tp_fill('b2222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000000b', current_date - 1, -100);
select pg_temp.tp_fill('b2222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-00000000000b', current_date - 1, 100);
-- C: strong numbers, 6 trades over 3 days, but never opted in.
select pg_temp.tp_fill('c3333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-00000000000c', current_date - 3, 900);
select pg_temp.tp_fill('c3333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-00000000000c', current_date - 3, 900);
select pg_temp.tp_fill('c3333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-00000000000c', current_date - 2, 800);
select pg_temp.tp_fill('c3333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-00000000000c', current_date - 2, 800);
select pg_temp.tp_fill('c3333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-00000000000c', current_date - 1, 1000);
select pg_temp.tp_fill('c3333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-00000000000c', current_date - 1, 700);
-- D: 2 trades only.
select pg_temp.tp_fill('d4444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-00000000000d', current_date - 2, 100);
select pg_temp.tp_fill('d4444444-4444-4444-4444-444444444444', 'd0000000-0000-0000-0000-00000000000d', current_date - 1, -50);

-- ------------------------------------------------------------ the profile row and its rules

select pg_temp.tp_as('a1111111-1111-1111-1111-111111111111');
insert into public.trader_profiles (handle) values ('ada_l');
select pg_temp.tp_check((select on_leaderboard = false from public.trader_profiles), 'a new profile is off the board by default');
select pg_temp.tp_check((select user_id = 'a1111111-1111-1111-1111-111111111111' from public.trader_profiles), 'the row belongs to the caller by default');
update public.trader_profiles set display_name = 'Ada Lovelace', country = 'GB', on_leaderboard = true;
select pg_temp.tp_check((select count(*) from public.trader_profiles where on_leaderboard) = 1, 'A opts in with a handle');

select pg_temp.tp_as('b2222222-2222-2222-2222-222222222222');
select pg_temp.tp_check(pg_temp.tp_err($$insert into public.trader_profiles (on_leaderboard) values (true)$$) = '23514', 'opting in without a handle is refused');
select pg_temp.tp_check(pg_temp.tp_err($$insert into public.trader_profiles (handle) values ('ab')$$) = '23514', 'a 2-character handle is refused');
select pg_temp.tp_check(pg_temp.tp_err($$insert into public.trader_profiles (handle) values ('a-b-c')$$) = '23514', 'a handle with a dash is refused');
select pg_temp.tp_check(pg_temp.tp_err($$insert into public.trader_profiles (handle) values ('abcdefghijklmnopqrstu')$$) = '23514', 'a 21-character handle is refused');
select pg_temp.tp_check(pg_temp.tp_err($$insert into public.trader_profiles (handle) values ('ADA_L')$$) = '23505', 'handles are unique whatever the case');
select pg_temp.tp_check(pg_temp.tp_err($$insert into public.trader_profiles (handle, country) values ('bob_x', 'gb')$$) = '23514', 'a lower-case country code is refused');
select pg_temp.tp_check(pg_temp.tp_err($$insert into public.trader_profiles (handle, display_name) values ('bob_x', '   ')$$) = '23514', 'a blank display name is refused');
select pg_temp.tp_check(pg_temp.tp_err($$insert into public.trader_profiles (user_id, handle) values ('a1111111-1111-1111-1111-111111111111', 'bob_x')$$) = '42501', 'B cannot make a row for A');
insert into public.trader_profiles (handle, on_leaderboard) values ('bob_trader', true);

-- B cannot see or change A's row; A can (positive control).
select pg_temp.tp_check((select count(*) from public.trader_profiles) = 1, 'B sees exactly one profile row');
select pg_temp.tp_check((select count(*) from public.trader_profiles where user_id = 'a1111111-1111-1111-1111-111111111111') = 0, 'B cannot read A''s row');
update public.trader_profiles set display_name = 'hacked' where user_id = 'a1111111-1111-1111-1111-111111111111';
delete from public.trader_profiles where user_id = 'a1111111-1111-1111-1111-111111111111';
select pg_temp.tp_check(pg_temp.tp_err($$update public.trader_profiles set user_id = 'a1111111-1111-1111-1111-111111111111'$$) is not null, 'B cannot move their row to A');
select pg_temp.tp_as('a1111111-1111-1111-1111-111111111111');
select pg_temp.tp_check((select display_name from public.trader_profiles where user_id = 'a1111111-1111-1111-1111-111111111111') = 'Ada Lovelace', 'A''s row is still there and unchanged after B tried (control)');

-- A connected AI app with A's token can read but not change the profile.
select pg_temp.tp_as('a1111111-1111-1111-1111-111111111111', 'some-ai-app');
select pg_temp.tp_check((select count(*) from public.trader_profiles) = 1, 'an AI app token reads the person''s profile');
update public.trader_profiles set display_name = 'x';
delete from public.trader_profiles;
select pg_temp.tp_check((select display_name from public.trader_profiles) = 'Ada Lovelace', 'an AI app token cannot change or remove it');

select pg_temp.tp_owner();
insert into public.trader_profiles (user_id, handle, on_leaderboard) values
  ('c3333333-3333-3333-3333-333333333333', 'cara_c', false),
  ('d4444444-4444-4444-4444-444444444444', 'dan_d', true);

-- ------------------------------------------------------------ the board

select pg_temp.tp_check(
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
   where table_schema = 'public' and table_name = 'leaderboard_public')
  = array['period','rank','handle','display_name','initials','country','region','trades','active_days',
          'total_return','risk_adjusted','win_rate','max_drawdown','min_trades','is_you'],
  'the board has exactly the agreed columns (no user_id, no email)');
select pg_temp.tp_check(
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
   where table_schema = 'public' and table_name = 'my_trade_stats')
  = array['period','trades','active_days','total_return','risk_adjusted','win_rate','max_drawdown',
          'min_trades','qualifies','on_leaderboard','board_rank'],
  'my_trade_stats has exactly the agreed columns');
select pg_temp.tp_check(
  (select bool_and(coalesce(c.reloptions::text, '') like '%security_invoker=true%') from pg_class c
   where c.oid in ('public.leaderboard_public'::regclass, 'public.my_trade_stats'::regclass)),
  'both views run as the caller');

select pg_temp.tp_as('a1111111-1111-1111-1111-111111111111');
select pg_temp.tp_check((select count(*) from public.leaderboard_public where period = 'week') = 2, 'the week board has the two qualifying opted-in people');
select pg_temp.tp_check((select handle from public.leaderboard_public where period = 'week' and rank = 1) = 'bob_trader', 'B ranks first on risk-adjusted return');
select pg_temp.tp_check((select handle from public.leaderboard_public where period = 'week' and rank = 2) = 'ada_l', 'A ranks second');
select pg_temp.tp_check((select is_you from public.leaderboard_public where handle = 'ada_l') and not (select is_you from public.leaderboard_public where handle = 'bob_trader'), 'is_you marks only the caller');
select pg_temp.tp_check(not exists (select 1 from public.leaderboard_public where handle in ('cara_c', 'dan_d')), 'not-opted-in C and under-traded D are not on the board');
select pg_temp.tp_check(not exists (select 1 from public.leaderboard_public where period in ('month', 'all')), 'nobody has enough trades for month (10) or all (20)');
select pg_temp.tp_check((select initials || '|' || country || '|' || region from public.leaderboard_public where handle = 'ada_l') = 'AL|GB|Europe', 'initials from the display name, country and region');
select pg_temp.tp_check((select initials from public.leaderboard_public where handle = 'bob_trader') = 'BO' and (select region is null from public.leaderboard_public where handle = 'bob_trader'), 'initials from the handle; no country means no region');

-- Stats math on A's hand-computed week.
select pg_temp.tp_check((select trades = 5 and active_days = 3 and min_trades = 5 from public.leaderboard_public where handle = 'ada_l'), 'A: 5 closed trades over 3 days (the buy and day -7 are not counted)');
select pg_temp.tp_check((select pg_temp.tp_near(total_return, 0.004) from public.leaderboard_public where handle = 'ada_l'), 'A: total return 0.004 (fees not subtracted twice)');
select pg_temp.tp_check((select pg_temp.tp_near(win_rate, 0.6) from public.leaderboard_public where handle = 'ada_l'), 'A: win rate 0.6');
select pg_temp.tp_check((select pg_temp.tp_near(risk_adjusted, 0.0848762) from public.leaderboard_public where handle = 'ada_l'), 'A: risk-adjusted 0.0848762');
select pg_temp.tp_check((select pg_temp.tp_near(max_drawdown, 3000.0 / 101500) from public.leaderboard_public where handle = 'ada_l'), 'A: max drawdown 3000 / 101500');
select pg_temp.tp_check((select pg_temp.tp_near(risk_adjusted, 1.6666667) from public.leaderboard_public where handle = 'bob_trader'), 'B: risk-adjusted 1.6666667');

-- My own numbers.
select pg_temp.tp_check((select count(*) from public.my_trade_stats) = 3, 'A gets three rows of their own');
select pg_temp.tp_check((select board_rank = 2 and qualifies and on_leaderboard from public.my_trade_stats where period = 'week'), 'A: week board rank 2');
select pg_temp.tp_check((select trades = 7 and not qualifies and board_rank is null and pg_temp.tp_near(total_return, 0.0535) from public.my_trade_stats where period = 'month'), 'A: month has 7 trades (day -7 and -20 in), does not qualify, no rank');
select pg_temp.tp_check((select trades = 7 and min_trades = 20 from public.my_trade_stats where period = 'all'), 'A: all time has 7 trades, needs 20');

select pg_temp.tp_as('c3333333-3333-3333-3333-333333333333');
select pg_temp.tp_check((select qualifies and not on_leaderboard and board_rank is null and trades = 6 from public.my_trade_stats where period = 'week'), 'C sees their own numbers (qualifying) while off the board');
select pg_temp.tp_check(not exists (select 1 from public.leaderboard_public where is_you), 'C is not on the board even when C is asking');
select pg_temp.tp_check((select count(*) from public.leaderboard_public where period = 'week') = 2, 'C sees the same two board rows (control)');

select pg_temp.tp_as('d4444444-4444-4444-4444-444444444444');
select pg_temp.tp_check((select trades = 2 and not qualifies and board_rank is null and risk_adjusted is not null from public.my_trade_stats where period = 'week'), 'D: 2 trades do not qualify');

-- A person with no account and no profile still gets three rows, all empty.
select pg_temp.tp_owner();
insert into auth.users (id, email) values ('e5555555-5555-5555-5555-555555555555', 'e@example.com') on conflict do nothing;
select pg_temp.tp_as('e5555555-5555-5555-5555-555555555555');
select pg_temp.tp_check((select count(*) = 3 and bool_and(trades = 0 and not qualifies and not on_leaderboard and max_drawdown = 0) from public.my_trade_stats), 'no trades: three empty rows');

-- Signed-in people cannot call the private helper or reach the stats of others any other way.
select pg_temp.tp_check(pg_temp.tp_err($$select * from trade_profile_private.compute_stats(array['c3333333-3333-3333-3333-333333333333'::uuid])$$) = '42501', 'signed in: the private stats helper is not callable');
select pg_temp.tp_check(pg_temp.tp_err($$select * from public.paper_fills where user_id = 'c3333333-3333-3333-3333-333333333333'$$) is null
  and (select count(*) from public.paper_fills where user_id = 'c3333333-3333-3333-3333-333333333333') = 0, 'signed in: other people''s fills stay hidden');

-- ------------------------------------------------------------ signed-out visitors

select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '', true);
select pg_temp.tp_check(pg_temp.tp_err('select count(*) from public.trader_profiles') = '42501', 'signed out: no profile table');
select pg_temp.tp_check(pg_temp.tp_err('select count(*) from public.leaderboard_public') = '42501', 'signed out: no board');
select pg_temp.tp_check(pg_temp.tp_err('select count(*) from public.my_trade_stats') = '42501', 'signed out: no stats');
select pg_temp.tp_check(pg_temp.tp_err('select count(*) from trade_profile_private.leaderboard_rows()') = '42501', 'signed out: no private board function');
select pg_temp.tp_check(pg_temp.tp_err('select count(*) from trade_profile_private.my_stats()') = '42501', 'signed out: no private stats function');

-- ------------------------------------------------------------ grants and function settings

select pg_temp.tp_owner();
select pg_temp.tp_check(not has_function_privilege('anon', 'trade_profile_private.leaderboard_rows()', 'execute')
  and not has_function_privilege('anon', 'trade_profile_private.my_stats()', 'execute')
  and not has_function_privilege('anon', 'trade_profile_private.compute_stats(uuid[])', 'execute')
  and not has_function_privilege('authenticated', 'trade_profile_private.compute_stats(uuid[])', 'execute')
  and not has_schema_privilege('anon', 'trade_profile_private', 'usage'), 'anon has no way into the private schema');
select pg_temp.tp_check(has_function_privilege('authenticated', 'trade_profile_private.leaderboard_rows()', 'execute'), 'signed-in people can run the board function (control)');
select pg_temp.tp_check(not has_table_privilege('anon', 'public.leaderboard_public', 'select')
  and not has_table_privilege('anon', 'public.my_trade_stats', 'select')
  and not has_table_privilege('anon', 'public.trader_profiles', 'select')
  and not has_table_privilege('authenticated', 'public.leaderboard_public', 'insert')
  and not has_table_privilege('authenticated', 'public.trader_profiles', 'truncate'), 'grants are only what is needed');
select pg_temp.tp_check((select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'trade_profile_private' or p.proname in ('country_region', 'trader_profiles_touch')), 'every function pins an empty search_path');
select pg_temp.tp_check((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.proname in ('country_region', 'trader_profiles_touch')) = 0, 'no security definer function in public from this file');
select pg_temp.tp_check(not has_function_privilege('parity_writer', 'trade_profile_private.leaderboard_rows()', 'execute')
  and not has_table_privilege('parity_writer', 'public.trader_profiles', 'select'), 'the research writer gets nothing here');

-- ------------------------------------------------------------ country to region

select pg_temp.tp_check(public.country_region('US') = 'North America', 'US is North America');
select pg_temp.tp_check(public.country_region('MX') = 'Latin America', 'MX is Latin America');
select pg_temp.tp_check(public.country_region('BR') = 'Latin America', 'BR is Latin America');
select pg_temp.tp_check(public.country_region('DE') = 'Europe', 'DE is Europe');
select pg_temp.tp_check(public.country_region('AE') = 'Middle East', 'AE is Middle East');
select pg_temp.tp_check(public.country_region('NG') = 'Africa', 'NG is Africa');
select pg_temp.tp_check(public.country_region('IN') = 'Asia', 'IN is Asia');
select pg_temp.tp_check(public.country_region('NZ') = 'Oceania', 'NZ is Oceania');
select pg_temp.tp_check(public.country_region('ZZ') is null and public.country_region(null) is null and public.country_region('AQ') is null, 'unknown, null and Antarctica have no region');

rollback;
\o
\echo trade_profile: all checks passed
