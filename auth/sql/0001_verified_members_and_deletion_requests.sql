-- Parity auth: database changes for in-app sign-in. NOT applied yet.
--
-- This file is kept out of supabase/migrations on purpose: anything in that folder is
-- applied to the live database when it reaches main (.github/workflows/db-migrate.yml).
-- When the owner switches in-app sign-in on, copy it to
-- supabase/migrations/<timestamp>_auth_verified_members.sql and merge. See auth/README.md.

-- 1. Only a confirmed email counts as a team member.
--    The JWT carries the email but not whether it was confirmed, so look it up.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join auth.users u on lower(u.email) = m.email
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- 2. "Delete my account" requests. A signed-in person can file one for themselves and
--    see it; only the owner (service role) acts on it and deletes the account.
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  reason text check (char_length(reason) <= 1000),
  requested_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

create policy "people file their own deletion request" on public.account_deletion_requests
  for insert to authenticated
  with check (user_id = auth.uid() and email = (auth.jwt() ->> 'email'));

create policy "people see their own deletion request" on public.account_deletion_requests
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.account_deletion_requests from anon;
grant select, insert on public.account_deletion_requests to authenticated;
