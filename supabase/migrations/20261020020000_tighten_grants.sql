-- Signed-in users only ever read. Supabase grants every privilege to `authenticated`
-- by default; row level security blocks writes, but not TRUNCATE, so we remove all
-- privileges except SELECT rather than rely on policies alone.
revoke all on public.members, public.research_batches, public.strategy_runs from authenticated;
grant select on public.members, public.research_batches, public.strategy_runs to authenticated;
