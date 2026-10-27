---
id: REF-0028
title: Database egress, what used it and what we cut
type: reference
status: current
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [process]
related: [DEC-0037, DEC-0045]
---

# Database egress, what used it and what we cut

## In plain words

The database is on Supabase's free plan, which allows 5 GB of data sent out a month. It sent about 19.7 GB in under six days. Almost all of it was one thing: every time the site was rebuilt (440 times in a week, mostly for pull request previews and the hourly news refresh), the build downloaded every published research run in full, about 45 MB, even when nothing had changed. The build now asks the database for a short fingerprint of each run and downloads only runs it has not seen before. A rebuild with no new research now reads a few kilobytes. The site's health line also checks the database less often, and a check on this Mac reports every six hours how fast we are using the allowance and warns on the site when we are on course to pass it.

## Summary

- **Measured:** 19.66 GB sent by the database host from 2026-10-21 02:25 to 2026-10-27 00:11 UTC (the host's own byte counter), about 3.3 GB a day, a pace of about 100 GB a month against a 5 GB allowance.
- **Top sources** (bytes estimated as rows returned times average row size, from the database's query statistics over the same window; they add up to the counter within a few percent):

  | Source | Calls | Bytes | Share |
  | --- | --- | --- | --- |
  | Deploy job reading every strategy run (equity curves, gauntlet results) | 3,696 queries, 94,229 rows | about 14.7 GB | 75% |
  | Deploy job reading every research batch (series, settings) | 423 queries, 3,968 rows | about 4.0 GB | 20% |
  | Deploy job reading the newest search snapshot | 384 queries | about 0.23 GB | 1% |
  | Browsers reading the health tables (health line, latency page, registry) | about 24,000 requests a day | about 0.03 to 0.2 GB a day | 1 to 4% |
  | Badge checks, analytics and latency writes, sign-in | small responses (2 to 200 bytes) | under 0.01 GB a day | 0% |
  | Realtime, Storage | 0 requests | 0 | 0% |

- **Why the deploy job:** `.github/workflows/deploy-web.yml` runs on every pull request push (279 runs this week), every merge to main (124), after each hourly News run and each research run (32), and by hand (5). Each run called `scripts/export_site_data.py`, which read all 10 research batches and then every strategy row of the 9 it keeps, about 45 MB, over a direct database connection.
- **Cut 1 (about 95% of the bytes):** the export asks the database for one fingerprint per run (an md5 the database works out over the batch row and all its strategy rows, about 50 bytes a run) and downloads a run only when that fingerprint is not in its cache folder. The deploy job keeps the folder between runs with the GitHub Actions cache; pull requests read main's copy. Snapshots (search, sims, feedback counts) are read in full only when the newest id changes. The files the site ships are unchanged.
- **Cut 2:** the health line on every page polled four health queries a minute in every open tab, including hidden ones. It now polls every five minutes, only while the tab is visible, and once when the tab comes back after more than a minute. The line still turns stale only after two hours, so nothing it says changes.
- **Watch:** `scripts/egress-check/` runs on this Mac every six hours (launchd, `com.endyland.parity-egress`). It reads the host's byte counter from the Management API, keeps a sample per run, and reports the last day's bytes and a 30-day projection to the health table as service `egress`. When the projection passes 80% of 5 GB, the site's health line shows "database transfer: N GB a month at this rate, plan allows 5 GB", and the log at `~/Library/Logs/parity-egress.log` gets a WARNING line.

## How it was measured

- **Total:** the Management API's Prometheus endpoint (`/v1/projects/{ref}/analytics/endpoints/metrics`), counter `node_network_transmit_bytes_total` on the database host, which booted at the same time the query statistics were reset. This counts everything the host sends, including PostgREST responses, so it is an upper bound on billed egress.
- **By source:** `pg_stat_statements` (calls and rows per query and role) times the average row size of each table as text, which is what a direct connection sends.
- **By path and caller:** the logs endpoint (`/v1/projects/{ref}/analytics/endpoints/logs`, ClickHouse over a `logs` table, 24 hours at most per query), source `edge_logs`, grouped by method, path, key type and the caller's network. Most REST responses are streamed without a length, so the logs give counts, not bytes; REST bytes come from fetching the same queries with gzip and measuring them (pipeline steps 23 KB, data freshness 6 KB, rum totals 2 KB, heartbeats 0.3 KB compressed).
- **Before and after:** the byte counter sampled before the change and again after deploys ran with it, recorded in the Results section.

## Results

RESULTS_PLACEHOLDER

## Options

| Option | Cost | What it takes | Risk |
| --- | --- | --- | --- |
| Stay on the free plan after these cuts | $0 | Nothing more | Projected use after the cuts is about 1 GB a month (one new research run a day, about 5 MB, plus browsers). A cold cache costs one 45 MB read. This billing cycle is already over the allowance, and Supabase may restrict a free project that stays over it until the cycle resets. No backups beyond Supabase's own. |
| Supabase Pro | $25 a month (list price; 250 GB egress included, then about $0.09 a GB) | Change the plan in the dashboard | None technical. Lifts any restriction at once and adds daily backups kept 7 days. |
| Postgres elsewhere (Neon, Render, a small VPS) | About $0 to $20 a month for the database | Replace Supabase Auth (sign-in, passkeys, OAuth), the REST API the browser apps use with row level security, the security definer functions, and the publishable key setup; move data; repoint every app, Pages Function, workflow and the Mac services | High: sign-in and row level security are the security boundary for every app. Weeks of work and a real chance of a data exposure during the move. Realtime is unused, so that part is free. |

**Recommendation:** stay on the free plan with these cuts and the six-hourly check. Move to Pro ($25 a month) only if Supabase restricts the project before the billing cycle resets, or when daily backups become worth $25 a month. Do not move Postgres off Supabase for egress: the cuts remove the cause, and replacing Auth and row level security costs far more than Pro.

## Smaller things looked at and left alone

- Analytics and latency writes (`rum_ingest`, badge checks) return 2 to 144 bytes; they are already minimal.
- The search and sims services on this Mac insert snapshots (about 0.7 MB each for search). Those are bytes into the database, which the plan does not count. The table keeps the newest few.
- The registry pages read about 22 KB compressed per visit. Moving them to static files would save little now; worth doing if visits grow.
- Realtime and Storage had no requests, so there is nothing to turn off.
- The GitHub Actions cache holding copied runs can be read by workflows in this public repo, including fork pull requests. It holds the same research results any signed-in person can read on the site.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
