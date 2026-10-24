---
id: DEC-0036
title: Verify runs its checks in the browser and holds daily prices only
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [method, ui]
related: [REF-0016, INT-0003, DEC-0032, DEC-0015, DEC-0014, DEC-0035]
---

# Verify runs its checks in the browser and holds daily prices only

## In plain words

Verify, the page that says whether a trading record holds up, is now built. A file you give it is read and checked on your own device and never sent to us. We wrote down the choices the spec left open: how the five possible verdicts are ranked, what counts as a red flag, how a file without a starting balance is handled, and what card 4 can check when we only hold one price a day for each market, not its high and low.

## Context

[REF-0016](../reference/0016-parity-verify-mvp-spec.md) sets what Verify must do and ten acceptance tests. It leaves some build choices open, and one assumption in it does not hold: card 4's fill checks need each day's high and low, and our free sources (FRED, the ECB, CoinGecko) publish one price a day ([DEC-0031](0031-trade-charts-pro-charting-on-delayed-data.md) hit the same limit for the Trade charts).

## Decision

### Where things run

| Part | Where |
| --- | --- |
| Parsers, personal column removal, every check | The browser, `web/src/lib/verify/` (pure TypeScript, no React) |
| Luck check | A line for line port of the engine's deflated Sharpe ratio, `web/src/lib/verify/dsr.ts`, checked against the Python on 20 series and tries from 1 to 10,000 (`scripts/verify_dsr_fixture.py`) |
| Input B, a described bot | A rule-based extractor and the report and search exports already on the site |
| Input C, one of our strategies | The strategy's equity curve from the research run, with every try our research and search have counted |
| Daily prices for card 4 | `/data/verify/prices.json`, written at deploy by `scripts/export_verify_prices.py` from the Parity Terminal export, behind sign-in like all `/data/` files |

The only request the page makes after a file is chosen is for that price file. A browser run (`web/scripts/verify-network.mjs`) checks that no request carries any part of the file.

### The verdict

The verdicts are checked in this order, and the first that applies wins:

1. **Not enough data:** fewer than 30 trades and fewer than 60 daily returns.
2. **Does not hold up:** a claim the file contradicts by more than 5 points, or expectancy at or below zero after fees.
3. **Fragile:** a red tail-risk flag. The worst loss wipes out more than 20 average wins, or a martingale pattern is found, or the account fell more than 50% from a high.
4. **Could be luck:** the luck check is below 0.95 at the stated tries, or any check on cards 4 or 5 failed (a short record counts as "too short to tell").
5. **Holds up:** none of the above.

The sentence under the verdict is built from the numbers that decided it, for example "Wins 99.0% of trades, but the 1.0% of losses are 150 times larger than the average win, so on average each trade loses 0.51".

### Choices the spec left open

| Question | Choice |
| --- | --- |
| A trade log with no starting balance | Per-trade checks run. The luck check uses each trade's profit (the Sharpe ratio does not need a balance), the largest fall from a high is not measured, and the page says so |
| Martingale pattern | Size grows after every loss in at least 3 out of 4 losing streaks (and at least 3 streaks), or a same-side position on the same symbol is opened at a worse price at least 3 times while an earlier one is still open. Needs position sizes; without them the card says it cannot be checked |
| Edited history, trade numbers that skip | Only for TradingView exports and plain trade lists, whose numbers run 1, 2, 3. MetaTrader tickets are shared across a broker's whole server, so their skips mean nothing |
| "Survives up to N tries" | The largest whole number of tries with a luck check of 0.95 or more, searched up to 1 billion |
| Minimum record length | Solved for the same luck check, with the same single-estimate variance stand-in, and shown as months still needed |
| Fees in a plain trade list | A fees column is taken off the profit. People whose profit already includes fees leave it unmapped |
| A described bot's settings | Numbers left in the rules once the claimed results (win rate, return, drawdown, trade counts, holding time, leverage) are taken out. Take-profit and stop-loss count as settings |

### Card 4 with one price a day

For each major currency pair, Bitcoin, Ether and the S&P 500 we hold one price a day, which sits inside that day's range. So:

- **Fills outside the day's range** becomes "fills far from the day's price" for these symbols: a fill is flagged when it is further from that day's price than three times a 1-in-100 daily move (at least 1%), a distance the day's range would not plausibly reach. It catches made-up or misdated prices, not small ones.
- **Perfect timing** says "cannot be checked from this input" for these symbols, because the day's low and high are unknown.
- Both run exactly as the spec says for any symbol whose rows carry a real high and low (kind `hl` in the price file). The code and its tests are ready; the data is not.
- A symbol we hold nothing for gets "cannot be checked from this input" with its name.

## Consequences

- Acceptance test 4 (the peeking backtest) passes in the test suite with real highs and lows, but a real upload cannot be flagged for perfect timing until we add a source of daily highs and lows that allows this use. That source, and its licence, is an owner decision.
- Verify results are product data and never reach the research side ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)).
- Changing a threshold or a check changes `METHOD_VERSION` in `web/src/lib/verify/types.ts`, so every badge says which rules judged it.
- The DSR port and the engine must change together; the fixture test fails otherwise.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
