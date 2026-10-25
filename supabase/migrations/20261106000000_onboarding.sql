-- Getting started checklist, first-run tours and read-only crypto wallets (DEC-0057).
--
-- This file adds two tables, each person reading and writing only their own rows:
--   1. onboarding_state: one row per person. When each checklist item was first done, whether
--      the checklist is hidden, which first-run tours they have seen, whether every tour is
--      off ("Skip all tours"), and the "Notify me" choice for brokerage linking.
--   2. crypto_wallets: public wallet addresses a person added, by chain, with the time the
--      server checked a signed message from that wallet. Nothing else: no seed phrase, no
--      private key, no balance, no label. Only the server (service role) can set verified_at.
--
-- Bank and card details are never stored: Parity holds no money and has no broker partner
-- (DEC-0046), so there is no column for them anywhere.
--
-- Additive only: two new tables, their triggers and policies. Nothing else changes.

-- 1. Checklist and tours ---------------------------------------------------------------------

create table if not exists public.onboarding_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  checklist_hidden boolean not null default false,
  -- "Skip all tours": no first-run tour opens for this person until they turn tours back on.
  tours_off boolean not null default false,
  -- Areas whose first-run tour this person has finished or skipped, such as 'home' or 'trade'.
  tours_seen text[] not null default '{}',
  -- When each checklist item was first done. Set once and never cleared (see the trigger).
  email_at timestamptz,
  ai_at timestamptz,
  verify_at timestamptz,
  trade_at timestamptz,
  watch_at timestamptz,
  lesson_at timestamptz,
  mfa_at timestamptz,
  wallet_at timestamptz,
  -- "Link a brokerage account, coming later": tell me when it exists.
  notify_brokerage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- At most 40 short lower-case area names, no empty or null entries.
  constraint onboarding_tours_seen_shape check (
    cardinality(tours_seen) <= 40
    and array_position(tours_seen, null) is null
    and (cardinality(tours_seen) = 0 or array_to_string(tours_seen, ',') ~ '^[a-z][a-z0-9-]{0,39}(,[a-z][a-z0-9-]{0,39})*$')
  )
);

-- A done time is never cleared or moved later, and never set in the future, whatever the app
-- sends (two tabs can save in either order). The row never moves to another person.
create or replace function public.onboarding_state_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.email_at := least(old.email_at, new.email_at);
    new.ai_at := least(old.ai_at, new.ai_at);
    new.verify_at := least(old.verify_at, new.verify_at);
    new.trade_at := least(old.trade_at, new.trade_at);
    new.watch_at := least(old.watch_at, new.watch_at);
    new.lesson_at := least(old.lesson_at, new.lesson_at);
    new.mfa_at := least(old.mfa_at, new.mfa_at);
    new.wallet_at := least(old.wallet_at, new.wallet_at);
  end if;
  -- least() ignores nulls, so the lines above keep a time once it is set. Now clamp the future.
  new.email_at := least(new.email_at, now());
  new.ai_at := least(new.ai_at, now());
  new.verify_at := least(new.verify_at, now());
  new.trade_at := least(new.trade_at, now());
  new.watch_at := least(new.watch_at, now());
  new.lesson_at := least(new.lesson_at, now());
  new.mfa_at := least(new.mfa_at, now());
  new.wallet_at := least(new.wallet_at, now());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists onboarding_state_guard on public.onboarding_state;
create trigger onboarding_state_guard
  before insert or update on public.onboarding_state
  for each row execute function public.onboarding_state_guard();

revoke all on function public.onboarding_state_guard() from public, anon, authenticated;

alter table public.onboarding_state enable row level security;

revoke all on public.onboarding_state from anon, authenticated;
grant select, insert, update, delete on public.onboarding_state to authenticated;

drop policy if exists "own onboarding state" on public.onboarding_state;
create policy "own onboarding state" on public.onboarding_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2. Read-only crypto wallets ----------------------------------------------------------------

create table if not exists public.crypto_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chain text not null check (chain in ('ethereum', 'solana')),
  -- Ethereum addresses are stored in lower case (the trigger folds them); Solana addresses are
  -- base58 and case matters.
  address text not null,
  -- Set only by the server after it checked a message signed by this wallet (EIP-4361 for
  -- Ethereum, the same format for Solana). Empty for an address that was typed in.
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint crypto_wallets_address_shape check (
    (chain = 'ethereum' and address ~ '^0x[0-9a-f]{40}$')
    or (chain = 'solana' and address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
  ),
  constraint crypto_wallets_one_row unique (user_id, chain, address)
);

-- Folds Ethereum addresses to lower case, keeps verified_at empty unless the server sets it,
-- keeps a row's person, chain and address fixed, and caps each person at 10 wallets.
create or replace function public.crypto_wallets_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.address := btrim(new.address);
  if new.chain = 'ethereum' then
    new.address := lower(new.address);
  end if;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.chain := old.chain;
    new.address := old.address;
    new.created_at := old.created_at;
  end if;
  -- Only the service role (the server, after checking a signature) and the database owner set
  -- the verification time. Everyone else, signed in or not, keeps whatever was there.
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.verified_at := case when tg_op = 'UPDATE' then old.verified_at else null end;
  end if;
  if new.verified_at is not null then
    new.verified_at := least(new.verified_at, now());
  end if;
  -- The cap counts new wallets only: the server's save of an existing one (insert on conflict)
  -- also passes through here.
  if tg_op = 'INSERT'
     and not exists (select 1 from public.crypto_wallets w where w.user_id = new.user_id and w.chain = new.chain and w.address = new.address)
     and (select count(*) from public.crypto_wallets w where w.user_id = new.user_id) >= 10 then
    raise exception 'crypto_wallets: at most 10 wallets per person';
  end if;
  return new;
end;
$$;

drop trigger if exists crypto_wallets_guard on public.crypto_wallets;
create trigger crypto_wallets_guard
  before insert or update on public.crypto_wallets
  for each row execute function public.crypto_wallets_guard();

revoke all on function public.crypto_wallets_guard() from public, anon, authenticated;

alter table public.crypto_wallets enable row level security;

-- People read, add and remove their own wallets. No update: only the server marks one verified.
revoke all on public.crypto_wallets from anon, authenticated;
grant select, insert, delete on public.crypto_wallets to authenticated;

drop policy if exists "own wallets are readable" on public.crypto_wallets;
create policy "own wallets are readable" on public.crypto_wallets
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "people add their own wallets" on public.crypto_wallets;
create policy "people add their own wallets" on public.crypto_wallets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "people remove their own wallets" on public.crypto_wallets;
create policy "people remove their own wallets" on public.crypto_wallets
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 3. Connected AI apps read, but never write directly (DEC-0051) ------------------------------
-- The same three restrictive rules every table people write to has: a token issued to a
-- connected app (one with a client_id claim) cannot insert, update or delete these rows.

do $$
declare
  t text;
  rule text := '((select auth.jwt()) ->> ''client_id'') is null';
begin
  foreach t in array array['onboarding_state', 'crypto_wallets'] loop
    execute format('drop policy if exists "connected apps cannot insert" on public.%I', t);
    execute format('create policy "connected apps cannot insert" on public.%I as restrictive for insert to authenticated with check (%s)', t, rule);
    execute format('drop policy if exists "connected apps cannot update" on public.%I', t);
    execute format('create policy "connected apps cannot update" on public.%I as restrictive for update to authenticated using (%s) with check (%s)', t, rule, rule);
    execute format('drop policy if exists "connected apps cannot delete" on public.%I', t);
    execute format('create policy "connected apps cannot delete" on public.%I as restrictive for delete to authenticated using (%s)', t, rule);
  end loop;
end;
$$;
