-- Read-only broker connections and broker-connected badges (DEC-0091). Additive only: new
-- tables and functions, new columns on verify_badges, and the badge triggers re-created with
-- the new columns handled.
--
-- broker_events       the log of every read and every change to a kept connection: fetch,
--                     fetched, refused, failed, saved, opened, synced, sync_failed, revoked.
--                     Append-only. The owner reads their own rows. No credential is ever in it.
-- broker_connections  "keep in sync" connections. Off by default: a credential is used once
--                     and dropped, and nothing is stored but the log row. When the person
--                     ticks "keep in sync", the credential is stored SEALED (AES-GCM, under
--                     the person's data key, which is itself sealed with a key only the Pages
--                     Function holds). The owner can see each connection's venue, label,
--                     account code and dates, never the sealed value. Revoking deletes the
--                     sealed value and keeps the row, so the log still names it.
-- broker_data_keys    one sealed data key per person. Nobody reads it through the API except
--                     the owner's own session, through broker_data_key_get().
-- verify_badges       a badge may carry a signed proof (attestation) from the server that it
--                     read the trades from a broker. The insert trigger checks that the proof
--                     was made for the person publishing (a hash of their id and the proof's
--                     id), that it is less than 7 days old and used once, and copies the venue,
--                     the account code and the fetch time from it. The signature itself is
--                     checked wherever the badge is shown (web/src/lib/connect/attest.ts),
--                     with the public key at /api/connect/keys. Withdrawing deletes the proof
--                     and the numbers but keeps the venue, account code and fetch time, so a
--                     withdrawn broker-connected record stays visible as one.
--
-- Rate limits: 10 reads an hour and 40 a day per person; 10 kept connections per person.
-- Connected AI apps (a token with client_id) can do none of this.
--
-- To undo: drop the functions below, drop table public.broker_connections,
-- public.broker_data_keys, public.broker_events; alter table public.verify_badges drop column
-- attestation, broker_venue, broker_account, broker_fetched_at, attestation_id; then re-run
-- the triggers, view and constraint from 20261025000000_verify_badges.sql.

-- ---------------------------------------------------------------- the log

create table if not exists public.broker_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid,
  venue text not null check (venue in ('ibkr', 'alpaca', 'coinbase', 'kraken', 'binance', 'binance_us', 'bybit')),
  event text not null check (event in ('fetch', 'fetched', 'refused', 'failed', 'saved', 'opened', 'synced', 'sync_failed', 'revoked')),
  detail text check (char_length(detail) <= 300),
  at timestamptz not null default now()
);

create index if not exists broker_events_user_at on public.broker_events (user_id, at desc);

-- ---------------------------------------------------------------- kept connections

create table if not exists public.broker_data_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sealed text not null check (sealed ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,200}$'),
  key_id text not null check (key_id ~ '^[A-Za-z0-9_-]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.broker_connections (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  venue text not null check (venue in ('ibkr', 'alpaca', 'coinbase', 'kraken', 'binance', 'binance_us', 'bybit')),
  env text not null check (env in ('live', 'paper')),
  label text not null check (char_length(label) between 1 and 80),
  account_code text check (account_code ~ '^acct_[A-Za-z0-9_-]{16}$'),
  sealed text check (sealed ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$' and char_length(sealed) <= 16000),
  key_id text check (key_id ~ '^[A-Za-z0-9_-]{8}$'),
  created_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_result text check (char_length(last_result) <= 300),
  revoked_at timestamptz,
  -- A live connection has its sealed credential; a revoked one has none.
  constraint broker_connections_sealed check ((revoked_at is null) = (sealed is not null and key_id is not null))
);

create index if not exists broker_connections_user on public.broker_connections (user_id, created_at desc);

alter table public.broker_events enable row level security;
alter table public.broker_connections enable row level security;
alter table public.broker_data_keys enable row level security;

revoke all on public.broker_events, public.broker_connections, public.broker_data_keys from public, anon, authenticated;
grant select on public.broker_events to authenticated;
-- Every column but the sealed credential and its key id.
grant select (id, user_id, venue, env, label, account_code, created_at, last_synced_at, last_result, revoked_at)
  on public.broker_connections to authenticated;

drop policy if exists "own broker events" on public.broker_events;
create policy "own broker events" on public.broker_events
  for select to authenticated
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'client_id') is null);

-- Data keys are read only through broker_data_key_get(), never directly.
drop policy if exists "closed to the api" on public.broker_data_keys;
create policy "closed to the api" on public.broker_data_keys for select to anon, authenticated using (false);

drop policy if exists "own broker connections" on public.broker_connections;
create policy "own broker connections" on public.broker_connections
  for select to authenticated
  using (user_id = (select auth.uid()) and ((select auth.jwt()) ->> 'client_id') is null);

-- The signed-in person, refusing signed-out callers and connected AI apps.
create or replace function public.broker_caller() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'client_id', '') <> '' then
    raise exception 'Connected apps cannot use broker connections.' using errcode = '42501';
  end if;
  return uid;
end
$$;

-- Before a read: the rate limit, and the "fetch" row in the log. Returns the row's id.
create or replace function public.broker_fetch_begin(p_venue text, p_connection uuid default null)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.broker_caller();
  hour_n integer;
  day_n integer;
  out_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('broker_fetch:' || uid::text, 0));
  select count(*) filter (where at > now() - interval '1 hour'), count(*) into hour_n, day_n
    from public.broker_events where user_id = uid and event = 'fetch' and at > now() - interval '24 hours';
  if hour_n >= 10 then
    raise exception 'You can read from a broker 10 times an hour. Try again later.' using errcode = 'P0001';
  end if;
  if day_n >= 40 then
    raise exception 'You can read from a broker 40 times a day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  if p_connection is not null and not exists (
    select 1 from public.broker_connections c where c.id = p_connection and c.user_id = uid and c.revoked_at is null) then
    raise exception 'That connection was not found or was revoked.' using errcode = 'P0001';
  end if;
  insert into public.broker_events (user_id, connection_id, venue, event)
    values (uid, p_connection, p_venue, 'fetch') returning id into out_id;
  return out_id;
end
$$;

-- After a read: how it went, in plain words (no credential, no raw venue reply).
create or replace function public.broker_event_log(p_venue text, p_event text, p_detail text default null, p_connection uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.broker_caller();
begin
  if p_event not in ('fetched', 'refused', 'failed') then
    raise exception 'Not an event that can be logged here.' using errcode = '22023';
  end if;
  insert into public.broker_events (user_id, connection_id, venue, event, detail)
    values (uid, p_connection, p_venue, p_event, left(p_detail, 300));
end
$$;

create or replace function public.broker_data_key_get()
returns table (sealed text, key_id text)
language sql stable security definer set search_path = '' as $$
  select k.sealed, k.key_id from public.broker_data_keys k where k.user_id = public.broker_caller();
$$;

-- Stores the person's sealed data key. If one exists under the same secret, that one wins (two
-- saves at once keep the first). Under an older secret it is replaced: it could not be opened
-- any more, and connections sealed with it ask to be connected again.
create or replace function public.broker_data_key_put(p_sealed text, p_key_id text)
returns table (sealed text, key_id text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.broker_caller();
begin
  insert into public.broker_data_keys as k (user_id, sealed, key_id) values (uid, p_sealed, p_key_id)
    on conflict (user_id) do update set sealed = excluded.sealed, key_id = excluded.key_id, created_at = now()
    where k.key_id <> excluded.key_id;
  return query select k.sealed, k.key_id from public.broker_data_keys k where k.user_id = uid;
end
$$;

create or replace function public.broker_connection_save(p_id uuid, p_venue text, p_env text, p_label text, p_account text, p_sealed text, p_key_id text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.broker_caller();
  n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('broker_conn:' || uid::text, 0));
  select count(*) into n from public.broker_connections where user_id = uid and revoked_at is null;
  if n >= 10 then
    raise exception 'You can keep 10 broker connections in sync. Revoke one in Settings first.' using errcode = 'P0001';
  end if;
  insert into public.broker_connections (id, user_id, venue, env, label, account_code, sealed, key_id)
    values (p_id, uid, p_venue, p_env, coalesce(nullif(btrim(p_label), ''), p_venue), p_account, p_sealed, p_key_id);
  insert into public.broker_events (user_id, connection_id, venue, event) values (uid, p_id, p_venue, 'saved');
  return p_id;
end
$$;

-- The sealed credential of one of the person's own live connections, for the server to open.
create or replace function public.broker_connection_open(p_id uuid)
returns table (venue text, env text, label text, account_code text, sealed text, key_id text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.broker_caller();
begin
  return query select c.venue, c.env, c.label, c.account_code, c.sealed, c.key_id
    from public.broker_connections c where c.id = p_id and c.user_id = uid and c.revoked_at is null;
  if found then
    insert into public.broker_events (user_id, connection_id, venue, event)
      select uid, c.id, c.venue, 'opened' from public.broker_connections c where c.id = p_id;
  end if;
end
$$;

create or replace function public.broker_connection_synced(p_id uuid, p_ok boolean, p_detail text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.broker_caller();
  v text;
begin
  update public.broker_connections c
    set last_synced_at = case when p_ok then now() else c.last_synced_at end, last_result = left(p_detail, 300)
    where c.id = p_id and c.user_id = uid and c.revoked_at is null
    returning c.venue into v;
  if v is not null then
    insert into public.broker_events (user_id, connection_id, venue, event, detail)
      values (uid, p_id, v, case when p_ok then 'synced' else 'sync_failed' end, left(p_detail, 300));
  end if;
end
$$;

-- Revoking deletes the sealed credential. The row and the log stay.
create or replace function public.broker_connection_revoke(p_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.broker_caller();
  v text;
begin
  update public.broker_connections c set revoked_at = now(), sealed = null, key_id = null
    where c.id = p_id and c.user_id = uid and c.revoked_at is null
    returning c.venue into v;
  if v is null then
    return false;
  end if;
  insert into public.broker_events (user_id, connection_id, venue, event) values (uid, p_id, v, 'revoked');
  return true;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.broker_caller()',
    'public.broker_fetch_begin(text, uuid)', 'public.broker_event_log(text, text, text, uuid)',
    'public.broker_data_key_get()', 'public.broker_data_key_put(text, text)',
    'public.broker_connection_save(uuid, text, text, text, text, text, text)', 'public.broker_connection_open(uuid)',
    'public.broker_connection_synced(uuid, boolean, text)', 'public.broker_connection_revoke(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;

-- ---------------------------------------------------------------- broker-connected badges

alter table public.verify_badges add column if not exists attestation text
  check (attestation ~ '^[A-Za-z0-9_-]{10,200}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{80,100}$' and char_length(attestation) <= 8000);
alter table public.verify_badges add column if not exists broker_venue text
  check (broker_venue in ('ibkr', 'alpaca', 'coinbase', 'kraken', 'binance', 'binance_us', 'bybit'));
alter table public.verify_badges add column if not exists broker_account text check (broker_account ~ '^acct_[A-Za-z0-9_-]{16}$');
alter table public.verify_badges add column if not exists broker_fetched_at timestamptz;
alter table public.verify_badges add column if not exists attestation_id text check (attestation_id ~ '^[A-Za-z0-9_-]{22}$');

-- One proof, one badge.
create unique index if not exists verify_badges_attestation_id on public.verify_badges (attestation_id) where attestation_id is not null;

-- A withdrawn badge also loses its proof (it holds the numbers); the venue stays.
alter table public.verify_badges drop constraint if exists verify_badges_whole;
alter table public.verify_badges add constraint verify_badges_whole check (
  (withdrawn_at is null
    and name is not null and input_kind is not null and stated_tries is not null
    and verdict is not null and cards is not null and method_version is not null and file_sha256 is not null)
  or
  (withdrawn_at is not null
    and name is null and input_kind is null and stated_tries is null and date_from is null and date_to is null
    and trade_count is null and verdict is null and survives_tries is null and cards is null
    and method_version is null and file_sha256 is null and attestation is null));

-- The claims inside a proof (the middle part of a compact JWS), read without checking the
-- signature: the badge is only ever shown as broker-connected after the signature is checked.
create or replace function public.verify_attestation_claims(p_jws text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  part text := split_part(p_jws, '.', 2);
begin
  return convert_from(decode(translate(part, '-_', '+/') || repeat('=', (4 - length(part) % 4) % 4), 'base64'), 'UTF8')::jsonb;
exception when others then
  return null;
end
$$;
revoke all on function public.verify_attestation_claims(text) from public, anon, authenticated;

create or replace function public.verify_badges_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  recent integer;
  c jsonb;
begin
  if uid is null then
    raise exception 'Sign in to publish a badge.' using errcode = '42501';
  end if;
  new.user_id := uid;
  new.created_at := now();
  new.withdrawn_at := null;
  -- Only a proof can make a badge broker-connected; these are never taken from the browser.
  new.broker_venue := null; new.broker_account := null; new.broker_fetched_at := null; new.attestation_id := null;
  if new.attestation is not null then
    c := public.verify_attestation_claims(new.attestation);
    if c is null or c ->> 'jti' is null or c ->> 'own' is null
       or c ->> 'own' <> encode(extensions.digest(convert_to(uid::text || ':' || (c ->> 'jti'), 'UTF8'), 'sha256'), 'hex') then
      raise exception 'This broker proof was made for someone else. Read the trades again.' using errcode = '42501';
    end if;
    if (c ->> 'iat') is null or to_timestamp((c ->> 'iat')::double precision) < now() - interval '7 days' then
      raise exception 'This broker proof is more than 7 days old. Read the trades again to publish.' using errcode = 'P0001';
    end if;
    new.attestation_id := c ->> 'jti';
    new.broker_venue := c ->> 'venue';
    new.broker_account := c ->> 'account';
    new.broker_fetched_at := (c ->> 'fetched_at')::timestamptz;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('verify_badges:' || uid::text, 0));
  select count(*) into recent from public.verify_badges
    where user_id = uid and created_at > now() - interval '24 hours';
  if recent >= 20 then
    raise exception 'You can publish up to 20 badges a day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.verify_badges_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.withdrawn_at is not null then
    -- Already withdrawn: only the account deletion's user_id = null may pass.
    if new.user_id is null and old.user_id is not null then
      new.id := old.id; new.created_at := old.created_at; new.withdrawn_at := old.withdrawn_at;
      new.broker_venue := old.broker_venue; new.broker_account := old.broker_account;
      new.broker_fetched_at := old.broker_fetched_at; new.attestation_id := old.attestation_id; new.attestation := null;
      return new;
    end if;
    raise exception 'This badge was already withdrawn.' using errcode = 'P0001';
  end if;
  if new.user_id is not null and new.user_id is distinct from old.user_id then
    raise exception 'A badge cannot change owner.' using errcode = '42501';
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  new.withdrawn_at := now();
  new.name := null; new.input_kind := null; new.stated_tries := null;
  new.date_from := null; new.date_to := null; new.trade_count := null;
  new.verdict := null; new.survives_tries := null; new.cards := null;
  new.method_version := null; new.file_sha256 := null;
  -- The proof goes with the numbers; where the record came from stays visible.
  new.attestation := null;
  new.broker_venue := old.broker_venue; new.broker_account := old.broker_account;
  new.broker_fetched_at := old.broker_fetched_at; new.attestation_id := old.attestation_id;
  return new;
end;
$$;

revoke all on function public.verify_badges_before_insert() from public, anon, authenticated;
revoke all on function public.verify_badges_before_update() from public, anon, authenticated;

-- The public columns, now with the proof and where the record came from. New columns go last.
create or replace view public.verify_badges_public with (security_invoker = true) as
  select id, created_at, withdrawn_at, name, input_kind, stated_tries, date_from, date_to,
         trade_count, verdict, survives_tries, cards, method_version, file_sha256,
         attestation, broker_venue, broker_account, broker_fetched_at
  from public.verify_badges;

revoke all on public.verify_badges_public from public, anon, authenticated;

create or replace function public.verify_badge_public(p_id text)
returns setof public.verify_badges_public
language sql stable security definer set search_path = '' as $$
  select * from public.verify_badges_public
  where p_id ~ '^[A-Za-z0-9]{12}$' and id = p_id;
$$;

revoke all on function public.verify_badge_public(text) from public;
grant execute on function public.verify_badge_public(text) to anon, authenticated;

-- ---------------------------------------------------------------- account deletion

-- delete_account_data() calls analytics_forget_user() when it exists; it now also removes the
-- person's broker log, kept connections and data key (the login's deletion would cascade, but
-- delete_account_data may keep the login).
create or replace function public.analytics_forget_user(p_user uuid)
returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.broker_connections where user_id = p_user;
  delete from public.broker_data_keys where user_id = p_user;
  delete from public.broker_events where user_id = p_user;
  perform personalization.forget(p_user, true);
  return analytics.forget_user(p_user);
end
$$;
revoke all on function public.analytics_forget_user(uuid) from public, anon, authenticated;
