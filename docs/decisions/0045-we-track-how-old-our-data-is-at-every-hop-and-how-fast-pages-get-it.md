---
id: DEC-0045
title: We track how old our data is at every hop and how fast pages get it
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [data, infra]
related: [DEC-0037, REF-0017, REF-0018, REF-0019]
---

# We track how old our data is at every hop and how fast pages get it

## In plain words

The owner asked us to track how slow our data and refreshes are. Now every source carries its own time (the date of its last price or headline), the time we fetched it and the time the site published it. Every scheduled job and service step records how long it took. One page load in ten reports, anonymously, how long it waited for its data. A new Latency page in the research app shows all of it, and nobody is ever paged: sources that fall behind are fetched again by themselves.

## Context

- Data reaches the site in hops: the source publishes, the hourly News job fetches news, markets data and (once a night, with the research run) prices into the Actions cache, the deploy job exports files and publishes the site, and a browser loads them ([DEC-0037](0037-everything-runs-by-itself-and-the-search-widens-itself.md) covers the always-on search and sims).
- Before this, only the search and sims reported a heartbeat. Nothing said how old a price on screen was or whether the hourly job ran hourly. [REF-0019](../reference/0019-latency-budget-and-target-architecture.md) sets the targets; this decision builds the measurement it asks for.
- The first measurement answered that: in the last 26 hours the "hourly" News job ran 7 times, 3.5 hours apart at the median, because GitHub skips scheduled runs when it is busy ([REF-0018](../reference/0018-parity-latency-baseline.md)).
- The owner's rule is that no human is paged. Problems must be recorded, shown and retried by the machines.

## Decision

1. **Data freshness per series** (`engine/src/parity/latency.py`, `parity latency freshness`).
   - One row per price series, markets source, news feed and site file: the source's as-of time, our fetch time, the publish time, an expected cadence, and which of the three times the cadence is measured from.
   - Prices are judged on the source's own date, with a cadence per provider and frequency (for example 11 days for the Fed's weekly H.10 currencies, 120 days for monthly series). News and markets feeds are judged on our last fetch, since a central bank can be quiet for weeks.
   - Past its cadence a row is late (amber). Past twice its cadence it is stale (red). A failed last fetch is stale.
   - The News job records fetch times; the deploy job stamps publish times after a production deploy.
2. **Pipeline timings.**
   - GitHub Actions runs, jobs and steps come from the GitHub API, with three extra rows per run: how late a scheduled run started, the gap since the previous scheduled run, and for a deploy, the time from the job that triggered it to the end of the deploy.
   - The sims service collects these every cycle (about every 22 minutes) with the signed-in GitHub command line on the owner's machine, so it costs no Actions minutes and does not depend on GitHub's schedule.
   - The search and sims services report their own steps (batch, export, data refresh, each sim step).
3. **Storage.** One migration adds `data_freshness`, `pipeline_steps` and `rum_hourly`, all readable by anyone because they hold no personal data, and all written only through checked functions. The writer login may call the freshness and step functions. Step rows are kept 60 days and timing totals 30 days.
4. **Page timing from real browsers** (`web/src/lib/rum.ts`, `web/functions/rum.ts`).
   - Every app (front page, product, research, Terminal, Trade, Academy, Workbench, sign-in, Verify badge pages and the desktop app) starts it from its entry, on one page load in ten.
   - It records time to first data, each data request's time, size and cache hit, the age of data shown, refresh lateness and gaps, and LCP, INP and CLS. It runs from browser callbacks after paint and sends one beacon of at most 40 numbers when the tab is hidden.
   - No cookies, storage, ids, page addresses or user agent. Do Not Track and Global Privacy Control turn it off. Because it stores nothing and identifies no one, it is essential-only and is described in the privacy and cookie pages rather than asked for.
   - The `/rum` Pages Function drops anything unexpected, allows 12 beacons a minute per address (kept in memory for a minute only), adds a continent code and calls `rum_ingest()`, which adds the numbers to hourly fixed-bin histograms. It takes at most 600 beacons a minute across the site, creates at most 300 buckets an hour and accepts only known endpoint shapes and continent codes.
5. **No paging, automatic retries.**
   - `parity latency retry` fetches stale sources once more after a 30 second pause, at most once per source group every 6 hours, and logs the attempt as a step. It runs in the hourly News job and in every sims cycle.
   - When the last News run started more than 3 hours ago, the sims service starts one itself (at most once every 3 hours) and logs it.
6. **On the site.** A Latency page in the research app (Data, then Latency) shows every hop's p50 and p95, freshness by source with the late and stale series, job durations over 7 days, the slowest steps, retries, and browser timings by app, region and request. The health line gains a second line: data age and refresh lag.

## Alternatives considered

- **Cloudflare Analytics Engine for page timing.** Rejected for now: reading it back needs an API token on the page's side, and the totals in Supabase are small and free.
- **A scheduled Actions job to collect Actions timings.** Rejected: it would spend minutes on a private repo and be skipped by the same busy schedule it measures.
- **Gate page timing behind the analytics consent.** Rejected: nothing is stored and nothing identifies anyone, so it is strictly necessary measurement. Do Not Track still turns it off.
- **Alert a person when a source goes stale.** Rejected by the owner's rule.

## Consequences

- The pages that read `data_freshness`, `pipeline_steps` and `rum_hourly` show nothing until the migration is applied and the first jobs and beacons arrive.
- The hourly refresh gets started by the owner's machine when GitHub skips it, so news and markets data should stay within a few hours old. This uses a few more Actions minutes, never more than the hourly schedule intended.
- Cadences are our best reading of each source's habits on 2026-10-25. Some series will stay stale for reasons a fetch cannot fix, such as the OECD interbank rates for the euro and the pound, whose newest values are from January 2026.
- `rum_ingest()` can be called with the public key directly, skipping the per-address limit. The caps bound the damage (about 216,000 rows at most, roughly 130 MB, and a flood can crowd out real beacons or add fake timings). Closing that needs a server-side secret for `/rum`, which is a new key and so waits for the owner.
- Trade has no live socket today. Its only timed poll is the desktop app's 30 minute alert check, which records lateness and gaps; a future socket can use the same hook.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0052: Live prices stream through our own edge, and every chart says how late they are](0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md)
- [DEC-0053: Our own product analytics, opt-in, stored in Postgres](0053-our-own-product-analytics-opt-in-stored-in-postgres.md)
- [DEC-0056: Team members see real-time venue feeds the public does not](0056-team-members-see-real-time-venue-feeds-the-public-does-not.md)
- [REF-0018: Parity latency baseline](../reference/0018-parity-latency-baseline.md)
- [REF-0021: Parity database schema and data model](../reference/0021-parity-database-schema-and-data-model.md)
- [REF-0022: Product analytics events](../reference/0022-product-analytics-events.md)
<!-- backlinks:end -->
