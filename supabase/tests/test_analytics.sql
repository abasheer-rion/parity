-- Checks for 20261104000000_product_analytics.sql (DEC-0053). Run by supabase/tests/local.sh;
-- any failed assert stops the run.
\set ON_ERROR_STOP 1
\echo == analytics: setup
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'viewer@x'),
  ('a0000000-0000-0000-0000-000000000002', 'person@x')
on conflict do nothing;
insert into analytics.viewers (user_id, note) values ('a0000000-0000-0000-0000-000000000001', 'test') on conflict do nothing;

create or replace function pg_temp.as_user(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', case when sub is null then '' else json_build_object('sub', sub, 'role', 'authenticated')::text end, false) $$;

\echo == anon writes through the function, and cannot read or write the tables
set role anon;
select pg_temp.as_user(null);
do $$
declare n integer;
begin
  n := public.analytics_ingest('{"app":"site","sid":"10000000-0000-0000-0000-000000000001","vid":"20000000-0000-0000-0000-000000000001","device":"desktop","ref":"news.example.com","ev":[
    {"k":"pageview","r":"/","o":5000},
    {"k":"click","r":"/","n":"Sign up","o":3000},
    {"k":"leave","r":"/","ms":4200,"v":80,"o":0},
    {"k":"custom","r":"/","n":"Bad Name"},
    {"k":"pageview","r":"/<script>"},
    {"k":"click","r":"/","n":"mail me at someone@example.com 12345678"}
  ]}'::jsonb, 'GB');
  assert n = 4, format('expected 4 stored, got %s', n);
end $$;
do $$
begin
  begin
    perform count(*) from analytics.events;
    raise exception 'anon read analytics.events';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into analytics.events (at, app, kind, route, session_id, visitor_id) values (now(), 'site', 'pageview', '/', gen_random_uuid(), gen_random_uuid());
    raise exception 'anon wrote analytics.events';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.metrics_live();
    raise exception 'anon ran metrics_live';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo == a signed-in person gets a hash, never the id; masking works
set role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select public.analytics_ingest('{"app":"product","sid":"10000000-0000-0000-0000-000000000002","vid":"20000000-0000-0000-0000-000000000001","ev":[
  {"k":"pageview","r":"/signup/"},{"k":"custom","r":"/signup/","n":"sign_up"},{"k":"custom","r":"/app/#/verify","n":"verify_run","p":{"rows":120,"source":"csv"}}]}'::jsonb, 'GB');
\echo == a non-viewer cannot read metrics
do $$
begin
  assert public.metrics_allowed() = false, 'non-viewer allowed';
  begin
    perform public.metrics_pages(7);
    raise exception 'non-viewer read metrics';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
declare h text; c integer;
begin
  select count(*) into c from analytics.events where user_hash is not null;
  assert c = 3, format('expected 3 hashed rows, got %s', c);
  select user_hash into h from analytics.events where user_hash is not null limit 1;
  assert h = analytics.user_hash('a0000000-0000-0000-0000-000000000002'), 'hash mismatch';
  assert h !~ 'a0000000', 'raw id stored';
  assert not exists (select 1 from analytics.events where name ~ '@|[0-9]{4,}'), 'email or digits kept';
  assert exists (select 1 from analytics.events where name = 'mail me at (email) #'), 'masking changed';
  assert (select referrer from analytics.events where kind = 'pageview' and app = 'site') = 'news.example.com', 'referrer';
  assert (select country from analytics.events limit 1) = 'GB', 'country';
end $$;

\echo == rollups, and a viewer reads them
select analytics.refresh();
set role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
do $$
declare r record;
begin
  assert public.metrics_allowed(), 'viewer not allowed';
  select * into r from public.metrics_pages(7) where route = '/';
  assert r.views = 1 and r.avg_visible_ms = 4200 and r.avg_scroll = 80, format('pages row %s', r);
  assert (select clicks from public.metrics_clicks('site', '/', 7) where target = 'Sign up') = 1, 'clicks';
  assert (select visitors from public.metrics_funnel(30) where step = 4) = 1, 'funnel end';
  assert (select count(*) from public.metrics_events(30)) = 2, 'events';
  assert (public.metrics_live()->>'visitors')::int = 1, 'live';
  assert (select size from public.metrics_retention(4) limit 1) = 1, 'retention';
end $$;
reset role;

\echo == partitions: next months exist, an early-arriving row moves out of default, old months drop
do $$
declare m date := date_trunc('month', now() at time zone 'utc')::date; c integer;
begin
  assert to_regclass(format('analytics.events_y%s', to_char(m + interval '2 months', 'YYYY"m"MM'))) is not null, 'month+2 missing';
  insert into analytics.events (at, app, kind, route, session_id, visitor_id)
    values ((m + interval '5 months')::timestamptz, 'site', 'pageview', '/', gen_random_uuid(), gen_random_uuid());
  assert (select count(*) from analytics.events_default) = 1, 'not in default';
  perform analytics.ensure_month((m + interval '5 months')::date);
  assert (select count(*) from analytics.events_default) = 0, 'default not emptied';
  perform analytics.ensure_month((m - interval '15 months')::date);
  insert into analytics.events (at, app, kind, route, session_id, visitor_id)
    values ((m - interval '15 months')::timestamptz, 'site', 'pageview', '/', gen_random_uuid(), gen_random_uuid());
  perform analytics.maintain();
  assert to_regclass(format('analytics.events_y%s', to_char(m - interval '15 months', 'YYYY"m"MM'))) is null, 'old month kept';
  select count(*) into c from analytics.events where at < m - interval '13 months';
  assert c = 0, 'old rows kept';
end $$;

\echo == forgetting a person removes their events and the anonymous events from their browser
do $$
declare gone bigint;
begin
  gone := analytics.forget_user('a0000000-0000-0000-0000-000000000002');
  assert gone >= 7, format('forgot only %s', gone);
  assert not exists (select 1 from analytics.events where visitor_id = '20000000-0000-0000-0000-000000000001'), 'visitor kept';
end $$;

\echo == account deletion reaches analytics, and only the owner can call it
do $$
declare out jsonb;
begin
  assert not has_function_privilege('authenticated', 'public.analytics_forget_user(uuid)', 'execute'), 'authenticated can forget users';
  perform public.analytics_ingest('{"app":"site","sid":"10000000-0000-0000-0000-000000000005","vid":"20000000-0000-0000-0000-000000000005","ev":[{"k":"pageview","r":"/"}]}'::jsonb);
  update analytics.events set user_hash = analytics.user_hash('a0000000-0000-0000-0000-000000000001') where visitor_id = '20000000-0000-0000-0000-000000000005';
  out := public.delete_account_data('a0000000-0000-0000-0000-000000000001', false);
  assert out ? 'analytics', format('delete_account_data skipped analytics: %s', out);
  assert not exists (select 1 from analytics.events where visitor_id = '20000000-0000-0000-0000-000000000005'), 'events kept after deletion';
end $$;

\echo == the per-minute cap holds
do $$
declare n integer;
begin
  update analytics.ingest_minute set n = 3000 where minute = date_trunc('minute', now());
  insert into analytics.ingest_minute (minute, n) values (date_trunc('minute', now()), 3000) on conflict do nothing;
  n := public.analytics_ingest('{"app":"site","sid":"10000000-0000-0000-0000-000000000009","vid":"20000000-0000-0000-0000-000000000009","ev":[{"k":"pageview","r":"/"}]}'::jsonb);
  assert n = 0, 'cap ignored';
  delete from analytics.ingest_minute;
end $$;

\echo == the API roles have no grants in the analytics schema
do $$
begin
  assert not has_schema_privilege('anon', 'analytics', 'usage'), 'anon has usage';
  assert not has_schema_privilege('authenticated', 'analytics', 'usage'), 'authenticated has usage';
  assert not has_function_privilege('anon', 'public.metrics_pages(integer)', 'execute'), 'anon runs metrics';
end $$;
delete from analytics.events;
\echo == analytics: ok
