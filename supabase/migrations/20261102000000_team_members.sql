-- The team list (DEC-0053): which accounts are Parity's own team. Team members see the
-- team-only live feeds (real-time data whose terms allow internal use only), and other team
-- areas may use the same list (the Metrics area on feat/product-analytics shares this exact
-- definition; keep the two identical).
--
-- Keyed by the account's id, not its email, so a row means one specific account. Nothing is
-- seeded: the owner adds people by hand in the Supabase SQL editor (which runs as the owner):
--
--   insert into public.team_members (user_id, note)
--   select id, 'owner' from auth.users where email = lower('you@example.com')
--   on conflict (user_id) do nothing;
--
-- and removes them with: delete from public.team_members where user_id = '<id>';
--
-- Row rules: a signed-in person can read only their own row (so the page can tell whether
-- they are on the team). There are no insert, update or delete policies and no grants for
-- them, so only the owner and the service role can change the list. Tokens issued to
-- connected AI apps (they carry a client_id) never count as team.

create table if not exists public.team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 200),
  added_at timestamptz not null default now()
);

alter table public.team_members enable row level security;
revoke all on public.team_members from public, anon, authenticated;
grant select on public.team_members to authenticated;

drop policy if exists "people see their own team row" on public.team_members;
create policy "people see their own team row" on public.team_members
  for select to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'client_id') is null);

-- True when the caller is on the team list. The live data function (functions/live/) calls
-- it with the person's own token; it reads only the caller's row.
create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'client_id') is null, false)
     and exists (select 1 from public.team_members t where t.user_id = (select auth.uid()));
$$;

revoke all on function public.is_team() from public, anon;
grant execute on function public.is_team() to authenticated;
