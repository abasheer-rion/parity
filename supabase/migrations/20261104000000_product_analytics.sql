-- Product analytics, our own (DEC-0053): which pages people open, how long they look at them,
-- what they click, how far they scroll, errors they hit and a few named actions such as a
-- Verify run. Only from people who switched analytics on in the cookie preferences, and never
-- from a browser that sends Do Not Track or Global Privacy Control (web/src/lib/analytics/).
--
-- Additive only. One new schema, `analytics`, which the API does not expose (supabase/config.toml
-- lists only public and graphql_public), so nobody can read or write its tables over the API.
-- Everything goes through the functions below.
--
--   analytics.events          raw events, partitioned by month on `at`. Pseudonymous: a random
--                             visitor id and session id made in the browser after opt-in, and
--                             for signed-in people a keyed hash of the user id (never the id).
--                             No IP address, no user agent, no page text beyond a clicked
--                             element's short label. Kept 13 months, then the month is dropped.
--   analytics.daily_*         totals per day (pages, clicks, events, errors), rebuilt from the
--                             raw events every 15 minutes. No ids. Kept 25 months.
--   analytics.daily_visitors  one row per visitor per day, and analytics.visitors their first and
--                             last day, for the retention chart. Pseudonymous like the raw
--                             events, so they are also kept 13 months.
--   analytics.viewers         the team allowlist for the Metrics page: user ids, added by hand.
--   analytics.salt            the secret key for the user id hash. Made here, never leaves the
--                             database.
--
-- Writes: public.analytics_ingest(), called by the site's /e function (web/functions/e.ts).
-- Deletes: public.analytics_forget_user(), called by public.delete_account_data().
-- Reads: public.metrics_*(), which answer only people on analytics.viewers.
-- Upkeep: analytics.maintain() makes next months' partitions and drops old ones;
-- analytics.refresh() rebuilds the daily totals. pg_cron runs both when it is installed (it is
-- on the hosted project); without it, analytics_ingest() makes a missing partition itself.
--
-- Rollback: nothing else depends on this file. To undo, unschedule the two cron jobs
-- (select cron.unschedule('parity-analytics-refresh'); select cron.unschedule('parity-analytics-maintain');)
-- and drop the functions public.analytics_ingest, public.analytics_forget_user, public.metrics_* and the schema analytics
-- (drop schema analytics cascade). That deletes the analytics data and nothing else.

create schema if not exists analytics;
revoke all on schema analytics from public;
revoke all on schema analytics from anon, authenticated;

-- ---------------------------------------------------------------- the hash key

create table if not exists analytics.salt (
  id boolean primary key default true check (id),
  value bytea not null default extensions.gen_random_bytes(32)
);
insert into analytics.salt (id) values (true) on conflict (id) do nothing;
alter table analytics.salt enable row level security;

-- The 32 hex characters stored for a signed-in person: an HMAC of the user id with the
-- secret key. The same person gets the same value, and it cannot be turned back into the id.
create or replace function analytics.user_hash(p_user uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select left(encode(extensions.hmac(convert_to(p_user::text, 'UTF8'), s.value, 'sha256'), 'hex'), 32)
  from analytics.salt s where s.id
$$;
revoke all on function analytics.user_hash(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- the team allowlist

create table if not exists analytics.viewers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text not null default '' check (length(note) <= 80),
  added_at timestamptz not null default now()
);
alter table analytics.viewers enable row level security;

-- True when the signed-in person is on the allowlist. A user id, not an email address: email
-- confirmation is off, so an address proves nothing (DEC-0012).
create or replace function analytics.can_view()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from analytics.viewers v where v.user_id = (select auth.uid()))
$$;
revoke all on function analytics.can_view() from public, anon, authenticated;

-- ---------------------------------------------------------------- raw events

create table if not exists analytics.events (
  at timestamptz not null,
  received_at timestamptz not null default now(),
  app text not null check (app ~ '^[a-z]{2,12}$'),
  surface text not null default '' check (surface ~ '^[a-z]{0,12}$'),
  kind text not null check (kind in ('pageview', 'leave', 'click', 'rage', 'error', 'custom')),
  name text not null default '' check (length(name) <= 60),
  route text not null check (length(route) between 1 and 120),
  session_id uuid not null,
  visitor_id uuid not null,
  user_hash text check (user_hash ~ '^[0-9a-f]{32}$'),
  ms integer check (ms between 0 and 86400000),
  value integer check (value between 0 and 1000000000),
  props jsonb not null default '{}'::jsonb
    check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 600),
  country text not null default 'XX' check (country ~ '^[A-Z]{2}$'),
  device text not null default '' check (device in ('', 'phone', 'tablet', 'desktop')),
  referrer text not null default '' check (length(referrer) <= 80)
) partition by range (at);

alter table analytics.events enable row level security;

-- Most reads are a time window (BRIN is tiny and fits append-only time order), a visitor's
-- path through the funnel, or one named event over time.
create index if not exists events_at_brin on analytics.events using brin (at) with (pages_per_range = 32, autosummarize = on);
create index if not exists events_visitor_at on analytics.events (visitor_id, at);
create index if not exists events_kind_name_at on analytics.events (kind, name, at);
create index if not exists events_user_hash on analytics.events (user_hash) where user_hash is not null;

-- Anything outside the monthly partitions lands here instead of failing; maintain() keeps it
-- empty by making partitions ahead of time.
create table if not exists analytics.events_default partition of analytics.events default;

create or replace function analytics.ensure_month(p_month date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  m date := date_trunc('month', p_month)::date;
  t text := format('events_y%sm%s', to_char(m, 'YYYY'), to_char(m, 'MM'));
begin
  if to_regclass('analytics.' || t) is not null then
    return;
  end if;
  -- Rows already in the default partition for this month would block the new partition.
  -- Move them across in the same transaction.
  execute format('create table analytics.%I (like analytics.events including defaults including constraints)', t);
  execute format(
    'with moved as (delete from analytics.events_default where at >= %L and at < %L returning *) insert into analytics.%I select * from moved',
    m, (m + interval '1 month')::date, t);
  execute format('alter table analytics.events attach partition analytics.%I for values from (%L) to (%L)',
    t, m, (m + interval '1 month')::date);
  execute format('alter table analytics.%I enable row level security', t);
end
$$;
revoke all on function analytics.ensure_month(date) from public, anon, authenticated;

-- ---------------------------------------------------------------- daily totals

create table if not exists analytics.daily_routes (
  day date not null,
  app text not null,
  route text not null,
  views integer not null default 0,
  visitors integer not null default 0,
  sessions integer not null default 0,
  visible_ms bigint not null default 0,
  visible_n integer not null default 0,
  scroll_sum bigint not null default 0,
  scroll_n integer not null default 0,
  primary key (day, app, route)
);

create table if not exists analytics.daily_clicks (
  day date not null,
  app text not null,
  route text not null,
  kind text not null check (kind in ('click', 'rage')),
  target text not null,
  n integer not null default 0,
  visitors integer not null default 0,
  primary key (day, app, route, kind, target)
);

create table if not exists analytics.daily_events (
  day date not null,
  app text not null,
  name text not null,
  n integer not null default 0,
  visitors integer not null default 0,
  primary key (day, app, name)
);

create table if not exists analytics.daily_errors (
  day date not null,
  app text not null,
  route text not null,
  message text not null,
  n integer not null default 0,
  primary key (day, app, route, message)
);

create table if not exists analytics.daily_visitors (
  day date not null,
  visitor_id uuid not null,
  primary key (day, visitor_id)
);
create index if not exists daily_visitors_visitor on analytics.daily_visitors (visitor_id, day);

-- First and last day each visitor was seen, so the retention chart does not scan every day.
create table if not exists analytics.visitors (
  visitor_id uuid primary key,
  first_day date not null,
  last_day date not null,
  check (last_day >= first_day)
);
create index if not exists visitors_first_day on analytics.visitors (first_day);

alter table analytics.daily_routes enable row level security;
alter table analytics.daily_clicks enable row level security;
alter table analytics.daily_events enable row level security;
alter table analytics.daily_errors enable row level security;
alter table analytics.daily_visitors enable row level security;
alter table analytics.visitors enable row level security;

-- Rebuilds the daily totals for a range of UTC days from the raw events. Safe to run any
-- number of times: each day is deleted and written again in one transaction.
create or replace function analytics.refresh(p_from date default (now() at time zone 'utc')::date - 1, p_to date default (now() at time zone 'utc')::date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  lo timestamptz := p_from::timestamp at time zone 'utc';
  hi timestamptz := (p_to + 1)::timestamp at time zone 'utc';
begin
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'refresh takes at most 400 days';
  end if;
  delete from analytics.daily_routes where day between p_from and p_to;
  delete from analytics.daily_clicks where day between p_from and p_to;
  delete from analytics.daily_events where day between p_from and p_to;
  delete from analytics.daily_errors where day between p_from and p_to;
  delete from analytics.daily_visitors where day between p_from and p_to;

  insert into analytics.daily_routes (day, app, route, views, visitors, sessions, visible_ms, visible_n, scroll_sum, scroll_n)
  select (e.at at time zone 'utc')::date, e.app, e.route,
         count(*) filter (where e.kind = 'pageview'),
         count(distinct e.visitor_id) filter (where e.kind = 'pageview'),
         count(distinct e.session_id),
         coalesce(sum(e.ms) filter (where e.kind = 'leave'), 0),
         count(*) filter (where e.kind = 'leave' and e.ms is not null),
         coalesce(sum(e.value) filter (where e.kind = 'leave'), 0),
         count(*) filter (where e.kind = 'leave' and e.value is not null)
  from analytics.events e
  where e.at >= lo and e.at < hi and e.kind in ('pageview', 'leave')
  group by 1, 2, 3;

  insert into analytics.daily_clicks (day, app, route, kind, target, n, visitors)
  select (e.at at time zone 'utc')::date, e.app, e.route, e.kind, e.name, count(*), count(distinct e.visitor_id)
  from analytics.events e
  where e.at >= lo and e.at < hi and e.kind in ('click', 'rage')
  group by 1, 2, 3, 4, 5;

  insert into analytics.daily_events (day, app, name, n, visitors)
  select (e.at at time zone 'utc')::date, e.app, e.name, count(*), count(distinct e.visitor_id)
  from analytics.events e
  where e.at >= lo and e.at < hi and e.kind = 'custom'
  group by 1, 2, 3;

  insert into analytics.daily_errors (day, app, route, message, n)
  select (e.at at time zone 'utc')::date, e.app, e.route, e.name, count(*)
  from analytics.events e
  where e.at >= lo and e.at < hi and e.kind = 'error'
  group by 1, 2, 3, 4;

  insert into analytics.daily_visitors (day, visitor_id)
  select distinct (e.at at time zone 'utc')::date, e.visitor_id
  from analytics.events e
  where e.at >= lo and e.at < hi;

  insert into analytics.visitors as v (visitor_id, first_day, last_day)
  select d.visitor_id, min(d.day), max(d.day)
  from analytics.daily_visitors d
  where d.day between p_from and p_to
  group by d.visitor_id
  on conflict (visitor_id) do update set
    first_day = least(v.first_day, excluded.first_day),
    last_day = greatest(v.last_day, excluded.last_day);
end
$$;
revoke all on function analytics.refresh(date, date) from public, anon, authenticated;

-- Partitions for this month and the next two; months older than 13 months dropped; the
-- pseudonymous per-visitor days trimmed to 13 months and the totals to 25 months.
create or replace function analytics.maintain()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  this_month date := date_trunc('month', now() at time zone 'utc')::date;
  oldest date := (date_trunc('month', now() at time zone 'utc') - interval '13 months')::date;
  r record;
begin
  perform analytics.ensure_month(this_month);
  perform analytics.ensure_month((this_month + interval '1 month')::date);
  perform analytics.ensure_month((this_month + interval '2 months')::date);
  for r in
    select c.relname from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    join pg_class p on p.oid = i.inhparent
    join pg_namespace n on n.oid = p.relnamespace
    where n.nspname = 'analytics' and p.relname = 'events' and c.relname ~ '^events_y[0-9]{4}m[0-9]{2}$'
  loop
    if to_date(substr(r.relname, 9, 4) || substr(r.relname, 14, 2), 'YYYYMM') < oldest then
      execute format('drop table analytics.%I', r.relname);
    end if;
  end loop;
  delete from analytics.events_default where at < oldest;
  delete from analytics.daily_visitors where day < oldest;
  delete from analytics.visitors where last_day < oldest;
  delete from analytics.daily_routes where day < now()::date - interval '25 months';
  delete from analytics.daily_clicks where day < now()::date - interval '25 months';
  delete from analytics.daily_events where day < now()::date - interval '25 months';
  delete from analytics.daily_errors where day < now()::date - interval '25 months';
  delete from analytics.ingest_minute where minute < now() - interval '1 day';
end
$$;
revoke all on function analytics.maintain() from public, anon, authenticated;

-- ---------------------------------------------------------------- writing

-- A per-minute counter for the whole site, so a flood (from /e or from someone calling the
-- function directly with the public key) stops at a fixed size.
create table if not exists analytics.ingest_minute (
  minute timestamptz primary key,
  n integer not null default 0
);
alter table analytics.ingest_minute enable row level security;

-- One batch from one browser tab:
--   {"app": "product", "surface": "", "sid": uuid, "vid": uuid, "device": "desktop",
--    "ref": "news.ycombinator.com", "ev": [{"k": kind, "r": route, "n": name, "o": ms ago,
--    "ms": visible ms, "v": value, "p": {props}}, ...]}
-- The /e function has already checked it (web/src/lib/analytics/schema.ts); this checks it
-- again because anyone can call it with the public key. The user hash comes from the caller's
-- own verified sign-in (auth.uid()), never from the body, so nobody can write as someone else.
-- Returns how many events were stored.
create or replace function public.analytics_ingest(p_batch jsonb, p_country text default 'XX')
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cur_minute timestamptz := date_trunc('minute', now());
  seen integer;
  v_app text;
  v_surface text;
  v_sid uuid;
  v_vid uuid;
  v_user text;
  v_device text;
  v_ref text;
  v_country text;
  ev jsonb;
  k text;
  r text;
  nm text;
  ago bigint;
  v_ms integer;
  v_val integer;
  v_props jsonb;
  n integer := 0;
begin
  if jsonb_typeof(p_batch) <> 'object' or jsonb_typeof(p_batch->'ev') <> 'array'
     or jsonb_array_length(p_batch->'ev') > 50 or pg_column_size(p_batch) > 20000 then
    return 0;
  end if;
  v_app := p_batch->>'app';
  v_surface := coalesce(p_batch->>'surface', '');
  if v_app is null or v_app !~ '^(site|auth|legal|connect|badge|product|research|sim|trade|academy|lab|desktop)$'
     or v_surface !~ '^[a-z]{0,12}$' then
    return 0;
  end if;
  begin
    v_sid := (p_batch->>'sid')::uuid;
    v_vid := (p_batch->>'vid')::uuid;
  exception when others then
    return 0;
  end;
  if v_sid is null or v_vid is null then
    return 0;
  end if;

  insert into analytics.ingest_minute as m (minute, n) values (cur_minute, 1)
  on conflict (minute) do update set n = m.n + 1
  returning m.n into seen;
  if seen > 3000 then
    return 0;
  end if;

  -- The month's partition normally exists already (maintain() runs hourly). If pg_cron is
  -- missing, the first batch of a month makes it.
  if to_regclass(format('analytics.events_y%sm%s', to_char(now() at time zone 'utc', 'YYYY'), to_char(now() at time zone 'utc', 'MM'))) is null then
    perform analytics.ensure_month((now() at time zone 'utc')::date);
  end if;

  v_user := case when (select auth.uid()) is null then null else analytics.user_hash((select auth.uid())) end;
  v_device := coalesce(p_batch->>'device', '');
  if v_device not in ('', 'phone', 'tablet', 'desktop') then v_device := ''; end if;
  v_ref := lower(coalesce(p_batch->>'ref', ''));
  if v_ref !~ '^[a-z0-9.-]{0,80}$' then v_ref := ''; end if;
  v_country := case when p_country ~ '^[A-Z]{2}$' then p_country else 'XX' end;

  for ev in select * from jsonb_array_elements(p_batch->'ev') loop
    if jsonb_typeof(ev) <> 'object' then continue; end if;
    k := ev->>'k';
    r := ev->>'r';
    nm := coalesce(ev->>'n', '');
    if k is null or k not in ('pageview', 'leave', 'click', 'rage', 'error', 'custom') then continue; end if;
    if r is null or r !~ '^/[a-z0-9:/._#-]{0,119}$' then continue; end if;
    -- Labels are short, single-line text. Long digit runs and anything shaped like an email
    -- address are masked here as well as in the browser.
    if length(nm) > 60 or nm ~ '[[:cntrl:]]' then continue; end if;
    nm := regexp_replace(regexp_replace(nm, '[^[:space:]@]+@[^[:space:]@]+', '(email)', 'g'), '[0-9]{4,}', '#', 'g');
    if k = 'custom' and nm !~ '^[a-z][a-z0-9_]{0,39}$' then continue; end if;
    ago := case when jsonb_typeof(ev->'o') = 'number' then least(greatest((ev->>'o')::numeric, 0), 86400000)::bigint else 0 end;
    v_ms := case when jsonb_typeof(ev->'ms') = 'number' then least(greatest((ev->>'ms')::numeric, 0), 86400000)::integer end;
    v_val := case when jsonb_typeof(ev->'v') = 'number' then least(greatest((ev->>'v')::numeric, 0), 1000000000)::integer end;
    v_props := coalesce(ev->'p', '{}'::jsonb);
    if jsonb_typeof(v_props) <> 'object' or pg_column_size(v_props) > 600
       or exists (select 1 from jsonb_object_keys(v_props) key where key !~ '^[a-z][a-z0-9_]{0,31}$') then
      v_props := '{}'::jsonb;
    end if;
    insert into analytics.events
      (at, app, surface, kind, name, route, session_id, visitor_id, user_hash, ms, value, props, country, device, referrer)
    values
      (now() - make_interval(secs => ago / 1000.0), v_app, v_surface, k, nm, r, v_sid, v_vid, v_user, v_ms, v_val, v_props,
       v_country, v_device, case when k = 'pageview' then v_ref else '' end);
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke all on function public.analytics_ingest(jsonb, text) from public;
-- The site's /e function calls it with the public key, or with the person's own sign-in so
-- the user hash can be made. Calling it directly gets the same checks and the same cap.
grant execute on function public.analytics_ingest(jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------- deleting a person's data

-- For "delete my account" (public.account_deletion_requests): removes every event tied to the
-- person, and every event from the browsers they used while signed in (the visitor ids seen
-- with their hash), so the anonymous part of the same visits goes too. Returns rows removed.
create or replace function analytics.forget_user(p_user uuid)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  h text := analytics.user_hash(p_user);
  gone bigint := 0;
  c bigint;
begin
  create temporary table if not exists forget_visitors (visitor_id uuid primary key) on commit drop;
  insert into forget_visitors select distinct e.visitor_id from analytics.events e where e.user_hash = h
  on conflict do nothing;
  delete from analytics.events e where e.user_hash = h or e.visitor_id in (select visitor_id from forget_visitors);
  get diagnostics c = row_count; gone := gone + c;
  delete from analytics.daily_visitors d where d.visitor_id in (select visitor_id from forget_visitors);
  get diagnostics c = row_count; gone := gone + c;
  delete from analytics.visitors v where v.visitor_id in (select visitor_id from forget_visitors);
  delete from analytics.viewers v where v.user_id = p_user;
  return gone;
end
$$;
revoke all on function analytics.forget_user(uuid) from public, anon, authenticated;

-- The name public.delete_account_data() (20261103000000_data_model.sql) looks for, so account
-- deletion removes analytics too. Owner and service role only.
create or replace function public.analytics_forget_user(p_user uuid)
returns bigint
language sql security definer set search_path = '' as $$
  select analytics.forget_user(p_user)
$$;
revoke all on function public.analytics_forget_user(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- reading (team only)

create or replace function analytics.require_viewer()
returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not analytics.can_view() then
    raise exception 'Metrics are for the team only.' using errcode = '42501';
  end if;
end
$$;
revoke all on function analytics.require_viewer() from public, anon, authenticated;

-- True when the caller may open the Metrics page. Never raises.
create or replace function public.metrics_allowed()
returns boolean
language sql stable security definer set search_path = '' as $$
  select analytics.can_view()
$$;

-- People active in the last five minutes, per app, and the pages they are on.
create or replace function public.metrics_live()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  out jsonb;
begin
  perform analytics.require_viewer();
  with recent as (
    select e.app, e.route, e.visitor_id, e.at
    from analytics.events e
    where e.at > now() - interval '5 minutes'
  ), last_route as (
    select distinct on (visitor_id) visitor_id, app, route from recent order by visitor_id, at desc
  )
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from recent),
    'apps', coalesce((select jsonb_agg(jsonb_build_object('app', app, 'visitors', n) order by n desc)
                      from (select app, count(*) n from last_route group by app) a), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('app', app, 'route', route, 'visitors', n) order by n desc)
                       from (select app, route, count(*) n from last_route group by app, route order by n desc limit 10) p), '[]'::jsonb)
  ) into out;
  return out;
end
$$;

-- Pages over the last p_days UTC days: views, visitors, average visible time and scroll depth.
create or replace function public.metrics_pages(p_days integer default 7)
returns table (app text, route text, views bigint, visitors bigint, sessions bigint, avg_visible_ms bigint, avg_scroll integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform analytics.require_viewer();
  return query
  select d.app, d.route, sum(d.views)::bigint, sum(d.visitors)::bigint, sum(d.sessions)::bigint,
         -- A page view can end in more than one "leave" (the tab hidden and shown again), so
         -- average visible time is per page view, not per leave.
         (sum(d.visible_ms) / nullif(sum(d.views), 0))::bigint,
         (sum(d.scroll_sum) / nullif(sum(d.scroll_n), 0))::integer
  from analytics.daily_routes d
  where d.day > (now() at time zone 'utc')::date - least(greatest(p_days, 1), 400)
  group by d.app, d.route
  order by 3 desc
  limit 200;
end
$$;

-- Visitors and views per day, for the trend line.
create or replace function public.metrics_daily(p_days integer default 30)
returns table (day date, views bigint, visitors bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform analytics.require_viewer();
  return query
  select v.day, coalesce(r.views, 0)::bigint, v.visitors::bigint
  from (select dv.day, count(*) visitors from analytics.daily_visitors dv
        where dv.day > (now() at time zone 'utc')::date - least(greatest(p_days, 1), 400) group by dv.day) v
  left join (select dr.day, sum(dr.views) views from analytics.daily_routes dr
             where dr.day > (now() at time zone 'utc')::date - least(greatest(p_days, 1), 400) group by dr.day) r using (day)
  order by v.day;
end
$$;

-- Which elements are clicked most on one page (or every page when p_route is null), and where
-- people click repeatedly in frustration.
create or replace function public.metrics_clicks(p_app text default null, p_route text default null, p_days integer default 7)
returns table (app text, route text, kind text, target text, clicks bigint, visitors bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform analytics.require_viewer();
  return query
  select c.app, c.route, c.kind, c.target, sum(c.n)::bigint, sum(c.visitors)::bigint
  from analytics.daily_clicks c
  where c.day > (now() at time zone 'utc')::date - least(greatest(p_days, 1), 400)
    and (p_app is null or c.app = p_app)
    and (p_route is null or c.route = p_route)
  group by c.app, c.route, c.kind, c.target
  order by 5 desc
  limit 100;
end
$$;

-- Named actions (track("verify_run")) per day.
create or replace function public.metrics_events(p_days integer default 30)
returns table (app text, name text, events bigint, visitors bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform analytics.require_viewer();
  return query
  select d.app, d.name, sum(d.n)::bigint, sum(d.visitors)::bigint
  from analytics.daily_events d
  where d.day > (now() at time zone 'utc')::date - least(greatest(p_days, 1), 400)
  group by d.app, d.name
  order by 3 desc
  limit 100;
end
$$;

create or replace function public.metrics_errors(p_days integer default 7)
returns table (app text, route text, message text, errors bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform analytics.require_viewer();
  return query
  select d.app, d.route, d.message, sum(d.n)::bigint
  from analytics.daily_errors d
  where d.day > (now() at time zone 'utc')::date - least(greatest(p_days, 1), 400)
  group by d.app, d.route, d.message
  order by 4 desc
  limit 50;
end
$$;

-- The sign-up funnel per visitor over the last p_days: saw the front page, opened sign up,
-- made an account, ran Verify. Each step counts only after the one before it.
create or replace function public.metrics_funnel(p_days integer default 30)
returns table (step integer, label text, visitors bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  lo timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 400));
begin
  perform analytics.require_viewer();
  return query
  with s1 as (
    select e.visitor_id, min(e.at) t from analytics.events e
    where e.at >= lo and e.kind = 'pageview' and e.app = 'site' and e.route = '/'
    group by 1
  ), s2 as (
    select s1.visitor_id, min(e.at) t from s1 join analytics.events e
      on e.visitor_id = s1.visitor_id and e.at >= s1.t and e.kind = 'pageview' and e.route = '/signup/'
    group by 1
  ), s3 as (
    select s2.visitor_id, min(e.at) t from s2 join analytics.events e
      on e.visitor_id = s2.visitor_id and e.at >= s2.t and e.kind = 'custom' and e.name = 'sign_up'
    group by 1
  ), s4 as (
    select s3.visitor_id, min(e.at) t from s3 join analytics.events e
      on e.visitor_id = s3.visitor_id and e.at >= s3.t and e.kind = 'custom' and e.name = 'verify_run'
    group by 1
  )
  select 1, 'Front page'::text, (select count(*) from s1)
  union all select 2, 'Sign up page', (select count(*) from s2)
  union all select 3, 'Account made', (select count(*) from s3)
  union all select 4, 'First Verify run', (select count(*) from s4);
end
$$;

-- Weekly retention: of the visitors first seen in a week, how many came back in each later week.
create or replace function public.metrics_retention(p_weeks integer default 8)
returns table (cohort date, size bigint, weeks bigint[])
language plpgsql stable security definer set search_path = '' as $$
declare
  w integer := least(greatest(p_weeks, 1), 26);
begin
  perform analytics.require_viewer();
  return query
  with cohort_visitors as (
    select v.visitor_id, date_trunc('week', v.first_day)::date cohort
    from analytics.visitors v
    where v.first_day >= date_trunc('week', now())::date - 7 * (w - 1)
  ), cohorts as (
    select cv.cohort, count(*) size from cohort_visitors cv group by 1
  ), hits as (
    select cv.cohort, (date_trunc('week', d.day)::date - cv.cohort) / 7 wk, count(distinct d.visitor_id) n
    from cohort_visitors cv join analytics.daily_visitors d on d.visitor_id = cv.visitor_id and d.day >= cv.cohort
    group by 1, 2
  )
  select c.cohort, c.size,
         array(select coalesce(h.n, 0)::bigint from generate_series(0, w - 1) g(i)
               left join hits h on h.cohort = c.cohort and h.wk = g.i order by g.i)
  from cohorts c
  order by c.cohort;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.metrics_allowed()', 'public.metrics_live()', 'public.metrics_pages(integer)',
    'public.metrics_daily(integer)', 'public.metrics_clicks(text, text, integer)',
    'public.metrics_events(integer)', 'public.metrics_errors(integer)',
    'public.metrics_funnel(integer)', 'public.metrics_retention(integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

-- ---------------------------------------------------------------- schedule

select analytics.maintain();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('parity-analytics-refresh', '*/15 * * * *', 'select analytics.refresh()');
    perform cron.schedule('parity-analytics-maintain', '7 * * * *', 'select analytics.maintain()');
  end if;
end
$$;
