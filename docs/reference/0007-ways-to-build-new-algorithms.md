---
id: REF-0007
title: Ways to build new algorithms, and ways to fool yourself
type: reference
status: current
created: 2026-10-20
updated: 2026-10-20
authors: [ayan]
tags: [method, strategy]
related: [DEC-0007, GDE-0004, REF-0006]
---

# Ways to build new algorithms, and ways to fool yourself

## In plain words

New trading ideas usually come from a few honest places: borrowing an idea that worked somewhere else, mixing ideas that do not move together, only switching an idea on when conditions suit it, or starting from an economic reason. There are also a few dishonest places that look like progress but are really just trying things until something works by luck. This page lists both, so we can tell them apart.

## Summary

Every method below ends the same way: write a hypothesis, register it, run it officially, report it ([GDE-0004](../guides/0004-the-research-routine.md)). The method only decides where the idea comes from. The catalog of existing algorithms is the raw material; filter it on the dashboard's Catalog page.

## Honest ways to get a new idea

| Method | What it means | Example for us | Main risk |
| --- | --- | --- | --- |
| Start from economics | Write down a reason the market should pay, then test it. | Terms of trade and commodity currencies ([HYP-0003](../hypotheses/0003-commodity-currencies-catch-up.md)). | The reason may be true and still too weak to trade. |
| Transfer across markets | Take something that worked in one market and test it in another. | Crypto funding carry is FX carry in a new market; test whether its fast decay after 2024 has an FX parallel. | The reason it worked may not exist in the new market. |
| Change the horizon | Use the information coefficient decay to choose how often to trade, instead of guessing. | The commodity gap's IC peaked at 63 days, so we tested monthly ([EXP-0003](../experiments/0003-monthly-commodity-gap.md)). | Picking the horizon after seeing returns is fishing. Pick it from IC, before returns. |
| Combine weak, unrelated signals | Hold several modest strategies that do not move together, sized by risk. | Carry plus trend: carry crashes with stocks, trend tends to gain in crashes ([EXP-0002](../experiments/0002-baseline-gauntlet.md)). | Correlations can jump in a crisis. Test the worst months separately. |
| Condition on regime | Only run a strategy when conditions suit it. | Carry only when the VIX is low (volatility timing). | Every condition is another trial. Keep conditions few and decided by theory. |
| Strip out what is already known | Remove exposure to known factors and see if anything is left. | Remove the dollar factor from any FX signal before claiming it is new (Verdelhan 2018). | Usually nothing is left, which is a useful answer. |
| Overlay instead of replace | Use the idea to improve something that already works. | S&P 500 plus FX trend at the same total risk ([HYP-0007](../hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md)). | It can look good only because of one crisis year. Check B4 in the gauntlet. |
| Reduce costs | Keep the signal, trade less: buffers, slower rebalancing, netting. | Weekly to monthly rebalancing. | Usually changes results less than hoped. |
| Event studies | Look at fixed, scheduled events where the timing is known in advance. | Fed decision days ([HYP-0006](../hypotheses/0006-short-the-dollar-on-fomc-days.md)), EIA inventory releases. | Few events a year means wide error bars. |
| Careful machine learning | Learn from many features, with walk-forward testing and purged cross-validation (Lopez de Prado 2018). | Elastic net on carry, momentum, value and macro features (Filippou et al. 2020). | The easiest place to overfit. Count every model and feature set as a trial. |

## Ways to fool yourself

These look like research but produce luck. The catalog has real examples of each.

| Trap | What it looks like | How our system catches it |
| --- | --- | --- |
| Grid search on all the data | Trying hundreds of settings and keeping the best. | Trials are counted and deflate the Sharpe ratio. The gauntlet's sensitivity test checks neighbours. |
| Adding rules until it works | "It loses in 2008, so add a filter for 2008." | Registrations are frozen; a new filter is a new registration with more trials counted. |
| Lookahead | Using data that was not known at the time, like revised macro numbers or same-day closes. | The backtester holds positions from the next day; macro data must be point in time. |
| Leakage in language models | A model trained on later news "knows" what happened. Several published Sharpe ratios above 4 come from this (Glasserman and Lin 2023). | Only score language-model signals on text published after the model's training cutoff. |
| Survivorship | Testing only on assets or bots that still exist. | Use full histories, and read failure reports (Zenbot, Quantopian) as well as successes. |
| Reporting the best year | A strategy that made all its money once. | Gauntlet test B4 removes the best year. |
| Short calm samples | A Sharpe of 16 over eight months, then a 60% loss (QuantConnect yen carry study). | Three eras and a bootstrap range in the gauntlet. |
| Strategies generated in bulk | Asking a model to invent hundreds of strategies and keeping the winners. Under honest controls every one failed (Gencay 2026, preprint). | Each candidate is a trial; most should never reach registration. |

## A short checklist before registering a new idea

1. Can we say in one sentence why the market would pay for this?
2. Is it more than a known factor in disguise?
3. Can it be tested with free, point-in-time data?
4. How many versions have we already looked at, including on the Lab and Explore pages?
5. What result would make us drop it?

If any answer is "not sure", it is not ready to register.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0006: What trading courses and traders swear by, and what the evidence says](../research/0006-courses-and-trader-beliefs.md)
- [RES-0007: Comparing every algorithm we know of](../research/0007-comparing-every-algorithm.md)
- [LOG-0002: Catalog, ledger and lab](../log/2026-10-20-catalog-ledger-and-lab.md)
- [LOG-0004: Ayan work log, requests and outcomes](../log/2026-10-21-ayan-work-log-requests-and-outcomes.md)
<!-- backlinks:end -->
