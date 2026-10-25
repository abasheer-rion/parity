---
id: DEC-0056
title: Team members see real-time venue feeds the public does not
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [crypto, data, infra, ui]
related: [DEC-0052, REF-0014, REF-0019, DEC-0045, DEC-0040, REF-0017]
---

# Team members see real-time venue feeds the public does not

## In plain words

The owner wanted to see live market data right away. Most exchanges let a company look at their prices for its own use but not show them on a public website. So Parity now has a team list: people on it see real-time prices, order books and recent trades from five crypto exchanges, and US stocks once a stock data key is added. Everyone else keeps the delayed, labelled prices they had before. The website checks the team list on the server every time someone connects, so hiding a button cannot get anyone in.

## Context

- [DEC-0052](0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md) built the live data pipe and switched on only CoinGecko (about a minute behind), because no free source allows showing real-time prices to the public. Hyperliquid and Kraken adapters were built and left off.
- Showing data to the public and using it inside the company are different rights. We re-read each venue's terms on 25 October 2026 for internal use (table below and in [REF-0014](../reference/0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md)).
- No new accounts, keys or paid contracts were allowed for this work. The owner creates any stock data account.

## Decision

1. **A team list in the database.** `public.team_members` holds one row per team account, keyed by the account's id. Row rules let a signed-in person read only their own row, and nobody but the owner or the service role can add, change or remove rows. `is_team()` answers for the caller and never counts a token issued to an AI app. Nothing is seeded; the owner adds people in the Supabase SQL editor (the line is in `market-data/README.md`).
2. **The server decides.** A source whose terms allow internal use only is marked `internal` (`web/src/lib/live/sources.ts`). For those, the `/live` function checks the sign-in (signature, issuer, audience, expiry, the same public-key check as the site middleware) and the team list before it connects anyone, and closes the socket with code 4003 otherwise. History and symbol lists for those sources answer 403. The fan-out refuses an internal viewer unless the function vouched for them, and closes the socket with code 4001 when the sign-in expires, so a person taken off the list loses access within the hour. Another site's page cannot ride a member's sign-in, because the check also looks at where the request came from.
3. **Every free feed that allows internal use is on for the team**, every pair each venue lists:

| Source | Pairs (25 Oct 2026) | What streams | Why internal use is allowed |
| --- | --- | --- | --- |
| Hyperliquid | 525 perps and spot pairs | trades, 20-level book, overview | Terms (15 June 2026) have no clause on data use; owner decision |
| Kraken | 1,344 spot, including 12 fiat pairs | trades, 25-level book, overview | Use for your own benefit; no making content available to third parties |
| Coinbase Exchange | 515 | trades, book, overview | No redistribution or display to third parties |
| Gemini | 334 | trades, book, overview | Market data agreement allows "personal and/or internal use" |
| Binance.US | 265 | trades, 20-level book, overview | No public display |
| Alpaca (IEX, keyed) | any US stock or ETF, 30 at once on the free plan | trades, overview of 100 large names | The account holder's own subscription, team only |
| Finnhub (keyed) | any US stock, 50 at once | trades | Only with a plan or written approval for business use; the free plan is personal only |

   Turned down: Binance, Bybit and OKX block or bar the US; Deribit and OKX data is personal use only; Bitstamp forbids use on any other website; CME and Deribit indices are not free. FX: no free interbank source allows internal real-time use, so the FX filter shows the fiat pairs crypto venues trade (Kraken's EUR/USD, GBP/USD, USD/JPY and others, Gemini's AUD/USD and EUR/USD), labelled as such.
4. **On the page** (Trade, [DEC-0040](0040-parity-trade-a-full-screen-trading-app-of-its-own.md)):
   - A Markets view lists every pair from every source the person may see, with live price, 24 hour change, 24 hour volume and a one hour sparkline. It sorts by any column, filters by venue, kind (crypto, FX, stocks) and text, and draws only the rows on screen at a fixed height, redrawing at most once a frame and re-sorting at most once a second.
   - A live crypto chart's side panel shows the order book (12 levels each side with depth bars and the spread) and the recent trades, written straight into fixed rows once a frame.
   - Candles build tick by tick. The forming bar is faded and marked "Forming" in the legend; strategy signals still use finished bars only.
   - Symbol search covers every team venue's pairs, and with a stock key every SEC-listed stock streams.
5. **Latency, pointed out.** The badge on team feeds says "Internal use, real-time" (INT for short). It shows the median exchange-to-screen time of the last 200 updates, and its card adds the 95th percentile, reconnects and lost updates. Browsers send hop samples and reconnect and lost-update counts to the latency tables ([DEC-0045](0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md)); the Latency page lists every source, team ones marked.

## What we measured

The fan-out worker could not be deployed from this session (see Consequences), so these numbers come from the same fan-out code running on the owner's Mac in Chicago, with the Mac's clock corrected against time.apple.com (it was 5.736 s slow). 90 seconds, one viewer per source, trades, books and the overview all subscribed.

| Feed | Exchange to fan-out p50 | p95 | Exchange to viewer p50 | p95 | Updates timed |
| --- | --- | --- | --- | --- | --- |
| Coinbase | 33 ms | 41 ms | 46 ms | 301 ms | 188 |
| Gemini | 49 ms | 95 ms | 52 ms | 305 ms | 15 |
| Kraken | 74 ms | 87 ms | 83 ms | 353 ms | 80 |
| Hyperliquid | 305 ms | 485 ms | 319 ms | 594 ms | 114 |
| Binance.US | no BTC trades in 90 s (its last BTC-USD trade was 7 minutes old) | | | | 0 |
| CoinGecko (public, delayed) | 38 s | | 38 s | | 1 |

The p95 to the viewer includes the 250 ms conflation window, which only applies when a symbol trades more than four times a second. On Cloudflare, add the edge's own distance to each venue; [DEC-0052](0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md) measured Hyperliquid at 290 ms p50 from Cloudflare. Real numbers per feed appear on the badge and the Latency page as soon as a team member watches.

## Alternatives considered

- **Show the venue feeds to everyone.** Rejected: their terms forbid it ([DEC-0052](0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md)).
- **Hide the feeds in the page only.** Rejected: anyone could call the WebSocket directly. The check lives on the server.
- **Key the team list by email.** Rejected: email confirmation has been off, so an address is not proof of identity. The row names one account by its id.
- **Sign a ticket for the WebSocket with a server secret.** Rejected for now: the session cookie already reaches the WebSocket on the site, and the sign-in itself rides as a sub-protocol from the desktop app, so no new secret is needed.

## Consequences

- **Owner steps** (details in `market-data/README.md`): add yourself and the team to `team_members` with one SQL line; for US stocks, create an Alpaca account and keys (free plan: IEX trades, 30 symbols; Algo Trader Plus for every exchange) and put them in the Keychain; for Finnhub, only with a plan that allows business use.
- **Deploying the fan-out needs a token.** The GitHub token is Pages only, and this session had no token with Workers Scripts Edit for the account. CI now deploys `parity-live` before the site when the GitHub secret `CLOUDFLARE_WORKERS_TOKEN` (Account, Workers Scripts Edit) is set, and skips it otherwise. Until then the team feeds answer "Unknown source" from the old worker; the public CoinGecko feed is unaffected.
- The Markets overview runs one upstream overview subscription per venue while someone has it open. Kraken's 1,344 tickers and Coinbase's 515 cost a few hundred messages a second at our edge, only while watched.
- Copy follows [REF-0017](../reference/0017-parity-copy-rules.md); nothing calls a feed live when it is not, and team feeds say they are team only.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0014: Markets data, crypto, perps and ETF sources and their terms](../reference/0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
