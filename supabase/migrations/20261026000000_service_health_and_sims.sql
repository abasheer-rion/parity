-- Auto-run (DEC-0037): the strategy search and the new sims service both run on the
-- owner's machine around the clock. Additive only: two new tables and one function.
--
-- service_heartbeats  one row per service ('search', 'sims'): when it last reported and a
--                     few public counts (tries so far, cycles so far). Anyone may read it,
--                     signed in or not, so the site can show "search: 130,466 tries, last
--                     batch 2 min ago" live. Nobody writes it directly: the writer calls
--                     report_heartbeat(), which stamps the database's own clock.
-- sim_snapshots       the sims' accumulated summary (bot crash odds, Sim World ranges).
--                     Only the writer may add rows and nobody but the database owner may
--                     read them; the deploy job copies the newest into the site, like
--                     search_snapshots. Only the newest 20 are kept.

-- ---------------------------------------------------------------- service health

create table if not exists public.service_heartbeats (
  service text primary key check (service in ('search', 'sims')),
  reported_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 2000)
);

alter table public.service_heartbeats enable row level security;

revoke all on public.service_heartbeats from anon, authenticated;
grant select on public.service_heartbeats to anon, authenticated;

drop policy if exists "anyone reads service health" on public.service_heartbeats;
create policy "anyone reads service health" on public.service_heartbeats
  for select to anon, authenticated
  using (true);

-- The only way in: one row per known service, the time from the database, the summary
-- capped by the table's check. Security definer so the writer needs no table rights.
create or replace function public.report_heartbeat(p_service text, p_summary jsonb)
returns void
language sql security definer set search_path = '' as $$
  insert into public.service_heartbeats (service, reported_at, summary)
  values (p_service, now(), coalesce(p_summary, '{}'::jsonb))
  on conflict (service) do update
    set reported_at = excluded.reported_at, summary = excluded.summary;
$$;

revoke all on function public.report_heartbeat(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- sim snapshots

create table if not exists public.sim_snapshots (
  id bigint generated always as identity primary key,
  generated_at timestamptz not null,
  cycles integer not null check (cycles >= 0),
  doc jsonb not null check (jsonb_typeof(doc) = 'object' and pg_column_size(doc) <= 200000)
);

alter table public.sim_snapshots enable row level security;

revoke all on public.sim_snapshots from anon, authenticated;

create or replace function public.prune_sim_snapshots() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.sim_snapshots
  where id not in (select id from public.sim_snapshots order by id desc limit 20);
  return null;
end
$$;

revoke all on function public.prune_sim_snapshots() from public, anon, authenticated;

drop trigger if exists prune_sim_snapshots on public.sim_snapshots;
create trigger prune_sim_snapshots after insert on public.sim_snapshots
  for each statement execute function public.prune_sim_snapshots();

-- ---------------------------------------------------------------- the writer

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parity_writer') then
    grant execute on function public.report_heartbeat(text, jsonb) to parity_writer;
    grant insert on public.sim_snapshots to parity_writer;
    drop policy if exists "writer inserts sim snapshots" on public.sim_snapshots;
    create policy "writer inserts sim snapshots" on public.sim_snapshots
      for insert to parity_writer with check (true);
  end if;
end
$$;
