-- The fill price check's daily allowance (DEC-0092). Additive only: one table and one function.
--
-- fill_check_usage  one row per person per UTC day: how many fill price checks they asked for
--                   and how many fills those carried. No symbol, time or price is ever stored:
--                   the check keeps nothing about the fills themselves. Nobody reads or writes
--                   the table through the API; only fill_check_take() touches it.
--
-- fill_check_take(n)  called by /api/verify/fills with the person's own session before it
--                   checks n fills. Refuses past 400 checks or 50,000 fills a day, so the answers
--                   cannot be used to rebuild market data one guess at a time. Connected AI apps
--                   (a token with client_id) cannot use it. Rows older than 30 days are deleted.
--
-- To undo: drop function public.fill_check_take(integer); drop table public.fill_check_usage.

create table if not exists public.fill_check_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  requests integer not null default 0 check (requests >= 0),
  fills integer not null default 0 check (fills >= 0),
  primary key (user_id, day)
);

alter table public.fill_check_usage enable row level security;
alter table public.fill_check_usage force row level security;
revoke all on public.fill_check_usage from public, anon, authenticated;
drop policy if exists "closed to the api" on public.fill_check_usage;
create policy "closed to the api" on public.fill_check_usage for select to anon, authenticated using (false);

create or replace function public.fill_check_take(p_fills integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  r public.fill_check_usage;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'client_id', '') <> '' then
    raise exception 'Connected apps cannot run the fill price check.' using errcode = '42501';
  end if;
  if p_fills is null or p_fills < 1 or p_fills > 1000 then
    raise exception 'Send between 1 and 1,000 fills at a time.' using errcode = '22023';
  end if;
  delete from public.fill_check_usage where user_id = uid and day < today - 30;
  insert into public.fill_check_usage as u (user_id, day, requests, fills) values (uid, today, 1, p_fills)
    on conflict (user_id, day) do update set requests = u.requests + 1, fills = u.fills + excluded.fills
    returning * into r;
  if r.requests > 400 or r.fills > 50000 then
    raise exception 'You have used today''s fill price checks (50,000 fills or 400 checks a day). Try again tomorrow.' using errcode = 'P0001';
  end if;
  return 50000 - r.fills;
end
$$;

revoke all on function public.fill_check_take(integer) from public, anon;
grant execute on function public.fill_check_take(integer) to authenticated;
