-- Check of 20261106000000_onboarding.sql (DEC-0060): row rules for the checklist, tours and
-- crypto wallets. Run it with supabase/tests/local.sh, which applies every migration to a
-- throwaway local Postgres and runs every test_*.sql. Never applied to the hosted project.
--
-- Every check raises an error when it fails, so the script stops at the first broken rule and
-- prints "onboarding rls: all checks passed" at the end.

\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@x'),
  ('22222222-2222-2222-2222-222222222222', 'b@x')
on conflict do nothing;

create or replace function pg_temp.as_user(sub text, client text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, true); $$;
create or replace function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end; $$;
create or replace function pg_temp.refused(stmt text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok: % (refused: %)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % was allowed', what;
end; $$;

set local role authenticated;

-- 1. A person writes and reads their own state ------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', null);
insert into public.onboarding_state (tours_seen, verify_at) values ('{home}', now());
select pg_temp.expect((select count(*) = 1 from public.onboarding_state), 'A sees own row');
select pg_temp.expect((select user_id = '11111111-1111-1111-1111-111111111111' from public.onboarding_state), 'user_id defaults to the caller');

-- 2. Done times are never cleared, never moved later, never in the future --------------------
update public.onboarding_state set verify_at = null, trade_at = now() + interval '1 day';
select pg_temp.expect((select verify_at is not null from public.onboarding_state), 'verify_at not cleared');
select pg_temp.expect((select trade_at <= now() from public.onboarding_state), 'future trade_at clamped to now');
update public.onboarding_state set verify_at = now() + interval '1 hour';
select pg_temp.expect((select verify_at <= now() from public.onboarding_state), 'verify_at not moved later');

-- 3. Tours can be reset, and the shape check holds -------------------------------------------
update public.onboarding_state set tours_seen = '{}', tours_off = false;
select pg_temp.expect((select cardinality(tours_seen) = 0 from public.onboarding_state), 'tours reset');
select pg_temp.refused($$update public.onboarding_state set tours_seen = '{"Bad Name"}'$$, 'bad tour name');
select pg_temp.refused($$update public.onboarding_state set tours_seen = array[null]::text[]$$, 'null tour name');
select pg_temp.refused($$update public.onboarding_state set tours_seen = (select array_agg('t' || g) from generate_series(1, 41) g)$$, '41 tour names');

-- 4. The row cannot move to another person, and nobody writes another person's row ------------
update public.onboarding_state set user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect((select count(*) = 1 from public.onboarding_state where user_id = '11111111-1111-1111-1111-111111111111'), 'row stays with A');
select pg_temp.refused($$insert into public.onboarding_state (user_id) values ('22222222-2222-2222-2222-222222222222')$$, 'A inserts a row for B');

select pg_temp.as_user('22222222-2222-2222-2222-222222222222', null);
select pg_temp.expect((select count(*) = 0 from public.onboarding_state), 'B sees none of A''s rows');
update public.onboarding_state set checklist_hidden = true;
delete from public.onboarding_state;
reset role;
select pg_temp.expect((select count(*) = 1 and not bool_or(checklist_hidden) from public.onboarding_state), 'B changed and deleted nothing of A''s');
set local role authenticated;

-- 5. Connected AI apps read but never write --------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'c1');
select pg_temp.expect((select count(*) = 1 from public.onboarding_state), 'app token reads own row');
select pg_temp.refused($$insert into public.crypto_wallets (chain, address) values ('ethereum', '0x0000000000000000000000000000000000000001')$$, 'app token adds a wallet');
update public.onboarding_state set checklist_hidden = true;
reset role;
select pg_temp.expect((select not checklist_hidden from public.onboarding_state where user_id = '11111111-1111-1111-1111-111111111111'), 'app token update changed nothing');
set local role authenticated;

-- 6. Wallets: own rows, no verified_at from the browser, shape checks, cap -------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', null);
insert into public.crypto_wallets (chain, address, verified_at) values ('ethereum', '0xAbCdEf0000000000000000000000000000000001', now());
select pg_temp.expect((select verified_at is null from public.crypto_wallets), 'browser cannot set verified_at');
select pg_temp.expect((select address = '0xabcdef0000000000000000000000000000000001' from public.crypto_wallets), 'ethereum address folded to lower case');
select pg_temp.refused($$update public.crypto_wallets set verified_at = now()$$, 'browser updates a wallet');
select pg_temp.refused($$insert into public.crypto_wallets (chain, address) values ('ethereum', '0x123')$$, 'short ethereum address');
select pg_temp.refused($$insert into public.crypto_wallets (chain, address) values ('solana', '0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl')$$, 'non-base58 solana address');
select pg_temp.refused($$insert into public.crypto_wallets (chain, address) values ('bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')$$, 'unknown chain');
insert into public.crypto_wallets (chain, address) values ('solana', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
select pg_temp.refused($$insert into public.crypto_wallets (chain, address) values ('solana', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')$$, 'same wallet twice');
insert into public.crypto_wallets (chain, address)
  select 'ethereum', '0x' || lpad(to_hex(g), 40, '0') from generate_series(100, 107) g;
select pg_temp.refused($$insert into public.crypto_wallets (chain, address) values ('ethereum', '0x00000000000000000000000000000000000000ff')$$, 'eleventh wallet');
select pg_temp.refused($$insert into public.crypto_wallets (user_id, chain, address) values ('22222222-2222-2222-2222-222222222222', 'ethereum', '0x00000000000000000000000000000000000000fe')$$, 'A adds a wallet for B');

select pg_temp.as_user('22222222-2222-2222-2222-222222222222', null);
select pg_temp.expect((select count(*) = 0 from public.crypto_wallets), 'B sees none of A''s wallets');
delete from public.crypto_wallets;
reset role;
select pg_temp.expect((select count(*) = 10 from public.crypto_wallets), 'B deleted none of A''s wallets');

-- 7. The service role marks a wallet verified, and cannot move it ----------------------------
set local role service_role;
-- The server's save of an existing wallet works at the cap of 10 (insert on conflict).
insert into public.crypto_wallets (user_id, chain, address, verified_at)
values ('11111111-1111-1111-1111-111111111111', 'solana', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', now())
on conflict (user_id, chain, address) do update set verified_at = excluded.verified_at;
reset role;
select pg_temp.expect((select verified_at is not null from public.crypto_wallets where chain = 'solana'), 'server verifies a wallet when the person is at 10');
set local role service_role;
update public.crypto_wallets set verified_at = now(), address = '0x00000000000000000000000000000000000000aa'
 where address = '0xabcdef0000000000000000000000000000000001';
reset role;
select pg_temp.expect((select verified_at is not null from public.crypto_wallets where address = '0xabcdef0000000000000000000000000000000001'), 'service role sets verified_at, address kept');

-- 8. Signed-out visitors get nothing ---------------------------------------------------------
set local role anon;
select pg_temp.refused($$select count(*) from public.onboarding_state$$, 'anon reads onboarding_state');
select pg_temp.refused($$select count(*) from public.crypto_wallets$$, 'anon reads crypto_wallets');
reset role;

rollback;
\echo onboarding rls: all checks passed
