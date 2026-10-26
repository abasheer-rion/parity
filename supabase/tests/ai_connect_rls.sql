-- Manual check of 20261101090000_ai_connect.sql (DEC-0051): row rules for connected AI apps,
-- the write grant, the limits and the log. Not run by CI and never applied to the hosted
-- project. Run it against a throwaway local Postgres:
--
--   1. Create a database and load the Supabase stand-ins below the line "stand-ins".
--   2. Apply every file in supabase/migrations/ in order.
--   3. psql -d <db> -f supabase/tests/ai_connect_rls.sql and read the == headings: each says
--      what to expect.
--
-- stand-ins (run first, as a superuser):
--   create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
--   create schema auth; create table auth.users (id uuid primary key, email text);
--   create extension if not exists pgcrypto;
--   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
--   create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
--   grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;
--   grant usage on schema public to anon, authenticated;

\set ON_ERROR_STOP 0
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x');
insert into public.paper_accounts (id,user_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222');
create or replace function pg_temp.as_user(sub text, client text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, false); $$;
set role authenticated;
\echo == 1 web session writes its own order and grant (expect 2 OK)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', null);
insert into public.paper_orders (account_id, symbol, side, type, qty, status, placed_on) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','market',1,'filled',current_date);
insert into public.ai_grants (client_id, client_name) values ('c1','Claude');
\echo == 2 oauth token reads own account (expect 1 row)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'c1');
select count(*) as own_accounts from public.paper_accounts;
\echo == 3 oauth direct insert / update / delete (expect 3 ERRORS or 0 rows)
insert into public.paper_orders (account_id, symbol, side, type, qty, status, placed_on) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','market',1,'filled',current_date);
update public.paper_accounts set cash = 1;
delete from public.paper_orders;
\echo == 4 oauth cannot grant itself write (expect ERROR, then UPDATE 0)
insert into public.ai_grants (client_id, allow_write) values ('c9', true);
update public.ai_grants set allow_write = true;
\echo == 5 place order without grant (expect ERROR may not make changes)
select public.mcp_place_demo_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','limit',1,1.0,null,null);
\echo == 6 web session allows c1 write
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', null);
update public.ai_grants set allow_write = true where client_id = 'c1';
select public.mcp_write_allowed() as web_session_write_allowed;
\echo == 7 c1 places limit order (expect ok), other user account (ERROR), market (ERROR)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'c1');
select public.mcp_write_allowed() as c1_allowed;
\echo == 7a without a started call (expect ERROR start this change through the MCP server)
select public.mcp_place_demo_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','limit',1,1.0,null,null);
select public.mcp_begin_call('place_demo_order', true) ->> 'ok' as started;
select public.mcp_begin_call('save_trade_layout', true) ->> 'ok' as started_layout;
\echo == 7b NaN price (expect ERROR needs a limit price)
select public.mcp_place_demo_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','limit',1,'NaN'::numeric,null,null);
\echo == 7c backdated order is placed today (expect placed_on = today)
select (public.mcp_place_demo_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','limit',1,1.0,null,current_date - 20) ->> 'placed_on')::date = current_date as placed_today;
\echo == 7d the started call is used up (expect ERROR start this change), then a new one works; the next three refuse because each change needs its own started call
select public.mcp_place_demo_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','limit',1,1.0,null,null);
select public.mcp_begin_call('place_demo_order', true) ->> 'ok' as started_again;
select public.mcp_place_demo_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','limit',1,1.0,null,null) ->> 'status' as placed;
select public.mcp_place_demo_order('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','fx.EUR','buy','limit',1,1.0,null,null);
select public.mcp_place_demo_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','market',1,null,null,null);
select public.mcp_place_demo_order('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','fx.EUR','buy','limit',1,null,null,null);
select public.mcp_save_trade_layout('Majors', '{"grid":2}'::jsonb) ->> 'name' as layout;
\echo == 8 another app c2 of same user not allowed (expect ERROR)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'c2');
select public.mcp_save_trade_layout('X', '{}'::jsonb);
\echo == 9 limits: 31 calls, last refused (3 calls already used above, so expect 27 ok and 4 refused)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'c1');
select count(*) filter (where (r->>'ok')::boolean) as ok_calls, count(*) filter (where not (r->>'ok')::boolean) as refused from (select public.mcp_begin_call('get_strategy', false) r from generate_series(1,31)) x;
select client_id, count(*) from public.mcp_calls group by 1;
select public.mcp_begin_call('Bad Tool!');
\echo == 10 user 2 sees none of user 1 rows, cannot end their call
select pg_temp.as_user('22222222-2222-2222-2222-222222222222', null);
select (select count(*) from public.mcp_calls) as calls_seen, (select count(*) from public.ai_grants) as grants_seen;
select public.mcp_end_call((select min(id) from public.mcp_calls), true, 5);
reset role;
select count(*) filter (where ok is not null) as ended_by_other from public.mcp_calls;
\echo == 11 user 1 ends own call
set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'c1');
reset role; select min(id) as first from public.mcp_calls \gset
set role authenticated;
select public.mcp_end_call(:first, true, 12);
reset role;
select ok, ms from public.mcp_calls where id = :first;
\echo == 12 anon cannot call
set role anon;
select public.mcp_begin_call('x');
reset role;
\echo == 13 policies list
select tablename, policyname, permissive, cmd from pg_policies where policyname like 'connected apps%' order by 1,4 limit 6;
select count(*) as restrictive_policies from pg_policies where policyname like 'connected apps%';
