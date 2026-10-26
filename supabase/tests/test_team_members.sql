-- Checks for 20261105000000_team_members.sql (DEC-0056), run by supabase/tests/local.sh after
-- every migration is applied. Each check raises an exception when a rule does not hold. Runs
-- in one transaction that is rolled back.

\o /dev/null
set client_min_messages = notice;
begin;

insert into auth.users (id, email) values
  ('31111111-1111-1111-1111-111111111111', 'team@example.com'),
  ('32222222-2222-2222-2222-222222222222', 'other@example.com');
insert into public.team_members (user_id, note) values ('31111111-1111-1111-1111-111111111111', 'test');

create function pg_temp.tm_as(sub text, client text default null) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.tm_check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
-- True when the statement is refused for lack of rights.
create function pg_temp.tm_refused(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when insufficient_privilege then
  return true;
end $$;

select pg_temp.tm_as('31111111-1111-1111-1111-111111111111');
select pg_temp.tm_check(public.is_team(), 'a team member is on the team');
select pg_temp.tm_check((select count(*) from public.team_members) = 1, 'a team member sees their own row');

select pg_temp.tm_as('32222222-2222-2222-2222-222222222222');
select pg_temp.tm_check(not public.is_team(), 'someone else is not on the team');
select pg_temp.tm_check((select count(*) from public.team_members) = 0, 'someone else sees no rows');
select pg_temp.tm_check(pg_temp.tm_refused($$insert into public.team_members (user_id) values ('32222222-2222-2222-2222-222222222222')$$), 'nobody adds themselves');
select pg_temp.tm_check(pg_temp.tm_refused($$update public.team_members set note = 'x'$$), 'nobody changes a row');
select pg_temp.tm_check(pg_temp.tm_refused($$delete from public.team_members$$), 'nobody removes a row');

select pg_temp.tm_as('31111111-1111-1111-1111-111111111111', 'some-ai-app');
select pg_temp.tm_check(not public.is_team(), 'an AI app token of a team member is not team');
select pg_temp.tm_check((select count(*) from public.team_members) = 0, 'an AI app token sees no rows');

select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '', true);
select pg_temp.tm_check(pg_temp.tm_refused('select count(*) from public.team_members'), 'signed out: no read');
select pg_temp.tm_check(pg_temp.tm_refused('select public.is_team()'), 'signed out: no is_team');

rollback;
\o
\echo team_members: all checks passed
