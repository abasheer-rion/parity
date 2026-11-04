---
id: REF-0030
title: Parity Verify methodology
type: reference
status: current
created: 2026-10-27
updated: 2026-11-03
authors: [ayan]
tags: [method]
related: [REF-0016, DEC-0036, DEC-0081, DEC-0083, DEC-0084, DEC-0088, DEC-0089, DEC-0090, DEC-0091]
---

# Parity Verify methodology

## In plain words

This is the repository copy of the public page at `/methodology/`, which says how Verify judges a trading record: the order of the five verdicts, every check and its threshold, the luck check, trust levels and what is stored. The public page fills in the method version, its changelog and the main thresholds from the code at build time (`web/plugins/legal.ts`), so it cannot drift; this copy is kept by hand and must change with it. The method version today is `verify-1.2`. Research only. Not investment advice.

## Summary

| Part | Rule |
| --- | --- |
| Verdict order | Not enough data, does not hold up, fragile, could be luck, holds up |
| Luck check | Deflated Sharpe ratio at the stated tries, pass at 0.95, "survives up to N tries" |
| Red flags | More than 20 average wins lost to one loss, martingale or grid, fall over 50% |
| Trust | Self-reported for every upload; broker-connected when Parity read the trades from the broker and the signed proof matches |
| Stored | Nothing unless a badge is published or the dataset box is ticked |

## Inputs

- **A file**: a trade list or equity curve, CSV or tab separated, up to 5 MB and 50,000 rows, read and checked in the browser and never sent. Before the checks run the person states real money, demo or backtest (default backtest), the starting balance, the number of things tried before this one (default 1) and, optionally, what was claimed.
- **A description of a bot**: a rule-based reader pulls out the claims. Only the claim arithmetic and the settings count can be checked.
- **One of our strategies**: its research equity curve, at the number of tries our research and search have counted.
- **A seller's page or words**: the claims on a public page, read by our server under its robots.txt with no login, or in words pasted, each with the words it came from ([DEC-0088](../decisions/0088-verify-reads-a-seller-s-claims-from-their-page.md)).
- **Strategy code**: Pine Script, a simple Python strategy, or rules in the `parity-rules-1` format (also written from a description by the person's own model), run by us on our daily closes ([DEC-0083](../decisions/0083-verify-runs-a-strategy-from-its-code-on-our-prices.md)).

## Strategy code

- **Read, not run as code.** Pine Script 4 to 6 and Python (pandas signal columns, vectorbt entries and exits, backtesting.py classes) are read into one rule format. The same code gives the same rules. Anything the orders depend on that one close a day cannot support (the day's open, high, low or volume, other markets or time frames, values carried from day to day, orders that wait for a price, trailing stops, partial closes) is refused by name and line, and nothing runs. Reading a later price is refused as peeking. Drawings, alerts and unused values are listed as left out.
- **Fills** at the close of the day the rule is true; stops and targets are checked against each close from the day after entry. One position at a time with the whole account (or the script's share); an opposite entry turns it around.
- **Costs** each way: 1 basis point for major currency pairs (1.5 for NZD, 3 for NOK and SEK), 2 for the S&P 500, 0.15% for Bitcoin and Ether, or the script's own commission when higher. Financing, short borrowing and perpetual funding are not charged.
- **Nearby settings**: each setting, including numbers written into an indicator, at half to one and a half times its value: all combinations of 5 values for up to 3 settings, 3 values for 4 settings, one at a time beyond that. Lengths stay whole.
- **Tries** for the luck check: the stated tries plus the nearby runs.

## From a record to returns

- Trades plus a starting balance become daily returns: every weekday from the first close to the last (weekend days only when a trade closed on them), quiet days as zero, each day's profit divided by the account value the evening before.
- An equity curve: (value minus money paid in) divided by the previous value, minus 1. A return column is used as it is.
- Trades without a balance have no returns: the luck check uses each trade's profit and the largest fall is not measured.
- Daily means at least 180 values a year, weekly 40, monthly 10.

## The verdict

Checked in this order; the first that applies wins.

| Order | Verdict | When |
| --- | --- | --- |
| 1 | Not enough data | Fewer than 30 trades and fewer than 60 daily returns |
| 2 | Does not hold up | A claim the file contradicts by more than 5 percentage points, or expectancy at or below zero after fees |
| 3 | Fragile | Worst loss wipes out more than 20 average wins, a martingale or grid pattern, or a fall of more than 50% from a high |
| 4 | Could be luck | Luck check below 0.95 at the stated tries or not measurable, or any failed check on card 4 or 5 |
| 5 | Holds up | None of the above |

The sentence under the verdict is built from the numbers that decided it. A description is judged on its own: "Does not hold up" when a claim fails on arithmetic, "Fragile" when the loss is not capped or there are too many settings, otherwise "Not enough data".

## Card 1: win rate against expectancy

One result is a trade's profit after fees, or one period's return. Win rate is the share above zero; payoff ratio is average win over average loss; expectancy is win rate times average win minus loss rate times average loss; break-even win rate is average loss over (average win plus average loss), that is 1 / (1 + payoff); profit factor is gross profit over gross loss.

## Card 2: tail risk

Worst trade (in money and as a share of the account before it), worst day, wins wiped out (worst loss over average win), largest fall from a high and longest time under water in calendar days, expected shortfall (mean of the worst 5% of period returns, at least one), and skew of daily returns or trade profits.

Martingale or grid needs sizes on at least 90% of trades and at least 8 sized trades. A losing streak that the record continues after "grew" when every trade after a loss in it is larger than the one before (by more than 0.01%). Found when at least 3 such streaks exist and size grew in at least 3 out of 4, or at least 3 times a same-side position on the same symbol opened at a worse price while an earlier one was open.

Red flag: more than 20 average wins wiped out, a martingale pattern, or a fall over 50%.

## Card 3: the luck check

The deflated Sharpe ratio [@bailey2014a], a line for line port of the engine's function, tested against it to 3 decimal places:

DSR = Φ((SR − SR0) √(T − 1) / √(1 − skew · SR + (kurt − 1)/4 · SR²)), with SR0 = √V ((1 − γ) Φ⁻¹(1 − 1/N) + γ Φ⁻¹(1 − 1/(N e))), SR0 = 0 for one try, and V = (1 + SR²/2)/(T − 1).

- SR is per observation, not annualised; T is at least 30; kurtosis is 3 for a normal distribution; γ = 0.5772; N is the number of tries.
- V is the single-estimate stand-in, because the spread of Sharpe across an uploader's tries is unknown.
- The line is 0.95, as in test A3 of the gauntlet ([REF-0006](0006-the-gauntlet.md)).
- "Survives up to N tries" is the largest whole number of tries still at 0.95 or more, searched up to 1,000,000,000.
- Minimum track record length [@bailey2012]: T* = 1 + ((z D + √(1 + SR²/2) K) / SR)², z = Φ⁻¹(0.95), D the denominator above and K the bracket in SR0, shown as months still needed. Never reached when SR is zero or below.
- Observations are period returns when there are at least 30, otherwise trade profits.

## Card 4: look-ahead and data flags

Each check is passed, failed or "cannot be checked from this input", never hidden.

| Check | Fails when |
| --- | --- |
| Fills outside the day's range | With the day's high and low: a fill more than 0.1% outside them |
| Fills far from the day's price | With one price a day: further from it than 3 times that market's 1-in-100 daily move, at least 1% |
| Perfect timing | With highs and lows and at least 10 dated entries: more than 30% within 0.05% of the day's best price |
| Too smooth | At least 30 returns: lag-one autocorrelation above 0.3, or (daily) no losing month in more than 24 months with under 3% losing days [@getmansky2004] |
| Edited history | At least 10 trades: median gap at most 3 days but gaps over 30 days; for TradingView and plain lists also skipped trade numbers when 90% of steps are 1 |
| Backtest labelled as real | Said real money, file is a TradingView Strategy Tester export |
| Strategy look-ahead test | Our strategies: cut-the-data test. Strategy code: passes, because each day sees only that close and earlier ones and look-ahead code is refused |
| Perfect timing, for code | Run again with every order a day late, the Sharpe ratio falls below half of a positive original |

We hold one price a day for major currency pairs, Bitcoin, Ether and the S&P 500, so for these the fill check is "far from the day's price" and perfect timing cannot be checked ([DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)). Without the price file, both say they cannot be checked.

## Card 5: overfitting flags

Short sample: fewer than 100 trades or less than 12 months. First part against last part: last 30% Sharpe below half of the first 70%'s, when that is positive (at least 30 results). Concentration: best 5 trades over 50% of profit (at least 10 trades). Many settings, few trades: descriptions and strategy code, more than one setting per 20 trades. Settings next to yours, for code: fewer than half of the nearby settings make money after costs. Claim against file: more than 5 points apart on win rate, monthly return or largest fall; or, on total return, more than 5 points and more than a tenth apart, unless the claim names a length of time more than a quarter away from the record's.

## Claim arithmetic

1. Break-even average loss = take-profit × win rate / (1 − win rate); a wider stop loses before costs.
2. A largest fall smaller than a single loss is impossible.
3. Over 10% a month for more than 12 months is shown compounded to a year, next to about 10% for the S&P 500.
4. Grid or martingale with no stated maximum loss: "loss is not capped".
5. Win rate above 90% with no average loss or stop: "the win rate alone says nothing about profit".

## Claims from a seller's page

- **Reading.** The page is fetched once as `ParityVerify/1.0`, after its robots.txt allows it [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309): our group if named, else "*", longest rule first, allow on a tie. No cookies or login; at most 3 redirects, each checked again; the first 2 MB; 8 seconds; http or https on ports 80 and 443; no IP addresses or local names. A login wall or a bot check is reported. X refuses all automatic readers, so its posts are pasted. Nothing is kept.
- **Finding.** Fixed patterns read labelled values and sentences: total, monthly and yearly return, win rate, largest fall, trades, trades a month, length of time, start date, profit factor, take-profit, stop, grid and martingale. A label beats a sentence; of several drawdowns the largest is used. A person's own model can add claims, each quoting words on the page.
- **Against a record.** Win rate, monthly return, largest fall and total return use the claim-against-file lines and can change the verdict. Trades (within a tenth), profit factor, start date (within a month), length of time and yearly return are shown only. Pips and a site's Sharpe ratio are not compared.

## The report

Every check ends in one report ([DEC-0089](../decisions/0089-every-verify-check-ends-in-one-report-that-can-be-shared-and-printed.md)): growth (against the S&P 500's daily closes when our prices are loaded), the luck check at 1 to 1 billion tries, the spread of the Sharpe ratio over 1,000 reshuffles in 21-day blocks or of profit per trade over 1,000 seeded draws of the trades (at least 200 for very long lists), falls from a high, and returns by kind of market, year, market and side. A shared report travels after the "#" of its link and is not stored or vouched for. Two reports can be compared side by side, never ranked ([DEC-0090](../decisions/0090-two-verify-reports-side-by-side-and-a-batch-row-opens-its-full-report.md)).

## Imports

Fills are paired first in, first out per symbol into round trips. Each closing fill is one trade, so a partial close is its own trade. Profit is the price difference times quantity and contract size minus the fees of both sides, opening fees shared by quantity. Fees count as each platform means them: Interactive Brokers' negative commissions are costs and positive ones rebates; a platform's own realized profit is used only for a close whose opening is before the file starts, as net of fees (Interactive Brokers) or before them (Binance futures); profit a platform already gives after commission (Myfxbook, NinjaTrader, cTrader net) is not reduced again; fees in a coin we cannot price (BNB) are named and left out. With a rate per row every amount becomes the base currency; several currencies without rates are flagged. A time zone in a cell or a header is turned into UTC; MetaTrader server time and Interactive Brokers' US Eastern time are stated. A skipped row is named with its line and cell. Personal columns, and order ids that identify an account, are removed first. MetaTrader 4 and 5 reports are read as saved (HTML in any language, UTF-16, and Excel), as are TradingView's Excel download and JSON from Alpaca. Each supported file is marked tested on a real export, layout copied from a real export, or unverified ([DEC-0084](../decisions/0084-verify-imports-are-tested-on-real-exports.md)).

## What Verify cannot check yet

- Anything inside the day: one closing price a day means code needing the open, high, low, volume, intraday bars, trailing stops or waiting orders is refused, and "perfect timing" for uploads cannot be checked.
- Other markets: strategy code runs on 9 currency pairs, Bitcoin, Ether and the S&P 500 only.
- Some costs: overnight financing and swap, short borrowing and perpetual funding are not charged to strategy code.
- Some code: values carried from day to day, functions written in the script, other time frames, partial exits and adding to a position are refused by name and line.
- Words: a description is only as good as the rules the person's own model writes; the rules are shown before they run.
- Some files: Bybit's spot trade history and older closed P&L layouts are from help pages only (its closed positions export is copied from a real one); BNB fees cannot be priced; an Interactive Brokers activity statement in several currencies is not converted; trades opened before a file starts have no known cost.
- Where a file came from: every upload is self-reported. A broker-connected record shows where its trades came from but not how many other things were tried.

## Trust levels and storage

Every upload is "Self-reported: Parity checked the numbers in the file, not where the file came from." A record is "Broker-connected" when Parity's server read the trades from the venue itself through a read-only link ([DEC-0091](../decisions/0091-verify-reads-trades-from-brokers-with-read-only-keys-and-marks-the-record-broker-connected.md)): Interactive Brokers (Flex token), Alpaca (sign-in, no scope), Coinbase, Kraken, Binance and Bybit (keys whose permissions the venue reports as read-only; anything else is refused before a trade is read). Binance.US is not taken: it cannot say what a key may do. The same checks run on the server, and the result is signed with Ed25519; the public key is at `/api/connect/keys`. A badge shows as broker-connected only when the signature checks out and every number on it matches the signed ones, and it names the venue, live or paper (from the venue), a one-way account code and the fetch time.

Broker-connected shows that the trades came from that venue and account and were not edited before the checks. It does not show how many other things were tried (tries are stated by the owner), the starting balance when typed, whose account it is beyond holding a read-only key, anything outside the dates read, or costs the venue books apart from fills.

The file, its trades and personal columns are never stored. A published badge stores summary numbers, the method version and the file's SHA-256 (for a broker-connected record, of the trades file Parity read), plus the signed proof; withdrawing deletes the numbers and the proof and keeps the venue and account code. A broker key is used once and dropped unless the owner asks to keep it in sync; then it is sealed with AES-GCM under a per-person key and can be revoked. Every read is logged for the owner. The dataset opt-in stores no user id and month-rounded dates.

## Method versions

| Version | From | What changed |
| --- | --- | --- |
| verify-1.2 | 2026-11-03 | Claims read from a seller's page or words; claim against file also compares the total return |
| verify-1.1 | 2026-11-03 | Strategy code run on our prices; tries include the nearby settings; perfect timing by a one-day-late run and settings next to yours for code; many settings, few trades for code too |
| verify-1.0 | 2026-10-24 | First version |

## Cite this

Parity Trading, Inc. (2026). Parity Verify methodology, version verify-1.2. paritytrading.app/methodology/

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@bailey2014a](../REFERENCES.md#bailey2014a): Bailey and López de Prado (2014), The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality
- [@bailey2012](../REFERENCES.md#bailey2012): Bailey and López de Prado (2012), The Sharpe ratio efficient frontier
- [@getmansky2004](../REFERENCES.md#getmansky2004): Getmansky et al. (2004), An econometric model of serial correlation and illiquidity in hedge fund returns

## Referenced by

- [DEC-0081: Verify is a public page with broker imports, embeds and a citable method](../decisions/0081-verify-is-a-public-page-with-broker-imports-embeds-and-a-citable-method.md)
- [DEC-0083: Verify runs a strategy from its code on our prices](../decisions/0083-verify-runs-a-strategy-from-its-code-on-our-prices.md)
- [DEC-0084: Verify's imports are tested on real exports](../decisions/0084-verify-imports-are-tested-on-real-exports.md)
- [DEC-0088: Verify reads a seller's claims from their page](../decisions/0088-verify-reads-a-seller-s-claims-from-their-page.md)
- [DEC-0089: Every Verify check ends in one report that can be shared and printed](../decisions/0089-every-verify-check-ends-in-one-report-that-can-be-shared-and-printed.md)
- [DEC-0090: Two Verify reports side by side, and a batch row opens its full report](../decisions/0090-two-verify-reports-side-by-side-and-a-batch-row-opens-its-full-report.md)
- [DEC-0091: Verify reads trades from brokers with read-only keys and marks the record broker-connected](../decisions/0091-verify-reads-trades-from-brokers-with-read-only-keys-and-marks-the-record-broker-connected.md)
- [LOG-0022: Read-only broker connections built](../log/2026-11-03-read-only-broker-connections-built.md)
<!-- backlinks:end -->
