-- Least-privilege writer for the nightly research job. The role itself (with its
-- password) is created by hand on the hosted project and recorded in the team's key
-- registry, never here. This migration only grants it what it needs: insert new
-- batches and runs, and read back the id of the batch it just inserted.
-- Locally the role may not exist, so everything is skipped in that case.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parity_writer') then
    grant usage on schema public to parity_writer;
    grant insert on public.research_batches, public.strategy_runs to parity_writer;
    grant select (id) on public.research_batches to parity_writer;
    grant usage on sequence public.strategy_runs_id_seq to parity_writer;

    create policy "writer inserts batches" on public.research_batches
      for insert to parity_writer with check (true);
    create policy "writer reads batch ids" on public.research_batches
      for select to parity_writer using (true);
    create policy "writer inserts runs" on public.strategy_runs
      for insert to parity_writer with check (true);
  end if;
end
$$;
