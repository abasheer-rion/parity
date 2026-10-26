-- Checks for 20261107000000_data_registry.sql (DEC-0064), run by supabase/tests/local.sh after
-- every migration is applied. Each check raises an exception when a rule does not hold. Runs
-- in one transaction that is rolled back.

\o /dev/null
set client_min_messages = notice;
begin;

insert into auth.users (id, email) values
  ('41111111-1111-1111-1111-111111111111', 'team@example.com'),
  ('42222222-2222-2222-2222-222222222222', 'other@example.com');
insert into public.team_members (user_id, note) values ('41111111-1111-1111-1111-111111111111', 'test');

create function pg_temp.dr_check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.dr_refused(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when insufficient_privilege or raise_exception or check_violation then
  return true;
end $$;
create function pg_temp.dr_as(sub text, client text default null) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'client_id', client)::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.dr_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'anon', true);
$$;

-- The writer sends a document through the function.
set local role parity_writer;
select pg_temp.dr_check((public.report_registry($j${
  "sources": [
    {"id": "fred", "name": "FRED", "display_rights": "public", "terms_url": "https://fred.stlouisfed.org/legal/", "terms_read_on": "2026-10-26", "key_name": "FRED_API_KEY"},
    {"id": "kraken", "name": "Kraken", "display_rights": "internal", "terms_url": "https://www.kraken.com/legal/global-terms"},
    {"id": "imf", "name": "IMF via FRED", "display_rights": "research"}
  ],
  "series": [
    {"id": "fx.EUR", "source_id": "fred", "code": "DEXUSEU", "name": "USD per EUR", "frequency": "D", "status": "live", "display_rights": "public", "tags": ["fx", "g10"], "labels": {"theme": "fx"}},
    {"id": "kraken.XBTUSD", "source_id": "kraken", "code": "XBTUSD", "name": "Bitcoin in USD on Kraken", "frequency": "D", "status": "enrolled", "display_rights": "internal", "origin": "discovered"},
    {"id": "cmd.NICKEL", "source_id": "imf", "code": "PNICKUSDM", "name": "Nickel", "frequency": "M", "status": "live", "display_rights": "research"}
  ],
  "lineage": [{"series_id": "fx.EUR", "kind": "strategy", "consumer": "fx_carry"}, {"series_id": "fx.EUR", "kind": "page", "consumer": "terminal"}],
  "events": [{"series_id": "fx.EUR", "kind": "seeded", "to_state": "live", "event_key": "e1"}, {"series_id": "fx.EUR", "kind": "seeded", "to_state": "live", "event_key": "e1"}],
  "uptime": [{"scope": "source", "id": "fred", "day": "2026-10-26", "checks": 10, "ok": 9, "late": 1}],
  "previews": [{"series_id": "fx.EUR", "points": [["2026-10-01", 1.1]]}, {"series_id": "kraken.XBTUSD", "points": [["2026-10-01", 60000]]}],
  "backtests": [{"series_id": "kraken.XBTUSD", "ran_at": "2026-10-26T00:00:00Z", "trials": 4, "battery": {"trend": {"sharpe": 0.5}}}]
}$j$::jsonb) ->> 'series')::int = 3, 'the writer sends a registry document');
select pg_temp.dr_check(pg_temp.dr_refused($$select public.report_registry('{"previews": [{"series_id": "cmd.NICKEL", "points": []}]}'::jsonb)$$), 'no preview for research-only data');
select pg_temp.dr_check(pg_temp.dr_refused($$insert into public.data_series (id, source_id, name, frequency, status, display_rights) values ('x', 'fred', 'x', 'D', 'live', 'public')$$), 'the writer has no direct table rights');
select pg_temp.dr_check(pg_temp.dr_refused($$select public.report_registry('{"series": [{"id": "kraken.ETHUSD", "source_id": "kraken", "name": "Ether", "frequency": "D", "status": "enrolled", "display_rights": "public"}]}'::jsonb)$$), 'a series cannot have wider rights than its source');
select pg_temp.dr_check(pg_temp.dr_refused($$select public.report_registry(jsonb_build_object('previews', jsonb_build_array(jsonb_build_object('series_id', 'fx.EUR', 'points', jsonb_build_array(repeat('x', 30000))))))$$), 'an oversized preview is refused');
-- Lineage sent again replaces the list.
select public.report_registry('{"lineage": [{"series_id": "fx.EUR", "kind": "strategy", "consumer": "fx_trend"}]}'::jsonb);
reset role;
select pg_temp.dr_check((select count(*) from public.data_events) = 1, 'an event sent twice is stored once');
select pg_temp.dr_check((select count(*) from public.data_lineage where series_id = 'fx.EUR') = 1, 'lineage sent again replaces the list');

-- Signed out.
select pg_temp.dr_anon();
select pg_temp.dr_check((select count(*) from public.data_series) = 3, 'anyone reads series metadata');
select pg_temp.dr_check((select count(*) from public.data_sources) = 3, 'anyone reads sources, by column');
select pg_temp.dr_check(pg_temp.dr_refused('select key_name from public.data_sources'), 'nobody reads key names');
select pg_temp.dr_check((select count(*) from public.data_series_preview) = 1, 'signed out: only the public preview');
select pg_temp.dr_check(pg_temp.dr_refused('select count(*) from public.data_backtests'), 'signed out: no backtests');
select pg_temp.dr_check(pg_temp.dr_refused($$select public.report_registry('{}'::jsonb)$$), 'signed out: cannot write');
select pg_temp.dr_check(pg_temp.dr_refused($$insert into public.data_events (kind, event_key) values ('status', 'x')$$), 'signed out: cannot add events');

-- Signed in, not on the team.
select pg_temp.dr_as('42222222-2222-2222-2222-222222222222');
select pg_temp.dr_check((select count(*) from public.data_series_preview) = 1, 'not team: no internal preview');
select pg_temp.dr_check((select count(*) from public.data_backtests) = 1, 'signed in reads backtests');
select pg_temp.dr_check(pg_temp.dr_refused($$update public.data_series set status = 'retired'$$), 'signed in cannot change series');

-- A team member, and the same person through a connected AI app.
select pg_temp.dr_as('41111111-1111-1111-1111-111111111111');
select pg_temp.dr_check((select count(*) from public.data_series_preview) = 2, 'team reads the internal preview');
select pg_temp.dr_as('41111111-1111-1111-1111-111111111111', 'some-ai-app');
select pg_temp.dr_check((select count(*) from public.data_series_preview) = 1, 'an AI app token is not team');
select pg_temp.dr_check((select count(*) from public.data_backtests) = 0, 'an AI app token reads no backtests');

-- The log is append-only, even for the owner.
reset role;
select set_config('request.jwt.claims', '', true);
select pg_temp.dr_check(pg_temp.dr_refused($$update public.data_events set kind = 'status'$$), 'events cannot be changed');
select pg_temp.dr_check(pg_temp.dr_refused($$delete from public.data_events$$), 'events cannot be removed');
select pg_temp.dr_check(pg_temp.dr_refused($$truncate public.data_events$$), 'events cannot be truncated');

-- Narrowing a series' rights removes its preview on the next send.
set local role parity_writer;
select public.report_registry('{"series": [{"id": "kraken.XBTUSD", "source_id": "kraken", "name": "Bitcoin", "frequency": "D", "status": "enrolled", "display_rights": "research"}]}'::jsonb);
reset role;
select pg_temp.dr_check(not exists (select 1 from public.data_series_preview where series_id = 'kraken.XBTUSD'), 'narrowed rights drop the preview');

rollback;
\o
\echo data_registry: all checks passed
