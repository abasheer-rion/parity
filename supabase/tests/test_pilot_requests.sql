-- Checks for 20261116000000_pilot_requests.sql (DEC-0087), run by supabase/tests/local.sh after
-- every migration is applied. Each check raises an exception when a rule does not hold. Runs
-- in one transaction that is rolled back.

\o /dev/null
set client_min_messages = notice;
begin;

insert into auth.users (id, email) values
  ('41111111-1111-1111-1111-111111111111', 'team@example.com'),
  ('42222222-2222-2222-2222-222222222222', 'other@example.com');
insert into public.team_members (user_id, note) values ('41111111-1111-1111-1111-111111111111', 'test');

create function pg_temp.pr_check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.pr_refused(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when insufficient_privilege then
  return true;
end $$;
-- True when the statement is stopped by the rate limit.
create function pg_temp.pr_limited(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when raise_exception then
  return sqlerrm = 'rate_limited';
end $$;
create function pg_temp.pr_anon(ip text) returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('request.headers', json_build_object('x-forwarded-for', ip || ', 10.0.0.1')::text, true);
  select set_config('role', 'anon', true);
$$;
create function pg_temp.pr_as(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- Signed out: a request goes in, and nothing can be read back, changed or removed.
select pg_temp.pr_anon('203.0.113.7');
insert into public.pilot_requests (id, kind, firm, name, email, accounts_per_month, message, page)
  values ('51111111-1111-1111-1111-111111111111', 'prop_firm', 'Example Funding', 'Ana Ruiz', ' Ana@Example.COM ', '100_1000', 'Hello', '/business/prop-firms/');
select pg_temp.pr_check(true, 'signed out: a request can be added');
select pg_temp.pr_check(pg_temp.pr_refused('select count(*) from public.pilot_requests'), 'signed out: no read');
select pg_temp.pr_check(pg_temp.pr_refused($$update public.pilot_requests set firm = 'x'$$), 'signed out: no update');
select pg_temp.pr_check(pg_temp.pr_refused('delete from public.pilot_requests'), 'signed out: no delete');
select pg_temp.pr_check(pg_temp.pr_refused($$insert into public.pilot_requests (firm, name, email, accounts_per_month, notified_at) values ('a', 'b', 'c@d.ef', 'under_100', now())$$), 'the client cannot set notified_at');
select pg_temp.pr_check(pg_temp.pr_refused($$insert into public.pilot_requests (firm, name, email, accounts_per_month, ip_hash) values ('a', 'b', 'c@d.ef', 'under_100', 'x')$$), 'the client cannot set ip_hash');
select pg_temp.pr_check(pg_temp.pr_refused('select * from parity_private.pilot_request_salt'), 'nobody reads the salt');

-- The rate limit: three an hour from one address, the fourth is refused.
insert into public.pilot_requests (firm, name, email, accounts_per_month) values ('Firm 2', 'B', 'b@example.com', 'under_100');
insert into public.pilot_requests (firm, name, email, accounts_per_month) values ('Firm 3', 'C', 'c@example.com', 'under_100');
select pg_temp.pr_check(pg_temp.pr_limited($$insert into public.pilot_requests (firm, name, email, accounts_per_month) values ('Firm 4', 'D', 'd@example.com', 'under_100')$$), 'a fourth request in an hour from one address is refused');
select pg_temp.pr_anon('198.51.100.9');
insert into public.pilot_requests (firm, name, email, accounts_per_month) values ('Firm 5', 'E', 'e@example.com', 'over_10000');
select pg_temp.pr_check(true, 'another address can still ask');

-- Claiming for the email: once only.
select pg_temp.pr_check((select count(*) from public.claim_pilot_request('51111111-1111-1111-1111-111111111111')) = 1, 'the email function claims a new request');
select pg_temp.pr_check((select count(*) from public.claim_pilot_request('51111111-1111-1111-1111-111111111111')) = 0, 'a request is claimed only once');
select pg_temp.pr_check((select count(*) from public.claim_pilot_request('59999999-9999-9999-9999-999999999999')) = 0, 'an unknown id claims nothing');

-- Signed in but not on the team: nothing to read. On the team: every request.
select pg_temp.pr_as('42222222-2222-2222-2222-222222222222');
select pg_temp.pr_check((select count(*) from public.pilot_requests) = 0, 'someone not on the team reads nothing');
select pg_temp.pr_as('41111111-1111-1111-1111-111111111111');
select pg_temp.pr_check((select count(*) from public.pilot_requests) = 4, 'the team reads every request');
select pg_temp.pr_check((select email from public.pilot_requests where id = '51111111-1111-1111-1111-111111111111') = 'ana@example.com', 'the email is trimmed and lower case');
select pg_temp.pr_check((select notified_at is not null from public.pilot_requests where id = '51111111-1111-1111-1111-111111111111'), 'a claimed request is marked told');
select pg_temp.pr_check((select bool_and(ip_hash ~ '^[0-9a-f]{64}$') from public.pilot_requests), 'addresses are kept only as hashes');
select pg_temp.pr_check(pg_temp.pr_refused($$update public.pilot_requests set firm = 'x'$$), 'the team cannot change a request through the API');

rollback;
\o
\echo pilot_requests: all checks passed
