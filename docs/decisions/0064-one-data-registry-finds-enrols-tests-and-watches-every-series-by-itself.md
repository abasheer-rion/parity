---
id: DEC-0064
title: One data registry finds, enrols, tests and watches every series by itself
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [data, infra, process]
related: [DEC-0014, DEC-0027, DEC-0037, DEC-0045, DEC-0052, DEC-0056, DEC-0063, REF-0015, REF-0017]
---

# One data registry finds, enrols, tests and watches every series by itself

## In plain words

The owner asked for one system that can take in new market data, find it by itself, tag and label it, track it, test it and keep it healthy around the clock. Until now each piece lived somewhere else: the list of series in one file, the list of providers and their terms in another, freshness on the latency page, and new data only when someone added a line by hand. Now there is one registry. It lists every source with what its terms allow, every series with its tags, status and health, and every place a series is used. A background job looks for new series every day, checks each one against a fixed list of rules, and accepts it only when its licence is recorded and allows the use. Each accepted series is tested at once by the strategy search, and every series is checked every cycle, with retries and a backup source when one exists. Nobody is paged. Everything it does is written to a log that can only grow, and shown on three new research pages.

## Context

- The curated list of series is `engine/src/parity/data/catalog.py` (271 series) and the providers with their licences are `engine/src/parity/data/providers.py`. Both stay. Official runs read the catalog as written ([DEC-0007](0007-official-results-come-only-from-the-ledger.md)).
- Two always-on services run on the owner's machine: the strategy search ([DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md)) and the sims ([DEC-0037](0037-everything-runs-by-itself-and-the-search-widens-itself.md)). Both restart every 12 hours on the newest code.
- Data age per source is already measured ([DEC-0045](0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md)) and stale prices get one retry.
- Live venue data is shown to the public only where terms allow it, and to team members where terms allow internal use ([DEC-0052](0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md), [DEC-0056](0056-team-members-see-real-time-venue-feeds-the-public-does-not.md), [DEC-0063](0063-the-public-sees-live-prices-from-our-own-on-chain-feed.md)).
- No accounts or keys could be created for this work, and nothing may page a person.

## Decision

### 1. The registry is the list of record

Seven tables in Supabase, written only through one function, `report_registry()`, which the least-privilege writer may call (migration `20261107000000_data_registry.sql`):

| Table | What it holds | Who may read it |
| --- | --- | --- |
| `data_sources` | Provider, access method, licence, display rights, terms link and the date we read them, cost, rate limits, the name of the key in the vault | Anyone, except the key name |
| `data_series` | Source, code, asset class, region, frequency, units, first and last date, look-ahead lag, tags, labels, quality score, status, display rights, health | Anyone (metadata only, never values) |
| `data_lineage` | Which strategies, pages, feeds and searches use each series | Anyone |
| `data_events` | Every state change, append-only: a trigger refuses any update or delete | Anyone |
| `data_uptime` | Daily health counts per source and per series, kept 400 days | Anyone |
| `data_series_preview` | A short chart of a series, at most 400 points | Public series: anyone. Internal series: team members only. Research-only: never stored |
| `data_backtests` | The quick tests run when a series is enrolled | Signed-in people |

The engine keeps a working copy, `engine/output/registry.db`, with the same fields, and sends every change after each cycle (`engine/src/parity/registry/`). The catalog and the providers list are copied in on every sync, so a line added to the catalog is in the registry within the hour, and a line removed is retired with an event. Series that discovery finds and enrolment accepts live only in the registry; `catalog.get` falls back to the registry for them, so the store, the panel and the search read them like curated ones. A curated series always wins.

**Display rights.** Four levels: `public` (anyone may see the values), `internal` (team members only, never a connected AI app), `research` (used to compute results, values never shown) and `none` (not used). A series never has wider rights than its source. The rights are enforced where data is served: the database refuses previews for research-only series and hides internal previews from anyone not on the team; the site export (`parity terminal export`) and the registry agree, and a test fails if they ever differ; enrolment refuses a use the rights do not allow. At the first sync: 236 public, 6 internal, 36 research-only and 1 with none (the Yahoo cross-check).

**Statuses.** `candidate` (found, waiting, with the reason), `enrolled` (passed the gate), `live` (data arriving and fresh), `degraded` (late, stale or failing) and `retired` (dead too long, or removed from the code).

### 2. Discovery proposes, it never enrols

Discoverers run at most once a day from the sims service, each with its own pause and user agent, and only against public endpoints whose terms allow scripted reading:

| Discoverer | What it looks for |
| --- | --- |
| FRED | New series in the release and category lists we track (needs `FRED_API_KEY`; skipped without it) |
| ECB | Euro reference rates for currencies we do not have, and new dataflows |
| BIS | Central bank policy rates for areas we do not have, and new dataflows |
| US Treasury | New columns in the daily par yield curve file |
| CFTC | The largest futures markets by open interest that we do not track |
| EIA | New weekly series (needs `EIA_API_KEY`; skipped without it) |
| SEC | New ETFs in the SEC's yearly fund list |
| Crypto venues | New pairs in the public instrument lists of Kraken, Coinbase, Gemini, Binance.US and Hyperliquid |
| Base | Deep Uniswap v3 and Aerodrome pools for our on-chain tokens that the live feed does not use yet, by quote-side depth |
| Competitor collector | Data that people ask other products for, counted from posts already collected |

Each candidate gets tags and labels: asset class, region, frequency, theme (rates, energy, FX, crypto, factor and so on) and liquidity tier. Rules on the key and name decide most; a small naive Bayes model, trained on the catalog's own names, labels the rest and records its confidence. No paid API is used.

### 3. The enrolment gate

A candidate becomes enrolled only when every check passes; otherwise it stays a candidate with the first failing reason:

1. **Licence.** Its source has display rights other than none, a terms link and the date we read them, and the rights allow the intended use.
2. **Schema.** A fetcher exists for its source and code, and the frequency is known.
3. **History.** History was fetched: at least 500 daily, 150 weekly, 60 monthly or 24 quarterly values.
4. **Look-ahead lag.** Set before any use. The default is conservative: daily values a business day late, weekly ones 5, monthly ones a month after the month ends (22 business days, as with the corporate bond yield), quarterly ones 65 business days after the quarter ends.
5. **Sanity.** No dates in the future, no duplicates, gaps no longer than allowed for the frequency, few outliers (moves beyond 12 median deviations), no zero or negative values for prices (rates and spreads may be negative), no long stretches of the same value, and a calendar that fits the source (no weekend values for exchange data).
6. **Quality score.** From 0 to 1, built from the checks above; below 0.6 the candidate waits.

Internal-only data can be enrolled for team research but is never shown in public.

### 4. Every new series is tested on arrival

When a series is enrolled, the cycle runs a short standard battery through the strategy search's own code and writes each run into the search's table, so it counts as a trial and raises the bar of the luck check like any other ([DEC-0014](0014-a-strategy-factory-and-an-always-on-search.md)). A price you can trade gets trend tests on itself and its correlation to the existing books (US stocks, Treasuries, oil, a G10 currency basket); a rate or spread gets carry where a matching currency exists; anything else is tried as a signal that switches US stocks on and off. The summary is attached to the series page. After that, the search draws the new series as a signal and, if it is a daily tradable price, as an asset, alongside everything else.

### 5. Health around the clock, with no paging

Each cycle checks every enrolled series: age against its expected cadence (the same rules as the latency page), gaps and outliers in the newest values, the error rate of its source's recent fetches, schema drift (a column or key that vanished, or values that jump by a factor of 50), and for live feeds the message rate and lag the fan-out reports, plus a direct reachability probe of each venue's public endpoint when nobody is watching. Then it heals what it can: one retry with a pause (at most every 6 hours per source), a switch to the backup source where one exists (Fed currencies have ECB crosses; FRED Treasury yields have the Treasury's own curve), `degraded` when it stays late, and `retired` after 14 days dead for a series discovery added. Curated series are never retired by the job; they stay degraded until the code changes. Every change of state is an event. The Data health page and the site's health line show the result, with an uptime history per source.

### 6. Three research pages

**Data catalog** (search; filters by tag, label, licence, status and health; a series page with chart, lineage, quality, health history, backtest results, licence and display rights), **Candidates** (what discovery found and why each one waits) and **Data health** (status and uptime per source, the newest events). They use the existing design tokens and follow [REF-0017](../reference/0017-parity-copy-rules.md).

### 7. It all runs by itself

The registry is one step of the sims service's cycle, already started with `nice -n 10`: sync, discovery when a day has passed, enrolment of at most 5 candidates, the battery for at most 3 new series, health, then a send to the database. A failing part is recorded and the rest of the cycle goes on. The hourly GitHub jobs do not need to run it.

## Alternatives considered

- **Make the catalog file the registry.** Every new series would need a code change and a review, so nothing could be found and enrolled by itself.
- **Make Supabase the only copy and have the engine read it.** The services would stop when the network or the database does. The engine keeps its own copy and sends changes; the database is the copy everyone reads.
- **Enrol automatically on discovery.** Rejected: a series must never be used before its licence is recorded.
- **A paid classifier for tags.** Not needed: rules place almost every series, and the local model handles names the rules cannot.

## Consequences

- New data reaches the search within a cycle of being enrolled, and every test of it is counted.
- A dead source shows as degraded on the Data health page within an hour, and fixes itself when it can.
- The registry adds two tables of work per cycle to the sims service and a few hundred small requests a day, all to public endpoints with pauses.

## Owner decisions

- A free `FRED_API_KEY` and `EIA_API_KEY` in the vault would turn on the FRED and EIA discoverers. Nothing is created without the owner.
- Whether the job may also add new deep Base pools to the live on-chain feed. Today it only proposes them; going live is a code change to the pool list.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0065: The Parity price combines every pool the way Pyth combines publishers](0065-the-parity-price-combines-every-pool-the-way-pyth-combines-publishers.md)
- [DEC-0070: Pairs and stat arb on 49 industries, with single stocks research only](0070-pairs-and-stat-arb-on-industries-with-stocks-research-only.md)
- [DEC-0071: People make their own API keys for a versioned Parity API](0071-people-make-their-own-api-keys-for-a-versioned-parity-api.md)
- [DEC-0073: Search and content run by themselves, with caps, a log and a kill switch](0073-search-and-content-run-by-themselves-with-caps-a-log-and-a-kill-switch.md)
<!-- backlinks:end -->
