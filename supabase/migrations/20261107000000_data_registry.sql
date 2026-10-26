-- The data registry (DEC-0064): one list of every data source and series we use or could use,
-- what each source's terms allow, where each series is used, and an append-only log of every
-- change. The always-on sims service on the owner's machine keeps a working copy, finds and
-- enrols new series, checks their health, and sends every change here through
-- report_registry(). The research app reads these tables for the Data catalog, Candidates
-- and Data health pages.
--
-- Additive only: seven new tables, two functions and two triggers. Nothing existing changes.
-- Nothing here holds personal data. Every statement can run twice (the runner can retry).
--
-- data_sources        one row per provider: access method, licence, display rights, terms
--                     link and the date we read them, cost, rate limits. Anyone may read it,
--                     except key_name (the vault entry that holds a key, if any), which only
--                     the owner and the service role can read.
-- data_series         one row per series: source, code, asset class, region, frequency,
--                     units, dates, look-ahead lag, tags, labels, quality score, status
--                     (candidate, enrolled, live, degraded, retired), display rights and
--                     health. Anyone may read it. Metadata only, never values.
-- data_lineage        which strategies, pages, feeds and searches use each series.
-- data_events         append-only log of every state change. Rows can be added, never
--                     changed or removed (triggers refuse update, delete and truncate).
-- data_uptime         daily health counters per source and per series, for uptime history.
--                     Rows older than 400 days are dropped.
-- data_series_preview a short chart of a series (at most 400 points). Display rights decide
--                     who may read it: public series anyone; internal series team members
--                     only (DEC-0056); research-only and no-rights series are never stored.
-- data_backtests      the quick test battery run when a series is enrolled. Signed-in only.
--
-- Rollback (by hand, only if something here misbehaves): the tables are new and nothing else
-- reads them, so
--   drop function public.report_registry(jsonb);
--   drop table public.data_backtests, public.data_series_preview, public.data_uptime,
--     public.data_events, public.data_lineage, public.data_series, public.data_sources cascade;
--   drop function public.data_events_append_only();

-- ---------------------------------------------------------------- sources

create table if not exists public.data_sources (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  name text not null check (length(name) between 1 and 160),
  provider text not null default '' check (length(provider) <= 120),
  access_method text not null default '' check (length(access_method) <= 200),
  licence text not null default '' check (length(licence) <= 400),
  -- public: anyone may see the values. internal: team members only (DEC-0056). research:
  -- used in research, values never shown. none: not used at all.
  display_rights text not null check (display_rights in ('public', 'internal', 'research', 'none')),
  terms_url text not null default '' check (length(terms_url) <= 300),
  terms_read_on date,
  cost text not null default '' check (length(cost) <= 200),
  rate_limit text not null default '' check (length(rate_limit) <= 200),
  key_name text check (key_name is null or key_name ~ '^[A-Za-z0-9_.-]{1,80}$'),
  status text not null default 'on' check (status in ('on', 'off', 'planned', 'no key', 'team')),
  note text not null default '' check (length(note) <= 400),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- series

create table if not exists public.data_series (
  id text primary key check (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:/+#-]{0,99}$'),
  source_id text not null references public.data_sources (id) on delete restrict,
  code text not null default '' check (length(code) <= 200),
  name text not null check (length(name) between 1 and 400),
  symbol text not null default '' check (length(symbol) <= 60),
  asset_class text not null default 'other' check (asset_class ~ '^[a-z_]{1,20}$'),
  region text not null default '' check (length(region) <= 20),
  frequency text not null check (frequency in ('T', 'D', 'W', 'M', 'Q', 'A')),
  units text not null default '' check (length(units) <= 60),
  start_date date,
  end_date date,
  -- Look-ahead rules (DEC-0027): business days after the period end (monthly, quarterly)
  -- or after the stamped date (lag_days) before a value may be used.
  published_after integer check (published_after is null or published_after between 0 and 400),
  lag_days integer not null default 0 check (lag_days between 0 and 60),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  labels jsonb not null default '{}'::jsonb
    check (jsonb_typeof(labels) = 'object' and pg_column_size(labels) <= 1000),
  quality real check (quality is null or quality between 0 and 1),
  status text not null check (status in ('candidate', 'enrolled', 'live', 'degraded', 'retired')),
  display_rights text not null check (display_rights in ('public', 'internal', 'research', 'none')),
  origin text not null default 'catalog' check (origin in ('catalog', 'discovered', 'live')),
  intended_use text not null default 'research' check (intended_use in ('research', 'feed', 'display')),
  required boolean not null default false,
  reason text not null default '' check (length(reason) <= 300),
  discovered_by text not null default '' check (length(discovered_by) <= 40),
  discovered_at timestamptz,
  enrolled_at timestamptz,
  health text not null default 'unknown'
    check (health in ('ok', 'late', 'stale', 'dead', 'idle', 'unknown')),
  health_checked_at timestamptz,
  -- Counts and short reasons only. The engine never writes raw error text here: it can quote
  -- a URL with a key in it (anyone may read this column).
  health_detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(health_detail) = 'object' and pg_column_size(health_detail) <= 2000),
  last_obs date,
  backup_id text check (backup_id is null or length(backup_id) <= 100),
  updated_at timestamptz not null default now()
);

create index if not exists data_series_source on public.data_series (source_id);
create index if not exists data_series_status on public.data_series (status, asset_class);

-- ---------------------------------------------------------------- lineage

create table if not exists public.data_lineage (
  series_id text not null references public.data_series (id) on delete cascade,
  kind text not null check (kind in ('strategy', 'page', 'feed', 'search', 'derived')),
  consumer text not null check (length(consumer) between 1 and 120),
  primary key (series_id, kind, consumer)
);

-- ---------------------------------------------------------------- events (append-only)

create table if not exists public.data_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  series_id text check (series_id is null or length(series_id) <= 100),
  source_id text check (source_id is null or length(source_id) <= 40),
  kind text not null check (kind in ('seeded', 'discovered', 'enrolled', 'rejected', 'status',
    'health', 'retry', 'failover', 'retired', 'backtest', 'licence', 'schema')),
  from_state text check (from_state is null or length(from_state) <= 40),
  to_state text check (to_state is null or length(to_state) <= 40),
  -- Counts and short reasons only, never raw error text (anyone may read this column).
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 4000),
  -- The engine's own id for the event, so a retried send never adds it twice.
  event_key text not null unique check (length(event_key) between 1 and 80)
);

create index if not exists data_events_series on public.data_events (series_id, at desc);
create index if not exists data_events_at on public.data_events (at desc);

create or replace function public.data_events_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'data_events is append-only';
end
$$;

revoke all on function public.data_events_append_only() from public, anon, authenticated;

drop trigger if exists data_events_append_only on public.data_events;
create trigger data_events_append_only before update or delete on public.data_events
  for each row execute function public.data_events_append_only();
drop trigger if exists data_events_no_truncate on public.data_events;
create trigger data_events_no_truncate before truncate on public.data_events
  for each statement execute function public.data_events_append_only();

-- ---------------------------------------------------------------- uptime

create table if not exists public.data_uptime (
  scope text not null check (scope in ('source', 'series')),
  id text not null check (length(id) between 1 and 100),
  day date not null,
  checks integer not null default 0 check (checks >= 0),
  ok integer not null default 0 check (ok >= 0),
  late integer not null default 0 check (late >= 0),
  stale integer not null default 0 check (stale >= 0),
  down integer not null default 0 check (down >= 0),
  primary key (scope, id, day)
);

create index if not exists data_uptime_day on public.data_uptime (day desc);

-- ---------------------------------------------------------------- previews and backtests

create table if not exists public.data_series_preview (
  series_id text primary key references public.data_series (id) on delete cascade,
  points jsonb not null check (case when jsonb_typeof(points) = 'array'
    then jsonb_array_length(points) <= 400 and pg_column_size(points) <= 20000 else false end),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_backtests (
  series_id text primary key references public.data_series (id) on delete cascade,
  ran_at timestamptz not null,
  trials integer not null default 0 check (trials between 0 and 1000),
  battery jsonb not null check (jsonb_typeof(battery) = 'object' and pg_column_size(battery) <= 4000)
);

-- ---------------------------------------------------------------- who may read what

alter table public.data_sources enable row level security;
alter table public.data_series enable row level security;
alter table public.data_lineage enable row level security;
alter table public.data_events enable row level security;
alter table public.data_uptime enable row level security;
alter table public.data_series_preview enable row level security;
alter table public.data_backtests enable row level security;

revoke all on public.data_sources, public.data_series, public.data_lineage, public.data_events,
  public.data_uptime, public.data_series_preview, public.data_backtests from public, anon, authenticated;
revoke all on sequence public.data_events_id_seq from public, anon, authenticated;

-- Every column of data_sources except key_name.
grant select (id, name, provider, access_method, licence, display_rights, terms_url, terms_read_on,
  cost, rate_limit, status, note, updated_at) on public.data_sources to anon, authenticated;
grant select on public.data_series, public.data_lineage, public.data_events, public.data_uptime
  to anon, authenticated;
grant select on public.data_series_preview to anon, authenticated;
grant select on public.data_backtests to authenticated;

drop policy if exists "anyone reads data sources" on public.data_sources;
create policy "anyone reads data sources" on public.data_sources
  for select to anon, authenticated using (true);
drop policy if exists "anyone reads data series" on public.data_series;
create policy "anyone reads data series" on public.data_series
  for select to anon, authenticated using (true);
drop policy if exists "anyone reads data lineage" on public.data_lineage;
create policy "anyone reads data lineage" on public.data_lineage
  for select to anon, authenticated using (true);
drop policy if exists "anyone reads data events" on public.data_events;
create policy "anyone reads data events" on public.data_events
  for select to anon, authenticated using (true);
drop policy if exists "anyone reads data uptime" on public.data_uptime;
create policy "anyone reads data uptime" on public.data_uptime
  for select to anon, authenticated using (true);

-- Values follow the display rights of the series and of its source, whichever is narrower.
-- Public: anyone. Internal: team members only, never a connected AI app (is_team() refuses
-- tokens with a client_id). Anything else: nobody.
drop policy if exists "previews follow display rights" on public.data_series_preview;
create policy "previews follow display rights" on public.data_series_preview
  for select to anon, authenticated using (
    exists (select 1 from public.data_series s join public.data_sources o on o.id = s.source_id
            where s.id = series_id and s.display_rights = 'public' and o.display_rights = 'public'));
drop policy if exists "team reads internal previews" on public.data_series_preview;
create policy "team reads internal previews" on public.data_series_preview
  for select to authenticated using (
    (select public.is_team())
    and exists (select 1 from public.data_series s join public.data_sources o on o.id = s.source_id
                where s.id = series_id and s.display_rights in ('public', 'internal')
                  and o.display_rights in ('public', 'internal')));

drop policy if exists "signed in reads backtests" on public.data_backtests;
create policy "signed in reads backtests" on public.data_backtests
  for select to authenticated using (((select auth.jwt()) ->> 'client_id') is null);

-- ---------------------------------------------------------------- the only way in

-- One JSON document with any of: sources, series, lineage, events, uptime, previews,
-- backtests (arrays of objects, at most 500 rows each). Returns the rows processed per kind.
-- A series whose display rights are wider than its source's is refused. Rows are upserted by their key;
-- lineage replaces the list for each series it names; events are added once each (by
-- event_key); uptime counters are set to the values sent. Previews are refused for series
-- whose display rights are not public or internal. Security definer, so the writer needs no
-- table rights.
create or replace function public.report_registry(p jsonb)
returns jsonb
language plpgsql strict security definer set search_path = '' as $$
declare
  r jsonb;
  k text;
  rank_of constant jsonb := '{"none": 0, "research": 1, "internal": 2, "public": 3}';
  n_sources integer := 0;
  n_series integer := 0;
  n_lineage integer := 0;
  n_events integer := 0;
  n_uptime integer := 0;
  n_previews integer := 0;
  n_backtests integer := 0;
begin
  if jsonb_typeof(p) <> 'object' then
    raise exception 'report_registry takes one JSON object';
  end if;
  foreach k in array array['sources', 'series', 'lineage', 'events', 'uptime', 'previews', 'backtests'] loop
    if p ? k and (case when jsonb_typeof(p -> k) = 'array' then jsonb_array_length(p -> k) > 500 else true end) then
      raise exception 'report_registry: % must be an array of at most 500 rows', k;
    end if;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p -> 'sources', '[]'::jsonb)) loop
    insert into public.data_sources as d (id, name, provider, access_method, licence, display_rights,
      terms_url, terms_read_on, cost, rate_limit, key_name, status, note, updated_at)
    values (r ->> 'id', r ->> 'name', coalesce(r ->> 'provider', ''), coalesce(r ->> 'access_method', ''),
      coalesce(left(r ->> 'licence', 400), ''), r ->> 'display_rights', coalesce(r ->> 'terms_url', ''),
      (r ->> 'terms_read_on')::date, coalesce(r ->> 'cost', ''), coalesce(r ->> 'rate_limit', ''),
      nullif(r ->> 'key_name', ''), coalesce(r ->> 'status', 'on'), coalesce(left(r ->> 'note', 400), ''), now())
    on conflict (id) do update set
      name = excluded.name, provider = excluded.provider, access_method = excluded.access_method,
      licence = excluded.licence, display_rights = excluded.display_rights, terms_url = excluded.terms_url,
      terms_read_on = excluded.terms_read_on, cost = excluded.cost, rate_limit = excluded.rate_limit,
      key_name = excluded.key_name, status = excluded.status, note = excluded.note, updated_at = now();
    n_sources := n_sources + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p -> 'series', '[]'::jsonb)) loop
    if coalesce((rank_of ->> (r ->> 'display_rights'))::int, 9) > coalesce((select (rank_of ->> o.display_rights)::int
        from public.data_sources o where o.id = r ->> 'source_id'), -1) then
      raise exception 'report_registry: % has wider display rights than its source', r ->> 'id';
    end if;
    insert into public.data_series as d (id, source_id, code, name, symbol, asset_class, region, frequency,
      units, start_date, end_date, published_after, lag_days, tags, labels, quality, status,
      display_rights, origin, intended_use, required, reason, discovered_by, discovered_at,
      enrolled_at, health, health_checked_at, health_detail, last_obs, backup_id, updated_at)
    values (r ->> 'id', r ->> 'source_id', coalesce(r ->> 'code', ''), left(r ->> 'name', 400),
      coalesce(r ->> 'symbol', ''), coalesce(r ->> 'asset_class', 'other'), coalesce(r ->> 'region', ''),
      r ->> 'frequency', coalesce(r ->> 'units', ''), (r ->> 'start_date')::date, (r ->> 'end_date')::date,
      (r ->> 'published_after')::integer, coalesce((r ->> 'lag_days')::integer, 0),
      coalesce(array(select jsonb_array_elements_text(r -> 'tags')), '{}'),
      coalesce(r -> 'labels', '{}'::jsonb), (r ->> 'quality')::real, r ->> 'status', r ->> 'display_rights',
      coalesce(r ->> 'origin', 'catalog'), coalesce(r ->> 'intended_use', 'research'),
      coalesce((r ->> 'required')::boolean, false), coalesce(left(r ->> 'reason', 300), ''),
      coalesce(r ->> 'discovered_by', ''), (r ->> 'discovered_at')::timestamptz,
      (r ->> 'enrolled_at')::timestamptz, coalesce(r ->> 'health', 'unknown'),
      (r ->> 'health_checked_at')::timestamptz, coalesce(r -> 'health_detail', '{}'::jsonb),
      (r ->> 'last_obs')::date, nullif(r ->> 'backup_id', ''), now())
    on conflict (id) do update set
      source_id = excluded.source_id, code = excluded.code, name = excluded.name, symbol = excluded.symbol,
      asset_class = excluded.asset_class, region = excluded.region, frequency = excluded.frequency,
      units = excluded.units, start_date = excluded.start_date, end_date = excluded.end_date,
      published_after = excluded.published_after, lag_days = excluded.lag_days, tags = excluded.tags,
      labels = excluded.labels, quality = excluded.quality, status = excluded.status,
      display_rights = excluded.display_rights, origin = excluded.origin,
      intended_use = excluded.intended_use, required = excluded.required, reason = excluded.reason,
      discovered_by = excluded.discovered_by, discovered_at = excluded.discovered_at,
      enrolled_at = excluded.enrolled_at, health = excluded.health,
      health_checked_at = excluded.health_checked_at, health_detail = excluded.health_detail,
      last_obs = excluded.last_obs, backup_id = excluded.backup_id, updated_at = now();
    n_series := n_series + 1;
  end loop;

  -- Lineage: the full list for each series named replaces what was there.
  delete from public.data_lineage l
  where l.series_id in (select distinct x ->> 'series_id' from jsonb_array_elements(coalesce(p -> 'lineage', '[]'::jsonb)) x);
  for r in select * from jsonb_array_elements(coalesce(p -> 'lineage', '[]'::jsonb)) loop
    insert into public.data_lineage (series_id, kind, consumer)
    values (r ->> 'series_id', r ->> 'kind', left(r ->> 'consumer', 120))
    on conflict do nothing;
    n_lineage := n_lineage + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p -> 'events', '[]'::jsonb)) loop
    insert into public.data_events (at, series_id, source_id, kind, from_state, to_state, detail, event_key)
    values (coalesce((r ->> 'at')::timestamptz, now()), nullif(r ->> 'series_id', ''), nullif(r ->> 'source_id', ''),
      r ->> 'kind', left(r ->> 'from_state', 40), left(r ->> 'to_state', 40),
      coalesce(r -> 'detail', '{}'::jsonb), r ->> 'event_key')
    on conflict (event_key) do nothing;
    n_events := n_events + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p -> 'uptime', '[]'::jsonb)) loop
    insert into public.data_uptime as u (scope, id, day, checks, ok, late, stale, down)
    values (r ->> 'scope', r ->> 'id', (r ->> 'day')::date, coalesce((r ->> 'checks')::integer, 0),
      coalesce((r ->> 'ok')::integer, 0), coalesce((r ->> 'late')::integer, 0),
      coalesce((r ->> 'stale')::integer, 0), coalesce((r ->> 'down')::integer, 0))
    on conflict (scope, id, day) do update set
      checks = excluded.checks, ok = excluded.ok, late = excluded.late, stale = excluded.stale, down = excluded.down;
    n_uptime := n_uptime + 1;
  end loop;
  delete from public.data_uptime where day < current_date - 400;

  for r in select * from jsonb_array_elements(coalesce(p -> 'previews', '[]'::jsonb)) loop
    if not exists (select 1 from public.data_series s where s.id = r ->> 'series_id'
                   and s.display_rights in ('public', 'internal')) then
      raise exception 'report_registry: no preview for % (its display rights do not allow one)', r ->> 'series_id';
    end if;
    insert into public.data_series_preview as v (series_id, points, updated_at)
    values (r ->> 'series_id', r -> 'points', now())
    on conflict (series_id) do update set points = excluded.points, updated_at = now();
    n_previews := n_previews + 1;
  end loop;
  -- A series whose rights were narrowed loses its preview at once.
  delete from public.data_series_preview v using public.data_series s
  where s.id = v.series_id and s.display_rights not in ('public', 'internal');

  for r in select * from jsonb_array_elements(coalesce(p -> 'backtests', '[]'::jsonb)) loop
    insert into public.data_backtests as b (series_id, ran_at, trials, battery)
    values (r ->> 'series_id', (r ->> 'ran_at')::timestamptz, coalesce((r ->> 'trials')::integer, 0), r -> 'battery')
    on conflict (series_id) do update set ran_at = excluded.ran_at, trials = excluded.trials, battery = excluded.battery;
    n_backtests := n_backtests + 1;
  end loop;

  return jsonb_build_object('sources', n_sources, 'series', n_series, 'lineage', n_lineage,
    'events', n_events, 'uptime', n_uptime, 'previews', n_previews, 'backtests', n_backtests);
end
$$;

revoke all on function public.report_registry(jsonb) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parity_writer') then
    grant execute on function public.report_registry(jsonb) to parity_writer;
  end if;
end
$$;
