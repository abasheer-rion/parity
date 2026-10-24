---
id: DEC-0034
title: Demo accounts, paper trading on delayed data
type: decision
status: accepted
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [ui]
related: [DEC-0019, DEC-0031, DEC-0033, DEC-0018, DEC-0015]
---

# Demo accounts, paper trading on delayed data

## In plain words

The Trade area has a new **Demo account** tab (`/app/#/trade/demo`). Every signed-in person gets a practice account with $100,000 of virtual money. They can place market, limit, stop, stop-limit, bracket and trailing stop orders on delayed, end-of-day prices, and see their positions, cash, open orders, order history, fills, an equity curve and performance numbers. A researcher can attach one of the tested strategies (or a draft spec from the MCP server) to an account and watch its forward test: how it does on days it has never seen.

**No real money is involved, ever.** The tab, the order ticket and the Trade header all say so. Orders are matched in the browser against delayed daily prices; this is a demo for testing ideas, not an exchange, and nothing is sent to any broker. Real trading stays a future decision for the owner ([DEC-0019](0019-real-trading-later-what-it-would-legally-take.md)); the last section of this page says what it would take.

## Context

The owner asked for "an actual trading platform... for actual trading eventually, but first demo accounts, so people and researchers can test strategies without real money, with delayed data." The charts came first ([DEC-0031](0031-trade-charts-pro-charting-on-delayed-data.md)). The Practice page in Markets ([DEC-0018](0018-markets-on-the-product-side-crypto-perps-etfs-and-what-is-new.md)) only follows a price with a pretend amount; it has no orders, fees or record. Our data is one close a day per instrument, delayed, so every rule below is written for daily bars built from closes.

## Decision

1. **One account per person to start, more on request.** The first visit to the tab makes an account with $100,000 of virtual cash. "New demo account" makes another, for example one per strategy. "Reset" (with a confirmation) removes the account's orders, fills and positions and restores the cash; the starting cash can be changed on reset.
2. **Long only.** You can buy, and sell up to what you hold. There is no short selling, no margin and no borrowing: a buy needs the cash, a sell needs the holding. Cash for open buy orders and quantity for open sell orders are set aside, so one dollar cannot be spent twice.
3. **How orders fill.** The matching engine is a pure function in `web/src/lib/paper/matching.ts`, tested in `web/tests/paperMatching.test.ts`; the same inputs always give the same fills.
   - A market order fills at once at the latest delayed close, moved against you by the slippage.
   - Every other order is checked against each new daily bar dated after the day it was placed. A limit buy fills if the low reaches the limit, at the lower of the open and the limit; a limit sell mirrors it.
   - A stop buy triggers if the high reaches the stop and fills at the higher of the open and the stop, plus slippage; a stop sell mirrors it. A gap through a stop fills at the open, which is worse than the stop.
   - A stop-limit becomes a limit when its stop triggers. On that bar it fills only if the trigger price is within the limit; otherwise it rests as a limit.
   - A trailing stop follows the best close since it was placed, by a percent.
   - A bracket is a buy plus two sell children, a take-profit limit and a stop-loss stop. The children wait until the buy fills and go live from the next bar; when one fills, the other is cancelled (one-cancels-other). Cancelling the buy cancels both.
   - A daily bar here opens at the previous close ([DEC-0031](0031-trade-charts-pro-charting-on-delayed-data.md)), so a "gap" is the move from one close to the next.
4. **Costs per account.** A fee in basis points of the notional with a minimum per order (default 1 bp, at least $1), and slippage in basis points (default 5 bp) on market and stop fills. The ticket shows the estimated price, notional, fee and total before you place an order.
5. **The fills are the record.** Cash and holdings are rebuilt from the fills every time, in the order they happened. The stored cash and positions are a copy kept for convenience.
6. **Performance uses the engine's definitions** (`web/src/lib/paper/stats.ts`, tested in `web/tests/paperStats.test.ts`, mirroring `engine/src/parity/metrics/performance.py` and [REF-0002](../reference/0002-kpis.md)): Sharpe is the mean of daily returns over their sample standard deviation times the square root of 252, with a zero risk-free rate; max drawdown is the worst fall of cumulative equity from its peak. Win rate and profit factor count closed trades (each sell) after fees. The equity curve values cash plus every holding at each day's delayed close.
7. **Storage.** Migration `supabase/migrations/20261024010000_paper_trading.sql` adds `paper_accounts`, `paper_orders`, `paper_fills` and `paper_positions`. Each has `user_id` defaulting to the signed-in person, row level security so a person reads and writes only their own rows, no access for signed-out visitors and no TRUNCATE. Child rows point at their account with the pair (account, owner), so a row can never hang off someone else's account, and they are removed with the account. Check constraints cover side, type, status, positive quantities and prices. The local preview without sign-in keeps the same records in the browser.
8. **Strategy forward testing.** A researcher attaches a strategy from the latest research report, or pastes an MCP draft spec, with a start date (today or later) and a capital. The research nightly workflow (`.github/workflows/research.yml`) reruns every strategy on the newest data each night with its code frozen and publishes the report. So the forward test is that strategy's own equity curve from the start date onward, scaled to the account's capital. It is labelled out-of-sample, the honest complement to a backtest, and shown next to what the backtest promised before the start date (total return, yearly growth, Sharpe and max drawdown of the earlier curve). The report keeps one point a week, so Sharpe there uses 52 weeks a year and the first forward week can include a few days before the start. A draft spec that is not in the nightly run is stored as it is and labelled as waiting; it is forward tested once it is registered as a strategy and included in the nightly run. We never estimate numbers for it.

## Consequences

- People and researchers can try order types, costs and strategies with nothing at stake, and every number on the page can be checked by a unit test.
- Matching runs in the browser, so a person could edit their own demo records. That is acceptable for a demo; it would not be for anything real.
- Fills only happen when the page is opened and new delayed bars exist. Orders do not fill on days with no new close.
- Daily bars from closes cannot show intraday moves, so stops and limits fill as if prices moved straight from one close to the next. A real intraday feed would need a paid licence ([DEC-0031](0031-trade-charts-pro-charting-on-delayed-data.md)).

## The path to real trading (a future owner decision)

None of this is built, and none should be until the owner decides and a lawyer has checked it. [DEC-0019](0019-real-trading-later-what-it-would-legally-take.md) holds the legal detail; in short:

1. **A broker partner, not our own brokerage.** A broker-dealer that offers trading through an API, such as Alpaca, would hold the accounts and the money and route the orders. Its agreement decides what we may show, say and charge.
2. **The regulatory steps.** A securities lawyer's review, the partner contract, disclosures and terms, complaint handling, record keeping, and for crypto either a licensed crypto partner or state licences. No personal advice: the product keeps showing evidence and risks, never "buy".
3. **Know your customer.** Identity checks, anti-money-laundering and sanctions screening, usually run by the partner, with our own privacy and security to match the personal data we would hold.
4. **What changes in the code.** Orders would go to the partner's API from a server, never from the browser; fills, cash and positions would come back from the partner and be the record, replacing our matching engine for real accounts. Prices would need a licensed real-time feed. Demo and real accounts would be kept visibly and technically apart, and the demo engine would stay for practice. Until then, nothing on the site takes money or places a real order.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
