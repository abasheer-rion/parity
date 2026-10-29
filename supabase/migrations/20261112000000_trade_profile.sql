-- Trade profile and leaderboard. A person can pick a public handle, an optional display name
-- and a country, and choose to appear on a leaderboard of demo (paper) trading results.
-- Nobody is on the board unless they switch it on, and switching it on needs a handle.
--
-- What other people can see: only the board rows of people who opted in and have enough
-- trades, and only the handle, display name, initials, country, region and the numbers.
-- Never an account id, an email or anything from auth. People who did not opt in never
-- appear, and their numbers are never computed for anyone else.
--
-- Objects
--   public.trader_profiles      one row per person, each person reads and writes only their own
--   public.country_region(code) country code to one of seven regions
--   public.leaderboard_public   the board (signed-in people only, never signed-out visitors)
--   public.my_trade_stats       the caller's own numbers for week, month and all time
--   trade_profile_private       a schema the API does not serve. It holds the functions the two
--                               views read from. They run as the table owner, so they can read
--                               everyone's fills, and they return only the allowed rows.
--
-- The numbers come from closed trades: demo fills with a realized P&L, across all of a
-- person's demo accounts. Fees: realized_pnl is already net of both fees (matching.ts puts the
-- buy fee into the cost basis and subtracts the sell fee), so it is used as it is and the
-- fee column is NOT subtracted again. The web calendar must use realized_pnl the same way.
--
-- Additive only: one new table, one new schema, functions and two views. Nothing else changes.
-- Rollback (by hand): drop view public.leaderboard_public, public.my_trade_stats; drop schema
-- trade_profile_private cascade; drop function public.country_region(text); drop table
-- public.trader_profiles.

-- ---------------------------------------------------------------- the profile table

create table if not exists public.trader_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  handle text check (handle ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) between 1 and 60 and btrim(display_name) <> ''),
  -- Chosen by the person, never inferred.
  country text check (country ~ '^[A-Z]{2}$'),
  on_leaderboard boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trader_profiles_board_needs_handle check (not on_leaderboard or handle is not null)
);

-- Handles are unique whatever the case: "Ada" and "ada" cannot both exist.
create unique index if not exists trader_profiles_handle_lower on public.trader_profiles (lower(handle));
create index if not exists trader_profiles_on_board on public.trader_profiles (user_id) where on_leaderboard;

-- Keeps created_at as it was and stamps updated_at on every change.
create or replace function public.trader_profiles_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.trader_profiles_touch() from public, anon, authenticated;

drop trigger if exists trader_profiles_touch on public.trader_profiles;
create trigger trader_profiles_touch before insert or update on public.trader_profiles
  for each row execute function public.trader_profiles_touch();

alter table public.trader_profiles enable row level security;

-- Signed-out visitors get nothing; signed-in people get plain row access, no TRUNCATE.
revoke all on public.trader_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.trader_profiles to authenticated;

drop policy if exists "own trader profile" on public.trader_profiles;
create policy "own trader profile" on public.trader_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Connected AI apps (tokens with a client_id) may read but never change the profile (DEC-0051).
drop policy if exists "connected apps cannot insert" on public.trader_profiles;
create policy "connected apps cannot insert" on public.trader_profiles as restrictive
  for insert to authenticated with check (((select auth.jwt()) ->> 'client_id') is null);
drop policy if exists "connected apps cannot update" on public.trader_profiles;
create policy "connected apps cannot update" on public.trader_profiles as restrictive
  for update to authenticated
  using (((select auth.jwt()) ->> 'client_id') is null)
  with check (((select auth.jwt()) ->> 'client_id') is null);
drop policy if exists "connected apps cannot delete" on public.trader_profiles;
create policy "connected apps cannot delete" on public.trader_profiles as restrictive
  for delete to authenticated using (((select auth.jwt()) ->> 'client_id') is null);

-- ---------------------------------------------------------------- country to region

-- One of seven regions, or null for a null or unknown code. The web list
-- (web/src/lib/tradeProfile/countries.ts) must give the same region for every code.
-- Choices: Mexico, Central America and the Caribbean (Puerto Rico included) are Latin America;
-- Turkey, Cyprus and Russia are Europe; Egypt and North Africa are Africa; the Caucasus and
-- Central Asia are Asia; Antarctica has no region. XK (Kosovo) is Europe.
create or replace function public.country_region(code text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case
    when code is null then null
    when code = any (array['BM','CA','GL','PM','US']) then 'North America'
    when code = any (array['AG','AI','AR','AW','BB','BL','BO','BQ','BR','BS','BZ','CL','CO','CR',
      'CU','CW','DM','DO','EC','FK','GD','GF','GP','GS','GT','GY','HN','HT','JM','KN','KY','LC',
      'MF','MQ','MS','MX','NI','PA','PE','PR','PY','SR','SV','SX','TC','TT','UY','VC','VE','VG',
      'VI']) then 'Latin America'
    when code = any (array['AD','AL','AT','AX','BA','BE','BG','BV','BY','CH','CY','CZ','DE','DK',
      'EE','ES','FI','FO','FR','GB','GG','GI','GR','HR','HU','IE','IM','IS','IT','JE','LI','LT',
      'LU','LV','MC','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SJ','SK',
      'SM','TR','UA','VA','XK']) then 'Europe'
    when code = any (array['AE','BH','IL','IQ','IR','JO','KW','LB','OM','PS','QA','SA','SY',
      'YE']) then 'Middle East'
    when code = any (array['AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG',
      'EH','ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG','ML','MR',
      'MU','MW','MZ','NA','NE','NG','RE','RW','SC','SD','SH','SL','SN','SO','SS','ST','SZ','TD',
      'TF','TG','TN','TZ','UG','YT','ZA','ZM','ZW']) then 'Africa'
    when code = any (array['AF','AM','AZ','BD','BN','BT','CN','GE','HK','ID','IN','IO','JP','KG',
      'KH','KP','KR','KZ','LA','LK','MM','MN','MO','MV','MY','NP','PH','PK','SG','TH','TJ','TL',
      'TM','TW','UZ','VN']) then 'Asia'
    when code = any (array['AS','AU','CC','CK','CX','FJ','FM','GU','HM','KI','MH','MP','NC','NF',
      'NR','NU','NZ','PF','PG','PN','PW','SB','TK','TO','TV','UM','VU','WF','WS']) then 'Oceania'
  end;
$$;

revoke all on function public.country_region(text) from public, anon, authenticated;
grant execute on function public.country_region(text) to authenticated;

-- ---------------------------------------------------------------- the private functions

create schema if not exists trade_profile_private;
revoke all on schema trade_profile_private from public, anon, authenticated;
-- The views run as the caller, so signed-in people need to look inside the schema to reach
-- the two board functions. Nothing else in it is granted, and the API does not serve it.
grant usage on schema trade_profile_private to authenticated;
-- A function added here later is not callable by everyone by default.
alter default privileges in schema trade_profile_private revoke execute on functions from public;

-- The numbers for the given people, one row per person and period. Not callable by any API
-- role: only the two functions below use it, as the owner.
--   window        week: bar_date after today - 7; month: after today - 30; all: everything
--   capital       sum of starting cash over the person's demo accounts
--   daily P&L     sum of realized_pnl per bar_date (already net of fees, see the top)
--   total_return  sum of daily P&L / capital
--   risk_adjusted mean(daily return) / sample stddev(daily return) * sqrt(active days);
--                 null with fewer than 2 active days or no spread
--   win_rate      closed trades with realized_pnl > 0 / closed trades (null with none)
--   max_drawdown  largest (peak - equity) / peak, equity = capital + running P&L, the peak
--                 starting at capital; 0 with no trades
--   qualifies     trades >= min_trades (week 5, month 10, all 20) and risk_adjusted is known
create or replace function trade_profile_private.compute_stats(p_users uuid[])
returns table (user_id uuid, period text, trades integer, active_days integer,
  total_return double precision, risk_adjusted double precision, win_rate double precision,
  max_drawdown double precision, min_trades integer, qualifies boolean)
language sql stable set search_path = '' as $$
  with periods (period, min_trades, since, sort) as (
    values ('week'::text, 5, current_date - 7, 1), ('month', 10, current_date - 30, 2), ('all', 20, null::date, 3)
  ),
  people as (
    select distinct u as user_id from unnest(p_users) u where u is not null
  ),
  capital as (
    select p.user_id, coalesce(sum(a.starting_cash), 0) as capital
    from people p left join public.paper_accounts a on a.user_id = p.user_id
    group by p.user_id
  ),
  daily as (
    select f.user_id, w.period, f.bar_date, sum(f.realized_pnl) as pnl, count(*) as n,
           count(*) filter (where f.realized_pnl > 0) as wins
    from public.paper_fills f
    join people p on p.user_id = f.user_id
    join periods w on w.since is null or f.bar_date > w.since
    where f.realized_pnl is not null
    group by f.user_id, w.period, f.bar_date
  ),
  curve as (
    select d.*, c.capital, c.capital + sum(d.pnl) over run as equity
    from daily d join capital c on c.user_id = d.user_id
    window run as (partition by d.user_id, d.period order by d.bar_date rows between unbounded preceding and current row)
  ),
  peaks as (
    select c.*, greatest(c.capital, max(c.equity) over run) as peak
    from curve c
    window run as (partition by c.user_id, c.period order by c.bar_date rows between unbounded preceding and current row)
  ),
  agg as (
    select k.user_id, k.period, sum(k.n)::integer as trades, count(*)::integer as active_days,
           sum(k.wins)::integer as wins, sum(k.pnl) as pnl,
           avg(k.pnl / k.capital) as mean_ret, stddev_samp(k.pnl / k.capital) as sd_ret,
           max((k.peak - k.equity) / k.peak) as mdd
    from peaks k where k.capital > 0
    group by k.user_id, k.period
  ),
  stats as (
    select p.user_id, w.period, w.sort, w.min_trades,
           coalesce(a.trades, 0) as trades, coalesce(a.active_days, 0) as active_days,
           case when c.capital > 0 then (coalesce(a.pnl, 0) / c.capital)::double precision end as total_return,
           case when a.active_days >= 2 and a.sd_ret > 0
                then (a.mean_ret / a.sd_ret)::double precision * sqrt(a.active_days::double precision) end as risk_adjusted,
           case when a.trades > 0 then (a.wins::numeric / a.trades)::double precision end as win_rate,
           coalesce(a.mdd, 0)::double precision as max_drawdown
    from people p
    cross join periods w
    join capital c on c.user_id = p.user_id
    left join agg a on a.user_id = p.user_id and a.period = w.period
  )
  select s.user_id, s.period, s.trades, s.active_days, s.total_return, s.risk_adjusted,
         s.win_rate, s.max_drawdown, s.min_trades,
         s.trades >= s.min_trades and s.risk_adjusted is not null
  from stats s
  order by s.user_id, s.sort;
$$;

revoke all on function trade_profile_private.compute_stats(uuid[]) from public, anon, authenticated;

-- Two upper-case letters for an avatar: first letters of the first and last word of the
-- display name, or its first two letters, else the first two letters of the handle.
create or replace function trade_profile_private.initials(p_display_name text, p_handle text) returns text
language sql immutable set search_path = '' as $$
  with w as (
    select regexp_split_to_array(btrim(regexp_replace(coalesce(p_display_name, ''), '[^[:alnum:][:space:]]', '', 'g')), '\s+') as words
  )
  select upper(case
    when array_length(w.words, 1) >= 2 then left(w.words[1], 1) || left(w.words[array_length(w.words, 1)], 1)
    when char_length(w.words[1]) >= 2 then left(w.words[1], 2)
    when char_length(regexp_replace(coalesce(p_handle, ''), '[^[:alnum:]]', '', 'g')) >= 2
      then left(regexp_replace(p_handle, '[^[:alnum:]]', '', 'g'), 2)
    else left(coalesce(p_handle, ''), 2)
  end)
  from w;
$$;

revoke all on function trade_profile_private.initials(text, text) from public, anon, authenticated;

-- The board: people who opted in and have a handle, only in the periods where they qualify.
-- It returns no account id; is_you is worked out here from the caller's token.
create or replace function trade_profile_private.leaderboard_rows()
returns table (period text, rank integer, handle text, display_name text, initials text,
  country text, region text, trades integer, active_days integer, total_return double precision,
  risk_adjusted double precision, win_rate double precision, max_drawdown double precision,
  min_trades integer, is_you boolean)
language sql stable security definer set search_path = '' as $$
  with board as (
    select t.user_id, t.handle, t.display_name, t.country
    from public.trader_profiles t
    where t.on_leaderboard and t.handle is not null
  )
  select s.period,
         (rank() over (partition by s.period order by s.risk_adjusted desc, s.trades desc))::integer,
         b.handle, b.display_name, trade_profile_private.initials(b.display_name, b.handle),
         b.country, public.country_region(b.country),
         s.trades, s.active_days, s.total_return, s.risk_adjusted, s.win_rate, s.max_drawdown,
         s.min_trades, s.user_id = (select auth.uid())
  from trade_profile_private.compute_stats(array(select b2.user_id from board b2)) s
  join board b on b.user_id = s.user_id
  where s.qualifies and (select auth.uid()) is not null;
$$;

revoke all on function trade_profile_private.leaderboard_rows() from public, anon, authenticated;
grant execute on function trade_profile_private.leaderboard_rows() to authenticated;

-- The caller's own numbers, three rows, whether or not they are on the board.
create or replace function trade_profile_private.my_stats()
returns table (period text, trades integer, active_days integer, total_return double precision,
  risk_adjusted double precision, win_rate double precision, max_drawdown double precision,
  min_trades integer, qualifies boolean, on_leaderboard boolean, board_rank integer)
language sql stable security definer set search_path = '' as $$
  select s.period, s.trades, s.active_days, s.total_return, s.risk_adjusted, s.win_rate,
         s.max_drawdown, s.min_trades, s.qualifies, coalesce(t.on_leaderboard, false),
         case when coalesce(t.on_leaderboard, false) and t.handle is not null and s.qualifies
              then (select l.rank from trade_profile_private.leaderboard_rows() l
                    where l.is_you and l.period = s.period) end
  from trade_profile_private.compute_stats(array[(select auth.uid())]) s
  left join public.trader_profiles t on t.user_id = s.user_id
  where s.user_id = (select auth.uid());
$$;

revoke all on function trade_profile_private.my_stats() from public, anon, authenticated;
grant execute on function trade_profile_private.my_stats() to authenticated;

-- ---------------------------------------------------------------- the two views

-- Both run as the caller (no security definer view), read only from the functions above, and
-- carry no account id or email. Signed-in people only.
create or replace view public.leaderboard_public with (security_invoker = true) as
  select period, rank, handle, display_name, initials, country, region, trades, active_days,
         total_return, risk_adjusted, win_rate, max_drawdown, min_trades, is_you
  from trade_profile_private.leaderboard_rows();

create or replace view public.my_trade_stats with (security_invoker = true) as
  select period, trades, active_days, total_return, risk_adjusted, win_rate, max_drawdown,
         min_trades, qualifies, on_leaderboard, board_rank
  from trade_profile_private.my_stats();

revoke all on public.leaderboard_public, public.my_trade_stats from public, anon, authenticated;
grant select on public.leaderboard_public, public.my_trade_stats to authenticated;
