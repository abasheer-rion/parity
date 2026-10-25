-- Parity Academy progress (DEC-0042): which lessons each person has opened and finished,
-- and their best quick check score, so progress and "continue where you left off" follow
-- the person between devices. One row per person, course and lesson. Each person reads
-- and writes only their own rows. Additive only: one new table and its two triggers,
-- nothing else changes.

create table if not exists public.academy_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Course and lesson ids as in academy/courses/*.json: lower case letters, digits and dashes.
  course text not null check (course ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  lesson text not null check (lesson ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  -- Best quick check result: right answers out of questions. Empty until the check is done.
  score smallint check (score between 0 and 20),
  total smallint check (total between 1 and 20),
  done_at timestamptz,
  -- When the lesson was last opened; the newest row is where "Continue" goes.
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint academy_progress_one_row unique (user_id, course, lesson),
  constraint academy_progress_score_fits check (score is null or total is null or score <= total)
);

-- An update never lowers the best score, never clears a finished lesson and never moves a
-- row to another person, course or lesson, whatever the app sends (two devices can save
-- in either order).
create or replace function public.academy_progress_keep_best()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.score is not null and (new.score is null or new.score < old.score) then
    new.score := old.score;
    new.total := old.total;
  end if;
  new.done_at := coalesce(old.done_at, new.done_at);
  new.user_id := old.user_id;
  new.course := old.course;
  new.lesson := old.lesson;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists academy_progress_keep_best on public.academy_progress;
create trigger academy_progress_keep_best
  before update on public.academy_progress
  for each row execute function public.academy_progress_keep_best();

-- At most 1,000 rows per person (the courses have 50 lessons today), so one account
-- cannot fill the table with made-up lesson ids. The count runs under the caller's row
-- level security, so it counts only their own rows.
create or replace function public.academy_progress_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.academy_progress where user_id = new.user_id) >= 1000 then
    raise exception 'academy_progress: at most 1000 rows per person';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_progress_cap on public.academy_progress;
create trigger academy_progress_cap
  before insert on public.academy_progress
  for each row execute function public.academy_progress_cap();

revoke all on function public.academy_progress_keep_best() from public, anon, authenticated;
revoke all on function public.academy_progress_cap() from public, anon, authenticated;

alter table public.academy_progress enable row level security;

revoke all on public.academy_progress from anon, authenticated;
grant select, insert, update, delete on public.academy_progress to authenticated;

drop policy if exists "own progress" on public.academy_progress;
create policy "own progress" on public.academy_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
