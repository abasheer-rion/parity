+++
title = "Publish the failures too"
dek = "A strategy shown without the tests it failed is an advertisement. We think every trading result should come with the record of what did not work."
slug = "publish-the-failures-too"
date = 2026-10-25
type = "Opinion"
stance = "Opinion"
status = "published"
sample = true
authors = ["parity-editorial"]
tags = ["research-method", "backtests"]
related = ["most-published-trading-results-are-backtests"]

[[sources]]
ref = "bailey2016"

[[sources]]
ref = "harvey2015"

[[sources]]
id = "dec-0007"
title = "Official results come only from pre-registered runs in a tamper-evident ledger"
url = "/notes/dec-0007/"
publisher = "Parity"
+++

This is an opinion piece. It argues for a view held by the Parity team, using the sources listed below.

When a trading result is shown alone, the reader cannot tell how many other versions were tried first. That number decides how much the result is worth. Bailey, Borwein, Lopez de Prado and Zhu show how the chance that a backtest is overfit grows with the number of configurations tried[^bailey2016].

> [!pull] The number of attempts is part of the result. Leaving it out changes what the result means.

## What we think should be standard

We think every published strategy should come with three things:

1. The rule and the pass mark, written down before the test was run.
2. The count of versions tried, including the ones that were dropped.
3. The tests it failed, shown with the same prominence as the ones it passed.

The bar for a new finding should rise with the number of findings tested before it[^harvey2015]. A reader can only apply that bar if the count is published.

## What we do

Our official results come only from runs that were registered before they started and recorded in a ledger that cannot be edited afterwards[^dec-0007]. Failed runs stay in the ledger. We hold ourselves to the standard argued for here, and we expect to be judged by it.
