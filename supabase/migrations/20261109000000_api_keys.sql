-- Self-serve API keys for the Parity public API (DEC-0071).
--
--   api_keys          one row per key: name, scopes, expiry, allowlist, prefix and last 4.
--                     Never the key: only HMAC-SHA-256(key, pepper) in key_hash, which no
--                     person can read back (column grants leave it out).
--   api_key_events    the audit log of key events (made, rotated, revoked, leaked). Append-only.
--   api_key_usage     requests and errors per key per day (UTC), for quotas and the keys page.
--   api_request_log   one line per request (time, method, path, status, ms), kept 30 days.
--                     No query strings, headers or keys.
--
-- Who can do what:
--   - a signed-in person reads only their own rows. They make and rotate keys through the
--     server (/api/keys, which holds the pepper) and revoke them from the keys page; all
--     three go through the functions below, which check auth.uid() and refuse tokens issued
--     to connected AI apps (they carry a client_id).
--   - the API server has no secret of its own. It looks keys up, records usage and revokes
--     leaked keys with the key's HMAC as the proof: only the server can work that out,
--     because only it holds the pepper, and it is 256 bits, so it cannot be guessed.
--
-- Undo: drop function public.api_key_lookup(text), public.api_key_record(text, integer,
--   integer, jsonb), public.api_key_revoke_leaked(text, text), public.api_key_create(text,
--   text[], integer, text, text, text, text[]), public.api_key_rotate(uuid, text, text,
--   integer), public.api_key_revoke(uuid), public.api_key_plan(uuid), public.api_key_caller();
--   drop table public.api_request_log, public.api_key_usage, public.api_key_events,
--   public.api_keys cascade;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null check (prefix in ('pk_test_', 'pk_live_')),
  last4 text not null check (last4 ~ '^[0-9A-Za-z]{4}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (
    cardinality(scopes) between 1 and 4
    and scopes <@ array['read:strategies', 'read:markets', 'read:verify', 'write:verify']::text[]
  ),
  ip_allowlist cidr[] not null default '{}' check (cardinality(ip_allowlist) <= 20),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason in ('user', 'leaked', 'admin')),
  rotated_from uuid references public.api_keys (id) on delete set null,
  constraint api_keys_expiry check (expires_at > created_at and expires_at <= created_at + interval '366 days'),
  constraint api_keys_revoked check ((revoked_at is null) = (revoked_reason is null))
);
create index if not exists api_keys_user on public.api_keys (user_id, created_at desc);
create index if not exists api_keys_rotated_from on public.api_keys (rotated_from);

create table if not exists public.api_key_events (
  id bigint generated always as identity primary key,
  key_id uuid not null references public.api_keys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (event in ('created', 'rotated', 'revoked', 'leaked')),
  detail jsonb not null default '{}' check (pg_column_size(detail) <= 2000),
  at timestamptz not null default now()
);
create index if not exists api_key_events_user on public.api_key_events (user_id, at desc);
create index if not exists api_key_events_key on public.api_key_events (key_id);

create table if not exists public.api_key_usage (
  key_id uuid not null references public.api_keys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  requests integer not null default 0 check (requests >= 0),
  errors integer not null default 0 check (errors >= 0),
  primary key (key_id, day)
);
create index if not exists api_key_usage_user_day on public.api_key_usage (user_id, day);

create table if not exists public.api_request_log (
  id bigint generated always as identity primary key,
  key_id uuid not null references public.api_keys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null,
  method text not null check (method in ('GET', 'POST')),
  path text not null check (path ~ '^/api/v1/[A-Za-z0-9/_.%:-]{0,190}$'),
  status smallint not null check (status between 100 and 599),
  ms integer not null check (ms between 0 and 600000)
);
create index if not exists api_request_log_key on public.api_request_log (key_id, at desc);
create index if not exists api_request_log_user on public.api_request_log (user_id, at desc);

alter table public.api_keys enable row level security;
alter table public.api_key_events enable row level security;
alter table public.api_key_usage enable row level security;
alter table public.api_request_log enable row level security;

revoke all on public.api_keys, public.api_key_events, public.api_key_usage, public.api_request_log from public, anon, authenticated;
-- Every column but key_hash. Writes only through the functions below.
grant select (id, user_id, name, prefix, last4, scopes, ip_allowlist, created_at, expires_at, last_used_at, revoked_at, revoked_reason, rotated_from)
  on public.api_keys to authenticated;
grant select on public.api_key_events, public.api_key_usage, public.api_request_log to authenticated;

drop policy if exists "people see their own keys" on public.api_keys;
create policy "people see their own keys" on public.api_keys
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "people see their own key events" on public.api_key_events;
create policy "people see their own key events" on public.api_key_events
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "people see their own key usage" on public.api_key_usage;
create policy "people see their own key usage" on public.api_key_usage
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "people see their own request log" on public.api_request_log;
create policy "people see their own request log" on public.api_request_log
  for select to authenticated using (user_id = (select auth.uid()));

-- The person behind the current token, refusing anonymous calls and connected AI apps.
create or replace function public.api_key_caller()
returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'client_id', '') <> '' then
    raise exception 'connected apps cannot manage API keys' using errcode = '42501';
  end if;
  return uid;
end;
$$;

-- The API plan from the person's entitlements (payment_entitlements, DEC-0046).
create or replace function public.api_key_plan(p_user uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.payment_entitlements e where e.user_id = p_user and e.feature = 'white_label' and (e.valid_until is null or e.valid_until > now())) then 'platform'
    when exists (select 1 from public.payment_entitlements e where e.user_id = p_user and e.feature = 'api_access' and (e.valid_until is null or e.valid_until > now())) then 'api_starter'
    else 'free'
  end;
$$;

create or replace function public.api_key_create(
  p_name text, p_scopes text[], p_days integer, p_prefix text, p_last4 text, p_hash text, p_ip text[] default '{}'
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.api_key_caller();
  n_active integer;
  k public.api_keys;
begin
  if p_days is null or p_days not in (30, 90, 180, 365) then
    raise exception 'expiry must be 30, 90, 180 or 365 days' using errcode = '22023';
  end if;
  if p_prefix is distinct from 'pk_test_' then
    raise exception 'only test keys are issued for now' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('api_keys:' || uid::text, 0));
  select count(*) into n_active from public.api_keys a
   where a.user_id = uid and a.revoked_at is null and a.expires_at > now();
  if n_active >= 10 then
    raise exception 'you have 10 active keys; revoke one first' using errcode = '22023';
  end if;
  insert into public.api_keys (user_id, name, prefix, last4, key_hash, scopes, ip_allowlist, expires_at)
  values (uid, btrim(p_name), p_prefix, p_last4, p_hash, (select array_agg(distinct s order by s) from unnest(p_scopes) s),
          (select coalesce(array_agg(distinct network(x::inet)), '{}') from unnest(coalesce(p_ip, '{}')) x), now() + make_interval(days => p_days))
  returning * into k;
  insert into public.api_key_events (key_id, user_id, event, detail)
  values (k.id, uid, 'created', jsonb_build_object('scopes', k.scopes, 'days', p_days, 'ip_ranges', cardinality(k.ip_allowlist)));
  return jsonb_build_object('id', k.id, 'expires_at', k.expires_at);
end;
$$;

-- A new key with the same name, scopes and allowlist; the old one keeps working for the
-- overlap (0 to 168 hours) and then expires.
create or replace function public.api_key_rotate(p_id uuid, p_last4 text, p_hash text, p_overlap_hours integer default 24)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.api_key_caller();
  old public.api_keys;
  k public.api_keys;
  life interval;
begin
  if p_overlap_hours is null or p_overlap_hours not in (0, 1, 24, 168) then
    raise exception 'overlap must be 0, 1, 24 or 168 hours' using errcode = '22023';
  end if;
  select * into old from public.api_keys a where a.id = p_id and a.user_id = uid for update;
  if not found or old.revoked_at is not null or old.expires_at <= now() then
    raise exception 'no active key with that id' using errcode = '22023';
  end if;
  -- Rotating must not get around the cap: the other active keys must leave room.
  perform pg_advisory_xact_lock(hashtextextended('api_keys:' || uid::text, 0));
  if (select count(*) from public.api_keys a
       where a.user_id = uid and a.id <> p_id and a.revoked_at is null and a.expires_at > now()) >= 10 then
    raise exception 'you have 10 other active keys; revoke one first' using errcode = '22023';
  end if;
  life := least(old.expires_at - old.created_at, interval '365 days');
  insert into public.api_keys (user_id, name, prefix, last4, key_hash, scopes, ip_allowlist, expires_at, rotated_from)
  values (uid, old.name, old.prefix, p_last4, p_hash, old.scopes, old.ip_allowlist, now() + life, old.id)
  returning * into k;
  update public.api_keys set expires_at = greatest(old.created_at + interval '1 second', least(old.expires_at, now() + make_interval(hours => p_overlap_hours)))
   where id = old.id;
  insert into public.api_key_events (key_id, user_id, event, detail) values
    (old.id, uid, 'rotated', jsonb_build_object('to', k.id, 'overlap_hours', p_overlap_hours)),
    (k.id, uid, 'created', jsonb_build_object('from', old.id, 'scopes', k.scopes));
  return jsonb_build_object('id', k.id, 'expires_at', k.expires_at);
end;
$$;

create or replace function public.api_key_revoke(p_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.api_key_caller();
begin
  update public.api_keys set revoked_at = now(), revoked_reason = 'user'
   where id = p_id and user_id = uid and revoked_at is null;
  if not found then
    return false;
  end if;
  insert into public.api_key_events (key_id, user_id, event) values (p_id, uid, 'revoked');
  return true;
end;
$$;

-- The API server's three calls. The HMAC is the proof (see the top of this file).
create or replace function public.api_key_lookup(p_hash text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  k public.api_keys;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into k from public.api_keys a where a.key_hash = p_hash;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', k.id, 'user_id', k.user_id, 'key_hash', k.key_hash, 'scopes', to_jsonb(k.scopes),
    'ip_allowlist', (select coalesce(jsonb_agg(host(c) || '/' || masklen(c)), '[]'::jsonb) from unnest(k.ip_allowlist) c),
    'expires_at', k.expires_at, 'revoked_at', k.revoked_at,
    'plan', public.api_key_plan(k.user_id),
    'used_today', (select coalesce(sum(u.requests), 0) from public.api_key_usage u
                    where u.user_id = k.user_id and u.day = (now() at time zone 'utc')::date)
  );
end;
$$;

create or replace function public.api_key_record(p_hash text, p_requests integer, p_errors integer, p_log jsonb default '[]')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  k public.api_keys;
  line jsonb;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  select * into k from public.api_keys a where a.key_hash = p_hash;
  if not found then
    return;
  end if;
  insert into public.api_key_usage as u (key_id, user_id, day, requests, errors)
  values (k.id, k.user_id, (now() at time zone 'utc')::date, greatest(0, least(coalesce(p_requests, 0), 100000)), greatest(0, least(coalesce(p_errors, 0), 100000)))
  on conflict (key_id, day) do update set requests = u.requests + excluded.requests, errors = u.errors + excluded.errors;
  update public.api_keys set last_used_at = now() where id = k.id;
  if jsonb_typeof(p_log) = 'array' then
    for line in select value from jsonb_array_elements(p_log) with ordinality as t(value, n) where n <= 100 loop
      begin
        insert into public.api_request_log (key_id, user_id, at, method, path, status, ms)
        values (k.id, k.user_id, least(now(), greatest(now() - interval '1 hour', (line ->> 'at')::timestamptz)),
                line ->> 'method', line ->> 'path', (line ->> 'status')::smallint, (line ->> 'ms')::integer);
      exception when others then
        null; -- a malformed line is dropped, never the batch
      end;
    end loop;
  end if;
  delete from public.api_request_log l where l.key_id = k.id and l.at < now() - interval '30 days';
end;
$$;

create or replace function public.api_key_revoke_leaked(p_hash text, p_source text default '')
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  k public.api_keys;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  update public.api_keys set revoked_at = now(), revoked_reason = 'leaked'
   where key_hash = p_hash and revoked_at is null
  returning * into k;
  if not found then
    -- Already revoked counts as handled; unknown does not.
    return exists (select 1 from public.api_keys a where a.key_hash = p_hash);
  end if;
  insert into public.api_key_events (key_id, user_id, event, detail)
  values (k.id, k.user_id, 'leaked', jsonb_build_object('source', left(coalesce(p_source, ''), 200)));
  return true;
end;
$$;

revoke all on function public.api_key_caller(), public.api_key_plan(uuid),
  public.api_key_create(text, text[], integer, text, text, text, text[]),
  public.api_key_rotate(uuid, text, text, integer), public.api_key_revoke(uuid),
  public.api_key_lookup(text), public.api_key_record(text, integer, integer, jsonb),
  public.api_key_revoke_leaked(text, text) from public, anon, authenticated;
grant execute on function public.api_key_create(text, text[], integer, text, text, text, text[]),
  public.api_key_rotate(uuid, text, text, integer), public.api_key_revoke(uuid) to authenticated;
grant execute on function public.api_key_lookup(text), public.api_key_record(text, integer, integer, jsonb),
  public.api_key_revoke_leaked(text, text) to anon, authenticated;
