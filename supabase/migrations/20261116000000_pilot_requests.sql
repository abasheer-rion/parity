-- Free pilot requests from firms (DEC-0087): the "Start a free 30-day pilot" form on
-- /business/prop-firms/, /business/copy-trading/ and /business/bot-marketplaces/.
--
-- Who can do what:
--   - anyone (signed in or not) can add a request, and only the form's own columns: the
--     client never sets the time, the address hash or whether the team was told
--   - only the team (public.is_team(), DEC-0056) can read requests; nobody changes or
--     deletes them through the API (the owner can, in the SQL editor)
-- A rate limit with no captcha runs in a trigger before each insert: at most 3 requests an
-- hour from one address, 3 a day for one email, and 60 an hour in all. The address is kept
-- only as a salted SHA-256 hash, for the limit; the salt is in a table nobody can read
-- through the API.
-- After a request is stored, the page asks the pilot-notify Edge Function to email
-- contact@paritytrading.app (supabase/functions/pilot-notify). The function claims the row
-- through claim_pilot_request(), which hands each new row out once, within 15 minutes. If the
-- email fails the row stays stored, and the team still sees it in the table.

create table if not exists public.pilot_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'prop_firm' check (kind in ('prop_firm', 'copy_trading', 'bot_marketplace', 'other')),
  firm text not null check (char_length(btrim(firm)) between 1 and 120),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  accounts_per_month text not null check (accounts_per_month in ('under_100', '100_1000', '1000_10000', 'over_10000')),
  message text not null default '' check (char_length(message) <= 2000),
  page text not null default '' check (char_length(page) <= 200),
  ip_hash text,
  notified_at timestamptz
);

create index if not exists pilot_requests_ip_recent on public.pilot_requests (ip_hash, created_at);
create index if not exists pilot_requests_email_recent on public.pilot_requests (email, created_at);
create index if not exists pilot_requests_created on public.pilot_requests (created_at);

alter table public.pilot_requests enable row level security;
revoke all on public.pilot_requests from public, anon, authenticated;
grant insert (id, kind, firm, name, email, accounts_per_month, message, page) on public.pilot_requests to anon, authenticated;
grant select on public.pilot_requests to authenticated;

drop policy if exists "anyone can ask for a pilot" on public.pilot_requests;
create policy "anyone can ask for a pilot" on public.pilot_requests
  for insert to anon, authenticated
  with check (true);

drop policy if exists "the team reads pilot requests" on public.pilot_requests;
create policy "the team reads pilot requests" on public.pilot_requests
  for select to authenticated
  using ((select public.is_team()));

-- The salt for the address hash. One row, made here, in the schema the API cannot reach.
create schema if not exists parity_private;
revoke all on schema parity_private from public, anon, authenticated;
create table if not exists parity_private.pilot_request_salt (
  id boolean primary key default true check (id),
  salt text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
alter table parity_private.pilot_request_salt enable row level security;
revoke all on parity_private.pilot_request_salt from public, anon, authenticated;
drop policy if exists "closed to the api" on parity_private.pilot_request_salt;
create policy "closed to the api" on parity_private.pilot_request_salt for select to anon, authenticated using (false);
insert into parity_private.pilot_request_salt (id) values (true) on conflict (id) do nothing;

create or replace function public.pilot_requests_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  h json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip text := coalesce(nullif(h ->> 'cf-connecting-ip', ''), nullif(btrim(split_part(h ->> 'x-forwarded-for', ',', 1)), ''), nullif(h ->> 'x-real-ip', ''), 'unknown');
  salt text := (select s.salt from parity_private.pilot_request_salt s where s.id);
begin
  new.created_at := now();
  new.notified_at := null;
  new.email := lower(btrim(new.email));
  new.firm := btrim(new.firm);
  new.name := btrim(new.name);
  new.message := btrim(coalesce(new.message, ''));
  new.ip_hash := encode(extensions.digest(coalesce(salt, '') || ip, 'sha256'), 'hex');
  if (select count(*) from public.pilot_requests r where r.ip_hash = new.ip_hash and r.created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.pilot_requests r where r.email = new.email and r.created_at > now() - interval '1 day') >= 3
     or (select count(*) from public.pilot_requests r where r.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Too many requests. Try again later or email contact@paritytrading.app.';
  end if;
  return new;
end $$;

revoke all on function public.pilot_requests_guard() from public, anon, authenticated;

drop trigger if exists pilot_requests_guard on public.pilot_requests;
create trigger pilot_requests_guard before insert on public.pilot_requests
  for each row execute function public.pilot_requests_guard();

-- Hands a new request to the email function once: the row's form fields, and marks it told.
-- Anyone may call it, but only with the id the page made for its own request, only once, and
-- only in the first 15 minutes, so it gives back nothing a caller did not just send.
create or replace function public.claim_pilot_request(p_id uuid)
returns table (kind text, firm text, name text, email text, accounts_per_month text, message text, page text, created_at timestamptz)
language sql security definer set search_path = '' as $$
  update public.pilot_requests r set notified_at = now()
  where r.id = p_id and r.notified_at is null and r.created_at > now() - interval '15 minutes'
  returning r.kind, r.firm, r.name, r.email, r.accounts_per_month, r.message, r.page, r.created_at;
$$;

revoke all on function public.claim_pilot_request(uuid) from public;
grant execute on function public.claim_pilot_request(uuid) to anon, authenticated, service_role;
