-- Competitor profiles (DEC-0047): the feedback collector runs inside the always-on sims
-- service once a day and keeps public feedback on other trading products in a local
-- SQLite file. Only its summary comes here: counts of praise and complaints by theme,
-- monthly trends and App Store ratings, never review text or authors. Additive only.
--
-- profile_snapshots  only the writer may add rows and nobody but the database owner may
--                    read them; the deploy job copies the newest into the site as
--                    data/profiles.json, like sim_snapshots. Only the newest 20 are kept.

create table if not exists public.profile_snapshots (
  id bigint generated always as identity primary key,
  generated_at timestamptz not null,
  items integer not null check (items >= 0),
  doc jsonb not null check (jsonb_typeof(doc) = 'object' and pg_column_size(doc) <= 300000)
);

alter table public.profile_snapshots enable row level security;

revoke all on public.profile_snapshots from anon, authenticated;

create or replace function public.prune_profile_snapshots() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.profile_snapshots
  where id not in (select id from public.profile_snapshots order by id desc limit 20);
  return null;
end
$$;

revoke all on function public.prune_profile_snapshots() from public, anon, authenticated;

drop trigger if exists prune_profile_snapshots on public.profile_snapshots;
create trigger prune_profile_snapshots after insert on public.profile_snapshots
  for each statement execute function public.prune_profile_snapshots();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parity_writer') then
    grant insert on public.profile_snapshots to parity_writer;
    drop policy if exists "writer inserts profile snapshots" on public.profile_snapshots;
    create policy "writer inserts profile snapshots" on public.profile_snapshots
      for insert to parity_writer with check (true);
  end if;
end
$$;
