-- Open sign-up (owner, 2026-10-21): anyone can make an account and use the app.
-- The team list (public.members) no longer decides who can read research results;
-- it only marks team members with a badge. See DEC-0012.

-- 1. Any signed-in person reads published research.
drop policy if exists "members read batches" on public.research_batches;
drop policy if exists "members read runs" on public.strategy_runs;
drop policy if exists "signed-in people read batches" on public.research_batches;
drop policy if exists "signed-in people read runs" on public.strategy_runs;

create policy "signed-in people read batches" on public.research_batches
  for select to authenticated using (true);
create policy "signed-in people read runs" on public.strategy_runs
  for select to authenticated using (true);

grant select on public.research_batches, public.strategy_runs to authenticated;

-- 2. The team list is private. A person can see only their own row (for the badge).
--    Email confirmation is off for now, so an address on the list is not proof of
--    who someone is; the list grants nothing but the badge.
drop policy if exists "members read the team list" on public.members;
drop policy if exists "people see their own team row" on public.members;
create policy "people see their own team row" on public.members
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 3. "Delete my account" requests. A signed-in person can file one for themselves and
--    see it; the owner (service role) acts on it and deletes the account by hand.
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  reason text check (char_length(reason) <= 1000),
  requested_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "people file their own deletion request" on public.account_deletion_requests;
create policy "people file their own deletion request" on public.account_deletion_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and email = (select auth.jwt() ->> 'email'));

drop policy if exists "people see their own deletion request" on public.account_deletion_requests;
create policy "people see their own deletion request" on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.account_deletion_requests from anon;
grant select, insert on public.account_deletion_requests to authenticated;
