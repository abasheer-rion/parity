---
id: DEC-0052
title: Live prices stream through our own edge, and every chart says how late they are
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [crypto, data, infra, ui]
related: [REF-0019, RES-0022, DEC-0045, REF-0014, DEC-0031, DEC-0040, DEC-0018, REF-0006]
---

# Live prices stream through our own edge, and every chart says how late they are

## In plain words

The owner asked for live market data on the page, with the trading signals drawn on the candles and the delay shown everywhere. We built the pipe for it: one connection to each data source, shared by every viewer, running on Cloudflare next to the site. Every chart now carries a small badge that says whether its price is real-time, delayed or end of day, where it comes from, how long the price took to reach your screen and how old it is.

The pipe is ready for real-time data, but no free source lets us show real-time prices on a public website. Every crypto exchange we checked forbids it, needs a contract or blocks the US. So today the only streamed feed is CoinGecko, about a minute behind, for the 100 largest coins. Everything else is end of day. Real-time crypto, stocks and FX each need a paid licence, listed below for the owner.

## Context

- Trade, the Terminal and the Workbench showed end-of-day prices only ([DEC-0031](0031-trade-charts-pro-charting-on-delayed-data.md), [DEC-0040](0040-parity-trade-a-full-screen-trading-app-of-its-own.md)). [REF-0019](../reference/0019-latency-budget-and-target-architecture.md) planned a real-time tier: one ingest per feed, one tick shape, Cloudflare Durable Objects for fan-out, four updates a second per symbol, the age of every price on screen.
- We read the market data terms of 30 sources on 25 October 2026 (the table is in [REF-0014](../reference/0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md)). Coinbase (terms of 7 August 2026), Kraken, Bitstamp, Bitfinex, Crypto.com, KuCoin, Bitget, MEXC, HTX and Binance.US forbid showing their data to others without consent. Gemini allows personal use only unless we sign its redistribution agreement. Binance and Bybit block US addresses. Pyth now needs a key for every request and sells display rights from 500 USD a month. Hyperliquid's terms say nothing about data and close the app to US persons, so it stays an owner call, as in [DEC-0018](0018-markets-on-the-product-side-crypto-perps-etfs-and-what-is-new.md).
- No free source allows showing single US stock prices. The SEC's symbol list is public. IEX next-day files are free with a credit line but cover only IEX's own trades, about 8% of volume, as raw packet files.
- No new accounts or keys were allowed for this work, and no paid contracts.

## Decision

1. **One fan-out per source** (`web/live/`, the `parity-live` worker).
   - A Durable Object per source holds one upstream connection (or one poll) and relays each update to every viewer of that symbol. It opens when the first viewer arrives and closes a minute after the last one leaves, so nothing runs while nobody watches.
   - Updates are conflated to at most four a second per symbol. A price after a quiet spell goes out at once; a burst is folded into one update with its first, last, high and low prices and the volume.
   - Every update carries the exchange's time, our receive time and our send time. A catch-up snapshot a source sends after a subscribe is dropped, so old trades never look live.
   - Caps: 500 viewers per source, 24 symbols per viewer, 60 upstream symbols per source. `GET /live/status` shows each source's line, viewers and feed lag and is the log.
   - The site reaches it at `/live/ws`, `/live/history`, `/live/universe`, `/live/sources` and `/live/status` (`web/functions/live/`), public and signed out. History and the symbol list are cached at the edge.
2. **Sources are switched on by their terms** (`web/src/lib/live/sources.ts`, also printed by `parity data sources`).
   - On: CoinGecko, polled every 30 seconds, about a minute behind, with "Data provided by CoinGecko" linked beside the chart. The SEC's list of 10,260 US-listed symbols for search.
   - Built, tested and off: Hyperliquid real-time trades (owner call; `LIVE_ALLOW=hyperliquid` turns it on) and Kraken (needs written consent).
   - A licensed vendor plugs in by setting `VENDOR` and `VENDOR_KEY`; the browser needs no change.
3. **On the page.**
   - Trade's symbol search covers the daily series, the live symbols and every SEC-listed stock. A live symbol opens a chart whose candles tick in place, with its own timeframes (5 minutes, 1 hour and 1 day for CoinGecko). A stock with no licensed feed says so instead of showing anything made up.
   - Updates reach the chart once per animation frame and change only the forming bar; the whole chart is redrawn once when a bar finishes. Header prices are written straight to the page.
   - The Terminal has a `LIVE` function and the Workbench a Live view, each a compact board of streamed prices with a small live chart.
4. **Signals on the candles** (`web/src/lib/signals.ts`).
   - The 11 factory recipes that trade one price series on its own (the trend, Turtle breakout, MACD, Ichimoku and Bollinger rules) are ported rule for rule. A test checks every rule against the engine's own output, bar for bar, on the same prices.
   - Each rule is a toggle. Buy, sell and exit markers sit on the candles; clicking one shows the rule that fired with its numbers, the market the strategy was tested on, and its result in the 11 tests from the latest report ([REF-0006](../reference/0006-the-gauntlet.md)).
   - No look-ahead: a signal uses closes up to its own bar only, and only finished bars are used. Ranking strategies and the edge recipes need many markets or macro data, so they are not drawn.
5. **Latency everywhere.**
   - The badge on every chart shows the feed type, source, exchange-to-screen time and data age, amber when late and red when stale or disconnected. Clicking it shows each hop: exchange time, our receive and send times, your browser's receive and draw times, and the clock check.
   - The browser corrects its own clock against the edge with ping and pong, keeping the fastest round trip. This Mac's clock was 5.7 seconds slow during testing, and the correction removed it.
   - Every 30 seconds the browser sends a random sample of each hop (four per hop per source) to the existing `/rum` totals ([DEC-0045](0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md)), unless the browser asks not to be tracked. The Latency page has a new "Live feeds" section with p50, p95 and p99 per hop per source, and the edge's own feed lag.

## What we measured

| Feed | How measured | Exchange to our edge | Exchange to screen p50 | p95 |
| --- | --- | --- | --- | --- |
| CoinGecko, delayed | Preview deploy, signed out, one browser in North America | 59 s (CoinGecko's own refresh plus our 30 s poll) | 59 s | not enough samples yet |
| Hyperliquid, real-time (not shown to anyone) | A keyed test worker on Cloudflare for 90 seconds, then deleted | p50 290 ms, p95 492 ms | 345 ms | 600 ms |

Our own part of the trip, from the edge to the browser, was 4 to 6 ms at the median from the owner's machine. The conflation window adds up to 250 ms only when a symbol trades more than four times a second.

## Alternatives considered

- **Show Hyperliquid or an exchange feed anyway.** Rejected: their terms forbid it or say nothing, and the rule for this work was to use only what is allowed.
- **Browsers connect straight to an exchange.** Rejected: one connection per viewer instead of one per source, no shared timing, and the same terms problem.
- **Supabase Realtime for fan-out.** Rejected in REF-0019: 500 messages a second on Pro.
- **Skip the pipe until a licence is bought.** Rejected: the pipe, the badge and the timing are the same for a paid feed, and building them now shows the owner what each licence would buy.

## Consequences

- **Owner decisions** (prices read 25 October 2026 from each vendor's page):
  - Real-time crypto display: Pyth Starter 500 USD a month (crypto only), or Pyth Pro from 2,500 USD (crypto, FX, metals and US stocks, limited redistribution). Gemini's redistribution agreement, price unknown (bizdev@gemini.com). Kraken written consent (marketdata@kraken.com).
  - Hyperliquid real-time perps: free, but its terms are silent and its app bars US persons. One setting turns it on; ideally decided with a lawyer.
  - US stocks, 15 minutes delayed: Intrinio Startup 333 USD a month for six months, 666 for the next six, then 999, display included. Real-time: Massive Stocks Business 2,499 USD a month plus 1,999 (499 for delayed), Databento 199 plus a 1,750 licence plus exchange fees, Cboe One direct 5,000 USD plus 0.25 per user, IEX TOPS real-time 1,000 USD (IEX trades only).
  - A free CoinGecko Demo key would give the feed limits in writing; the keyless API is limited per address and Cloudflare's addresses are shared, so a poll sometimes fails and is retried after 5 seconds.
  - Deploying `parity-live` needs a token with Workers Scripts Edit. The Pages token in GitHub is Pages only, so the worker is deployed from the owner's machine for now.
- Feeds that are not real-time say so on every chart. Nothing on the page claims to be live when it is not.
- Signals show when each rule fires on the chart's own bars, with no costs, sizing or rebalancing. They are not trade advice, and the card says which market the strategy was actually tested on.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0056: Team members see real-time venue feeds the public does not](0056-team-members-see-real-time-venue-feeds-the-public-does-not.md)
- [DEC-0063: The public sees live prices from our own on-chain feed](0063-the-public-sees-live-prices-from-our-own-on-chain-feed.md)
- [DEC-0064: One data registry finds, enrols, tests and watches every series by itself](0064-one-data-registry-finds-enrols-tests-and-watches-every-series-by-itself.md)
- [REF-0014: Markets data, crypto, perps and ETF sources and their terms](../reference/0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md)
- [REF-0019: Latency budget and target architecture](../reference/0019-latency-budget-and-target-architecture.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
