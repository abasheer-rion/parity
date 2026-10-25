-- Latency tracking (DEC-0045): how old the data is at every hop, how long each scheduled
-- job and service step takes, and how fast pages get their data in real browsers.
-- Additive only: four new tables and three functions. Nothing here holds personal data.
--
-- data_freshness  one row per (source, series): the source's own as-of time, when we
--                 fetched it, when the site published it, and the cadence we expect.
--                 Anyone may read it. Written only through report_freshness().
-- pipeline_steps  one row per step of a scheduled job or service cycle: start, end,
--                 seconds, ok. Anyone may read it. Written only through
--                 report_pipeline_steps(). Rows older than 60 days are dropped.
-- rum_hourly      page timings from real browsers, already summed into hourly buckets:
--                 a count, a sum and a fixed log histogram per (hour, app, metric,
--                 endpoint, region). There are no raw events, no ids, no addresses.
--                 Anyone may read it. Written only through rum_ingest(), which the
--                 site's /rum function calls. Buckets older than 90 days are dropped.
-- rum_minute      a per-minute counter that caps how many beacons rum_ingest() takes,
--                 so a flood cannot grow the table. Nobody reads it.

-- ---------------------------------------------------------------- data freshness

create table if not exists public.data_freshness (
  source text not null check (source ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  series text not null check (series ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$'),
  label text not null default '' check (length(label) <= 120),
  kind text not null check (kind in ('prices', 'markets', 'news', 'site', 'service')),
  -- Which time the cadence applies to: the source's own as-of time, our last fetch, or
  -- the site's last publish. A central bank feed can be quiet for weeks; what must be
  -- recent is our last look at it.
  basis text not null default 'source' check (basis in ('source', 'fetch', 'publish')),
  cadence_hours real not null check (cadence_hours > 0 and cadence_hours <= 24 * 400),
  source_at timestamptz,
  fetched_at timestamptz,
  published_at timestamptz,
  ok boolean not null default true,
  reported_at timestamptz not null default now(),
  primary key (source, series)
);

alter table public.data_freshness enable row level security;
revoke all on public.data_freshness from anon, authenticated;
grant select on public.data_freshness to anon, authenticated;
drop policy if exists "anyone reads data freshness" on public.data_freshness;
create policy "anyone reads data freshness" on public.data_freshness
  for select to anon, authenticated using (true);

-- Rows come as a JSON array of objects. A row with a null time keeps the stored time, so
-- the fetch job can report fetched_at and the deploy job published_at for the same row.
create or replace function public.report_freshness(p_rows jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  n integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'report_freshness takes an array of at most 500 rows';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.data_freshness as d
      (source, series, label, kind, basis, cadence_hours, source_at, fetched_at, published_at, ok, reported_at)
    values (
      r->>'source', r->>'series', coalesce(left(r->>'label', 120), ''), r->>'kind', coalesce(r->>'basis', 'source'),
      (r->>'cadence_hours')::real, (r->>'source_at')::timestamptz,
      (r->>'fetched_at')::timestamptz, (r->>'published_at')::timestamptz,
      coalesce((r->>'ok')::boolean, true), now())
    on conflict (source, series) do update set
      label = excluded.label,
      kind = excluded.kind,
      basis = excluded.basis,
      cadence_hours = excluded.cadence_hours,
      source_at = coalesce(excluded.source_at, d.source_at),
      fetched_at = coalesce(excluded.fetched_at, d.fetched_at),
      published_at = coalesce(excluded.published_at, d.published_at),
      ok = excluded.ok,
      reported_at = now();
    n := n + 1;
  end loop;
  -- A series nobody has reported for 30 days was removed from the catalog.
  delete from public.data_freshness where reported_at < now() - interval '30 days';
  return n;
end
$$;

revoke all on function public.report_freshness(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- pipeline steps

create table if not exists public.pipeline_steps (
  id bigint generated always as identity primary key,
  pipeline text not null check (pipeline ~ '^[a-z0-9][a-z0-9 ._:/-]{0,59}$'),
  run_key text not null check (length(run_key) between 1 and 80),
  step text not null check (length(step) between 1 and 80),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  seconds real not null check (seconds >= 0 and seconds <= 7 * 86400),
  ok boolean not null,
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 1000),
  unique (pipeline, run_key, step)
);

create index if not exists pipeline_steps_started on public.pipeline_steps (started_at desc);

alter table public.pipeline_steps enable row level security;
revoke all on public.pipeline_steps from anon, authenticated;
grant select on public.pipeline_steps to anon, authenticated;
drop policy if exists "anyone reads pipeline steps" on public.pipeline_steps;
create policy "anyone reads pipeline steps" on public.pipeline_steps
  for select to anon, authenticated using (true);

create or replace function public.report_pipeline_steps(p_rows jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  n integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'report_pipeline_steps takes an array of at most 500 rows';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.pipeline_steps as p
      (pipeline, run_key, step, started_at, finished_at, seconds, ok, detail)
    values (
      r->>'pipeline', r->>'run_key', left(r->>'step', 80), (r->>'started_at')::timestamptz,
      (r->>'finished_at')::timestamptz, greatest((r->>'seconds')::real, 0),
      coalesce((r->>'ok')::boolean, true), coalesce(r->'detail', '{}'::jsonb))
    on conflict (pipeline, run_key, step) do update set
      started_at = excluded.started_at, finished_at = excluded.finished_at,
      seconds = excluded.seconds, ok = excluded.ok, detail = excluded.detail;
    n := n + 1;
  end loop;
  delete from public.pipeline_steps where started_at < now() - interval '60 days';
  return n;
end
$$;

revoke all on function public.report_pipeline_steps(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- real user timings

-- Histogram bins, the same in the browser, the database and the dashboard: bin 0 holds
-- values below 1, bin k (1..63) holds [10^((k-1)/8), 10^(k/8)). Eight bins per tenfold
-- step, so any percentile read back is within about 15% of the true value.
create table if not exists public.rum_hourly (
  hour timestamptz not null,
  app text not null,
  metric text not null,
  endpoint text not null default '',
  region text not null default 'XX',
  n integer not null default 0,
  hits integer not null default 0,
  total double precision not null default 0,
  bins integer[] not null default array_fill(0, array[64]),
  primary key (hour, app, metric, endpoint, region),
  check (array_length(bins, 1) = 64)
);

alter table public.rum_hourly enable row level security;
revoke all on public.rum_hourly from anon, authenticated;
grant select on public.rum_hourly to anon, authenticated;
drop policy if exists "anyone reads page timing totals" on public.rum_hourly;
create policy "anyone reads page timing totals" on public.rum_hourly
  for select to anon, authenticated using (true);

create table if not exists public.rum_minute (
  minute timestamptz primary key,
  n integer not null default 0
);

alter table public.rum_minute enable row level security;
revoke all on public.rum_minute from anon, authenticated;

-- One beacon: an app name, a coarse region (a continent code from Cloudflare) and up to 40
-- events {m: metric, e: endpoint, v: value, h: 1 for a cache hit}. Anything unexpected is
-- dropped, not stored. At most 3,000 beacons a minute are taken across the whole site.
create or replace function public.rum_ingest(p_app text, p_region text, p_events jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  ev jsonb;
  m text;
  e text;
  v double precision;
  h integer;
  j integer;
  hr timestamptz := date_trunc('hour', now());
  cur_minute timestamptz := date_trunc('minute', now());
  seen integer;
  n integer := 0;
begin
  if p_app is null or p_app !~ '^(site|product|research|sim|trade|academy|lab|desktop|auth|verify)$' then
    return 0;
  end if;
  if p_region is null or p_region !~ '^[A-Z]{2}$' then
    p_region := 'XX';
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 40 then
    return 0;
  end if;

  insert into public.rum_minute as r (minute, n) values (cur_minute, 1)
  on conflict (minute) do update set n = r.n + 1
  returning r.n into seen;
  if seen = 1 then  -- first beacon of a minute: tidy up old rows
    delete from public.rum_minute where minute < cur_minute - interval '1 hour';
    delete from public.rum_hourly where hour < hr - interval '90 days';
  end if;
  if seen > 3000 then
    return 0;
  end if;

  for ev in select * from jsonb_array_elements(p_events) loop
    if jsonb_typeof(ev) <> 'object' or jsonb_typeof(ev->'v') <> 'number' then
      continue;
    end if;
    m := ev->>'m';
    e := coalesce(ev->>'e', '');
    v := (ev->>'v')::double precision;
    h := case when ev->>'h' = '1' then 1 else 0 end;
    if m is null or m !~ '^(ttd|ttfb|fetch|bytes|age|lag|gap|lcp|inp|cls)$' then
      continue;
    end if;
    if e !~ '^[a-z0-9:/._-]{0,80}$' or v < 0 or v > 1e9 or v <> v then
      continue;
    end if;
    j := case when v < 1 then 1 else least(64, floor(8 * log(v))::integer + 2) end;
    insert into public.rum_hourly as t (hour, app, metric, endpoint, region, n, hits, total, bins)
    values (hr, p_app, m, e, p_region, 1, h, v,
            array_fill(0, array[j - 1]) || 1 || array_fill(0, array[64 - j]))
    on conflict (hour, app, metric, endpoint, region) do update set
      n = t.n + 1,
      hits = t.hits + excluded.hits,
      total = t.total + excluded.total,
      bins = t.bins[1:j - 1] || (t.bins[j] + 1) || t.bins[j + 1:64];
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke all on function public.rum_ingest(text, text, jsonb) from public;
-- The site's /rum function calls this with the public key. Calling it directly gets the
-- same checks and the same cap, and can only add to anonymous totals.
grant execute on function public.rum_ingest(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- the writer

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parity_writer') then
    grant execute on function public.report_freshness(jsonb) to parity_writer;
    grant execute on function public.report_pipeline_steps(jsonb) to parity_writer;
  end if;
end
$$;
