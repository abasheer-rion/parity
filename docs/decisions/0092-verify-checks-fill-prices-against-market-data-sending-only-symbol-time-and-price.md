---
id: DEC-0092
title: Verify checks fill prices against market data, sending only symbol, time and price
type: decision
status: accepted
created: 2026-11-04
updated: 2026-11-04
authors: [ayan]
tags: [data, method, ui]
related: [DEC-0036, DEC-0079, DEC-0081, DEC-0087, DEC-0091, REF-0030, REF-0014, DEC-0063]
---

# Verify checks fill prices against market data, sending only symbol, time and price

## In plain words

A faked trade file is easiest to catch by its prices: a fill at a price nobody traded at that minute, or on a day the market was shut. Verify can now check that. With the person's leave, the page sends the symbol, the time and the price of each fill to our server, and nothing else from the file. The server compares each one with the prices traded around that time and answers inside, outside, market closed, or not checked and why. The market data stays on our server: it is never shown or passed on. US stocks are built and switched off until Alpaca has had the notice its terms ask for; crypto runs on our own on-chain pools; currencies are not covered, because no free source we read allows this use.

## Context

- We hold one price a day ([DEC-0036](0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)), so for an uploaded file "perfect timing" said "cannot be checked", and fills were only flagged when far from the day's price. That is the main way a made-up CSV gets through, and it matters most for prop firms ([DEC-0087](0087-free-pilots-for-prop-firms-with-a-batch-screen-a-back-test-and-a-sample-report.md)) and badges ([DEC-0081](0081-verify-is-a-public-page-with-broker-imports-embeds-and-a-citable-method.md)). [DEC-0079](0079-parity-is-an-ai-native-verification-platform-for-retail-traders-of-all-sizes.md) named a licensed source of highs and lows as an owner item.
- On 4 November 2026 the owner asked to build the actual product: price ranges for computation only, from Alpaca for US stocks (the existing `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY`), exchanges' public candles and our on-chain price for crypto, and currencies if a free source allows it, each source's terms read first and any that forbid this use skipped.
- Until now nothing from a file left the browser ([DEC-0036](0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)). This check needs three fields of each fill on our server, so it is opt-out, said before it runs, and limited to those fields.

## Decision

### 1. Sources, and what their terms permit

Read on 4 November 2026. The use asked about each time: a business's server fetches bars, computes a pass or fail per fill for its users, shows only that result, and keeps the bars in a short cache.

| Source | What its terms say | Used |
| --- | --- | --- |
| Alpaca market data, IEX feed ([terms](https://files.alpaca.markets/disclosures/library/TermsAndConditions.pdf), [customer agreement](https://files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf)) | "use the Services and Content solely for your own personal and non-commercial purposes. Should you wish to use the Services and Content for any other purposes, including without limitation commercial usage, or making the Services and Content available to others through your own application ... you shall provide Alpaca with 30 days advance written notice"; and "not to reproduce, distribute, sell or commercially exploit the market data in any manner without written consent from Alpaca" | Built, off until the owner has given the notice and has consent (owner step 1) |
| IEX historical data ([terms](https://www.iex.io/legal/hist-data-terms)) | Use and distribution allowed with the credit line "Data provided for free by IEX. By accessing or using IEX Historical Data, you agree to the IEX Historical Data Terms of Use."; non-display use of IEX data is free | The IEX feed is asked for, never the consolidated one, which carries every exchange's licence. The credit is shown wherever an IEX result is |
| Coinbase ([market data terms](https://www.coinbase.com/legal/market_data)) | "may not be used to build an application intended for use by end users", and no "Derived Works" to third parties | No |
| Kraken ([terms](https://www.kraken.com/legal/global-terms)) | Content "only for your own benefit"; no third-party applications without consent. Its OHLC also returns only the last 720 bars | No |
| Binance ([dataset terms](https://data.binance.vision/Binance_Vision-Terms_of_Use.pdf)) | CC BY-NC-SA, "Commercial licensing is strictly excluded"; the main API answers 451 from the US | No |
| Bybit ([terms](https://www.bybit.com/en/legal/terms-of-service/terms-of-service)) | No commercial use or derivative works; the US is excluded and blocked (403) | No |
| OKX ([API agreement](https://www.okx.com/en-us/help/okx-api-agreement)) | Market data "solely for your own personal, non-commercial" use, which "apply equally to Market Data accessed through public endpoints" | No |
| Parity on-chain price, Base pools ([DEC-0063](0063-the-public-sees-live-prices-from-our-own-on-chain-feed.md)) | Public blockchain data carries no licence. PublicNode's terms cover its service and claim nothing over chain data ([terms](https://www.publicnode.com/terms)) | Yes, for crypto. Its free node keeps about the last eight weeks |
| Tenderly's free gateway ([terms](https://tenderly.co/terms-of-service)) | "solely for Your personal use and not for the benefit of any other person or entity" | No |
| Currencies: Dukascopy, OANDA, Twelve Data, Alpha Vantage, FXCM, Massive free plan | Personal, internal or non-commercial use only on the free plans | No |
| HistData.com | No licence found | No |
| Frankfurter and the ECB | Allowed, but one daily rate, no high or low | Not useful here |

Massive's paid Business plan allows "calculations ... provided that they do not contain Information", and a nightly job could build minute bars from IEX's own historical files. Both are owner decisions (step 3).

### 2. The check

For each fill the server takes the bars around its time, the lowest and highest price in them, widens that by the source's tolerance, and answers one word. Method `fills-1.0`, part of Verify method `verify-1.3`.

| Source | Bars | Window | Tolerance | Day's range as a fallback |
| --- | --- | --- | --- | --- |
| IEX trades through Alpaca | One minute | 5 minutes either side | 0.5%, at least a cent | 1%, regular session only, when IEX had no trade in the window |
| Base pools | Each swap | 10 minutes either side | 1% (a pool is another venue, up to its fee away) | None |

- **Outside** fails card 4's new row "Fill prices against the traded range" when more than 2 in 100 checked fills, and at least 2, are outside. One or two can come from fills at an average price, late reports or another venue. The words are "N fills fall outside the traded range on our data source", never an accusation.
- **Market closed**: US stocks from 8 p.m. Friday to 8 p.m. Sunday New York time, and market holidays (a weekday on which SPY has no day bar). Same failing rule, its own row "Fills while the market was closed". Evenings and nights are not called closed: some brokers trade then.
- **At the day's high or low**: within 0.05%. "Perfect timing" now uses this when at least 10 entries have a known day range: more than 30% at the day's best price fails, as before.
- **Time zones**: a file that names its zone is read in it, Interactive Brokers in New York time. Otherwise every zone from UTC-12 to UTC+14 in half hours is tried and the one that puts the most fills inside a minute bar is used, an hour either way for summer time; with fewer than 5 fills, inside at any zone counts. Dates only use the day's range. The on-chain source needs a time of day and a known zone.
- **Which fills**: every exit, and every entry unless the importer averaged opening fills at different prices (no trade happened at that average).

### 3. What leaves the browser

- A checkbox, ticked by default and shown before "Check this record" and on the batch screen, says the symbol, time and price of each fill are sent and nothing else. Unticked, nothing is sent and the rows say "Not run". Signed out, nothing is sent.
- The page first asks `GET /api/verify/fills` which markets and coins can be checked, and sends only those fills: a currency pair, or a coin with no Base pool, never leaves.
- The server refuses a fill with any field but `s`, `t` and `p`. Nothing about the fills is stored. Its log line has counts only.

### 4. The server

- `POST /api/verify/fills`, a Pages Function (`web/functions/api/verify/fills.ts`, logic in `web/src/lib/verify/range/`). Parity's own pages only, signed in, never a connected AI app's token.
- Limits: 1,000 fills and 60 symbols a request, 120 calls to sources and 20 seconds; the page sends what is left again, up to 8 rounds. 50,000 fills and 400 checks a day per person, counted by `fill_check_take()` (`supabase/migrations/20261118000000_fill_checks.sql`, counts only, rows kept 30 days), and 30 requests a minute per address. These stop the answers being used to rebuild the bars one guess at a time.
- Each source is paced per server instance; a 429 or 5xx rests it a minute and the fills say "not checked".
- Cache: Cloudflare's cache in each data centre, nothing to set up; a KV namespace bound as `FILL_RANGES` is used too when the owner adds one. Past days and hours are kept 30 days, the last two days 10 minutes. Never served to a page.

### 5. Where it runs

| Where | How |
| --- | --- |
| `/verify/` and the app's Verify page | Opt-out checkbox, signed in |
| Batch screen (`/business/screen/`) | Step 4, same checkbox; up to 10,000 fills a batch, the same share of each account's; a "Fill prices" column, a line in the summary and three CSV columns. It does not change the screen's verdict (`screen-1.0`); each account's full report carries the rows |
| Broker-connected records ([DEC-0091](0091-verify-reads-trades-from-brokers-with-read-only-keys-and-marks-the-record-broker-connected.md)) | Run on our server on the trades read, nothing from a page. They should pass, so the log records the row's status for each read as a self-test of our data |
| API and AI apps | Not yet |

### 6. Tests

Unit tests in `web/tests/fills/` run the real server code against a made-up market whose answers have the exact layout Alpaca and a Base node gave on 4 November 2026 (samples in `web/tests/fixtures/fills/`) but whose prices come from smooth formulas: no real market data is put in the repository. `web/e2e/verify-fills.spec.ts` uploads a deliberately faked file (every third trade bought 5% under and sold 5% over what traded) and a genuine one, and checks what was sent. `supabase/tests/test_fill_checks.sql` checks the daily allowance.

### 7. Owner steps

None of these was done by us. No new secret is needed for what is switched on.

1. To check US stocks: send Alpaca the 30 days' written notice its terms ask for, saying Parity will use IEX bars on its server to compute pass or fail results for its users, never displayed or redistributed, and ask for the written consent its customer agreement asks for. Once given, set the Pages environment variable `FILL_CHECK_STOCKS=on` (not a secret).
2. Optional: create a KV namespace and bind it to the Pages project as `FILL_RANGES`, so every data centre shares one cache.
3. Optional, to reach further: a Base node with full history (for example a PublicNode personal token) set as the secret `BASE_RPC_URL`, with a credentials register row, for crypto fills older than about eight weeks; and a decision on consolidated US data and currencies (Massive Business plan, or a nightly job on IEX's own files).
4. `FILL_CHECK=off` in the Pages environment switches the check off anywhere.

## Consequences

- A made-up price, a misdated fill or a fill on a weekend now shows on card 4, for US stocks once switched on and for crypto with Base pools today. Prop firms see it per account.
- Verify no longer keeps every byte of a file in the browser by default: three fields per covered fill leave it, said up front and easy to turn off. The methodology page, `/methodology/#fills`, says so.
- Limits that stay: currencies, futures, options, metals and indexes are not checked; crypto reaches back about eight weeks; IEX is one exchange, so its tolerance is wide; a fair price at the wrong minute of the same day can still pass. The check shows a price was possible, not that a trade happened.
- Changing a window, a tolerance or a source changes `RANGE_VERSION` and the Verify method version.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0030: Parity Verify methodology](../reference/0030-parity-verify-methodology.md)
<!-- backlinks:end -->
