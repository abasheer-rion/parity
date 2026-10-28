-- Personalization and experiments (DEC-0068): a profile per person built from how they use the
-- product app, a What's new feed ranked from it, home widgets ordered by use, and A/B tests.
--
-- What it reads. Product actions stored in the app's own tables, which need no analytics consent:
-- Academy lessons opened and finished, demo orders, fills and positions, watchlists, Verify
-- badges, connected AI apps, What's new clicks and widget use recorded here. Page views and named
-- actions from analytics.events only when the person has analytics switched on
-- (personalization_settings.analytics_ok, sent by the app from the cookie choice on every visit).
-- It never infers anything sensitive (health, religion, politics, sexuality, ethnicity, age,
-- income or wealth): only which parts of Parity someone uses, their demo trading style and
-- which markets and strategy families they look at.
--
-- The rules that keep the two sides apart (DEC-0015): recommendations may show research results,
-- but nothing here feeds research. The research writer role (parity_writer) gets no access to
-- any table or function in this file, and the check in supabase/tests/test_personalization.sql
-- fails if it ever does.
--
-- Tables
--   public.personalization_settings  on/off and the last analytics choice, one row per person
--   public.personalization_profiles  the computed profile, one row per person
--   public.personalization_widgets   home widget use and the person's keep/collapse choices
--   public.reco_feedback             What's new items shown, clicked and dismissed, per person
--   public.experiments               the experiments and their rules (no per-person data)
--   personalization.arm_stats        shows and clicks per What's new item, over everyone, no ids
--   personalization.reco_daily       shows and clicks per kind per day, no ids
--   personalization.exposures        who saw which variant (deleted when they switch off)
--   personalization.outcomes         first time each exposed person did each metric (same)
--   personalization.experiment_counts  people per experiment, variant and metric, no ids
--
-- People read only their own rows. Every write goes through the functions below, which do
-- nothing while personalization is off. Switching off deletes the profile, widget state,
-- feedback and experiment rows; the counts without ids stay.
--
-- Retention: inputs are the last 90 days; feedback is kept 180 days after it was last touched;
-- experiment rows 90 days after the experiment stops; profile and widget state 13 months after
-- the last visit; daily totals 25 months.
--
-- Rollback (by hand): unschedule the two cron jobs (parity-personalization-refresh and
-- parity-personalization-maintain), drop schema personalization cascade, drop the five public
-- tables and the public functions named personalization_*, reco_*, widget_*, experiment_* and
-- metrics_personalization / metrics_experiments, then re-create public.analytics_forget_user from
-- 20261104000000_product_analytics.sql. Nothing else reads them.

create schema if not exists personalization;
revoke all on schema personalization from public;
revoke all on schema personalization from anon, authenticated;

-- ---------------------------------------------------------------- per-person tables

create table if not exists public.personalization_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  analytics_ok boolean not null default false,
  analytics_seen_at timestamptz,
  reset_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.personalization_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  learner numeric not null check (learner between 0 and 1),
  trader numeric not null check (trader between 0 and 1),
  risk numeric check (risk between 0 and 1),
  engagement numeric not null check (engagement between 0 and 1),
  paid_use numeric not null check (paid_use between 0 and 1),
  segment text not null check (segment in ('new', 'learner', 'trader', 'both', 'browser')),
  risk_band text not null check (risk_band in ('unknown', 'careful', 'moderate', 'bold')),
  engagement_band text not null check (engagement_band in ('new', 'light', 'regular', 'heavy')),
  interests jsonb not null default '{}'::jsonb check (jsonb_typeof(interests) = 'object'),
  widgets jsonb not null default '{}'::jsonb check (jsonb_typeof(widgets) = 'object'),
  inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(inputs) = 'object'),
  sources text[] not null default '{product}',
  computed_at timestamptz not null default now()
);

create table if not exists public.personalization_widgets (
  user_id uuid not null references auth.users (id) on delete cascade,
  widget_id text not null check (widget_id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  used integer not null default 0 check (used >= 0),
  ignored_sessions integer not null default 0 check (ignored_sessions >= 0),
  choice text not null default 'auto' check (choice in ('auto', 'keep', 'collapse')),
  last_seen_at timestamptz,
  last_used_at timestamptz,
  primary key (user_id, widget_id)
);

create table if not exists public.reco_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  item text not null check (item ~ '^(algo|lesson|tool|market|scenario|verify):[a-z0-9._-]{1,80}$'),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  shown integer not null default 0 check (shown >= 0),
  last_shown_at timestamptz,
  clicked_at timestamptz,
  dismissed_at timestamptz,
  primary key (user_id, item)
);
create index if not exists reco_feedback_touched on public.reco_feedback (greatest(last_shown_at, clicked_at, dismissed_at));

alter table public.personalization_settings enable row level security;
alter table public.personalization_profiles enable row level security;
alter table public.personalization_widgets enable row level security;
alter table public.reco_feedback enable row level security;

-- Read own rows only. No insert, update or delete grants: writes go through the functions.
revoke all on public.personalization_settings, public.personalization_profiles,
  public.personalization_widgets, public.reco_feedback from public, anon, authenticated;
grant select on public.personalization_settings, public.personalization_profiles,
  public.personalization_widgets, public.reco_feedback to authenticated;

drop policy if exists "own personalization settings" on public.personalization_settings;
create policy "own personalization settings" on public.personalization_settings
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own personalization profile" on public.personalization_profiles;
create policy "own personalization profile" on public.personalization_profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own personalization widgets" on public.personalization_widgets;
create policy "own personalization widgets" on public.personalization_widgets
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own reco feedback" on public.reco_feedback;
create policy "own reco feedback" on public.reco_feedback
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- experiments

create table if not exists public.experiments (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  name text not null check (length(name) between 1 and 120),
  hypothesis text not null default '' check (length(hypothesis) <= 400),
  -- The first variant is the control.
  variants text[] not null check (cardinality(variants) between 2 and 5),
  weights integer[] not null,
  primary_metric text not null,
  guardrails text[] not null default '{}',
  min_per_arm integer not null default 400 check (min_per_arm between 50 and 1000000),
  max_days integer not null default 42 check (max_days between 1 and 365),
  status text not null default 'draft' check (status in ('draft', 'running', 'stopped')),
  started_at timestamptz,
  stopped_at timestamptz,
  stop_reason text check (length(stop_reason) <= 200),
  created_at timestamptz not null default now(),
  check (cardinality(weights) = cardinality(variants)),
  check (status <> 'running' or started_at is not null)
);
alter table public.experiments enable row level security;
revoke all on public.experiments from public, anon, authenticated;
-- Closed on purpose: the app reads experiments only through experiment_assign().
drop policy if exists "experiments through functions only" on public.experiments;
create policy "experiments through functions only" on public.experiments
  for select to authenticated using (false);

create table if not exists personalization.exposures (
  experiment text not null references public.experiments (key) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  variant text not null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (experiment, user_id)
);
create index if not exists exposures_user on personalization.exposures (user_id);
create table if not exists personalization.outcomes (
  experiment text not null,
  user_id uuid not null,
  metric text not null,
  first_at timestamptz not null default now(),
  n integer not null default 1,
  primary key (experiment, user_id, metric),
  foreign key (experiment, user_id) references personalization.exposures (experiment, user_id) on delete cascade
);
-- People per experiment, variant and metric ('exposed' for the arm size). Kept when personal rows
-- are deleted, so switching off does not rewrite a running test's results.
create table if not exists personalization.experiment_counts (
  experiment text not null references public.experiments (key) on delete cascade,
  variant text not null,
  metric text not null,
  users integer not null default 0,
  primary key (experiment, variant, metric)
);
create table if not exists personalization.arm_stats (
  item text primary key,
  kind text not null,
  shows bigint not null default 0,
  clicks bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists personalization.reco_daily (
  day date not null,
  kind text not null,
  shows integer not null default 0,
  clicks integer not null default 0,
  primary key (day, kind)
);
alter table personalization.exposures enable row level security;
alter table personalization.outcomes enable row level security;
alter table personalization.experiment_counts enable row level security;
alter table personalization.arm_stats enable row level security;
alter table personalization.reco_daily enable row level security;

-- The DEC-0015 rule, stated as grants: the research writer reaches nothing here.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parity_writer') then
    revoke all on schema personalization from parity_writer;
    revoke all on all tables in schema personalization from parity_writer;
    revoke all on public.personalization_settings, public.personalization_profiles,
      public.personalization_widgets, public.reco_feedback, public.experiments from parity_writer;
  end if;
end
$$;

-- ---------------------------------------------------------------- helpers

-- A number in [0, 1) from the experiment key and the user id: the first 8 hex characters of
-- sha256("key:user id") over 2^32. web/src/lib/personalize/experiments.ts does the same.
create or replace function personalization.bucket(p_key text, p_user uuid)
returns double precision
language sql immutable set search_path = '' as $$
  select (('x' || left(encode(extensions.digest(convert_to(p_key || ':' || p_user::text, 'UTF8'), 'sha256'), 'hex'), 8))::bit(32)::bigint)::double precision / 4294967296.0
$$;

-- The variant whose share of the cumulative weights first passes the bucket.
create or replace function personalization.pick(p_variants text[], p_weights integer[], p_bucket double precision)
returns text
language plpgsql immutable set search_path = '' as $$
declare
  total integer := 0;
  acc integer := 0;
  i integer;
begin
  for i in 1 .. cardinality(p_weights) loop total := total + greatest(p_weights[i], 0); end loop;
  if total = 0 then return p_variants[1]; end if;
  for i in 1 .. cardinality(p_variants) loop
    acc := acc + greatest(p_weights[i], 0);
    if p_bucket < acc::double precision / total then return p_variants[i]; end if;
  end loop;
  return p_variants[cardinality(p_variants)];
end
$$;

create or replace function personalization.sat(x numeric, k numeric)
returns numeric
language sql immutable set search_path = '' as $$
  select case when x is null or x <= 0 then 0 else round(x / (x + k), 4) end
$$;

-- Asset class of a demo order symbol or watchlist key. Terminal keys carry it ("fx.EUR",
-- "crypto.BTC"); bare symbols fall back to a few patterns.
create or replace function personalization.asset_class(p_symbol text)
returns text
language sql immutable set search_path = '' as $$
  select case
    when p_symbol is null then 'other'
    when position('.' in p_symbol) > 1 then
      case split_part(lower(p_symbol), '.', 1)
        when 'fx' then 'fx' when 'crypto' then 'crypto' when 'rates' then 'rates' when 'bond' then 'rates'
        when 'equity' then 'equity' when 'stock' then 'equity' when 'index' then 'index'
        when 'commodity' then 'commodity' when 'energy' then 'commodity' when 'metal' then 'commodity'
        when 'metals' then 'commodity' when 'futures' then 'commodity' else 'other' end
    when upper(p_symbol) ~ '^(BTC|ETH|SOL|XRP|DOGE|ADA|AVAX|LTC|BNB|DOT|LINK)' or upper(p_symbol) ~ '(USDT|USDC)$' then 'crypto'
    when upper(p_symbol) ~ '^[A-Z]{6}$' or p_symbol ~ '/' then 'fx'
    when upper(p_symbol) ~ '^(CL|NG|GC|SI|HG|ZC|ZW|ZS|BZ|RB|HO)' then 'commodity'
    when upper(p_symbol) ~ '^(SPY|QQQ|IWM|DIA|ES|NQ|YM|RTY)$' then 'index'
    else 'equity' end
$$;

-- How much an asset class tends to move, for the demo trading style only.
create or replace function personalization.vol_weight(p_class text)
returns numeric
language sql immutable set search_path = '' as $$
  select case p_class when 'crypto' then 1.0 when 'commodity' then 0.6 when 'equity' then 0.6
    when 'index' then 0.4 when 'fx' then 0.3 when 'rates' then 0.2 else 0.5 end
$$;

-- Counts from 1 to 4 are hidden on team pages.
create or replace function personalization.k5(n bigint)
returns bigint
language sql immutable set search_path = '' as $$
  select case when n between 1 and 4 then null else n end
$$;

create or replace function personalization.is_on(p_user uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and coalesce((select s.enabled from public.personalization_settings s where s.user_id = p_user), true)
$$;

-- Shares that add up to 1, largest 6 kept.
create or replace function personalization.shares(p jsonb)
returns jsonb
language sql immutable set search_path = '' as $$
  with t as (select key, value::numeric v from jsonb_each_text(coalesce(p, '{}'::jsonb)) where value::numeric > 0),
  s as (select sum(v) total from t),
  top as (select key, v from t order by v desc, key limit 6)
  select coalesce(jsonb_object_agg(top.key, round(top.v / s.total, 3)), '{}'::jsonb) from top, s
$$;

-- ---------------------------------------------------------------- the profile

-- Builds and stores one person's profile. Returns it, or null when personalization is off.
create or replace function personalization.compute(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  since timestamptz := now() - interval '90 days';
  since30 timestamptz := now() - interval '30 days';
  use_analytics boolean;
  h text;
  lessons_done integer; lessons_opened integer; quiz numeric;
  orders integer; entry_orders integer; stop_orders integer;
  avg_size numeric; exposure numeric; volatile numeric;
  watch_items integer; badges integer; ai_apps integer; product_days integer;
  a_sessions integer := 0; a_days integer := 0; a_academy integer := 0; a_trade integer := 0;
  a_lab integer := 0; a_verify integer := 0;
  asset jsonb; family jsonb; kinds jsonb; widgets jsonb;
  v_learner numeric; v_trader numeric; v_risk numeric; v_eng numeric; v_paid numeric;
  v_segment text; v_risk_band text; v_eng_band text;
  v_inputs jsonb; v_sources text[] := '{product}';
  out jsonb;
begin
  if not personalization.is_on(p_user) then
    delete from public.personalization_profiles where user_id = p_user;
    return null;
  end if;
  select coalesce(s.analytics_ok, false) into use_analytics from public.personalization_settings s where s.user_id = p_user;
  use_analytics := coalesce(use_analytics, false);

  -- Product actions (no analytics consent needed).
  select count(*) filter (where p.done_at >= since), count(*) filter (where p.opened_at >= since),
         avg(p.score::numeric / nullif(p.total, 0)) filter (where p.done_at >= since)
    into lessons_done, lessons_opened, quiz
    from public.academy_progress p where p.user_id = p_user;
  select count(*), count(*) filter (where o.role is null or o.role = 'entry'),
         count(*) filter (where o.role = 'stop_loss' or o.type in ('stop', 'stop_limit', 'trailing_stop')),
         avg(personalization.vol_weight(personalization.asset_class(o.symbol)))
    into orders, entry_orders, stop_orders, volatile
    from public.paper_orders o where o.user_id = p_user and o.placed_at >= since;
  select avg(f.qty * f.price / a.starting_cash) into avg_size
    from public.paper_fills f join public.paper_accounts a on a.id = f.account_id and a.user_id = f.user_id
    where f.user_id = p_user and f.side = 'buy' and f.created_at >= since;
  select max(x.gross / x.starting_cash) into exposure from (
    select a.starting_cash, sum(p.qty * p.avg_cost) gross
    from public.paper_positions p join public.paper_accounts a on a.id = p.account_id and a.user_id = p.user_id
    where p.user_id = p_user group by a.id, a.starting_cash) x;
  select coalesce(sum(jsonb_array_length(w.items)), 0) into watch_items from public.trade_watchlists w where w.user_id = p_user;
  select count(*) into badges from public.verify_badges b where b.user_id = p_user and b.created_at >= since;
  select count(*) into ai_apps from public.ai_grants g where g.user_id = p_user;
  select count(distinct d) into product_days from (
    select (p.opened_at at time zone 'utc')::date d from public.academy_progress p where p.user_id = p_user and p.opened_at >= since30
    union all select (o.placed_at at time zone 'utc')::date from public.paper_orders o where o.user_id = p_user and o.placed_at >= since30
    union all select (b.created_at at time zone 'utc')::date from public.verify_badges b where b.user_id = p_user and b.created_at >= since30
    union all select (r.clicked_at at time zone 'utc')::date from public.reco_feedback r where r.user_id = p_user and r.clicked_at >= since30
  ) days;

  -- Interests: markets traded or watched, and the tags of What's new items clicked.
  select coalesce(jsonb_object_agg(c, n), '{}'::jsonb) into asset from (
    select c, count(*) n from (
      select personalization.asset_class(o.symbol) c from public.paper_orders o where o.user_id = p_user and o.placed_at >= since
      union all select personalization.asset_class(i.v) from public.trade_watchlists w, jsonb_array_elements_text(w.items) i(v) where w.user_id = p_user
      union all select substr(t, 7) from public.reco_feedback r, unnest(r.tags) t where r.user_id = p_user and r.clicked_at >= since and t like 'asset:%'
    ) z where c <> 'other' group by c) y;
  select coalesce(jsonb_object_agg(f, n), '{}'::jsonb) into family from (
    select substr(t, 8) f, count(*) n from public.reco_feedback r, unnest(r.tags) t
    where r.user_id = p_user and r.clicked_at >= since and t like 'family:%' group by 1) y;
  select coalesce(jsonb_object_agg(kd, n), '{}'::jsonb) into kinds from (
    select split_part(r.item, ':', 1) kd, count(*) n from public.reco_feedback r
    where r.user_id = p_user and r.clicked_at >= since group by 1) y;
  select coalesce(jsonb_object_agg(w.widget_id, jsonb_build_object('used', w.used, 'ignored_sessions', w.ignored_sessions)), '{}'::jsonb)
    into widgets from public.personalization_widgets w where w.user_id = p_user;

  -- Page use, only with analytics consent.
  if use_analytics then
    h := analytics.user_hash(p_user);
    select count(distinct e.session_id) filter (where e.at >= since30),
           count(distinct (e.at at time zone 'utc')::date) filter (where e.at >= since30),
           count(*) filter (where e.kind = 'pageview' and e.app = 'academy'),
           count(*) filter (where e.kind = 'pageview' and e.app = 'trade'),
           count(*) filter (where e.kind = 'pageview' and e.app = 'lab'),
           count(*) filter (where e.kind = 'custom' and e.name = 'verify_run')
      into a_sessions, a_days, a_academy, a_trade, a_lab, a_verify
      from analytics.events e where e.user_hash = h and e.at >= since;
    select widgets || coalesce(jsonb_object_agg(id, jsonb_build_object(
             'used', coalesce((widgets->id->>'used')::integer, 0) + n,
             'ignored_sessions', coalesce((widgets->id->>'ignored_sessions')::integer, 0))), '{}'::jsonb)
      into widgets from (
        select e.props->>'id' id, count(*) n from analytics.events e
        where e.user_hash = h and e.at >= since and e.kind = 'custom' and e.name = 'widget_click'
          and e.props->>'id' ~ '^[a-z0-9][a-z0-9_-]{0,39}$'
        group by 1) x;
    v_sources := '{product,analytics}';
  end if;

  v_learner := 0.6 * personalization.sat(lessons_done, 3) + 0.4 * personalization.sat(lessons_opened, 5);
  v_trader := 0.6 * personalization.sat(orders, 5) + 0.4 * personalization.sat(watch_items, 5);
  if use_analytics then
    v_learner := 0.75 * v_learner + 0.25 * personalization.sat(a_academy, 20);
    v_trader := 0.75 * v_trader + 0.25 * personalization.sat(a_trade, 20);
  end if;
  -- Demo trading style: bigger positions, more exposure, more volatile markets and fewer stops
  -- read as bolder. Unknown without demo orders.
  if orders > 0 then
    v_risk := round((least(coalesce(avg_size, 0) / 0.25, 1) + least(coalesce(exposure, 0), 1)
      + coalesce(volatile, 0.5) + (1 - least(stop_orders::numeric / greatest(entry_orders, 1), 1))) / 4, 4);
  end if;
  v_eng := personalization.sat(greatest(product_days, case when use_analytics then a_days else 0 end), 6);
  v_paid := personalization.sat(badges + ai_apps + case when use_analytics then a_verify + a_lab / 5.0 else 0 end, 5);

  v_segment := case
    when v_learner < 0.15 and v_trader < 0.15 then case when v_eng < 0.15 then 'new' else 'browser' end
    when v_learner >= 0.3 and v_trader >= 0.3 and abs(v_learner - v_trader) < 0.15 then 'both'
    when v_learner >= v_trader then 'learner' else 'trader' end;
  v_risk_band := case when v_risk is null then 'unknown' when v_risk < 0.35 then 'careful' when v_risk < 0.65 then 'moderate' else 'bold' end;
  v_eng_band := case when v_eng < 0.15 then 'new' when v_eng < 0.4 then 'light' when v_eng < 0.7 then 'regular' else 'heavy' end;

  v_inputs := jsonb_build_object(
    'lessons_done', lessons_done, 'lessons_opened', lessons_opened, 'demo_orders', orders,
    'stop_orders', stop_orders, 'watchlist_items', watch_items, 'verify_badges', badges,
    'ai_apps', ai_apps, 'active_days_30', greatest(product_days, case when use_analytics then a_days else 0 end))
    || case when quiz is null then '{}'::jsonb else jsonb_build_object('quiz_pct', round(quiz * 100)) end
    || case when use_analytics then jsonb_build_object('sessions_30', a_sessions, 'academy_views', a_academy,
         'trade_views', a_trade, 'workbench_views', a_lab, 'verify_runs', a_verify) else '{}'::jsonb end;

  insert into public.personalization_profiles as p (user_id, learner, trader, risk, engagement, paid_use, segment,
    risk_band, engagement_band, interests, widgets, inputs, sources, computed_at)
  values (p_user, round(v_learner, 4), round(v_trader, 4), v_risk, v_eng, v_paid, v_segment, v_risk_band, v_eng_band,
    jsonb_build_object('asset', personalization.shares(asset), 'family', personalization.shares(family), 'kind', personalization.shares(kinds)),
    widgets, v_inputs, v_sources, now())
  on conflict (user_id) do update set learner = excluded.learner, trader = excluded.trader, risk = excluded.risk,
    engagement = excluded.engagement, paid_use = excluded.paid_use, segment = excluded.segment,
    risk_band = excluded.risk_band, engagement_band = excluded.engagement_band, interests = excluded.interests,
    widgets = excluded.widgets, inputs = excluded.inputs, sources = excluded.sources, computed_at = excluded.computed_at
  returning to_jsonb(p) - 'user_id' into out;
  return out;
end
$$;

-- Every six hours: profiles older than six hours for people who have personalization on.
create or replace function personalization.refresh_all(p_limit integer default 5000)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select s.user_id from public.personalization_settings s
    left join public.personalization_profiles p on p.user_id = s.user_id
    where s.enabled and (p.computed_at is null or p.computed_at < now() - interval '6 hours')
      and coalesce(s.analytics_seen_at, s.updated_at) > now() - interval '13 months'
    order by p.computed_at nulls first limit p_limit
  loop
    perform personalization.compute(r.user_id);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Deletes a person's personal rows. Settings stay unless p_all (account deletion), so an off
-- switch is remembered.
create or replace function personalization.forget(p_user uuid, p_all boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.personalization_profiles where user_id = p_user;
  delete from public.personalization_widgets where user_id = p_user;
  delete from public.reco_feedback where user_id = p_user;
  delete from personalization.exposures where user_id = p_user;
  if p_all then
    delete from public.personalization_settings where user_id = p_user;
  end if;
end
$$;

-- ---------------------------------------------------------------- experiments: stop rules

-- Hourly. Stops a running experiment when a guardrail metric is worse in a variant than in the
-- control (one-sided two-proportion z above 2.58, at least 100 people in both), when it reaches
-- its time limit, or when every arm reached its planned size. It never stops early for a winner,
-- so looking at results does not change them.
create or replace function personalization.check_stops()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  x record;
  g text;
  v text;
  n0 numeric; n1 numeric; c0 numeric; c1 numeric; p numeric; se numeric;
  reason text;
  stopped integer := 0;
begin
  for x in select * from public.experiments e where e.status = 'running' loop
    reason := null;
    foreach g in array x.guardrails loop
      exit when reason is not null;
      foreach v in array x.variants[2:] loop
        select coalesce(sum(users) filter (where variant = x.variants[1] and metric = 'exposed'), 0),
               coalesce(sum(users) filter (where variant = v and metric = 'exposed'), 0),
               coalesce(sum(users) filter (where variant = x.variants[1] and metric = g), 0),
               coalesce(sum(users) filter (where variant = v and metric = g), 0)
          into n0, n1, c0, c1
          from personalization.experiment_counts where experiment = x.key;
        if n0 >= 100 and n1 >= 100 then
          p := (c0 + c1) / (n0 + n1);
          se := sqrt(p * (1 - p) * (1 / n0 + 1 / n1));
          if se > 0 and ((c1 / n1) - (c0 / n0)) / se > 2.58 then
            reason := format('guardrail: %s worse in %s', g, v);
            exit;
          end if;
        end if;
      end loop;
    end loop;
    if reason is null and x.started_at + make_interval(days => x.max_days) <= now() then
      reason := 'time limit';
    end if;
    if reason is null and not exists (
      select 1 from unnest(x.variants) vv
      where coalesce((select c.users from personalization.experiment_counts c
                      where c.experiment = x.key and c.variant = vv and c.metric = 'exposed'), 0) < x.min_per_arm) then
      reason := 'sample reached';
    end if;
    if reason is not null then
      update public.experiments set status = 'stopped', stopped_at = now(), stop_reason = reason where key = x.key;
      stopped := stopped + 1;
    end if;
  end loop;
  return stopped;
end
$$;

-- Hourly upkeep: stop rules, then the retention limits.
create or replace function personalization.maintain()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform personalization.check_stops();
  delete from public.reco_feedback where greatest(last_shown_at, clicked_at, dismissed_at) < now() - interval '180 days';
  delete from personalization.exposures x using public.experiments e
    where e.key = x.experiment and e.status = 'stopped' and e.stopped_at < now() - interval '90 days';
  delete from personalization.reco_daily where day < (now() - interval '25 months')::date;
  delete from public.personalization_profiles p using public.personalization_settings s
    where s.user_id = p.user_id and not s.enabled;
  -- No visit for 13 months (the app reports the cookie choice on every visit): profile and
  -- widget state go.
  delete from public.personalization_profiles p using public.personalization_settings s
    where s.user_id = p.user_id and coalesce(s.analytics_seen_at, s.updated_at) < now() - interval '13 months';
  delete from public.personalization_widgets w using public.personalization_settings s
    where s.user_id = w.user_id and coalesce(s.analytics_seen_at, s.updated_at) < now() - interval '13 months';
end
$$;

-- ---------------------------------------------------------------- what the app calls

create or replace function public.personalization_get()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'settings', coalesce((select jsonb_build_object('enabled', s.enabled, 'analytics_ok', s.analytics_ok,
        'updated_at', s.updated_at, 'reset_at', s.reset_at)
      from public.personalization_settings s where s.user_id = uid),
      jsonb_build_object('enabled', true, 'analytics_ok', false, 'updated_at', null, 'reset_at', null)),
    'profile', (select to_jsonb(p) - 'user_id' from public.personalization_profiles p where p.user_id = uid),
    'widgets', coalesce((select jsonb_agg(jsonb_build_object('widget_id', w.widget_id, 'ignored_sessions', w.ignored_sessions,
        'choice', w.choice, 'last_used_at', w.last_used_at) order by w.widget_id)
      from public.personalization_widgets w where w.user_id = uid), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('item', r.item, 'shown', r.shown,
        'clicked_at', r.clicked_at, 'dismissed_at', r.dismissed_at))
      from (select * from public.reco_feedback r where r.user_id = uid
            order by greatest(r.last_shown_at, r.clicked_at, r.dismissed_at) desc nulls last limit 300) r), '[]'::jsonb),
    'experiments', coalesce((select jsonb_agg(jsonb_build_object('key', x.experiment, 'variant', x.variant) order by x.experiment)
      from personalization.exposures x join public.experiments e on e.key = x.experiment
      where x.user_id = uid and e.status = 'running'), '[]'::jsonb));
end
$$;

-- Called by the app on each visit with the cookie choice (p_analytics), and by the switch on the
-- Personalization page (p_enabled). Null keeps the stored value.
create or replace function public.personalization_set(p_enabled boolean default null, p_analytics boolean default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  was boolean;
  was_analytics boolean;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  insert into public.personalization_settings (user_id) values (uid) on conflict (user_id) do nothing;
  select s.enabled, s.analytics_ok into was, was_analytics from public.personalization_settings s where s.user_id = uid for update;
  update public.personalization_settings set
    enabled = coalesce(p_enabled, enabled),
    analytics_ok = coalesce(p_analytics, analytics_ok),
    analytics_seen_at = case when p_analytics is null then analytics_seen_at else now() end,
    updated_at = case when p_enabled is distinct from null and p_enabled is distinct from was then now() else updated_at end
  where user_id = uid;
  if was and p_enabled is false then
    -- Count the switch-off as a guardrail outcome in the running experiments this person is in,
    -- then delete their rows. The counts have no ids and stay.
    insert into personalization.experiment_counts as c (experiment, variant, metric, users)
    select x.experiment, x.variant, 'personalization_off', 1
    from personalization.exposures x join public.experiments e on e.key = x.experiment
    where x.user_id = uid and e.status = 'running' and 'personalization_off' = any (e.guardrails || e.primary_metric)
      and not exists (select 1 from personalization.outcomes o
                      where o.experiment = x.experiment and o.user_id = uid and o.metric = 'personalization_off')
    on conflict (experiment, variant, metric) do update set users = c.users + 1;
    perform personalization.forget(uid);
  elsif coalesce(p_enabled, was) and p_analytics is not null and p_analytics is distinct from was_analytics then
    -- The analytics choice changed: rebuild now so page use stops counting at once.
    if exists (select 1 from public.personalization_profiles p where p.user_id = uid) then
      perform personalization.compute(uid);
    end if;
  end if;
end
$$;

create or replace function public.personalization_reset()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  delete from public.personalization_profiles where user_id = uid;
  delete from public.personalization_widgets where user_id = uid;
  delete from public.reco_feedback where user_id = uid;
  insert into public.personalization_settings (user_id, reset_at) values (uid, now())
  on conflict (user_id) do update set reset_at = now(), updated_at = now();
end
$$;

create or replace function public.personalization_refresh()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  fresh jsonb;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not personalization.is_on(uid) then
    return null;
  end if;
  insert into public.personalization_settings (user_id) values (uid) on conflict (user_id) do nothing;
  select to_jsonb(p) - 'user_id' into fresh from public.personalization_profiles p
    where p.user_id = uid and p.computed_at > now() - interval '5 minutes';
  return coalesce(fresh, personalization.compute(uid));
end
$$;

-- What's new shows, clicks and dismissals. A show counts at most once an hour per item per
-- person, and a click once per item per person, so reloading does not move the counts.
create or replace function public.reco_log(p_events jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  e jsonb;
  v_item text;
  v_ev text;
  v_kind text;
  v_tags text[];
  first_click boolean;
  counted boolean;
  n integer := 0;
  today date := (now() at time zone 'utc')::date;
begin
  if uid is null or not personalization.is_on(uid) then return 0; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 30 then return 0; end if;
  for e in select * from jsonb_array_elements(p_events) loop
    if jsonb_typeof(e) <> 'object' then continue; end if;
    v_item := e->>'item';
    v_ev := e->>'ev';
    if v_item is null or v_item !~ '^(algo|lesson|tool|market|scenario|verify):[a-z0-9._-]{1,80}$'
       or v_ev is null or v_ev not in ('show', 'click', 'dismiss') then continue; end if;
    v_kind := split_part(v_item, ':', 1);
    v_tags := '{}';
    if jsonb_typeof(e->'tags') = 'array' then
      select coalesce(array_agg(t), '{}') into v_tags from (
        select distinct t from jsonb_array_elements_text(e->'tags') t
        where t ~ '^[a-z]+:[a-z0-9._-]{1,40}$' limit 8) z;
    end if;
    insert into public.reco_feedback (user_id, item, tags) values (uid, v_item, v_tags)
    on conflict (user_id, item) do update set tags = case when cardinality(excluded.tags) > 0 then excluded.tags else public.reco_feedback.tags end;
    if v_ev = 'show' then
      update public.reco_feedback set shown = shown + 1, last_shown_at = now()
        where user_id = uid and item = v_item and (last_shown_at is null or last_shown_at < now() - interval '1 hour')
        returning true into counted;
      if coalesce(counted, false) then
        insert into personalization.arm_stats as a (item, kind, shows) values (v_item, v_kind, 1)
        on conflict (item) do update set shows = a.shows + 1, updated_at = now();
        insert into personalization.reco_daily as d (day, kind, shows) values (today, v_kind, 1)
        on conflict (day, kind) do update set shows = d.shows + 1;
      end if;
      counted := null;
    elsif v_ev = 'click' then
      update public.reco_feedback set clicked_at = now()
        where user_id = uid and item = v_item and clicked_at is null returning true into first_click;
      if coalesce(first_click, false) then
        insert into personalization.arm_stats as a (item, kind, clicks) values (v_item, v_kind, 1)
        on conflict (item) do update set clicks = a.clicks + 1, updated_at = now();
        insert into personalization.reco_daily as d (day, kind, clicks) values (today, v_kind, 1)
        on conflict (day, kind) do update set clicks = d.clicks + 1;
      end if;
      first_click := null;
    else
      update public.reco_feedback set dismissed_at = coalesce(dismissed_at, now()) where user_id = uid and item = v_item;
    end if;
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Shows and clicks per item over everyone, for the exploration step of the ranking. No ids.
create or replace function public.reco_arms(p_items text[])
returns table (item text, shows bigint, clicks bigint)
language sql stable security definer set search_path = '' as $$
  select a.item, a.shows, a.clicks from personalization.arm_stats a
  where (select auth.uid()) is not null and cardinality(p_items) <= 300 and a.item = any (p_items)
$$;

-- Once per session from the home page: widgets that were on screen and the ones clicked.
create or replace function public.widget_seen(p_seen text[], p_used text[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  w text;
begin
  if uid is null or not personalization.is_on(uid) then return; end if;
  if cardinality(p_seen) > 40 or cardinality(p_used) > 40 then return; end if;
  foreach w in array coalesce(p_used, '{}') loop
    continue when w !~ '^[a-z0-9][a-z0-9_-]{0,39}$';
    insert into public.personalization_widgets as x (user_id, widget_id, used, last_used_at, last_seen_at)
    values (uid, w, 1, now(), now())
    on conflict (user_id, widget_id) do update set used = x.used + 1, ignored_sessions = 0, last_used_at = now(), last_seen_at = now();
  end loop;
  foreach w in array coalesce(p_seen, '{}') loop
    continue when w !~ '^[a-z0-9][a-z0-9_-]{0,39}$' or w = any (coalesce(p_used, '{}'));
    -- At most one ignored session per 30 minutes, so reloads do not count as sessions.
    insert into public.personalization_widgets as x (user_id, widget_id, ignored_sessions, last_seen_at)
    values (uid, w, 1, now())
    on conflict (user_id, widget_id) do update set ignored_sessions = x.ignored_sessions + 1, last_seen_at = now()
      where x.last_seen_at is null or x.last_seen_at < now() - interval '30 minutes';
  end loop;
end
$$;

create or replace function public.widget_choose(p_widget text, p_choice text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not personalization.is_on(uid) then return; end if;
  if p_widget !~ '^[a-z0-9][a-z0-9_-]{0,39}$' or p_choice not in ('auto', 'keep', 'collapse') then
    raise exception 'bad widget choice' using errcode = '22023';
  end if;
  insert into public.personalization_widgets as x (user_id, widget_id, choice) values (uid, p_widget, p_choice)
  on conflict (user_id, widget_id) do update set choice = excluded.choice,
    ignored_sessions = case when excluded.choice = 'keep' then 0 else x.ignored_sessions end;
end
$$;

-- The variant for each experiment key. Not running, or personalization off: control, not
-- exposed and nothing stored. The variant comes from the caller's own user id, so nobody can
-- pick theirs.
create or replace function public.experiment_assign(p_keys text[])
returns table (key text, variant text, exposed boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  on_ boolean;
  k text;
  x public.experiments;
  v text;
  is_new boolean;
begin
  if uid is null or cardinality(p_keys) > 10 then return; end if;
  on_ := personalization.is_on(uid);
  foreach k in array p_keys loop
    select * into x from public.experiments e where e.key = k;
    if x.key is null or x.status <> 'running' or not on_ then
      key := k; variant := coalesce(x.variants[1], 'control'); exposed := false;
      return next;
      continue;
    end if;
    v := personalization.pick(x.variants, x.weights, personalization.bucket(x.key, uid));
    insert into personalization.exposures as ex (experiment, user_id, variant) values (x.key, uid, v)
    on conflict (experiment, user_id) do update set last_at = now()
    returning (xmax = 0) into is_new;
    if is_new then
      insert into personalization.experiment_counts as c (experiment, variant, metric, users) values (x.key, v, 'exposed', 1)
      on conflict (experiment, variant, metric) do update set users = c.users + 1;
    end if;
    key := k; variant := v; exposed := true;
    return next;
  end loop;
end
$$;

-- One outcome for the caller in every running experiment they are exposed to that measures it.
-- Each person counts once per metric.
create or replace function public.experiment_track(p_metric text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  r record;
  is_new boolean;
begin
  if uid is null or not personalization.is_on(uid) then return; end if;
  if p_metric not in ('whats_new_click', 'whats_new_dismiss', 'widget_restore', 'widget_used',
                      'personalization_off', 'lesson_done', 'demo_order') then
    raise exception 'unknown metric' using errcode = '22023';
  end if;
  for r in
    select x.experiment, x.variant from personalization.exposures x join public.experiments e on e.key = x.experiment
    where x.user_id = uid and e.status = 'running' and p_metric = any (e.guardrails || e.primary_metric)
  loop
    insert into personalization.outcomes as o (experiment, user_id, metric) values (r.experiment, uid, p_metric)
    on conflict (experiment, user_id, metric) do update set n = o.n + 1
    returning (xmax = 0) into is_new;
    if is_new then
      insert into personalization.experiment_counts as c (experiment, variant, metric, users) values (r.experiment, r.variant, p_metric, 1)
      on conflict (experiment, variant, metric) do update set users = c.users + 1;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------- team pages

create or replace function public.metrics_personalization()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform analytics.require_viewer();
  return jsonb_build_object(
    'days', 30,
    'profiles', personalization.k5((select count(*) from public.personalization_profiles)),
    'enabled', personalization.k5((select count(*) from public.personalization_settings where enabled)),
    'disabled', personalization.k5((select count(*) from public.personalization_settings where not enabled)),
    'analytics_ok', personalization.k5((select count(*) from public.personalization_settings where enabled and analytics_ok)),
    'segments', coalesce((select jsonb_agg(jsonb_build_object('segment', segment, 'users', personalization.k5(n)) order by n desc)
      from (select segment, count(*) n from public.personalization_profiles group by 1) s), '[]'::jsonb),
    'risk', coalesce((select jsonb_agg(jsonb_build_object('band', risk_band, 'users', personalization.k5(n)) order by risk_band)
      from (select risk_band, count(*) n from public.personalization_profiles group by 1) s), '[]'::jsonb),
    'engagement', coalesce((select jsonb_agg(jsonb_build_object('band', engagement_band, 'users', personalization.k5(n)) order by engagement_band)
      from (select engagement_band, count(*) n from public.personalization_profiles group by 1) s), '[]'::jsonb),
    'reco', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'shows', shows, 'clicks', clicks) order by shows desc)
      from (select kind, sum(shows) shows, sum(clicks) clicks from personalization.reco_daily
            where day >= (now() at time zone 'utc')::date - 30 group by 1) s), '[]'::jsonb));
end
$$;

create or replace function public.metrics_experiments()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform analytics.require_viewer();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'key', e.key, 'name', e.name, 'hypothesis', e.hypothesis, 'status', e.status,
      'primary_metric', e.primary_metric, 'guardrails', to_jsonb(e.guardrails), 'variants', to_jsonb(e.variants),
      'min_per_arm', e.min_per_arm, 'max_days', e.max_days, 'started_at', e.started_at, 'stopped_at', e.stopped_at,
      'stop_reason', e.stop_reason,
      'arms', (select jsonb_agg(jsonb_build_object(
          'variant', v,
          'exposed', coalesce((select c.users from personalization.experiment_counts c
                               where c.experiment = e.key and c.variant = v and c.metric = 'exposed'), 0),
          'metrics', coalesce((select jsonb_object_agg(c.metric, c.users) from personalization.experiment_counts c
                               where c.experiment = e.key and c.variant = v and c.metric <> 'exposed'), '{}'::jsonb)) order by o)
        from unnest(e.variants) with ordinality u(v, o)))
    order by e.created_at, e.key) from public.experiments e), '[]'::jsonb);
end
$$;

-- Account deletion (public.delete_account_data looks for this name) now removes personalization
-- rows too, then analytics as before.
create or replace function public.analytics_forget_user(p_user uuid)
returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  perform personalization.forget(p_user, true);
  return analytics.forget_user(p_user);
end
$$;
revoke all on function public.analytics_forget_user(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- grants

do $$
declare
  f text;
begin
  -- Internal functions: owner only.
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'personalization' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.personalization_get()', 'public.personalization_set(boolean, boolean)',
    'public.personalization_reset()', 'public.personalization_refresh()', 'public.reco_log(jsonb)',
    'public.reco_arms(text[])', 'public.widget_seen(text[], text[])', 'public.widget_choose(text, text)',
    'public.experiment_assign(text[])', 'public.experiment_track(text)',
    'public.metrics_personalization()', 'public.metrics_experiments()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'parity_writer') then
      execute format('revoke all on function %s from parity_writer', f);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------- the first experiments

insert into public.experiments (key, name, hypothesis, variants, weights, primary_metric, guardrails, min_per_arm, max_days, status, started_at)
values
  ('whats_new_order', 'What''s new ordering',
   'Ranking What''s new by each person''s use gets more people to open an item than newest first.',
   '{control,personal}', '{50,50}', 'whats_new_click', '{whats_new_dismiss,personalization_off}', 400, 42, 'running', now()),
  ('whats_new_hook', 'What''s new hook wording',
   'A line with a fact from our data under the title gets more people to open an item than the title alone.',
   '{control,hook}', '{50,50}', 'whats_new_click', '{whats_new_dismiss}', 400, 42, 'running', now()),
  ('widget_defaults', 'Home widget defaults',
   'Collapsing widgets someone ignored for 5 sessions gets more people to use a widget, without many restoring them.',
   '{control,collapse5}', '{50,50}', 'widget_used', '{widget_restore,personalization_off}', 400, 42, 'running', now())
on conflict (key) do nothing;

-- ---------------------------------------------------------------- schedule

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('parity-personalization-refresh', '23 */6 * * *', 'select personalization.refresh_all()');
    perform cron.schedule('parity-personalization-maintain', '41 * * * *', 'select personalization.maintain()');
  end if;
end
$$;
