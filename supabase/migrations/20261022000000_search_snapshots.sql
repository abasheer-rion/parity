-- The always-on strategy search (DEC-0014) runs on the owner's machine and sends a
-- compact snapshot of its results here a few times a day; the deploy job copies the
-- newest one into the site as data/search.json. Only the newest 20 are kept.

create table if not exists public.search_snapshots (
  id bigint generated always as identity primary key,
  generated_at timestamptz not null,
  trials integer not null,
  doc jsonb not null
);

alter table public.search_snapshots enable row level security;

create or replace function public.prune_search_snapshots() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.search_snapshots
  where id not in (select id from public.search_snapshots order by id desc limit 20);
  return null;
end
$$;

drop trigger if exists prune_search_snapshots on public.search_snapshots;
create trigger prune_search_snapshots after insert on public.search_snapshots
  for each statement execute function public.prune_search_snapshots();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parity_writer') then
    grant insert on public.search_snapshots to parity_writer;
    create policy "writer inserts search snapshots" on public.search_snapshots
      for insert to parity_writer with check (true);
  end if;
end
$$;
