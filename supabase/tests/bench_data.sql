-- Made-up data at a realistic size for timing the hot queries (supabase/tests/bench.sh).
-- 10,000 people, 12,000 demo accounts, 1,000,000 orders, about 800,000 fills, 60,000
-- positions, 100,000 alerts, 20,000 watchlists, 200,000 lesson rows and 500,000 MCP calls.
-- Never applied to the hosted project.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
select setseed(0.42);

insert into auth.users (id, email)
select gen_random_uuid(), 'user' || g || '@example.com' from generate_series(1, 10000) g;

create temporary table u as select row_number() over (order by id) as n, id from auth.users;
create index on u (n);

insert into public.paper_accounts (id, user_id, name)
select gen_random_uuid(), u.id, 'Demo account' from u;
insert into public.paper_accounts (id, user_id, name)
select gen_random_uuid(), u.id, 'Demo 2' from u where u.n <= 2000;

create temporary table a as
select row_number() over (order by p.user_id, p.created_at, p.id) as n, p.id, p.user_id from public.paper_accounts p;
create index on a (n);

-- Orders: 80% filled, 10% cancelled, 7% pending, 3% held; half market, half limit.
insert into public.paper_orders (id, user_id, account_id, symbol, side, type, qty, limit_price, status, placed_at, placed_on, fill_price, filled_on)
select gen_random_uuid(), a.user_id, a.id,
       (array['fx.EUR', 'fx.JPY', 'fx.GBP', 'crypto.BTC', 'crypto.ETH', 'idx.SPX', 'cmd.WTI', 'fx.AUD'])[1 + (g % 8)],
       case when g % 2 = 0 then 'buy' else 'sell' end,
       case when r.k < 0.5 then 'market' else 'limit' end,
       round((1 + random() * 100)::numeric, 4),
       case when r.k < 0.5 then null else round((1 + random() * 100)::numeric, 4) end,
       s.status,
       now() - make_interval(days => (g % 365)),
       (now() - make_interval(days => (g % 365)))::date,
       case when s.status = 'filled' then round((1 + random() * 100)::numeric, 4) end,
       case when s.status = 'filled' then (now() - make_interval(days => (g % 365)))::date end
from generate_series(1, 1000000) g
cross join lateral (select random() as k, random() as z) r
cross join lateral (select case when r.z < 0.80 then 'filled' when r.z < 0.90 then 'cancelled' when r.z < 0.97 then 'pending' else 'held' end as status) s
join a on a.n = 1 + (g::bigint * 7919) % 12000;

insert into public.paper_fills (user_id, account_id, order_id, symbol, side, qty, price, fee, bar_date)
select o.user_id, o.account_id, o.id, o.symbol, o.side, o.qty, o.fill_price, 1, o.filled_on
from public.paper_orders o where o.status = 'filled';

insert into public.paper_positions (user_id, account_id, symbol, qty, avg_cost)
select a.user_id, a.id, s, 10, 1.5
from a cross join unnest(array['fx.EUR', 'fx.JPY', 'crypto.BTC', 'idx.SPX', 'cmd.WTI']) s;

insert into public.trade_alerts (user_id, symbol, kind, value)
select u.id, 'fx.EUR', 'price_above', 1.2 from generate_series(1, 100000) g join u on u.n = 1 + g % 10000;
insert into public.trade_watchlists (user_id, name, items)
select u.id, 'List ' || g, '["fx.EUR","crypto.BTC"]'::jsonb from generate_series(1, 20000) g join u on u.n = 1 + g % 10000;
insert into public.academy_progress (user_id, course, lesson)
select u.id, 'course-' || (g % 10), 'lesson-' || g from generate_series(1, 200000) g join u on u.n = 1 + g % 10000;
insert into public.mcp_calls (user_id, client_id, tool, created_at)
select u.id, 'parity-web', 'list_strategies', now() - make_interval(mins => g % 100000)
from generate_series(1, 500000) g join u on u.n = 1 + g % 10000;
insert into public.members (email) select 'user' || g || '@example.com' from generate_series(1, 3) g on conflict do nothing;

vacuum analyze;
