---
id: REF-0019
title: Latency budget and target architecture
type: reference
status: current
created: 2026-10-24
updated: 2026-10-25
authors: [ayan]
tags: [crypto, data, fx, infra, ui]
related: [RES-0022, DEC-0046, REF-0001, REF-0005, REF-0015, DEC-0005, DEC-0052]
---

# Latency budget and target architecture

## In plain words

Latency is how old a price is by the time you see it, and how long an order takes to reach the market. Today our prices are a day old, which is fine for research. This page sets four speed levels Parity might offer, from "yesterday's close" to "live prices and real orders through a broker", and lists what each level needs: which data we must license, which small services we would run, where the data is kept, what it costs a month, and the numbers we must measure to know we are hitting the target. It ends with the tools we should adopt now and later.

## Summary

- **We are not building a trading venue.** The fastest systems in [RES-0022](../research/0022-how-trading-and-market-data-platforms-are-built.md) work in microseconds because they match orders. Parity shows prices and, one day, passes orders to a broker. Our floor is the speed of the internet to a browser, tens of milliseconds, so the right tools are a small ingest service, a fan-out layer at the edge and careful measurement, not kdb+, Aeron or colocation ([DEC-0005](../decisions/0005-no-microsecond-trading-in-the-poc.md)).
- **The data licence costs more than the machines.** Real-time display rights run from nothing (some crypto, with written consent) to $5,000 a month and more (US equities, redistributable FX). The servers for every tier below cost under $100 a month.
- **Build order:** measure what we have now; add 15-minute delayed prices only when a product needs them; go real-time with crypto first, through one ingest service and Cloudflare Durable Objects; order entry only after [DEC-0046](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md) and [DEC-0019](../decisions/0019-real-trading-later-what-it-would-legally-take.md) are accepted.
- Prices were read on 24 October 2026 from each vendor's page. Lines marked "unconfirmed" could not be checked on a public page and need a quote.

## The four tiers

| Tier | Freshness on screen | Who it is for | Status |
| --- | --- | --- | --- |
| A. Research and end of day | Minutes to hours after the source publishes | Research app, backtests, Verify, the Terminal | Today |
| B. Retail delayed | 15 minutes plus our own delay, refreshed every 15 to 60 seconds | Trade charts, watchlists, the demo account | Partly (daily bars only) |
| C. Real-time retail display | Under 1 second from the source, p95 | A live Trade screen, alerts | Not built |
| D. Order entry through a broker API | Click to broker acknowledgement in a few hundred milliseconds | Real trading, if ever approved | Not built, legally gated |

### Budget per hop

Each tier gets a budget for every hop, measured with the same names the latency tracking work uses (branch `feat/latency`): the source's own time, when we fetched it, when we published it, and when a screen showed it.

| Hop | A. Research | B. Delayed | C. Real-time (p95) | D. Orders (p95) |
| --- | --- | --- | --- | --- |
| Source time to fetched (feed lag) | Under 6 hours after the source's release | Under 60 s beyond the 15 min delay | Under 250 ms | n/a |
| Fetched to published (our processing) | Under 30 min | Under 5 s | Under 50 ms | n/a |
| Published to screen (fan-out and network) | Next page load | Under 60 s (polling or cache) | Under 200 ms | n/a |
| Screen render | Under 100 ms per page view | Under 50 ms per update | One frame, 16 ms, per batch | n/a |
| Refresh age shown to the user | "As of" date | "Delayed 15 min, as of hh:mm" | Age in ms, grey after 5 s | n/a |
| Click to our order check | n/a | n/a | n/a | Under 100 ms (browser to edge function) |
| Our check to broker acknowledgement | n/a | n/a | n/a | Under 400 ms |
| Acknowledgement to fill on screen | n/a | n/a | n/a | Broker and market dependent; shown as it streams |

For comparison: OANDA's own price stream sends at most one price per instrument every 250 ms, and Interactive Brokers streams snapshots taken several times a second rather than every tick ([OANDA pricing stream](https://developer.oanda.com/rest-live-v20/pricing-ep/), [IBKR market data](https://interactivebrokers.github.io/tws-api/md_request.html)). A retail screen at four updates a second per symbol matches what large retail brokers show.

## What each tier needs

### A. Research and end of day (today)

Free and paid daily sources ([REF-0003](0003-data-sources.md), [REF-0015](0015-getting-close-to-bloomberg-data-sources-costs-and-licences.md)), the engine and the always-on services on one Mac, GitHub Actions for nightly runs, Supabase for results, Cloudflare Pages for the site ([REF-0001](0001-architecture.md)). Nothing new is needed except measurement: for every series, the source's as-of time, when we fetched it and when the site published it, plus how long each job step took and how fast real browsers load the data. That is what the latency tracking branch adds.

### B. Retail delayed (15 minutes)

| Need | Choice | Monthly cost |
| --- | --- | --- |
| Licence | A vendor plan that allows showing delayed prices to the public. Candidates: Massive (formerly Polygon) business plan with the full-market 15-minute delayed add-on; Alpaca Broker API data, whose standard tier is "real time IEX or 15 mins delayed SIP" ([Massive business](https://massive.com/business), [Alpaca data plans](https://docs.alpaca.markets/docs/about-market-data-api)) | About $500 to $3,000, unconfirmed for public display |
| Ingest | A scheduled job (GitHub Actions or a Worker cron) that pulls snapshots every minute | $0 to $5 |
| Fan-out | No sockets. A JSON file per watchlist group, cached at the edge for 30 to 60 seconds | Included in Pages and Workers |
| Storage | One-minute bars in Supabase Postgres, 90 days | Included in Supabase Pro ($25) |
| Client | Poll every 30 to 60 seconds; label every price "delayed 15 min" | n/a |

Individual-use plans such as Massive's personal tiers and Twelve Data's personal plans do not allow showing prices to other people ([Massive pricing](https://massive.com/pricing), [Twelve Data pricing](https://twelvedata.com/pricing)).

### C. Real-time retail display (under 1 second)

```text
venue or vendor feed ──> ingest service ──> normaliser ──> fan-out (Durable Objects) ──> browsers (WebSocket)
   (WebSocket/FIX)      (one process,        (one tick       (one object per group       (batch per frame,
                         region-pinned)       shape, seq)      of symbols, conflated)      show age)
                              │
                              └──> hourly Parquet files in R2 (audit and replay) ──> 1-minute bars in Postgres
```

| Part | Recommendation | Why | Monthly cost |
| --- | --- | --- | --- |
| Data licence | Crypto first: exchange feeds with written permission to display (Kraken's terms forbid third-party use without consent) ([Kraken terms](https://www.kraken.com/legal/global-terms)). FX later: TraderMade's business plan is £599 a month, but redistribution is enterprise only at custom prices ([TraderMade pricing](https://tradermade.com/pricing)). US equities last: Cboe One external distribution is $5,000 a month plus $0.25 to $0.50 per non-professional user ([Cboe One](https://www.cboe.com/market_data_services/us/equities/cboe_one/)); the new consolidated tape plan charges $0.90 per non-professional user per tape from April 2027 ([CT Plan fees](https://consolidatedtape.com/fees)) | Crypto feeds are the cheapest to license and run every day of the year | Crypto $0 to unknown; FX enterprise quote; equities from about $5,000 |
| Ingest | One small process per feed in the region nearest the source, for example a 256 MB to 1 GB Fly.io machine ([Fly.io pricing](https://docs.fly.io/about/pricing)). It keeps the feed's sequence numbers, detects gaps and resubscribes, as Coinbase and Binance tell clients to do ([Coinbase feed](https://docs.cdp.coinbase.com/exchange/websocket-feed/overview), [Binance streams](https://raw.githubusercontent.com/binance/binance-spot-api-docs/master/web-socket-streams.md)). Not on the owner's Mac: it must not stop when the Mac sleeps or restarts | Feeds disconnect; whoever holds the socket must reconnect and rebuild the book | $2 to $7 per feed |
| Normalise | One tick shape for every source: source, symbol, bid, ask, last, size, source time, ingest time, sequence. Conflate to at most 4 updates a second per symbol | Clients and storage never see vendor formats | Included |
| Fan-out | Cloudflare Durable Objects with the WebSocket Hibernation API, one object per group of about 50 symbols. Clients subscribe to groups. Incoming WebSocket messages bill at 20 to 1, and idle objects that can hibernate are not billed for duration ([Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)) | Runs at the edge next to the site, same sign-in, no server to patch | Workers Paid $5, plus about $10 to $50 at a few hundred symbols (estimate below) |
| Not Supabase Realtime | Pro allows 500 connections and 500 messages a second ([Realtime limits](https://supabase.com/docs/guides/realtime/limits)) | Too low for tick fan-out; fine for account events such as "order filled" | n/a |
| Tick storage | Hourly Parquet files in R2, queried with DuckDB when needed. One-minute bars in Postgres | Append-only files are the audit trail and the replay source, at a few dollars a month | Under $5 |
| Analytics store, later | ClickHouse Cloud (no monthly minimum, $300 trial) or Tiger Data (Timescale) from $30 a month, only when tick queries outgrow DuckDB ([ClickHouse pricing](https://clickhouse.com/pricing), [Tiger Data pricing](https://www.tigerdata.com/pricing)) | kdb+ is the industry standard for ticks ([kdb+tick](https://code.kx.com/q/wp/rt-tick/)) but its licence is priced for banks | $30 to $200 when needed |
| Client | Batch updates into one `requestAnimationFrame`, update the chart's last bar in place, show the price's age and grey it after 5 seconds without an update | A busy feed must not block typing or scrolling | n/a |

**Fan-out cost estimate.** 200 symbols at 4 updates a second is 800 incoming messages a second, about 2.1 billion a month. At 20 to 1 that bills as about 104 million requests, roughly $15 a month after the included million. Four always-busy objects of 128 MB use about 1.3 million GB-seconds a month, about $11 after the included 400,000. Only incoming WebSocket messages count as requests. Total about $30 a month plus the $5 plan, before the free allowance on duration from hibernating quiet groups.

### D. Order entry through a broker API

```text
browser ticket ──> Pages Function (sign-in, our pre-trade checks, rate limit, audit row)
               ──> broker REST API (their KYC'd account, their risk checks, their routing)
               ──> venue
broker trade-updates stream ──> Pages Function or Durable Object ──> browser (fills, rejects)
```

| Part | Design |
| --- | --- |
| Order check before the broker | Instrument allowed, size and notional caps, one order in flight per client order id, daily order cap per account. The broker repeats its own checks; ours exist to stop mistakes early and to log |
| Idempotency | A client order id generated in the browser and passed to the broker, so a retried click cannot place two orders |
| Audit | An append-only table with every request, every broker response and its time, kept as long as the partner agreement requires |
| Time | The server's clock, checked against NTP. US broker-dealers must keep clocks within 50 ms of NIST for the audit trail ([FINRA Rule 6820](https://www.finra.org/rules-guidance/rulebooks/finra-rules/6820)); the partner carries that duty, and we hold ourselves to the same 50 ms so our logs line up with theirs |
| Failover | If the broker API or stream is down, the ticket disables itself and says so. No queueing of orders on our side |
| Broker | The `Broker` interface from DEC-0046: the demo account today, a partner adapter after the legal gates |

The broker's own path (their order management, risk checks, routing to market makers or venues) is outside our budget. Alpaca, for example, is self-clearing and routes the orders ([Alpaca account models](https://docs.alpaca.markets/docs/use-cases)).

## Metrics we must track

| Metric | Definition | Tiers | Target |
| --- | --- | --- | --- |
| Feed lag | fetched time minus source time, per series | All | Per tier budget above |
| Processing time | published time minus fetched time | All | Per tier budget |
| Publish to screen | time the browser applied the update minus published time (needs the server time in each message) | B, C | C: p95 under 200 ms |
| Refresh age | now minus source time, as the user sees it | All | Shown on screen; alert when over 2 times the tier's budget |
| Percentiles | p50, p95, p99 per hop, per hour, per region | All | p99 within 3 times p50 in normal hours |
| Gaps and reconnects | sequence breaks, reconnects and resubscribes per feed per hour | C | Under 1 an hour per feed |
| Conflation | updates dropped by the 4-per-second cap | C | Reported, not a failure |
| Job duration | start to end of each scheduled step | A, B | Within 2 times its 30-day median |
| Order round trip | click to broker acknowledgement, acknowledgement to fill | D | p95 under 500 ms to acknowledgement |
| Order rejects | broker rejects by reason | D | Reviewed daily |

Percentiles come from histograms, not averages. The latency branch stores real-browser timings as fixed log histograms per hour, which give p50, p95 and p99 without keeping raw events.

## Phased plan and costs

| Phase | What we build | Monthly cost (infra plus data) | Gate |
| --- | --- | --- | --- |
| 0. Measure (now) | Freshness, job durations and real-browser timings for what exists (the latency branch); a "data as of" label everywhere | $0 extra (Supabase Pro $25 and Cloudflare already paid or free) | None |
| 1. Delayed equities (when Trade needs it) | Minute snapshots, edge-cached JSON, one-minute bars in Postgres | About $500 to $3,000 for a display licence, plus $0 to $5 | A vendor that confirms public display in writing |
| 2. Real-time crypto | One ingest machine per exchange, normaliser, Durable Objects fan-out, R2 Parquet, live Trade charts | About $40 to $60 infra; licence $0 if the exchange agrees, else a quote | Written display permission from the exchange |
| 3. Real-time FX and equities | Add vendor feeds behind the same normaliser | FX: enterprise quote (TraderMade business is £599 without redistribution); equities from about $5,000 plus per-user fees | Revenue that covers it |
| 4. Order entry | Order check, audit table, broker adapter, trade-updates stream | Same infra; broker fees per partner agreement; legal fees | DEC-0046 and DEC-0019 accepted, lawyer, signed partner |

What to build first: phase 0, then the ingest service and Durable Objects fan-out for one crypto exchange in a branch, measured against the phase 2 budget, before paying for any licence.

## Tooling, now and later

| Tool | Use | Adopt | Cost |
| --- | --- | --- | --- |
| Our own freshness and timing tables in Supabase | The source, fetched, published and screen times above | Now (latency branch) | $0 |
| OpenTelemetry conventions | One trace id per request across browser, function and broker call; span names per hop. Use the conventions and ids now; a collector later | Now (conventions), later (collector) | Free |
| Sentry | Browser and function errors with the release attached | Now, Developer plan; Team when all three of us need it ([Sentry pricing](https://sentry.io/pricing/)) | $0, then $29 |
| Cloudflare Analytics Engine | High-volume per-hop timings from Workers and Durable Objects (phase 2) | Phase 2 | 10 million data points a month on Workers Paid, then $0.25 per million; billing not active yet ([Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)) |
| Grafana Cloud | Dashboards and alerts over the above | When there is a live feed to watch | Free tier: 10,000 series, 50 GB logs, 14-day retention ([Grafana pricing](https://grafana.com/pricing/)) |
| k6 | Load tests: 1,000 browsers on the fan-out, order ticket bursts | Phase 2 | Open source; 500 cloud test hours free ([k6 docs](https://grafana.com/docs/k6/latest/)) |
| Clock check | Compare each service's clock with NTP daily and alert over 50 ms; record the offset next to the timings | Now | $0 |
| Cloudflare Queues | Buffer between ingest and storage writers if R2 writes fall behind | Phase 2, if needed | 1 million operations a month, then $0.40 per million ([Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)) |
| ClickHouse or Timescale | Tick queries beyond DuckDB | Later | $30 to $200 |
| A FIX engine (QuickFIX/J or QuickFIX/n) | Only if a partner offers FIX and not REST | Later, probably never | Free, open source ([QuickFIX/J](https://github.com/quickfix-j/quickfixj)) |
| Not for us | kdb+, Kafka, Aeron, Chronicle, PTP hardware clocks, colocation, wire capture | Not planned | These solve microsecond problems we do not have ([RES-0022](../research/0022-how-trading-and-market-data-platforms-are-built.md)) |

## Status, 25 October 2026

Tier C's pipe is built and running ([DEC-0052](../decisions/0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md)): one Durable Object per source on Cloudflare, one upstream line shared by every viewer, conflation to four updates a second, our receive and send times on every update, the browser's clock corrected against the edge, and a latency badge on every chart. The Latency page shows p50, p95 and p99 per hop per feed.

- **What runs.** CoinGecko, about a minute behind, is the only feed whose terms allow showing it. Hyperliquid and Kraken adapters are built and off. No free source allows real-time crypto, FX or stocks on a public site, so phase 2's gate ("written display permission from the exchange") still stands, and phases 1 and 3 still need a paid licence.
- **Measured against the tier C budget.** Hyperliquid through our edge, in a test not shown to anyone: exchange to our edge p50 290 ms and p95 492 ms (budget 250 ms at p95; most of it is Hyperliquid's own block time), our processing 0 ms at the median and at most the 250 ms conflation window, edge to browser 4 ms at the median, exchange to screen p50 345 ms and p95 600 ms against the 500 ms implied by the budget. The browser hop is well inside its 200 ms; the source hop is the one over.
- **Not done yet.** Hourly Parquet files in R2 and one-minute bars in Postgres: nothing streamed today is worth keeping, and CoinGecko's terms discourage storing its data. Sequence gaps are counted in the browser; upstream gap detection matters once a real-time feed is on.
- **The worker deploy** needs a token with Workers Scripts Edit, which the GitHub Pages token does not have; it is deployed from the owner's machine until the owner adds one.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0045: We track how old our data is at every hop and how fast pages get it](../decisions/0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md)
- [DEC-0046: Payments through Stripe, and real trading only through a regulated broker](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md)
- [DEC-0047: Competitor profiles and a feedback collector that runs by itself](../decisions/0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md)
- [DEC-0052: Live prices stream through our own edge, and every chart says how late they are](../decisions/0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md)
- [RES-0022: How trading and market data platforms are built](../research/0022-how-trading-and-market-data-platforms-are-built.md)
- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](../competitors/0001-ux-patterns-users-praise-most.md)
- [LOG-0017: Ayan work log, competitor profiles, feedback collector and architecture](../log/2026-10-24-ayan-work-log-competitor-profiles-feedback-collector-and-architecture.md)
<!-- backlinks:end -->
