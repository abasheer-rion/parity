-- AI apps connected to Parity (DEC-0051). People can add Parity to Claude, ChatGPT and other
-- AI apps through the hosted MCP server at /mcp (web/functions/mcp.ts). The app signs in
-- through Supabase Auth's OAuth server, so it holds an ordinary access token for that person
-- with one extra claim, client_id, naming the app. Every read goes through the same row
-- rules as the person's own browser.
--
-- This file adds:
--   1. ai_grants: per person, per app, whether that app may make changes. Off unless the
--      person turns it on. A connected app can never turn it on for itself.
--   2. mcp_calls: one row per tool call (which app, which tool, when, ok or not, how long).
--      No arguments and no results are stored. Each person reads only their own rows.
--   3. mcp_begin_call / mcp_end_call: the per-person limits and the log, in one place.
--   4. mcp_place_demo_order / mcp_save_trade_layout: the only two changes an app can make,
--      each checking ai_grants first.
--   5. A restrictive rule on every table people write to: a token issued to a connected app
--      (one with a client_id claim) can read the person's rows but cannot insert, update or
--      delete them directly. The person's own browser and the desktop app have no client_id
--      claim and are unaffected.
--
-- Additive only: new tables and functions, and extra restrictive policies on existing tables.
-- No existing policy, column or row changes.

-- 1. Which connected apps may make changes ---------------------------------------------------

create table if not exists public.ai_grants (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The OAuth client id Supabase gave the app when it registered.
  client_id text not null check (char_length(client_id) between 1 and 200),
  client_name text check (char_length(client_name) <= 200),
  allow_write boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

alter table public.ai_grants enable row level security;

revoke all on public.ai_grants from anon, authenticated;
grant select, insert, update, delete on public.ai_grants to authenticated;

drop policy if exists "own ai grants are readable" on public.ai_grants;
create policy "own ai grants are readable" on public.ai_grants
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Only the person's own session may change a grant: never a token issued to an app.
drop policy if exists "people change their own ai grants" on public.ai_grants;
create policy "people change their own ai grants" on public.ai_grants
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'client_id') is null);

drop policy if exists "people update their own ai grants" on public.ai_grants;
create policy "people update their own ai grants" on public.ai_grants
  for update to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'client_id') is null)
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'client_id') is null);

drop policy if exists "people remove their own ai grants" on public.ai_grants;
create policy "people remove their own ai grants" on public.ai_grants
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'client_id') is null);

-- 2. The call log ---------------------------------------------------------------------------

create table if not exists public.mcp_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The app's OAuth client id, or 'parity-web' for Parity's own assistant panel.
  client_id text not null check (char_length(client_id) between 1 and 200),
  tool text not null check (tool ~ '^[a-z_]{1,64}$'),
  write boolean not null default false,
  ok boolean,
  ms integer check (ms between 0 and 600000),
  created_at timestamptz not null default now()
);

create index if not exists mcp_calls_user_time on public.mcp_calls (user_id, created_at desc);

alter table public.mcp_calls enable row level security;

revoke all on public.mcp_calls from anon, authenticated;
grant select on public.mcp_calls to authenticated;

drop policy if exists "own mcp calls are readable" on public.mcp_calls;
create policy "own mcp calls are readable" on public.mcp_calls
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 3. Limits and the log ---------------------------------------------------------------------
-- Per person, across every app: 30 calls a minute, 1000 a day, 30 changes a day. Answers
-- {"ok": true, "id": n} and logs the call, or {"ok": false, "reason": ...} and logs nothing.
-- Rows older than 90 days are removed as the person makes new calls.

create or replace function public.mcp_begin_call(p_tool text, p_write boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid text := coalesce(nullif(auth.jwt() ->> 'client_id', ''), 'parity-web');
  n_minute integer;
  n_day integer;
  n_write integer;
  new_id bigint;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_tool is null or p_tool !~ '^[a-z_]{1,64}$' then
    raise exception 'unknown tool name' using errcode = '22023';
  end if;
  if char_length(cid) > 200 then
    cid := left(cid, 200);
  end if;
  -- One call at a time per person while counting, so two parallel calls cannot both slip
  -- under the limit.
  perform pg_advisory_xact_lock(hashtextextended('mcp:' || uid::text, 0));
  select count(*) filter (where c.created_at > now() - interval '1 minute'),
         count(*),
         count(*) filter (where c.write)
    into n_minute, n_day, n_write
    from public.mcp_calls c
   where c.user_id = uid and c.created_at > now() - interval '1 day';
  if n_minute >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'minute', 'retry_after', 60);
  end if;
  if n_day >= 1000 then
    return jsonb_build_object('ok', false, 'reason', 'day', 'retry_after', 3600);
  end if;
  if coalesce(p_write, false) and n_write >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'write', 'retry_after', 3600);
  end if;
  delete from public.mcp_calls c where c.user_id = uid and c.created_at < now() - interval '90 days';
  insert into public.mcp_calls (user_id, client_id, tool, write)
  values (uid, cid, p_tool, coalesce(p_write, false))
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

create or replace function public.mcp_end_call(p_id bigint, p_ok boolean, p_ms integer)
returns void
language sql security definer set search_path = '' as $$
  update public.mcp_calls
     set ok = coalesce(p_ok, false), ms = least(greatest(coalesce(p_ms, 0), 0), 600000)
   where id = p_id and user_id = auth.uid() and ok is null;
$$;

-- True when the app holding this token has been allowed to make changes by this person.
-- Parity's own browser session has no client_id, so this is false for it: the assistant
-- panel inside Parity only reads.
create or replace function public.mcp_write_allowed()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ai_grants g
     where g.user_id = auth.uid()
       and g.client_id = (auth.jwt() ->> 'client_id')
       and g.allow_write
  );
$$;

-- Uses up this person's open change call of this tool, started through this app in the last
-- two minutes by mcp_begin_call (which counted it against the daily limit). Returns false when
-- there is none. One started call allows one change, even when an app calls the database
-- directly.
create or replace function public.mcp_use_open_call(p_tool text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  call_id bigint;
begin
  select c.id into call_id
    from public.mcp_calls c
   where c.user_id = auth.uid()
     and c.client_id = coalesce(nullif(auth.jwt() ->> 'client_id', ''), 'parity-web')
     and c.tool = p_tool and c.write and c.ok is null
     and c.created_at > now() - interval '2 minutes'
   order by c.id
   limit 1
   for update;
  if call_id is null then
    return false;
  end if;
  update public.mcp_calls set ok = true, ms = 0 where id = call_id;
  return true;
end;
$$;

-- 4. The two changes an app may make --------------------------------------------------------

-- A limit or stop order in one of the person's demo accounts (DEC-0034). It waits as
-- pending; Parity Trade checks it against new delayed prices the next time it opens, the
-- same as an order placed in the app. No market orders: those fill at once in the app.
create or replace function public.mcp_place_demo_order(
  p_account uuid, p_symbol text, p_side text, p_type text, p_qty numeric,
  p_limit_price numeric default null, p_stop_price numeric default null, p_placed_on date default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  -- Always today: an app must not backdate an order to fill it against prices it has seen.
  -- p_placed_on is kept in the signature but ignored.
  day date := current_date;
  new_id uuid;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not public.mcp_write_allowed() then
    raise exception 'this app may not make changes' using errcode = '42501';
  end if;
  -- Only inside a call started with mcp_begin_call, one change per started call, so the daily
  -- limit on changes holds even when an app calls the database directly.
  if not public.mcp_use_open_call('place_demo_order') then
    raise exception 'start this change through Parity''s MCP server' using errcode = '42501';
  end if;
  if not exists (select 1 from public.paper_accounts a where a.id = p_account and a.user_id = uid) then
    raise exception 'no such demo account' using errcode = '22023';
  end if;
  if p_type not in ('limit', 'stop') then
    raise exception 'only limit and stop orders' using errcode = '22023';
  end if;
  if p_side not in ('buy', 'sell') then
    raise exception 'side must be buy or sell' using errcode = '22023';
  end if;
  if p_qty is null or p_qty <= 0 or p_qty > 1000000000 then
    raise exception 'quantity out of range' using errcode = '22023';
  end if;
  if (p_type = 'limit' and not (coalesce(p_limit_price, 0) > 0 and p_limit_price < 1000000000000))
     or (p_type = 'stop' and not (coalesce(p_stop_price, 0) > 0 and p_stop_price < 1000000000000)) then
    raise exception 'a limit order needs a limit price and a stop order a stop price' using errcode = '22023';
  end if;
  if (select count(*) from public.paper_orders o where o.user_id = uid and o.status in ('pending', 'held')) >= 200 then
    raise exception 'too many open demo orders' using errcode = '22023';
  end if;
  insert into public.paper_orders (user_id, account_id, symbol, side, type, qty, limit_price, stop_price, status, placed_on, reason)
  values (uid, p_account, p_symbol, p_side, p_type, p_qty,
          case when p_type = 'limit' then p_limit_price end,
          case when p_type = 'stop' then p_stop_price end,
          'pending', day, 'Placed by a connected AI app')
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'status', 'pending', 'placed_on', day);
end;
$$;

-- A named Parity Trade layout (DEC-0040). The app checks every field when it loads one.
create or replace function public.mcp_save_trade_layout(p_name text, p_state jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  next_pos integer;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not public.mcp_write_allowed() then
    raise exception 'this app may not make changes' using errcode = '42501';
  end if;
  -- Only inside a call started with mcp_begin_call, one change per started call, so the daily
  -- limit on changes holds even when an app calls the database directly.
  if not public.mcp_use_open_call('save_trade_layout') then
    raise exception 'start this change through Parity''s MCP server' using errcode = '42501';
  end if;
  if (select count(*) from public.trade_layouts l where l.user_id = uid) >= 20 then
    raise exception 'you already have 20 layouts' using errcode = '22023';
  end if;
  select coalesce(max(l.position), -1) + 1 into next_pos from public.trade_layouts l where l.user_id = uid;
  insert into public.trade_layouts (user_id, name, state, position)
  values (uid, p_name, p_state, least(next_pos, 10000))
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'name', p_name);
end;
$$;

revoke all on function public.mcp_begin_call(text, boolean) from public, anon, authenticated;
revoke all on function public.mcp_end_call(bigint, boolean, integer) from public, anon, authenticated;
revoke all on function public.mcp_write_allowed() from public, anon, authenticated;
revoke all on function public.mcp_use_open_call(text) from public, anon, authenticated;
revoke all on function public.mcp_place_demo_order(uuid, text, text, text, numeric, numeric, numeric, date) from public, anon, authenticated;
revoke all on function public.mcp_save_trade_layout(text, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_begin_call(text, boolean) to authenticated;
grant execute on function public.mcp_end_call(bigint, boolean, integer) to authenticated;
grant execute on function public.mcp_write_allowed() to authenticated;
grant execute on function public.mcp_place_demo_order(uuid, text, text, text, numeric, numeric, numeric, date) to authenticated;
grant execute on function public.mcp_save_trade_layout(text, jsonb) to authenticated;

-- 5. Connected apps read, but never write directly -----------------------------------------
-- Restrictive policies are ANDed with the existing ones, so they only ever take access away.
-- They apply only to tokens that carry a client_id claim (issued by the OAuth server to an
-- app). Tables that do not exist yet are skipped. A new table people write to should get
-- the same three policies (see DEC-0051).

do $$
declare
  t text;
  rule text := '(select auth.jwt() ->> ''client_id'') is null';
begin
  foreach t in array array[
    'paper_accounts', 'paper_orders', 'paper_fills', 'paper_positions',
    'trade_layouts', 'trade_drawings', 'trade_watchlists', 'trade_alerts',
    'verify_badges', 'verify_dataset', 'account_deletion_requests', 'academy_progress'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "connected apps cannot insert" on public.%I', t);
      execute format('create policy "connected apps cannot insert" on public.%I as restrictive for insert to authenticated with check (%s)', t, rule);
      execute format('drop policy if exists "connected apps cannot update" on public.%I', t);
      execute format('create policy "connected apps cannot update" on public.%I as restrictive for update to authenticated using (%s) with check (%s)', t, rule, rule);
      execute format('drop policy if exists "connected apps cannot delete" on public.%I', t);
      execute format('create policy "connected apps cannot delete" on public.%I as restrictive for delete to authenticated using (%s)', t, rule);
    end if;
  end loop;
end;
$$;
