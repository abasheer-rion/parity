-- The first-run intro (DEC-0077): a few full-screen questions after the first sign-in, then one
-- real Verify result. This file adds five columns to onboarding_state (20261106000000), the
-- table that already holds each person's checklist and tours, so the same row rules apply:
-- a person reads and writes only their own row, and connected AI apps cannot write it.
--
--   intro_status   'done' or 'skipped' once the intro ends, so it never opens again. Never
--                  cleared once set (the guard below keeps it).
--   intro_step     the screen the person was on, so a closed tab resumes there.
--   intro_goal     what brings them here: verify, learn, trade or research.
--   intro_level    how much they have traded: new, some or experienced.
--   intro_markets  markets they follow: stocks, fx, crypto, commodities (at most 4).
--
-- Nothing sensitive: the answers are which parts of Parity someone wants and which markets
-- they follow, the same kind of thing personalization (DEC-0068) already infers from use.
--
-- Additive only. Safe to apply twice. Rollback (by hand): drop the five columns and their
-- checks, and re-create public.onboarding_state_guard() from 20261106000000_onboarding.sql.

alter table public.onboarding_state
  add column if not exists intro_status text,
  add column if not exists intro_step smallint not null default 0,
  add column if not exists intro_goal text,
  add column if not exists intro_level text,
  add column if not exists intro_markets text[] not null default '{}';

alter table public.onboarding_state drop constraint if exists onboarding_intro_shape;
alter table public.onboarding_state add constraint onboarding_intro_shape check (
  (intro_status is null or intro_status in ('done', 'skipped'))
  and intro_step between 0 and 9
  and (intro_goal is null or intro_goal in ('verify', 'learn', 'trade', 'research'))
  and (intro_level is null or intro_level in ('new', 'some', 'experienced'))
  and cardinality(intro_markets) <= 4
  and intro_markets <@ array['stocks', 'fx', 'crypto', 'commodities']::text[]
);

-- The same guard as before, plus: once the intro has ended it stays ended, whatever a stale
-- tab sends later.
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
    new.intro_status := coalesce(old.intro_status, new.intro_status);
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

revoke all on function public.onboarding_state_guard() from public, anon, authenticated;
