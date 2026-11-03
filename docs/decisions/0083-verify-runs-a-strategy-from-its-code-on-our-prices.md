---
id: DEC-0083
title: Verify runs a strategy from its code on our prices
type: decision
status: accepted
created: 2026-11-03
updated: 2026-11-03
authors: [ayan]
tags: [method, strategy, ui]
related: [DEC-0079, DEC-0081, DEC-0082, REF-0030, REF-0016, DEC-0051, DEC-0036]
---

# Verify runs a strategy from its code on our prices

## In plain words

A trader can now paste a strategy's code into Verify and get a verdict on it, not only on a trade file. Verify reads TradingView Pine Script, a simple Python strategy, or rules written in our own short format. It runs them on our daily prices with the costs a retail account pays, also runs the settings next to the person's, counts every one of those as a try, and judges the result with the same five checks as an uploaded record. Anything in the code it cannot run is named with its line, and then nothing is run. A strategy described in words is turned into rules by the person's own AI model, never by a model Parity pays for. The same check is on the page at `/verify/`, the API at `POST /api/v1/verify/strategy` and the MCP tool `verify_strategy`.

## Context

On 3 November 2026 the owner asked for "the actual product": a real trader should get a real, correct answer. Until now Verify could judge a trade file, a seller's claim or one of our own strategies ([DEC-0079](0079-parity-is-an-ai-native-verification-platform-for-retail-traders-of-all-sizes.md), [DEC-0082](0082-verify-tools-and-endpoints-for-ai-apps-and-programs.md)). A strategy someone had written but not traded could only be matched to the closest strategy we had tested. Most retail strategies today are TradingView scripts or short Python files, often written by an AI, and most of them have been tuned by trying many settings.

## Decision

1. **One rule format.** `parity-rules-1` (`web/src/lib/verify/strategy/rules.ts`) holds a strategy as data: a market, settings, named values built from the close with indicator functions, and entry, exit, stop and target rules for long and short positions. Expressions are short JSON lists such as `["crossover", "fast", "slow"]`, which an AI app can write without other help.
2. **Readers, not interpreters.** Pine Script versions 4 to 6 (`pine.ts`) and Python (`python.ts`: pandas signal columns, vectorbt entries and exits, backtesting.py strategy classes) are read into that format. The same code always gives the same rules. Whatever the orders depend on that our data cannot support is refused by name and line: the day's open, high, low or volume, other markets or time frames, values carried from day to day (`:=`, loops), orders that wait for a price, trailing stops and partial closes. Reading a later price, such as `shift(-1)`, is refused as peeking. Drawings, alerts and values no order uses are listed as left out.
3. **Our prices, honest costs.** The rules run on the daily closes in `/data/verify/prices.json` ([DEC-0036](0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)). An order fills at the close of the day its rule is true; TradingView fills at the next open by default ([TradingView strategies](https://www.tradingview.com/pine-script-docs/concepts/strategies/)), which for currencies and crypto, traded round the clock, is the same price. Each fill pays 1 basis point for major currency pairs, 3 for thin ones, 2 for the S&P 500 and 0.15% for Bitcoin and Ether (a 0.1% taker fee, as on [Binance](https://www.binance.com/en/fee/schedule), plus spread), or the script's own commission when that is higher. Financing and funding are not charged, and the page says so.
4. **Every try counts.** Each setting, including numbers written straight into an indicator, is also run at half to one and a half times its value (up to 125 runs). The luck check uses the tries the person states plus those nearby runs.
5. **Two new checks, method `verify-1.1`.** "Perfect timing" for code: run again with every order filled a day late, the result must keep at least half its Sharpe ratio. "Settings next to yours": at least half of the nearby settings must make money after costs. "Many settings, few trades" now applies to code too. The methodology page and [REF-0030](../reference/0030-parity-verify-methodology.md) describe all of it.
6. **Words go through the person's own model.** On the page, a description is sent from the browser to the person's own provider with their key ([DEC-0051](0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)), or they copy our prompt into any AI chat and paste back the rules. The rules are shown in words before they run. The API and MCP tool take `rules` directly: the calling AI app is the person's model. Parity never pays for a model call.
7. **Where it runs.** On the page the code is read and run in the browser and never sent; running needs the daily price file, which loads for signed-in accounts. The API and MCP tool run it in memory and store nothing. Answers are the same in all three because they share one set of pure functions.

## Alternatives considered

- **Run the person's Python or Pine as code.** Rejected: running arbitrary code on our servers is unsafe, and a reader that refuses what it cannot run is honest about its limits.
- **Ask a model to read the code.** Rejected: the answer would change from one run to the next, and the owner ruled out paying for model calls.
- **Charge financing and funding.** Deferred: it needs rates per market and day that we do not yet publish for Verify.

## Consequences

- A trader can check a TradingView script before trading it, and an AI app can check a strategy it wrote before showing it to anyone.
- Results depend on daily closes. Strategies that need intraday prices or the day's range are refused, not approximated.
- Files: `web/src/lib/verify/strategy/`, `web/src/lib/verify/checks/index.ts` (`checkBacktest`), `web/src/pages/verify/CodeInput.tsx`, `web/src/lib/mcp/verify.ts`, `web/src/assistant/chat.ts` (`complete`), tests in `web/tests/verify/strategy.test.ts`, `web/tests/verify/strategy-api.test.ts` and `web/e2e/verify-code.spec.ts`.
- How the other tools behave, which the readers follow: [TradingView strategies](https://www.tradingview.com/pine-script-docs/concepts/strategies/), [backtesting.py](https://kernc.github.io/backtesting.py/), [pandas ewm](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.ewm.html).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0030: Parity Verify methodology](../reference/0030-parity-verify-methodology.md)
<!-- backlinks:end -->
