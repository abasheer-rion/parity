+++
title = "Most published trading results are backtests"
dek = "Of the results reported for the trading ideas in our catalog, almost all come from backtests. Here is what the research says that means for the numbers."
slug = "most-published-trading-results-are-backtests"
date = 2026-10-25
type = "Analysis"
stance = "Analysis"
status = "published"
sample = true
featured = true
authors = ["parity-research"]
tags = ["backtests", "research-method", "publication-decay"]
markets = ["Stocks", "Currencies", "Futures"]
related = ["publish-the-failures-too"]

[hero]
kind = "chart"
chart = "catalog-evidence"
alt = "Bar chart of results reported for the ideas in the Parity catalog, by kind of evidence. Backtests make up 164 of 178 results; live trading 8, index 4, competition 1 and paper trading 1."
caption = "Results reported for the ideas in our catalog, by the kind of evidence behind each one, as of 25 October 2026."

[[images]]
src = "chart:catalog-decades"
alt = "Bar chart of the ideas in the Parity catalog by the decade they were first published. Most date from the 2000s onward."

[[sources]]
id = "catalog"
title = "Trading ideas, with the evidence and the risks"
url = "/ideas/"
publisher = "Parity"
note = "Our public catalog. Each idea lists the results its sources report and the kind of evidence behind them."

[[sources]]
ref = "mclean2016"

[[sources]]
ref = "hou2018"

[[sources]]
ref = "harvey2015"

[[sources]]
ref = "bailey2014a"

[[sources]]
id = "res-0011"
title = "Where market edges come from, and which survive"
url = "/notes/res-0011/"
publisher = "Parity"
note = "Our research note on 25 edges and what kills them."
+++

Our catalog lists the trading ideas we have found in papers, books and practitioner write-ups, and next to each one the results its sources report[^catalog]. On 25 October 2026 it held 178 reported results. 164 of them are backtests: the rule was run on past prices, after the fact. 8 come from live trading.

That ratio matters because a backtest and a live record answer different questions. A backtest says the rule would have worked on data the author had already seen. A live record says it worked on data nobody had seen yet.

## What happens after publication

The best measure of the gap comes from stock market research. McLean and Pontiff followed 97 published return predictors. Returns were 26% lower out of sample and 58% lower after the paper was published[^mclean2016]. Part of that is the effect being traded away. Part of it is that some of the effect was never there.

> [!pull] Treat any published Sharpe ratio as an upper bound, and plan for about half.

Replication studies point the same way. Hou, Xue and Zhang tried to reproduce 452 published anomalies and found that 65% fail the usual significance bar of a t-statistic of 1.96[^hou2018].

## Why so many backtests look good

If enough rules are tried on the same data, some will look strong by chance. Harvey, Liu and Zhu argue that a new factor should clear a t-statistic of about 3, not 2, because so many have been tested[^harvey2015]. Bailey and Lopez de Prado give a way to deflate a Sharpe ratio for the number of tries behind it[^bailey2014a]. We use that correction in our own search.

![Bar chart of the ideas in the Parity catalog by the decade they were first published. Most date from the 2000s onward.](chart:catalog-decades "When the ideas in our catalog were first published.")

## What we take from this

- A reported Sharpe ratio is the start of a check, not the result of one.
- The kind of evidence belongs next to the number. Our catalog shows it for every result.
- The more variations an author tried, the higher the bar should be. Ask how many.

Our research note on market edges goes through 25 of them and what made each one shrink[^res-0011].
