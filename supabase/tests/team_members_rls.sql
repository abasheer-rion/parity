-- Manual check of 20261102000000_team_members.sql (DEC-0056): the team list. Not run by CI.
-- Load Supabase stand-ins, apply every migration, then: psql -f supabase/tests/team_members_rls.sql
-- Each == heading says what to expect. ON_ERROR_STOP is off so refusals print and the run goes on.
\set ON_ERROR_STOP 0
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'team@x'), ('22222222-2222-2222-2222-222222222222', 'other@x') on conflict do nothing;
insert into public.team_members (user_id, note) values ('11111111-1111-1111-1111-111111111111', 'test') on conflict do nothing;
create or replace function pg_temp.as_user(sub text, client text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, false); $$;

set role authenticated;
\echo == 1 team member: is_team true, sees own row (expect t, 1)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', null);
select public.is_team();
select count(*) from public.team_members;
\echo == 2 other person: is_team false, sees no rows (expect f, 0)
select pg_temp.as_user('22222222-2222-2222-2222-222222222222', null);
select public.is_team();
select count(*) from public.team_members;
\echo == 3 AI app token of a team member: not team, no rows (expect f, 0)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'c1');
select public.is_team();
select count(*) from public.team_members;
\echo == 4 signed-in people cannot add, change or remove rows (expect 3 permission errors)
select pg_temp.as_user('22222222-2222-2222-2222-222222222222', null);
insert into public.team_members (user_id) values ('22222222-2222-2222-2222-222222222222');
update public.team_members set note = 'x';
delete from public.team_members;
reset role;
set role anon;
\echo == 5 signed out: no read, no is_team (expect 2 permission errors)
select count(*) from public.team_members;
select public.is_team();
reset role;
\echo == 6 the owner still sees the one row (expect 1)
select count(*) from public.team_members;
