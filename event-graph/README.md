# News-impact engine (event graph)

Parity's engine for working out what any piece of news affects and why. It holds a general world graph (companies,
facilities, products, countries, funds, people, drivers such as oil or an election's odds), turns news into claims
with a belief score (the false-news filter), reasons forward through mechanisms to calls on listed securities, and
trains on past cases replayed blind.

**In plain words:** when something happens, the engine asks who depends on it and why, and how big the hit or gain
should be. It never looks up "what happened last time" to answer. Past cases are used only to tune its numbers and to
find links or rules it was missing, and every case is replayed as if it were live, with nothing after that moment
visible.

## Layout

| Path | What it is |
| --- | --- |
| `schema.sql` | Tables: entities and typed links (all point-in-time), claims and evidence, mechanisms, rule parameters, channel rules, case studies, replays, the rule log. |
| `reason.sql` | `belief()`, `impact()` (mechanisms: supply_loss, policy, financial, governance, driver), `replay()`, `sweep()`, `calibrate()`, `tune_driver()`, `driver_checks()`, case helpers. |
| `cases.txt` | Every case in load order. For each NAME: `NAME.sql` (graph + claims as they arrived), `NAME.prices` (price windows), `NAME_story.sql` (hindsight outcomes). |
| `exposures.sql` | Why each company depends on each driver (business-model reasons with an elasticity). A driver call needs one; measured betas only check it. |
| `rule_log.sql` | What each case taught: new rules, tuned numbers, open questions. |
| `analyst_views.sql` | Public coverage of sell-side views around the cases, scored by `analyst_scorecard`. |
| `impact.sql` | Prints `impact()` for one event: `psql -v event_id=1 -f impact.sql`. |
| `build.sh` | Drops and rebuilds the `eg` database from all of the above. |
| `funnel/` | The news funnel that feeds the engine ([README](funnel/README.md)). |
| `catalog/` | Official event catalogs (Federal Register, OFAC, Fed, FEMA, USGS) into `event_candidate`. |
| `edgar/` | SEC EDGAR: registrants, XBRL facts, 13F holdings, the live 8-K feed. Needs `SEC_USER_AGENT`. |
| `prices/` | Research-only price loaders (Yahoo chart endpoint, Polymarket history). Yahoo's robots.txt disallows automated access; production should load licensed prices into the same table. |
| `calls/` | Live calls frozen before the outcome was known, for later scoring. |
| `viz/` | The graph viewer: `export.sql` -> `graph.json` -> `template.html` -> `index.html` (the last two are generated). |

## Run it

Needs Postgres 17 (Postgres.app works), Python 3.11+ and `psycopg2`. The cluster lives in `.pgdata/` on port 5499:

```bash
pg_ctl -D .pgdata -l .pgdata/server.log -o "-p 5499 -k $PWD/.pgdata -c listen_addresses=" start
./build.sh                                  # rebuild eg: schema, rules, every case, prices, stories
psql -d eg -c "SELECT * FROM replay(21, (SELECT replay_at FROM case_study WHERE id = 21))"
psql -d eg -c "SELECT * FROM tune_driver()" # size correction advice per driver class
```

A rebuild empties `event_candidate`: re-run `catalog/catalog.py fetch --since YYYY-MM-DD` and `funnel/funnel.py promote`.
Nothing in CI runs the engine yet.

## Rules the cases enforce

- Every read filters `known_at <=` the moment being reasoned about; a replay that sees the future is a bug.
- A call needs a reason (a link or an exposure). Correlations are safety checks, never the reason.
- Numbers change only when 3+ independent cases agree, judged leave-one-case-out (`tune_driver()`), per driver class.
- Each new case is swept against a wide universe, so names the graph did not know show up as misses.
