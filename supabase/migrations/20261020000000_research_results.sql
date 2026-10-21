-- Research results for the dashboard. See docs/reference/0001-architecture.md#database.
--
-- Only the scheduled research job writes, using the service role key, which bypasses
-- row level security. The dashboard reads with the public anon key after sign-in, and
-- the policies below only let listed team members read anything.

create table public.members (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);

create table public.research_batches (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null,
  git_sha text,
  schema_version int not null,
  n_trials int not null,
  config jsonb not null,
  coverage jsonb not null,
  created_at timestamptz not null default now()
);

create index research_batches_generated_at_idx on public.research_batches (generated_at desc);

create table public.strategy_runs (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.research_batches (id) on delete cascade,
  strategy text not null,
  summary text not null,
  reference text not null default '',
  is_benchmark boolean not null default false,
  params jsonb not null,
  config jsonb not null,
  metrics jsonb not null,
  yearly jsonb not null,
  equity jsonb not null,
  drawdown jsonb not null,
  ic_decay jsonb not null,
  exposure jsonb not null,
  gauntlet jsonb,
  unique (batch_id, strategy)
);

create index strategy_runs_batch_idx on public.strategy_runs (batch_id);

-- True when the signed-in user's email is on the team list.
create function public.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

alter table public.members enable row level security;
alter table public.research_batches enable row level security;
alter table public.strategy_runs enable row level security;

create policy "members read the team list" on public.members
  for select to authenticated using (public.is_member());

create policy "members read batches" on public.research_batches
  for select to authenticated using (public.is_member());

create policy "members read runs" on public.strategy_runs
  for select to authenticated using (public.is_member());

-- Nothing is granted to anon, and no insert, update or delete policies exist, so only
-- the service role can write.
revoke all on public.members, public.research_batches, public.strategy_runs from anon;
