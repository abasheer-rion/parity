-- Checks for 20261109000000_api_keys.sql (DEC-0071), run by supabase/tests/local.sh after
-- every migration is applied. Each check raises an exception when a rule does not hold. Runs
-- in one transaction that is rolled back.

\o /dev/null
set client_min_messages = notice;
begin;

insert into auth.users (id, email) values
  ('41111111-1111-1111-1111-111111111111', 'keys-a@example.com'),
  ('42222222-2222-2222-2222-222222222222', 'keys-b@example.com');

create function pg_temp.ak_as(sub text, client text default null) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.ak_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'anon', true);
$$;
create function pg_temp.ak_check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.ak_refused(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when insufficient_privilege or invalid_parameter_value or check_violation or raise_exception then
  return true;
end $$;

-- A makes a key.
select pg_temp.ak_as('41111111-1111-1111-1111-111111111111');
select pg_temp.ak_check(
  (public.api_key_create('build server', array['read:markets', 'read:strategies'], 90, 'pk_test_', 'Ab12', repeat('a', 64), array['203.0.113.7', '2001:db8::/32']) ->> 'id') is not null,
  'a signed-in person can make a key');
select pg_temp.ak_check((select count(*) from public.api_keys) = 1, 'the maker sees the key');
select pg_temp.ak_check((select expires_at::date from public.api_keys) = (now() + interval '90 days')::date, 'default expiry is the asked 90 days');
select pg_temp.ak_check((select ip_allowlist from public.api_keys)::text[] = array['203.0.113.7/32', '2001:db8::/32'], 'the allowlist is stored as ranges');
select pg_temp.ak_check(pg_temp.ak_refused('select key_hash from public.api_keys'), 'nobody can read a key hash back');
select pg_temp.ak_check(pg_temp.ak_refused('insert into public.api_keys (user_id, name, prefix, last4, key_hash, scopes, expires_at) values (''41111111-1111-1111-1111-111111111111'', ''x'', ''pk_test_'', ''abcd'', repeat(''b'', 64), array[''read:markets''], now() + interval ''1 day'')'), 'no direct inserts');
select pg_temp.ak_check(pg_temp.ak_refused('update public.api_keys set revoked_at = null'), 'no direct updates');
select pg_temp.ak_check(pg_temp.ak_refused('delete from public.api_key_events'), 'the audit log cannot be deleted from');
select pg_temp.ak_check((select count(*) from public.api_key_events where event = 'created') = 1, 'making a key is in the audit log');
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_create('x', array['admin:all'], 90, 'pk_test_', 'Ab12', repeat('c', 64))$q$), 'unknown scopes are refused');
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_create('x', array['read:markets'], 400, 'pk_test_', 'Ab12', repeat('c', 64))$q$), 'expiry over a year is refused');
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_create('x', array['read:markets'], 90, 'pk_live_', 'Ab12', repeat('c', 64))$q$), 'live keys are not issued yet');
select pg_temp.ak_check(pg_temp.ak_refused('select public.api_key_lookup(repeat(''a'', 64))') = false, 'a signed-in person may call lookup (it needs the HMAC)');

-- A connected AI app acting for A cannot manage keys.
select pg_temp.ak_as('41111111-1111-1111-1111-111111111111', 'some-ai-app');
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_create('app', array['read:markets'], 90, 'pk_test_', 'Ab12', repeat('d', 64))$q$), 'an AI app token cannot make keys');
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_revoke((select id from public.api_keys limit 1))$q$), 'an AI app token cannot revoke keys');

-- B sees nothing of A's and cannot revoke or rotate A's key.
select pg_temp.ak_as('42222222-2222-2222-2222-222222222222');
select pg_temp.ak_check((select count(*) from public.api_keys) = 0, 'another person sees no keys');
select pg_temp.ak_check((select count(*) from public.api_key_events) = 0, 'another person sees no key events');
reset role;
create temp table ak_ids as select id from public.api_keys;
grant select on ak_ids to authenticated, anon;
select pg_temp.ak_as('42222222-2222-2222-2222-222222222222');
select pg_temp.ak_check(public.api_key_revoke((select id from ak_ids)) = false, 'another person cannot revoke the key');
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_rotate((select id from ak_ids), 'Zz99', repeat('e', 64), 24)$q$), 'another person cannot rotate the key');

-- Signed out: only the three server calls, which need the HMAC.
select pg_temp.ak_anon();
select pg_temp.ak_check(pg_temp.ak_refused('select count(*) from public.api_keys'), 'signed out: no reading keys');
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_create('x', array['read:markets'], 90, 'pk_test_', 'Ab12', repeat('f', 64))$q$), 'signed out: no making keys');
select pg_temp.ak_check(pg_temp.ak_refused('select public.api_key_plan(''41111111-1111-1111-1111-111111111111'')'), 'signed out: no plan lookups by user id');
select pg_temp.ak_check(public.api_key_lookup(repeat('9', 64)) is null, 'an unknown HMAC finds nothing');
select pg_temp.ak_check(public.api_key_lookup('not-a-hash') is null, 'a malformed HMAC finds nothing');
select pg_temp.ak_check((public.api_key_lookup(repeat('a', 64)) ->> 'plan') = 'free', 'the lookup returns the plan');
select pg_temp.ak_check((public.api_key_lookup(repeat('a', 64)) -> 'scopes') = '["read:markets", "read:strategies"]'::jsonb, 'the lookup returns the scopes');
select public.api_key_record(repeat('a', 64), 7, 2, '[{"at": "2026-10-26T10:00:00Z", "method": "GET", "path": "/api/v1/strategies", "status": 200, "ms": 12}, {"method": "DROP", "path": "x"}]'::jsonb);
select public.api_key_record(repeat('a', 64), 3, 0, '[]'::jsonb);
select pg_temp.ak_check((public.api_key_lookup(repeat('a', 64)) ->> 'used_today')::int = 10, 'usage adds up across flushes');

reset role;
select pg_temp.ak_check((select count(*) from public.api_request_log) = 1, 'a malformed log line is dropped, the good one kept');
select pg_temp.ak_check((select last_used_at is not null from public.api_keys where key_hash = repeat('a', 64)), 'last used is stamped');
insert into public.payment_entitlements (user_id, feature) values ('41111111-1111-1111-1111-111111111111', 'api_access');
select pg_temp.ak_anon();
select pg_temp.ak_check((public.api_key_lookup(repeat('a', 64)) ->> 'plan') = 'api_starter', 'an api_access entitlement means API Starter');

-- Rotation keeps the old key for the overlap; revocation and leaks.
select pg_temp.ak_as('41111111-1111-1111-1111-111111111111');
select pg_temp.ak_check((public.api_key_rotate((select id from ak_ids), 'Rt01', repeat('b', 64), 1) ->> 'id') is not null, 'the owner can rotate');
select pg_temp.ak_check((select expires_at < now() + interval '2 hours' from public.api_keys where id = (select id from ak_ids)), 'the old key expires after the overlap');
select pg_temp.ak_check((select scopes from public.api_keys where last4 = 'Rt01') = array['read:markets', 'read:strategies'], 'the new key keeps the scopes');
select pg_temp.ak_check((select rotated_from from public.api_keys where last4 = 'Rt01') = (select id from ak_ids), 'the new key points at the old one');
select pg_temp.ak_check(public.api_key_revoke((select id from public.api_keys where last4 = 'Rt01')) = true, 'the owner can revoke');
select pg_temp.ak_check(public.api_key_revoke((select id from public.api_keys where last4 = 'Rt01')) = false, 'revoking twice is a no-op');
select pg_temp.ak_anon();
select pg_temp.ak_check((public.api_key_lookup(repeat('b', 64)) ->> 'revoked_at') is not null, 'a revoked key looks revoked');
select pg_temp.ak_check(public.api_key_revoke_leaked(repeat('a', 64), 'github https://example.com/x') = true, 'a leaked key is revoked');
select pg_temp.ak_check(public.api_key_revoke_leaked(repeat('8', 64), 'github') = false, 'an unknown leaked key is not');
reset role;
select pg_temp.ak_check((select revoked_reason from public.api_keys where key_hash = repeat('a', 64)) = 'leaked', 'the reason says leaked');
select pg_temp.ak_check((select count(*) from public.api_key_events where event in ('rotated', 'revoked', 'leaked')) = 3, 'rotate, revoke and leak are in the audit log');

-- Ten active keys at most.
select pg_temp.ak_as('42222222-2222-2222-2222-222222222222');
select public.api_key_create('k' || n, array['read:markets'], 30, 'pk_test_', 'Ab12', lpad(to_hex(n), 64, '0')) from generate_series(1, 10) n;
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_create('k11', array['read:markets'], 30, 'pk_test_', 'Ab12', repeat('7', 64))$q$), 'an eleventh active key is refused');
select pg_temp.ak_check((public.api_key_rotate((select id from public.api_keys where name = 'k1'), 'Rk01', repeat('6', 64), 168) ->> 'id') is not null, 'at the cap, one key can still be rotated with an overlap');
select pg_temp.ak_check(pg_temp.ak_refused($q$select public.api_key_rotate((select id from public.api_keys where name = 'k2'), 'Rk02', repeat('5', 64), 168)$q$), 'rotating cannot be chained past the cap');

rollback;
\o
\echo api_keys: all checks passed
