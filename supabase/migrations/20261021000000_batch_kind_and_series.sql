-- Mark each batch as exploratory (nightly) or official (ledger run), and keep the
-- weekly market series behind it for the dashboard's data explorer.
alter table public.research_batches
  add column kind text not null default 'exploratory' check (kind in ('exploratory', 'official')),
  add column run_id text,
  add column series jsonb;

-- Series are large and only the recent ones are useful, so keep them for the
-- latest 10 batches. Owner-only function, run from the nightly job's connection
-- is not allowed (the writer cannot update), so it runs on a schedule if pg_cron
-- is available, and can always be run by hand.
create or replace function public.prune_old_series() returns void
language sql security definer set search_path = ''
as $$
  update public.research_batches set series = null
  where series is not null
    and id not in (select id from public.research_batches order by generated_at desc limit 10);
$$;
revoke all on function public.prune_old_series() from public;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('parity-prune-series', '15 3 * * *', 'select public.prune_old_series()');
  end if;
end
$$;
