---
id: REF-0025
title: Parity capacity and load test results
type: reference
status: current
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [infra]
related: [REF-0024, REF-0016, REF-0022, DEC-0052, DEC-0053, DEC-0041]
---

# Parity capacity and load test results

## In plain words

We sent made-up visitors at a preview copy of the site, in steps, until something slowed down or broke. Nothing did: public pages held 1,200 requests a second, the site's own functions 200 a second, and the live price feed 450 viewers, all with no errors. The first real limit is not speed but the daily allowance of function calls, because every front page view, every file of a signed-in app and every analytics batch uses one. We made three cheap changes: shared badges are looked up once a minute instead of on every view, the live status answer is shared for 2 seconds, and analytics sends one batch every 30 seconds instead of 10. The desktop app was also run for 50 launches, 50 window open and close cycles, 50 reloads and 30 minutes on a live page, hidden on a Mac in CI, looking for memory that keeps growing.

## Summary

- Public pages: 1,200 requests a second with no errors, at least 24,000 readers at once.
- Functions: 200 a second with no errors. The daily allowance of function requests (100,000 on the free plan) runs out long before speed does.
- Live prices: 450 viewers on one feed with no errors; the fan-out stops at 500 on purpose.
- Fixed: badge lookups cached for a minute, live status for 2 s, analytics batches every 30 s.
- Desktop: 50 launches, 50 window cycles, 50 reloads and 30 minutes of live prices, hidden on a Mac in CI: no crash, nothing left running, one leak found and fixed (live updates piling up in hidden windows).

## Concurrent users we can hold

Each number is the most a single scenario held without breaking a limit (95% of answers under 2 s, under 2% errors, no sign of the database running out of connections), turned into people with the assumption in the last column. "Held" means the test stopped there, not that it broke.

| Scenario | Held in the test | 95% of answers within | Before | After | Assumption |
| --- | --- | --- | --- | --- | --- |
| Reading public pages (legal, blog, learn, ideas, notes, public data files) | 1,200 requests a second, no errors | 182 ms | 24,000 or more | same | a page every 30 s, 1.5 requests each (files after the first come from the browser's cache). Our one test machine was the limit, not Cloudflare |
| Front page and opening an app (runs a function) | 100 a second, then 200 a second in the mixed test | 61 ms, 110 ms | 6,000 or more by speed | same | a function request every 30 s per person. See the daily limit below |
| Live prices on one feed | 450 viewers, none refused | connect 123 ms, updates 321 to 510 ms after our edge sent them | 500 per feed | same | the fan-out refuses viewer 501 on purpose (`MAX_VIEWERS` in `web/live/src/hub.ts`); we stopped at 450 so real viewers were never turned away |
| A Verify badge shared widely (one id viewed again and again) | 200 a second in the mix | 129 ms before, 80 ms after | every view one database call | one database call a minute per Cloudflare data centre | the badge image and page both read through the same lookup |
| Analytics from people who opted in | not loaded (the database caps it) | not measured | about 500 active visitors before batches are dropped | about 1,500 | the database takes 3,000 batches a minute in total (DEC-0053); a busy visitor sent one every 10 s, now one every 30 s |

## The first bottleneck: the daily function allowance

Speed held everywhere we looked. What runs out first is Cloudflare's daily allowance of function requests: 100,000 a day for the whole account on the free Workers plan, shared by production and every preview. We could not read which plan the account is on, so the numbers assume the free one. When it runs out, functions fail until midnight UTC, which on this site means the front page of the app addresses, sign-in checks and live data stop working. So the load tests are kept small (the scripts refuse to plan more than 8,000 function requests unless told otherwise) and were never pushed further than 200 function requests a second.

What uses a function request:

| Action | Function requests |
| --- | --- |
| Opening the front page (every host, for the sim., trade., academy. and lab. addresses) | 1 |
| A signed-in person opening the product app for the first time | about 30 (the page and each of its 27 code files pass the sign-in check; later visits use the browser's copy) |
| An analytics batch, a page timing beacon, a badge view, live status | 1 each |

At 100,000 a day that is about 3,000 first-time app openings, or 100,000 front page views. One busy opted-in visitor used up to 8,640 a day in analytics batches (one every 10 s); now at most 2,880. The change to analytics batches is the cheap part of the fix; the rest needs a decision (below).

## What we changed

| Change | Where | Effect measured |
| --- | --- | --- |
| Badge lookups kept for 60 s in each data centre's cache, found or not; a failed lookup is never kept | `web/functions/badge/[id].ts` (used by `/v/<id>`, `/badge/<id>.svg` and the share image) | the same id viewed again: 97 ms to 43 ms typical, 129 ms to 80 ms at the 95th percentile; database calls for the test fell from one per lookup (2,479 for 2,468) to 1,566 for 2,563, the saved ones all being the repeated ids |
| Live status shared for 2 s in each data centre | `web/functions/live/[[path]].ts` | each answer asks every source's fan-out object, so many open Latency pages no longer multiply those calls; 36 ms to 29 ms typical, 94 ms to 63 ms at the 95th percentile |
| Analytics sends at most one batch every 30 s while someone is active | `web/src/lib/analytics/tracker.ts` | a third of the function and database calls per busy visitor; leaving or hiding the page still sends at once |

A withdrawn badge now shows as withdrawn within a minute (browsers could already keep the image for 5 minutes).

## The database

The functions reach Supabase over its web API (PostgREST), not with their own database connections, so connection pooling (Supavisor transaction mode) does not apply to visitor traffic; only CI jobs connect directly. During the 200 a second test the project's connections went from 18 to 22 of 60, and PostgREST's from 6 to 8. No lookup failed.

On this machine, with every migration applied to a local Postgres 17 (`supabase/tests/local.sh --keep`, then `pgbench`):

| Database function | One caller | 16 callers | Note |
| --- | --- | --- | --- |
| `verify_badge_public` (badge lookup) | 21,700 a second | 105,000 a second | reads only; the hosted project took 0.7 to 1.3 ms per call |
| `analytics_ingest` (4 events, under the cap) | 3,000 a second | 2,100 a second | every batch updates one counter row for the minute, so batches wait for each other and more callers do not help |
| `rum_ingest` (3 timings) | 16,800 a second | 5,900 a second | adds to hourly totals, also one row per hour and page |

The hosted project is much smaller than this machine, but both caps (3,000 analytics batches a minute, 50 a second) sit far below these rates. The single counter row is the database's own first limit and only matters if the analytics cap is ever raised: then the counter should be split into several rows.

## Desktop soak test

Run hidden on a Mac runner in CI (`.github/workflows/soak.yml`, `desktop/scripts/soak.mjs`): the app starts hidden (`PARITY_HIDDEN=1`, also on by default for every test run, #121), so no window is shown or focused, there is no Dock or menu bar icon, no notification, no global key and no update check. It uses its own profile folder. A stand-in for Supabase and a stand-in live price feed (one update a second for 20 coins) run inside the test, so nothing reaches a real account or an outside data source. The script refuses to run on a person's own Mac unless `PARITY_SOAK_LOCAL=1`.

Results (Mac runner, 26 October, three runs; the last passed every check; numbers in MB of memory unless marked):

| Part | Result | Memory, first 5 to last 5 | Verdict |
| --- | --- | --- | --- |
| 50 launches with one profile | no crash, no process left behind; ready in 0.4 to 1.9 s, getting faster as caches warm | all processes 669 to 670 | flat |
| 50 reloads of one page | no crash | all processes 859 to 852 once the hidden Trade page had started | flat |
| 50 window open and close cycles | no crash, no window or process left; open, draw and close 0.66 to 0.89 s on the first runs, 0.9 s typical and 3.5 s at worst on the last one (after main's desktop fixes in #116; worth watching) | all processes 684 to 831 in the first cycles, then flat (0.1 to 0.3 MB a cycle in the second half) | flat after the step |
| 30 minutes on Trade's Markets page with live prices | one socket all along, 1,829 live messages, no crash | page JS heap 5.4 to 7.2, page process 124 to 126 | small, see below |

The step in the window cycles is the app's hidden Trade page (it keeps one for the menu bar ticker) starting 8 seconds after launch, plus caches filling; it does not grow after that.

**A leak found and fixed.** On the first 30 minute run the live page's memory kept climbing (JS heap 5.5 to 9.6 MB, about 10 MB an hour). The live price client handed updates to the page once per drawn frame, and a hidden page (a background tab, a minimised or hidden desktop window) draws no frames, so every message waited in a list until the page was looked at again. It now uses a short timer while the page is hidden (`web/src/lib/live/client.ts`, test in `web/tests/liveHidden.test.ts`). The rerun climbed half as fast (5.4 to 7.2 MB, about 4 MB an hour). That is under the test's limit and was not traced further; a longer run would show whether it levels off. In a hidden window Chromium also runs timers about once a minute, so the page's 15 second pings arrived about once a minute; that is expected for a hidden window.

## How to re-run

1. `make k6` downloads k6 into `tools/k6/` (git-ignored) and checks it against the release's checksums. Nothing is installed globally.
2. Get a preview address. A pull request that touches `web/` deploys one at `https://<branch>.parity-research.pages.dev` (dots and slashes become dashes). Never the live site: the scripts refuse `endyland.com` unless `ALLOW_PROD=1`.
3. Run, with `BASE` set to that address:

| Command | What it sends | Function requests (default steps) |
| --- | --- | --- |
| `make load-static BASE=... STEPS=100,400,1200 STEP_S=30` | public pages and files | none |
| `make load-entry BASE=... STEPS=10,25,50,100` | the front page and signed-out app addresses | 5,550 |
| `make load-functions BASE=... STEPS=25,50,100,200 BUDGET=12000` | live status and symbols, analytics and timing beacons (sent with Do Not Track or an unknown app, so they are dropped before the database), badge pages and images for ids that do not exist, MCP sign-in metadata | 11,250 |
| `make load-ws BASE=... STEPS=50,150,300,450 STEP_S=60` | viewers on the public delayed feed | 4 per viewer |

Each step is held for `STEP_S` seconds; the run stops at the first step that breaks a limit, and the step before it is the most it held. Results print as a table and are written to `load/results/` (git-ignored). Check the day's other runs before starting: two full rounds use about a third of the free daily allowance.

Rules the scripts keep: no test ever loads an outside source (the live feed asks CoinGecko once every 30 s however many viewers there are), no account is created, no real sign-in is used, and analytics test batches never reach the database. The viewer test stops below 450 so real viewers are never refused. Cost: preview deploys and these requests are free on the free plans; on Workers Paid, a full round is well inside the included requests.

The desktop soak: open the Desktop soak workflow in GitHub Actions and run it (inputs: seconds on the live page, window cycles), or change `desktop/scripts/soak.mjs` in a pull request. Results are attached to the run as `soak-results`.

## Owner decisions

1. **The Cloudflare plan.** If the account is on the free Workers plan, the daily allowance is the site's first limit. Workers Paid is $5 a month and includes 10 million requests a month.
2. **Sign-in check on app code files.** The product app's code files each pass the sign-in check, about 30 function requests per first visit. The code repository is public, so the check protects no secret in those files (the research data under `/data/` would stay protected). Letting files whose names carry a content hash skip the function would cut a first visit to about 3.
3. **Live viewers past 500 per feed.** The cap is on purpose. Going past it means several fan-out objects per feed, each with its own line to the source.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
