---
id: REF-0016
title: Parity Verify MVP spec
type: reference
status: current
created: 2026-10-23
updated: 2026-10-24
authors: [ayan]
tags: [method, ui]
related: [INT-0003, DEC-0032, DEC-0036, RES-0020, DEC-0015, DEC-0025, REF-0006]
---

# Parity Verify MVP spec

## In plain words

Verify is a new page in the product app. You give it a trading record, a description of a bot, or the name of a strategy. It tells you, in plain words, whether the record holds up: does it actually make money per trade, how bad can a single loss get, could the result be luck given how many things were tried, and are there signs it was tuned to the past or peeked at the future. If you want, it makes a badge and a link you can share, which say exactly what was checked and what was not.

This page is a spec. It was built in October 2026; the choices it left open, and one assumption that did not hold (we hold one price a day, not daily highs and lows), are in [DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md). Why we build it is in [INT-0003](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md) and the business around it is in [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md).

## Summary

| Part | MVP scope |
| --- | --- |
| Where | Product app, `/app/#/verify`, listed in `web/src/lib/pages.ts` as a product page ([DEC-0015](../decisions/0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)) |
| Inputs | (A) a CSV of trades or an equity curve, (B) a bot described in plain words, (C) a strategy picked from our list |
| Output | One verdict, five check cards, a "survives up to N tries" number, and an optional shareable badge |
| Where the maths runs | In the browser for (A). Precomputed research results for (B) and (C). No new server for the MVP |
| What is stored | Nothing, unless the person publishes a badge or opts in to the dataset. Then only summary numbers and a file hash, never the file |
| Not in the MVP | Broker connections, running a new backtest on a server for any description, paid tiers, the API |

The build is done when every item in [acceptance tests](#acceptance-tests) passes.

## The three inputs

### A. Upload a trade log or equity curve

One drop zone that accepts `.csv` (and `.txt` with commas or tabs). Maximum 5 MB and 50,000 rows for the MVP. The parser detects the format from the header row, shows what it found ("MetaTrader 5 history, 412 closed trades, EURUSD and XAUUSD, 3 Jan 2024 to 18 Oct 2026"), and lets the person correct the column mapping before anything is computed.

| Format | How people get the file | Columns we need | Notes |
| --- | --- | --- | --- |
| MetaTrader 4 | Account History, "Save as Report" gives HTML. Many traders convert it to CSV with a script or a journal app | Open time, close time, type, size, symbol, open price, close price, commission, swap, profit | MVP accepts CSV. Parsing the HTML report directly is a stretch goal. The exact column names must be checked against real exports before coding (unverified) |
| MetaTrader 5 | History tab, Report, Open XML or HTML; saved as CSV from a spreadsheet | Same as MT4, plus deal and position IDs | Deals must be paired into positions (in and out). Partial closes count as separate trades |
| TradingView | Strategy Tester, "List of trades", export | Trade number, type (entry or exit), signal, date and time, price, contracts, profit, cumulative profit, run-up, drawdown | Rows come in entry and exit pairs. A TradingView export is a backtest, not real trading, and the verdict must say so |
| Generic trades | Any CSV with at least a close date and a profit per trade | `close_time`, `pnl`; optional `open_time`, `symbol`, `side`, `size`, `entry`, `exit`, `fees` | Column picker if the names differ |
| Generic equity curve | Any CSV with a date and an account value or a return | `date`, and `equity` or `return` | Daily or coarser. Deposits and withdrawals must be marked in a `cashflow` column or the person is asked to confirm there were none |

Before any check runs, the page asks four questions. The answers change the verdict, so they are not optional, but each has a default that is stated on the result:

1. **Is this real money, a demo account, or a backtest?** Default: backtest, the least trusted.
2. **Starting balance** (for trade logs, so profits become returns). Default: inferred from the first equity value; a trade log with no balance gets "returns unknown" and only per-trade checks.
3. **How many strategies, bots or settings did you try before this one?** This is the number the luck check needs. Default: 1, with a warning on the result that says "you told us this was the only thing you tried". Helper text explains why it matters, with the bot battle as the example.
4. **What was claimed?** Optional: a claimed win rate, monthly return or drawdown, for example from a seller's page. If filled in, the result compares the claim with the file.

The parser drops any column that looks like personal data before computing: account number, name, email, server, login, IP address. See [data handling and privacy](#data-handling-and-privacy).

### B. Describe a bot in plain words

A text box: "Buys Bitcoin when RSI goes under 30 and sells at 5% profit, 50 trades a month, claims 92% win rate."

For the MVP this does not run a new backtest. It does three things:

1. **Pulls out the claim.** Win rate, return, drawdown, number of trades, holding time, leverage and whether it adds to losers (martingale or grid), using a small rule-based extractor. An optional LLM extractor can come later behind the same interface.
2. **Matches it to the closest strategies we have already tested,** from the factory's 102 named strategies and the search's exported leads ([DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md)), by shape and tags. It shows the closest three with their real verdicts.
3. **Runs the claim check.** Even with no trades, some claims fail on arithmetic: a 92% win rate with a 5% take-profit and no stop needs the average loss to stay under about 57.5% of a position to break even (5 x 0.92 / 0.08); a stated drawdown smaller than one stated loss is impossible. These checks are listed in [claim arithmetic](#claim-arithmetic).

The result says plainly that this is a check of the description, not of the bot. Running a real backtest of any description is phase 2: it needs the hosted engine planned in [DEC-0025](../decisions/0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md), with a sign-in, a compute cap and a log.

### C. Pick a strategy

A search box over our tested strategies. The result reuses the strategy page's numbers and gauntlet ([REF-0006](0006-the-gauntlet.md)), laid out in the same five cards as A, so people learn one format. The luck check uses our real trial count from the search, which is far larger than 1.

## The output

### The verdict

One line at the top, one of five:

| Verdict | When | Colour token |
| --- | --- | --- |
| Holds up | Positive expectancy, luck check at or above 0.95 for the stated tries, no red flags | positive |
| Could be luck | Positive expectancy but luck check below 0.95, or too short to tell | caution |
| Fragile | Positive expectancy but a red tail-risk flag (for example, one loss wipes out more than 20 wins) | caution |
| Does not hold up | Expectancy at or below zero after costs, or a claim the file contradicts | negative |
| Not enough data | Fewer than 30 trades and fewer than 60 daily returns | neutral |

Under it, one sentence written from the numbers, never from a template that hides them. Example: "Wins 97% of trades, but the 3% of losses are 41 times larger, so on average each trade loses about a quarter of a typical win."

Every result also shows: input type (real, demo or backtest, as stated by the person), the date range, the number of trades, the method version, and "Research only. Not investment advice. A verdict is about this record, not about the future."

### Card 1: win rate against expectancy

| Number | Definition |
| --- | --- |
| Win rate | Share of closed trades with profit above zero, after fees |
| Average win, average loss | Mean profit of winners, mean loss of losers, after fees |
| Payoff ratio | Average win divided by average loss |
| Expectancy per trade | Win rate x average win minus loss rate x average loss, in money and as a share of balance |
| Break-even win rate | Average loss divided by (average win plus average loss): the win rate needed at this payoff ratio to make zero |
| Profit factor | Gross profit divided by gross loss |

Shown as a small chart: the person's win rate and payoff ratio as a point against the break-even curve. This is the lesson of the bot battle, a 99% win rate can lose money, and the card should make that visible in one glance.

### Card 2: tail risk

| Number | Definition |
| --- | --- |
| Worst trade and worst day | In money and as a share of balance |
| Wins wiped out by the worst loss | Worst loss divided by average win |
| Maximum drawdown and longest time under water | From the equity curve |
| Expected shortfall (5%) | Average of the worst 5% of daily returns |
| Skew | Of daily returns, or of trade returns if there is no curve |
| Martingale or grid pattern | Position size grows after losses in at least 3 out of 4 losing streaks, or open positions are added while the first is losing |

Red flag rule: worst loss wipes out more than 20 average wins, or a martingale pattern is found, or drawdown exceeds 50%.

### Card 3: the luck check

The deflated Sharpe ratio of Bailey and Lopez de Prado [@bailey2014a], already in `engine/src/parity/metrics/performance.py`, ported to TypeScript and tested against the Python version on the same inputs to 3 decimal places.

- **Input:** daily returns from the equity curve (or built from trades and the starting balance), and the number of tries from question 3.
- **Shown:** the probability that the true Sharpe ratio is above zero after the tries, with 0.95 as the line, exactly as in the gauntlet's test A3.
- **The shareable number: "survives up to N tries".** The largest number of tries for which the luck check stays at or above 0.95. A record that survives 3 tries is weak. One that survives 5,000 is strong.
- **Minimum track record length.** How many more months of the same results would be needed to pass at the stated tries [@bailey2012].
- When the sample variance of Sharpe across tries is unknown, which is always true for uploads, the code uses the single-estimate stand-in the Python function already uses, and the card says so.

### Card 4: look-ahead and data flags

What can be checked depends on the input. The card lists every check and marks each one as passed, failed or "cannot be checked from this input". It never hides the last group.

| Check | Input | Flag when |
| --- | --- | --- |
| Fills outside the day's range | Trade log with prices and a symbol we hold daily data for (major currencies, US stocks and ETFs, Bitcoin and Ether) | An entry or exit price is outside that day's high and low by more than 0.1% |
| Perfect timing | Same | More than 30% of entries are within 0.05% of the day's best price (low for buys, high for sells). Real traders rarely do this; backtests that trade at the close they used as a signal often do |
| Too smooth | Equity curve | First-order autocorrelation of daily returns above 0.3, or no losing month in over 24 months with fewer than 3% losing days. The smoothing measure reuses `engine/src/parity/unsmooth.py` [@getmansky2004] |
| Edited history | Trade log | Gaps of more than 30 days with no trades in a record that otherwise trades daily, or trade IDs that skip, which can mean deleted trades |
| Backtest labelled as real | Any | The person said "real" but the file is a TradingView strategy export |
| Strategy look-ahead test | Input C only | Our cut-the-data test from [DEC-0014](../decisions/0014-a-strategy-factory-and-an-always-on-search.md) |

### Card 5: overfitting flags

| Check | Flag when |
| --- | --- |
| Short sample | Fewer than 100 trades or less than 12 months |
| First part against last part | Sharpe in the last 30% of the record is below half the Sharpe in the first 70% |
| Concentration | The best 5 trades make more than 50% of total profit |
| Many settings, few trades | Input B: the described rules have more than one adjustable setting per 20 trades |
| Claim against file | The claimed win rate, return or drawdown differs from the file by more than 5 percentage points |

### Claim arithmetic

Used for input B, and for input A when a claim is entered. Each rule is a pure function with a test.

1. Break-even average loss = take-profit x win rate / (1 - win rate). If the described stop-loss is wider than this, expectancy is negative before costs.
2. A stated maximum drawdown smaller than a stated single loss is impossible.
3. A stated monthly return above 10% for more than 12 months, compounded, is shown as the yearly figure it implies, next to the S&P 500's long-run figure.
4. A grid or martingale bot with no stated maximum loss is flagged "loss is not capped".
5. A win rate above 90% with no stated average loss gets "the win rate alone says nothing about profit".

## The shareable badge

Only on request, after the result is shown. The person picks a name for the record. We then store a badge record and give back:

- a public page at `/v/<id>`, where `<id>` is a random 12-character string, not guessable or sequential;
- an image (SVG, 320 by 80) and an embed snippet;
- a plain-text line for social posts: "Parity Verify: Could be luck. Survives up to 4 tries. Self-reported backtest, 212 trades. parity.endyland.com/v/<id>".

The public page shows the verdict, the five cards, the date it was checked, the method version and the SHA-256 hash of the uploaded file. Anyone with the same file can check that the hash matches.

**What the badge says about trust, in words on the badge itself.** MVP badges are always "Self-reported: Parity checked the numbers in the file, not where the file came from." A higher level, "Broker-connected", needs read-only broker or exchange connections and is out of the MVP. A badge is never an endorsement: the page says "Verification is not a recommendation."

The owner can delete a badge at any time. Deleted badges show "This record was withdrawn by its owner on <date>". They do not vanish silently, because silent deletion of losing records is one of the problems we exist to fix.

## Data handling and privacy

1. **The file stays in the browser.** Parsing and every check for input A run client-side. The file is never sent to our servers in the MVP. The page says so above the drop zone.
2. **Personal fields are dropped on parse.** Account number, name, email, broker server, login and IP columns are removed before any computation and are never stored.
3. **Nothing is stored by default.** If the person leaves, nothing remains on our side.
4. **Publishing a badge stores summary numbers only.** A new Supabase table `verify_badges` holds: id, owner user id, created and withdrawn dates, input type, stated tries, date range, trade count, the five cards' numbers, the verdict, method version and file hash. No trades and no file. Row-level security lets the owner read and withdraw their own rows; the public page reads only published, non-withdrawn rows through a view with no owner id.
5. **The dataset is opt-in, separately.** A second, unticked box: "Add this result, without your name, to Parity's research dataset of tested strategies." Ticking it copies the summary numbers, input type, asset classes and stated tries into `verify_dataset` with no user id and dates rounded to the month. This is the seed of the data business in [DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md). It must never be ticked by default and the box must say what the data is used for, including that it may be sold in aggregate.
6. **The wall still holds.** Verify results are product data. They never feed a research test or the search ([DEC-0015](../decisions/0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)).
7. **Retention.** Badges live until withdrawn. Dataset rows are kept; a person can ask for their contributed rows to be removed only while they are still linked, which they are not, so the opt-in text says "this cannot be undone".
8. **Legal pages.** The privacy policy from [DEC-0022](../decisions/0022-safe-sign-in-legal-pages-essential-only-cookies-and-an-accessibility-bar.md) gets a Verify section before launch.
9. **Rate limits.** Publishing badges needs sign-in and is capped at 20 a day per account.

## Build notes

| Piece | Where |
| --- | --- |
| Page | `web/src/pages/Verify.tsx`, route `#/verify`, product space |
| Parsers | `web/src/lib/verify/parse/{mt4,mt5,tradingview,generic}.ts`, one detector per format, each with a fixture file |
| Checks | `web/src/lib/verify/checks/*.ts`, pure functions, no React |
| Deflated Sharpe port | `web/src/lib/verify/dsr.ts`, with a cross-check fixture generated by the Python function |
| Daily price ranges for card 4 | A small static file of daily high and low for the symbols we hold, built by the hourly deploy |
| Badge page | `web/src/pages/VerifyBadge.tsx`, public route, no sign-in needed to view |
| Database | One migration for `verify_badges` and `verify_dataset` with row-level security |
| Academy link | The bot battle lesson links to Verify, and Verify's empty state links to the lesson |

## Acceptance tests

1. **The 99% bot.** A fixture of 1,000 trades with 99% winners of +1 and 1% losers of -150 gives "Does not hold up", win rate 99.0%, expectancy -0.51 per trade, and a break-even win rate of 99.3%.
2. **The honest small edge.** A fixture with 56% winners and a payoff ratio of 1.0 over 500 trades and 2 years gives positive expectancy and a verdict that depends on stated tries: "Holds up" at 1 try and "Could be luck" at 1,000, with the switch point printed as "survives up to N tries".
3. **The martingale.** A fixture that doubles size after each loss is flagged on card 2 even when its total profit is positive.
4. **The peeking backtest.** A fixture whose entries are at the day's low on 80% of buys is flagged "perfect timing" on card 4.
5. **Each format.** One real-shaped fixture each for MT4 CSV, MT5 CSV, TradingView list of trades and generic, parsed to the same internal trade list. Fixtures are synthetic; no real customer data is committed.
6. **Personal data.** A fixture with an account number column produces no trace of it in memory after parse, in the badge record or in the dataset row.
7. **Deflated Sharpe parity.** TypeScript and Python give the same value to 3 decimal places on 20 random return series and tries from 1 to 10,000.
8. **Nothing leaves.** With the network panel open, uploading and checking a file makes no request that carries file content.
9. **Badge withdrawal.** A withdrawn badge's page shows the withdrawal notice, not a 404.
10. **Plain words.** Every number on the page has a one-line explanation on hover or tap, and the verdict sentence contains the numbers that drove it.

## Sources

The luck check and minimum record length follow Bailey and Lopez de Prado [@bailey2014a; @bailey2012], DOI <https://doi.org/10.21314/JOR.2012.255> for the second. The smoothing check follows Getmansky, Lo and Makarov [@getmansky2004].

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@bailey2014a](../REFERENCES.md#bailey2014a): Bailey and López de Prado (2014), The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality
- [@bailey2012](../REFERENCES.md#bailey2012): Bailey and López de Prado (2012), The Sharpe ratio efficient frontier
- [@getmansky2004](../REFERENCES.md#getmansky2004): Getmansky et al. (2004), An econometric model of serial correlation and illiquidity in hedge fund returns

## Referenced by

- [INT-0003: Parity Verify, the lie detector for trading strategies and bots](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)
- [DEC-0032: Parity Verify as a data and API business, with a free retail tier](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)
- [DEC-0036: Verify runs its checks in the browser and holds daily prices only](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)
- [DEC-0038: Every page gets its tags from one table and every view has a link](../decisions/0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md)
- [RES-0020: Verifying trading claims, market size and competitors](../research/0020-verifying-trading-claims-market-size-and-competitors.md)
- [LOG-0013: Parity Verify built and shipped](../log/2026-10-24-parity-verify-built-and-shipped.md)
<!-- backlinks:end -->
