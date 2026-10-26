-- Timings for the analytics tables on made-up data (DEC-0053): 1,000,000 events from 20,000
-- visitors over 60 days. Run with PARITY_BENCH=1 supabase/tests/local.sh. Reads the numbers,
-- asserts nothing.
\timing on
\echo == bench: load 1,000,000 events
insert into auth.users (id, email) values ('b0000000-0000-0000-0000-000000000001', 'bench@x') on conflict do nothing;
insert into analytics.viewers (user_id) values ('b0000000-0000-0000-0000-000000000001') on conflict do nothing;
do $$ begin perform analytics.ensure_month((now() - make_interval(months => k))::date) from generate_series(0, 2) k; end $$;
insert into analytics.events (at, app, kind, name, route, session_id, visitor_id, ms, value, country, device)
select now() - make_interval(secs => (random() * 60 * 86400)::int),
       (array['site','product','trade','research','academy'])[1 + (i % 5)],
       (array['pageview','pageview','leave','click','click','click','custom','error','rage','pageview'])[1 + (i % 10)],
       case (i % 10) when 3 then 'Button ' || (i % 40) when 4 then 'Tab ' || (i % 12) when 5 then 'Link ' || (i % 60)
                     when 6 then (array['verify_run','sign_up','order_placed','lesson_done'])[1 + (i % 4)]
                     when 7 then 'TypeError at chart' when 8 then 'Run' else '' end,
       (array['/','/signup/','/app/#/verify','/app/#/strategies','/trade/#/chart','/research/#/docs','/academy/#/','/app/#/news'])[1 + (i % 8)],
       md5('s' || (i / 7))::uuid, md5('v' || (i % 20000))::uuid,
       case when i % 10 = 2 then (random() * 120000)::int end,
       case when i % 10 = 2 then (random() * 100)::int end,
       'US', 'desktop'
from generate_series(1, 1000000) i
order by 1;  -- events arrive in time order, as they do for real
vacuum analyze analytics.events;  -- autovacuum does this on the hosted project
\echo == bench: rebuild 60 days of daily totals
select analytics.refresh(((now() at time zone 'utc') - interval '61 days')::date, (now() at time zone 'utc')::date);
\echo == bench: the 15 minute refresh (2 days)
select analytics.refresh();
analyze analytics.daily_routes; analyze analytics.daily_clicks; analyze analytics.daily_visitors;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
set role authenticated;
\echo == bench: dashboard reads (7 and 30 days)
select count(*) from public.metrics_pages(7);
select count(*) from public.metrics_pages(30);
select count(*) from public.metrics_clicks(null, null, 30);
select count(*) from public.metrics_daily(30);
select public.metrics_live() is not null as live;
select * from public.metrics_funnel(30);
select count(*) from public.metrics_retention(8);
reset role;
\echo == bench: plans
explain (analyze, buffers, costs off) select count(distinct visitor_id) from analytics.events where at > now() - interval '5 minutes';
explain (analyze, buffers, costs off) select app, route, sum(views) from analytics.daily_routes where day > current_date - 30 group by 1, 2;
select pg_size_pretty(sum(pg_total_relation_size(c.oid))) as events_size from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'analytics.events'::regclass;
select pg_size_pretty(pg_total_relation_size('analytics.daily_routes') + pg_total_relation_size('analytics.daily_clicks') + pg_total_relation_size('analytics.daily_events') + pg_total_relation_size('analytics.daily_errors') + pg_total_relation_size('analytics.daily_visitors')) as rollup_size;
select c.relname, pg_size_pretty(pg_relation_size(c.oid)) from pg_class c where c.relname like 'events_y%' and c.relkind in ('r','i') and pg_relation_size(c.oid) > 1000000 order by pg_relation_size(c.oid) desc;
explain (analyze, buffers, costs off) select * from public.metrics_funnel(30);
