-- Check of 20261108000000_personalization.sql (DEC-0068): row rules, the off switch, the analytics
-- opt-out, experiment assignment and stop rules, team-only reads and the DEC-0015 grants. Run it
-- with supabase/tests/local.sh. Never applied to the hosted project.
--
-- Every check raises an error when it fails and prints "personalization: all checks passed" at
-- the end.

\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@x'),
  ('22222222-2222-2222-2222-222222222222', 'b@x'),
  ('33333333-3333-3333-3333-333333333333', 'team@x')
on conflict do nothing;
insert into analytics.viewers (user_id) values ('33333333-3333-3333-3333-333333333333') on conflict do nothing;

create or replace function pg_temp.as_user(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated')::text, true); $$;
create or replace function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end; $$;
create or replace function pg_temp.refused(stmt text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok: % (refused: %)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % was allowed', what;
end; $$;

-- 0. Assignment matches the app: same bucket for the shared test vector -----------------------
select pg_temp.expect(abs(personalization.bucket('t', '11111111-1111-1111-1111-111111111111') - 0.5389482050668448) < 1e-9, 'bucket matches web/src/lib/personalize/experiments.ts');
select pg_temp.expect(personalization.pick('{a,b}', '{50,50}', 0.49) = 'a' and personalization.pick('{a,b}', '{50,50}', 0.5) = 'b', 'pick splits by weight');
select pg_temp.expect(personalization.pick('{a,b,c}', '{0,0,0}', 0.9) = 'a', 'zero weights fall back to control');

-- Analytics events for A, written as the owner (the ingest path is tested in test_analytics.sql).
insert into analytics.events (at, app, kind, name, route, session_id, visitor_id, user_hash, props)
select now() - make_interval(hours => g), 'academy', 'pageview', '', '/l', gen_random_uuid(), gen_random_uuid(),
       analytics.user_hash('11111111-1111-1111-1111-111111111111'), '{}'::jsonb
from generate_series(1, 30) g;

set local role authenticated;

-- 1. Settings: on by default, own row only, no direct writes ----------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect((public.personalization_get()->'settings'->>'enabled')::boolean, 'on by default before any row');
select public.personalization_set(null, false);
select pg_temp.expect((select count(*) = 1 from public.personalization_settings), 'A sees own settings row');
select pg_temp.refused($$update public.personalization_settings set enabled = false$$, 'A updates settings directly');
select pg_temp.refused($$insert into public.personalization_profiles (user_id, learner, trader, engagement, paid_use, segment, risk_band, engagement_band) values ('11111111-1111-1111-1111-111111111111', 1, 1, 1, 1, 'both', 'bold', 'heavy')$$, 'A writes a profile directly');
select pg_temp.refused($$delete from public.reco_feedback$$, 'A deletes feedback directly');
select pg_temp.refused($$select * from public.experiments$$, 'A reads the experiments table');
select pg_temp.refused($$select * from personalization.arm_stats$$, 'A reads the internal schema');

-- 2. A profile from product actions only (analytics off) --------------------------------------
insert into public.academy_progress (course, lesson, score, total, done_at) values
  ('basics', 'one', 3, 4, now()), ('basics', 'two', 4, 4, now()), ('basics', 'three', null, null, null);
insert into public.paper_accounts (id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.paper_orders (account_id, symbol, side, type, qty, status, placed_on, fill_price, filled_on)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'crypto.BTC', 'buy', 'market', 1, 'filled', current_date, 100, current_date),
       ('aaaaaaaa-0000-0000-0000-000000000001', 'crypto.BTC', 'sell', 'market', 1, 'filled', current_date, 100, current_date);
select public.reco_log('[{"item":"algo:ts-momentum","ev":"show","tags":["asset:fx","family:momentum"]},{"item":"algo:ts-momentum","ev":"click"},{"item":"lesson:basics-one","ev":"show"},{"item":"lesson:basics-one","ev":"dismiss"},{"item":"BAD","ev":"show"},{"item":"algo:x","ev":"nope"}]'::jsonb);
select public.personalization_refresh();
select pg_temp.expect((select sources = '{product}' from public.personalization_profiles), 'analytics off: product data only');
select pg_temp.expect((select (inputs->>'lessons_done')::int = 2 and (inputs->>'demo_orders')::int = 2 from public.personalization_profiles), 'inputs counted');
select pg_temp.expect((select not (inputs ? 'academy_views') from public.personalization_profiles), 'no page use without consent');
select pg_temp.expect((select risk is not null and risk_band <> 'unknown' from public.personalization_profiles), 'demo style from demo orders');
select pg_temp.expect((select interests->'family' ? 'momentum' and interests->'asset' ? 'crypto' from public.personalization_profiles), 'interests from orders and clicks');
select pg_temp.expect((select segment in ('learner', 'trader', 'both') from public.personalization_profiles), 'a segment');

-- 3. With analytics consent the page views count; withdrawing it rebuilds without them ---------
select public.personalization_set(null, true);
select pg_temp.expect((select sources = '{product,analytics}' and (inputs->>'academy_views')::int = 30 from public.personalization_profiles), 'consent on: page use counted');
select public.personalization_set(null, false);
select pg_temp.expect((select sources = '{product}' and not (inputs ? 'academy_views') from public.personalization_profiles), 'consent withdrawn: rebuilt without page use');

-- 4. What's new counts: a show once an hour, a click once, no ids in the totals ---------------
select public.reco_log('[{"item":"algo:ts-momentum","ev":"show"},{"item":"algo:ts-momentum","ev":"click"}]'::jsonb);
select pg_temp.expect((select shows = 1 and clicks = 1 from public.reco_arms('{algo:ts-momentum}')), 'repeat show and click not counted twice');
select pg_temp.expect((select dismissed_at is not null from public.reco_feedback where item = 'lesson:basics-one'), 'dismiss stored');
select pg_temp.expect((select count(*) = 2 from public.reco_feedback), 'bad items ignored');

-- 5. Widgets: ignored sessions, use resets them, keep restores ---------------------------------
select public.widget_seen('{markets,news,account}', '{markets}');
select pg_temp.expect((select ignored_sessions = 1 from public.personalization_widgets where widget_id = 'news'), 'ignored session counted');
select public.widget_seen('{news}', '{}');
select pg_temp.expect((select ignored_sessions = 1 from public.personalization_widgets where widget_id = 'news'), 'a reload is not a new session');
select public.widget_choose('news', 'keep');
select pg_temp.expect((select choice = 'keep' and ignored_sessions = 0 from public.personalization_widgets where widget_id = 'news'), 'restore keeps and clears');
select pg_temp.refused($$select public.widget_choose('news', 'hide')$$, 'unknown widget choice');

-- 6. Experiments: the variant comes from the user id, exposure and outcomes counted once ------
select pg_temp.expect((select bool_and(exposed) and count(*) = 2 from public.experiment_assign('{whats_new_order,widget_defaults}')), 'running experiments assign');
reset role;
select pg_temp.expect((select variant = personalization.pick('{control,personal}', '{50,50}', personalization.bucket('whats_new_order', '11111111-1111-1111-1111-111111111111')) from personalization.exposures where experiment = 'whats_new_order' and user_id = '11111111-1111-1111-1111-111111111111'), 'variant from the hashed user id');
set local role authenticated;
select pg_temp.expect((select not exposed and variant = 'control' from public.experiment_assign('{no_such_test}')), 'unknown experiment: control, not exposed');
select public.experiment_track('whats_new_click');
select public.experiment_track('whats_new_click');
select pg_temp.refused($$select public.experiment_track('made_up')$$, 'unknown metric');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.expect((select count(*) = 0 from public.personalization_profiles), 'B cannot see A profile');
select pg_temp.expect((select count(*) = 0 from public.reco_feedback), 'B cannot see A feedback');
select pg_temp.expect((select count(*) = 0 from public.personalization_widgets), 'B cannot see A widgets');
select pg_temp.expect((select count(*) = 0 from public.personalization_settings), 'B cannot see A settings');
select pg_temp.refused($$select public.metrics_personalization()$$, 'non-team reads personalization metrics');
select pg_temp.refused($$select public.metrics_experiments()$$, 'non-team reads experiment results');

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect((select (public.metrics_personalization()->>'profiles') is null), 'a count under 5 is hidden');
select pg_temp.expect((select (a->>'exposed')::int = 1 and coalesce((a->'metrics'->>'whats_new_click')::int, 0) = 1
  from jsonb_array_elements(public.metrics_experiments()) e, jsonb_array_elements(e->'arms') a
  where e->>'key' = 'whats_new_order' and (a->>'exposed')::int > 0), 'one exposure and one click counted');

-- 7. Switching off: rows deleted, the switch-off counted without an id, nothing more stored ----
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.personalization_set(false, null);
select pg_temp.expect((select count(*) = 0 from public.personalization_profiles), 'off: profile deleted');
select pg_temp.expect((select count(*) = 0 from public.reco_feedback), 'off: feedback deleted');
select pg_temp.expect((select count(*) = 0 from public.personalization_widgets), 'off: widgets deleted');
select pg_temp.expect((select not enabled from public.personalization_settings), 'off is remembered');
select pg_temp.expect((public.personalization_get()->'experiments') = '[]'::jsonb, 'off: no experiments');
select pg_temp.expect(public.reco_log('[{"item":"algo:a","ev":"show"}]'::jsonb) = 0, 'off: reco_log stores nothing');
select pg_temp.expect((select not exposed from public.experiment_assign('{whats_new_order}')), 'off: control, not exposed');
select pg_temp.expect(public.personalization_refresh() is null, 'off: no profile');
select public.widget_seen('{news}', '{}');
select pg_temp.expect((select count(*) = 0 from public.personalization_widgets), 'off: widget use not stored');

reset role;
select pg_temp.expect((select count(*) = 0 from personalization.exposures where user_id = '11111111-1111-1111-1111-111111111111'), 'off: exposures deleted');
select pg_temp.expect((select users = 1 from personalization.experiment_counts where experiment = 'whats_new_order' and metric = 'personalization_off'), 'switch-off counted as a guardrail');
select pg_temp.expect((select users = 1 from personalization.experiment_counts where experiment = 'whats_new_order' and metric = 'exposed'), 'arm size kept after switch-off');

-- 8. Stop rules -------------------------------------------------------------------------------
insert into public.experiments (key, name, variants, weights, primary_metric, guardrails, min_per_arm, max_days, status, started_at)
values ('t_guard', 'g', '{control,b}', '{50,50}', 'whats_new_click', '{whats_new_dismiss}', 5000, 42, 'running', now()),
       ('t_time', 't', '{control,b}', '{50,50}', 'whats_new_click', '{}', 5000, 7, 'running', now() - interval '8 days'),
       ('t_size', 's', '{control,b}', '{50,50}', 'whats_new_click', '{}', 100, 42, 'running', now()),
       ('t_fine', 'f', '{control,b}', '{50,50}', 'whats_new_click', '{whats_new_dismiss}', 5000, 42, 'running', now());
insert into personalization.experiment_counts (experiment, variant, metric, users) values
  ('t_guard', 'control', 'exposed', 1000), ('t_guard', 'b', 'exposed', 1000),
  ('t_guard', 'control', 'whats_new_dismiss', 50), ('t_guard', 'b', 'whats_new_dismiss', 120),
  ('t_size', 'control', 'exposed', 100), ('t_size', 'b', 'exposed', 100),
  ('t_fine', 'control', 'exposed', 1000), ('t_fine', 'b', 'exposed', 1000),
  ('t_fine', 'control', 'whats_new_dismiss', 50), ('t_fine', 'b', 'whats_new_dismiss', 55);
select personalization.check_stops();
select pg_temp.expect((select status = 'stopped' and stop_reason like 'guardrail: whats_new_dismiss%' from public.experiments where key = 't_guard'), 'guardrail harm stops');
select pg_temp.expect((select status = 'stopped' and stop_reason = 'time limit' from public.experiments where key = 't_time'), 'time limit stops');
select pg_temp.expect((select status = 'stopped' and stop_reason = 'sample reached' from public.experiments where key = 't_size'), 'planned size stops');
select pg_temp.expect((select status = 'running' from public.experiments where key = 't_fine'), 'noise does not stop');
select pg_temp.expect((select count(*) = 3 from public.experiments where key in ('whats_new_order', 'whats_new_hook', 'widget_defaults') and status = 'running'), 'first experiments running');

-- 9. The research writer reaches nothing here (DEC-0015); anon reaches nothing -----------------
select pg_temp.expect(not has_schema_privilege('parity_writer', 'personalization', 'usage'), 'writer: no schema usage');
select pg_temp.expect((select bool_and(not has_table_privilege('parity_writer', t, 'select') and not has_table_privilege('parity_writer', t, 'insert'))
  from unnest(array['public.personalization_settings', 'public.personalization_profiles', 'public.personalization_widgets',
    'public.reco_feedback', 'public.experiments']) t), 'writer: no table access');
select pg_temp.expect((select bool_and(not has_function_privilege('parity_writer', f, 'execute') and not has_function_privilege('anon', f, 'execute'))
  from unnest(array['public.personalization_get()', 'public.personalization_set(boolean, boolean)', 'public.personalization_refresh()',
    'public.reco_log(jsonb)', 'public.reco_arms(text[])', 'public.experiment_assign(text[])', 'public.experiment_track(text)',
    'public.metrics_personalization()', 'public.metrics_experiments()']) f), 'writer and anon: no function access');
select pg_temp.expect(not has_table_privilege('anon', 'public.personalization_profiles', 'select'), 'anon: no profile access');
select pg_temp.expect(not has_function_privilege('authenticated', 'personalization.compute(uuid)', 'execute'), 'internal compute not callable');

-- 10. Account deletion removes everything, settings included ----------------------------------
select public.analytics_forget_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect((select count(*) = 0 from public.personalization_settings where user_id = '11111111-1111-1111-1111-111111111111'), 'account deletion removes settings');

-- 11. Upkeep runs ----------------------------------------------------------------------------
select personalization.maintain();
select personalization.refresh_all();

rollback;
\echo 'personalization: all checks passed'
