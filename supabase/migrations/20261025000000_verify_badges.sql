-- Parity Verify badges and the opt-in research dataset (REF-0016 "Data handling and
-- privacy", DEC-0036). Additive only: new tables, a view, functions and triggers.
--
-- verify_badges   a published badge: summary numbers and a file hash, never trades or the
--                 file. The owner reads and withdraws their own rows. Withdrawing wipes
--                 every number and keeps only the id and the dates, so the public page can
--                 say "withdrawn by its owner on <date>" instead of vanishing. Deleting the
--                 account withdraws its badges the same way. Nobody can delete a row.
--                 Publishing needs sign-in and is capped at 20 a day per account.
-- verify_badges_public
--                 the public columns, with no owner id. It is read only through
--                 verify_badge_public(id), one badge by its id, so the list of badges
--                 cannot be paged through.
-- verify_dataset  opt-in rows with no user id, dates rounded to the month. Signed-in people
--                 may add rows (20 a day, counted in verify_dataset_quota, which holds no
--                 row ids) and nobody but the database owner can read them.

-- ---------------------------------------------------------------- badges

create table if not exists public.verify_badges (
  id text primary key check (id ~ '^[A-Za-z0-9]{12}$'),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  name text check (char_length(name) between 1 and 80),
  input_kind text check (input_kind in ('real', 'demo', 'backtest')),
  stated_tries integer check (stated_tries between 1 and 1000000000),
  date_from date,
  date_to date,
  trade_count integer check (trade_count between 0 and 1000000),
  verdict text check (verdict in ('holds_up', 'could_be_luck', 'fragile', 'does_not_hold_up', 'not_enough_data')),
  survives_tries bigint check (survives_tries between 0 and 1000000000),
  cards jsonb check (jsonb_typeof(cards) = 'object' and pg_column_size(cards) <= 32000),
  method_version text check (char_length(method_version) between 1 and 32),
  file_sha256 text check (file_sha256 ~ '^[0-9a-f]{64}$'),
  constraint verify_badges_dates check (date_from is null or date_to is null or date_from <= date_to),
  -- A live badge has all its numbers; a withdrawn one has none of them.
  constraint verify_badges_whole check (
    (withdrawn_at is null
      and name is not null and input_kind is not null and stated_tries is not null
      and verdict is not null and cards is not null and method_version is not null and file_sha256 is not null)
    or
    (withdrawn_at is not null
      and name is null and input_kind is null and stated_tries is null and date_from is null and date_to is null
      and trade_count is null and verdict is null and survives_tries is null and cards is null
      and method_version is null and file_sha256 is null))
);

create index if not exists verify_badges_user_created on public.verify_badges (user_id, created_at);

alter table public.verify_badges enable row level security;

-- Signed-out visitors get nothing from the table itself (they use the function below).
-- Signed-in people may read, add, and set withdrawn_at; no delete, no other updates.
revoke all on public.verify_badges from anon, authenticated;
grant select, insert on public.verify_badges to authenticated;
grant update (withdrawn_at) on public.verify_badges to authenticated;

drop policy if exists "own badges are readable" on public.verify_badges;
create policy "own badges are readable" on public.verify_badges
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "publish own badges" on public.verify_badges;
create policy "publish own badges" on public.verify_badges
  for insert to authenticated
  with check (user_id = (select auth.uid()) and withdrawn_at is null);

drop policy if exists "withdraw own badges" on public.verify_badges;
create policy "withdraw own badges" on public.verify_badges
  for update to authenticated
  using (user_id = (select auth.uid()) and withdrawn_at is null)
  with check (user_id = (select auth.uid()));

-- Before a badge is added: the server sets the owner and the date, and an account may add
-- at most 20 badges in any 24 hours (withdrawn ones count). The advisory lock makes two
-- publishes at the same moment queue, so the cap cannot be raced.
create or replace function public.verify_badges_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  recent integer;
begin
  if uid is null then
    raise exception 'Sign in to publish a badge.' using errcode = '42501';
  end if;
  new.user_id := uid;
  new.created_at := now();
  new.withdrawn_at := null;
  perform pg_advisory_xact_lock(hashtextextended('verify_badges:' || uid::text, 0));
  select count(*) into recent from public.verify_badges
    where user_id = uid and created_at > now() - interval '24 hours';
  if recent >= 20 then
    raise exception 'You can publish up to 20 badges a day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Before a badge changes: the only change allowed is withdrawing it, which stamps the date
-- and wipes every number. When the owner's account is deleted (user_id set to null by the
-- foreign key), the badge is withdrawn the same way, so it never stays up without an owner.
create or replace function public.verify_badges_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.withdrawn_at is not null then
    -- Already withdrawn: only the account deletion's user_id = null may pass.
    if new.user_id is null and old.user_id is not null then
      new.id := old.id; new.created_at := old.created_at; new.withdrawn_at := old.withdrawn_at;
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
  return new;
end;
$$;

revoke all on function public.verify_badges_before_insert() from public, anon, authenticated;
revoke all on function public.verify_badges_before_update() from public, anon, authenticated;

drop trigger if exists verify_badges_before_insert on public.verify_badges;
create trigger verify_badges_before_insert before insert on public.verify_badges
  for each row execute function public.verify_badges_before_insert();

drop trigger if exists verify_badges_before_update on public.verify_badges;
create trigger verify_badges_before_update before update on public.verify_badges
  for each row execute function public.verify_badges_before_update();

-- The public columns, with no owner id. Nobody is granted the view itself.
create or replace view public.verify_badges_public with (security_invoker = true) as
  select id, created_at, withdrawn_at, name, input_kind, stated_tries, date_from, date_to,
         trade_count, verdict, survives_tries, cards, method_version, file_sha256
  from public.verify_badges;

revoke all on public.verify_badges_public from public, anon, authenticated;

-- One badge by its id, for the public page and the badge image. It runs as the owner of
-- the tables, so it sees every row, but it only ever returns the one asked for.
create or replace function public.verify_badge_public(p_id text)
returns setof public.verify_badges_public
language sql stable security definer set search_path = '' as $$
  select * from public.verify_badges_public
  where p_id ~ '^[A-Za-z0-9]{12}$' and id = p_id;
$$;

revoke all on function public.verify_badge_public(text) from public;
grant execute on function public.verify_badge_public(text) to anon, authenticated;

-- ---------------------------------------------------------------- the opt-in dataset

create table if not exists public.verify_dataset (
  id bigint generated always as identity primary key,
  contributed_month date not null default date_trunc('month', now())::date
    check (contributed_month = date_trunc('month', contributed_month)::date),
  input_kind text not null check (input_kind in ('real', 'demo', 'backtest')),
  asset_classes text[] not null default '{}'
    check (asset_classes <@ array['fx', 'crypto', 'stocks', 'commodities', 'other']::text[]),
  stated_tries integer not null check (stated_tries between 1 and 1000000000),
  month_from date check (month_from = date_trunc('month', month_from)::date),
  month_to date check (month_to = date_trunc('month', month_to)::date),
  trade_count integer check (trade_count between 0 and 1000000),
  verdict text not null check (verdict in ('holds_up', 'could_be_luck', 'fragile', 'does_not_hold_up', 'not_enough_data')),
  summary jsonb not null check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 8000),
  method_version text not null check (char_length(method_version) between 1 and 32),
  constraint verify_dataset_months check (month_from is null or month_to is null or month_from <= month_to)
);

-- How many rows each account added on each day, for the 20 a day cap. No row ids, so it
-- cannot link a dataset row back to anyone.
create table if not exists public.verify_dataset_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  n integer not null default 0,
  primary key (user_id, day)
);

alter table public.verify_dataset enable row level security;
alter table public.verify_dataset_quota enable row level security;

revoke all on public.verify_dataset, public.verify_dataset_quota from anon, authenticated;
grant insert (input_kind, asset_classes, stated_tries, month_from, month_to, trade_count, verdict, summary, method_version)
  on public.verify_dataset to authenticated;

drop policy if exists "signed-in people may contribute" on public.verify_dataset;
create policy "signed-in people may contribute" on public.verify_dataset
  for insert to authenticated
  with check (true);

create or replace function public.verify_dataset_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    raise exception 'Sign in to add a result to the dataset.' using errcode = '42501';
  end if;
  new.contributed_month := date_trunc('month', now())::date;
  delete from public.verify_dataset_quota where day < current_date - 2;
  insert into public.verify_dataset_quota as q (user_id, day, n) values (uid, current_date, 1)
    on conflict (user_id, day) do update set n = q.n + 1
    returning n into used;
  if used > 20 then
    raise exception 'You can add up to 20 results a day to the dataset. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.verify_dataset_before_insert() from public, anon, authenticated;

drop trigger if exists verify_dataset_before_insert on public.verify_dataset;
create trigger verify_dataset_before_insert before insert on public.verify_dataset
  for each row execute function public.verify_dataset_before_insert();
