-- Checks for 20261117100000_broker_connections.sql (DEC-0091), run by supabase/tests/local.sh
-- after every migration is applied. Each check raises an exception when a rule does not hold.
-- Runs in one transaction that is rolled back.

\o /dev/null
set client_min_messages = notice;
begin;

insert into auth.users (id, email) values
  ('51111111-1111-1111-1111-111111111111', 'broker-a@example.com'),
  ('52222222-2222-2222-2222-222222222222', 'broker-b@example.com');

create function pg_temp.bc_as(sub text, client text default null) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.bc_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'anon', true);
$$;
create function pg_temp.bc_check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.bc_refused(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when insufficient_privilege or invalid_parameter_value or check_violation or raise_exception or unique_violation then
  return true;
end $$;
-- A proof shaped like the server's: header.claims.signature, claims as base64url JSON. The
-- signature is not checked by the database (the page and the badge functions check it).
create function pg_temp.bc_proof(uid text, jti text, iat bigint default extract(epoch from now())::bigint) returns text language sql as $$
  select 'eyJhbGciOiJFZERTQSJ9.' || rtrim(translate(replace(encode(convert_to(json_build_object(
    'v', 1, 'jti', jti, 'iat', iat, 'venue', 'kraken', 'env', 'live', 'account', 'acct_AbCdEfGhIjKlMnOp',
    'fetched_at', '2026-11-03T12:00:00Z', 'own', encode(extensions.digest(convert_to(uid || ':' || jti, 'UTF8'), 'sha256'), 'hex'))::text, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=')
    || '.' || repeat('A', 86);
$$;
grant execute on function pg_temp.bc_proof(text, text, bigint) to authenticated;

-- ---------------------------------------------------------------- reads, the log and limits

select pg_temp.bc_as('51111111-1111-1111-1111-111111111111');
select pg_temp.bc_check(public.broker_fetch_begin('kraken') > 0, 'a signed-in person can start a read');
select public.broker_event_log('kraken', 'fetched', '40 trades, 2026-01-01 to 2026-01-31');
select pg_temp.bc_check((select count(*) from public.broker_events) = 2, 'the person sees their own log');
select pg_temp.bc_check(pg_temp.bc_refused($q$select public.broker_event_log('kraken', 'synced', 'x')$q$), 'only fetched, refused and failed can be logged directly');
select pg_temp.bc_check(pg_temp.bc_refused('delete from public.broker_events'), 'the log cannot be deleted from');
select pg_temp.bc_check(pg_temp.bc_refused('update public.broker_events set detail = null'), 'the log cannot be changed');
select pg_temp.bc_check(pg_temp.bc_refused($q$insert into public.broker_events (user_id, venue, event) values ('51111111-1111-1111-1111-111111111111', 'kraken', 'fetched')$q$), 'no direct inserts into the log');
select public.broker_fetch_begin('kraken') from generate_series(1, 9);
select pg_temp.bc_check(pg_temp.bc_refused($q$select public.broker_fetch_begin('kraken')$q$), 'the 11th read in an hour is refused');

-- ---------------------------------------------------------------- kept connections

select pg_temp.bc_check((select count(*) from public.broker_data_key_get()) = 0, 'no data key yet');
select pg_temp.bc_check((select key_id from public.broker_data_key_put('v1.AAAAAAAAAAAAAAAA.' || repeat('B', 60), 'kid00001')) = 'kid00001', 'a data key is stored');
select pg_temp.bc_check((select sealed from public.broker_data_key_put('v1.CCCCCCCCCCCCCCCC.' || repeat('D', 60), 'kid00001')) like 'v1.AAAA%', 'a second save under the same secret keeps the first');
select pg_temp.bc_check((select key_id from public.broker_data_key_put('v1.EEEEEEEEEEEEEEEE.' || repeat('F', 60), 'kid00002')) = 'kid00002', 'a new secret replaces the old data key');
select pg_temp.bc_check(pg_temp.bc_refused('select * from public.broker_data_keys'), 'nobody reads data keys directly');

select public.broker_connection_save('a1111111-1111-4111-8111-111111111111', 'kraken', 'live', 'Main account', 'acct_AbCdEfGhIjKlMnOp', 'v1.GGGGGGGGGGGGGGGG.' || repeat('H', 80), 'kid00002');
select pg_temp.bc_check((select count(*) from public.broker_connections) = 1, 'the owner sees the connection');
select pg_temp.bc_check(pg_temp.bc_refused('select sealed from public.broker_connections'), 'nobody reads a sealed credential directly');
select pg_temp.bc_check(pg_temp.bc_refused($q$insert into public.broker_connections (id, user_id, venue, env, label) values (gen_random_uuid(), '51111111-1111-1111-1111-111111111111', 'kraken', 'live', 'x')$q$), 'no direct inserts');
select pg_temp.bc_check((select sealed from public.broker_connection_open('a1111111-1111-4111-8111-111111111111')) like 'v1.GGGG%', 'the owner session can fetch the sealed value for the server');
select pg_temp.bc_check((select count(*) from public.broker_events where event in ('saved', 'opened')) = 2, 'saving and opening are logged');
select public.broker_connection_synced('a1111111-1111-4111-8111-111111111111', true, '12 trades');
select pg_temp.bc_check((select last_synced_at is not null and last_result = '12 trades' from public.broker_connections), 'a sync is stamped');

-- Another person sees nothing and can do nothing to it.
select pg_temp.bc_as('52222222-2222-2222-2222-222222222222');
select pg_temp.bc_check((select count(*) from public.broker_connections) = 0, 'another person sees no connections');
select pg_temp.bc_check((select count(*) from public.broker_events) = 0, 'another person sees no log');
select pg_temp.bc_check((select count(*) from public.broker_connection_open('a1111111-1111-4111-8111-111111111111')) = 0, 'another person cannot open it');
select pg_temp.bc_check(public.broker_connection_revoke('a1111111-1111-4111-8111-111111111111') = false, 'another person cannot revoke it');
select pg_temp.bc_check(pg_temp.bc_refused($q$select public.broker_fetch_begin('kraken', 'a1111111-1111-4111-8111-111111111111')$q$), 'another person cannot read through it');

-- A connected AI app acting for the owner can do none of it.
select pg_temp.bc_as('51111111-1111-1111-1111-111111111111', 'some-ai-app');
select pg_temp.bc_check(pg_temp.bc_refused($q$select public.broker_fetch_begin('kraken')$q$), 'an AI app token cannot read from brokers');
select pg_temp.bc_check(pg_temp.bc_refused($q$select * from public.broker_connection_open('a1111111-1111-4111-8111-111111111111')$q$), 'an AI app token cannot open a kept connection');
select pg_temp.bc_check((select count(*) from public.broker_connections) = 0, 'an AI app token sees no connections');

-- Signed out: nothing.
select pg_temp.bc_anon();
select pg_temp.bc_check(pg_temp.bc_refused($q$select public.broker_fetch_begin('kraken')$q$), 'signed out: no reads');
select pg_temp.bc_check(pg_temp.bc_refused('select count(*) from public.broker_events'), 'signed out: no log');

-- Revoking deletes the sealed value and keeps the row and the log.
select pg_temp.bc_as('51111111-1111-1111-1111-111111111111');
select pg_temp.bc_check(public.broker_connection_revoke('a1111111-1111-4111-8111-111111111111') = true, 'the owner can revoke');
select pg_temp.bc_check(public.broker_connection_revoke('a1111111-1111-4111-8111-111111111111') = false, 'revoking twice is a no-op');
select pg_temp.bc_check((select count(*) from public.broker_connection_open('a1111111-1111-4111-8111-111111111111')) = 0, 'a revoked connection cannot be opened');
reset role;
select pg_temp.bc_check((select sealed is null and key_id is null and revoked_at is not null from public.broker_connections), 'revoking deleted the sealed credential');
select pg_temp.bc_check((select count(*) from public.broker_events where event = 'revoked') = 1, 'revoking is logged');

-- ---------------------------------------------------------------- broker-connected badges

select pg_temp.bc_as('51111111-1111-1111-1111-111111111111');
insert into public.verify_badges (id, name, input_kind, stated_tries, trade_count, verdict, survives_tries, cards, method_version, file_sha256, attestation, broker_venue)
  values ('BrokerBadge1', 'Kraken bot', 'real', 3, 40, 'could_be_luck', 2, '{}', 'verify-1.1', repeat('a', 64),
          pg_temp.bc_proof('51111111-1111-1111-1111-111111111111', 'AAAAAAAAAAAAAAAAAAAAA1'), 'binance');
select pg_temp.bc_check((select broker_venue = 'kraken' and broker_account = 'acct_AbCdEfGhIjKlMnOp' and attestation_id = 'AAAAAAAAAAAAAAAAAAAAA1' from public.verify_badges where id = 'BrokerBadge1'),
  'the venue and account come from the proof, not from the browser');
select pg_temp.bc_check(pg_temp.bc_refused($q$insert into public.verify_badges (id, name, input_kind, stated_tries, verdict, cards, method_version, file_sha256, attestation)
  values ('BrokerBadge2', 'Again', 'real', 3, 'could_be_luck', '{}', 'verify-1.1', repeat('a', 64), pg_temp.bc_proof('51111111-1111-1111-1111-111111111111', 'AAAAAAAAAAAAAAAAAAAAA1'))$q$),
  'one proof makes one badge');
select pg_temp.bc_check(pg_temp.bc_refused($q$insert into public.verify_badges (id, name, input_kind, stated_tries, verdict, cards, method_version, file_sha256, attestation)
  values ('BrokerBadge3', 'Old', 'real', 3, 'could_be_luck', '{}', 'verify-1.1', repeat('a', 64), pg_temp.bc_proof('51111111-1111-1111-1111-111111111111', 'AAAAAAAAAAAAAAAAAAAAA3', extract(epoch from now() - interval '8 days')::bigint))$q$),
  'a proof older than 7 days is refused');
insert into public.verify_badges (id, name, input_kind, stated_tries, verdict, cards, method_version, file_sha256, broker_venue, broker_account)
  values ('PlainBadge01', 'Upload', 'backtest', 1, 'not_enough_data', '{}', 'verify-1.1', repeat('b', 64), 'kraken', 'acct_AbCdEfGhIjKlMnOp');
select pg_temp.bc_check((select broker_venue is null and broker_account is null from public.verify_badges where id = 'PlainBadge01'), 'without a proof the browser cannot set a venue');

-- Someone else's proof does not work for you.
select pg_temp.bc_as('52222222-2222-2222-2222-222222222222');
select pg_temp.bc_check(pg_temp.bc_refused($q$insert into public.verify_badges (id, name, input_kind, stated_tries, verdict, cards, method_version, file_sha256, attestation)
  values ('BrokerBadge4', 'Copied', 'real', 3, 'could_be_luck', '{}', 'verify-1.1', repeat('a', 64), pg_temp.bc_proof('51111111-1111-1111-1111-111111111111', 'AAAAAAAAAAAAAAAAAAAAA4'))$q$),
  'a proof made for someone else is refused');

-- The public read has the proof; withdrawing deletes it and keeps where the record came from.
select pg_temp.bc_anon();
select pg_temp.bc_check((select attestation is not null and broker_venue = 'kraken' from public.verify_badge_public('BrokerBadge1')), 'the public read carries the proof and the venue');
select pg_temp.bc_as('51111111-1111-1111-1111-111111111111');
update public.verify_badges set withdrawn_at = now() where id = 'BrokerBadge1';
select pg_temp.bc_anon();
select pg_temp.bc_check((select withdrawn_at is not null and attestation is null and verdict is null and broker_venue = 'kraken' and broker_account = 'acct_AbCdEfGhIjKlMnOp'
  from public.verify_badge_public('BrokerBadge1')), 'a withdrawn badge loses its proof and numbers but still says which venue and account');

-- Account deletion removes the broker rows.
reset role;
select public.delete_account_data('51111111-1111-1111-1111-111111111111', false);
select pg_temp.bc_check((select count(*) from public.broker_events where user_id = '51111111-1111-1111-1111-111111111111') = 0, 'deleting an account removes its broker log');
select pg_temp.bc_check((select count(*) from public.broker_connections where user_id = '51111111-1111-1111-1111-111111111111') = 0, 'deleting an account removes its kept connections');
select pg_temp.bc_check((select count(*) from public.broker_data_keys where user_id = '51111111-1111-1111-1111-111111111111') = 0, 'deleting an account removes its data key');

rollback;
\o
\echo broker_connections: all checks passed
