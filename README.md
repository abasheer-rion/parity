# Parity

A research project by Ayan, Amanda and Abanish. We are testing whether a systematic currency strategy, possibly informed by commodity prices and macro news, can beat the S&P 500 once costs and risk are accounted for.

This is a proof of concept, not a product. If the answer is no, we will have learned something and may write it up anyway. The full statement of what we set out to do is in [INT-0001](docs/intent/0001-initial-intent.md).

## Where things stand

| | |
| --- | --- |
| Strategies tested | 3, plus the S&P 500 benchmark |
| Beating the S&P 500 | None so far ([EXP-0001](docs/experiments/0001-baseline-backtests.md)) |
| Most promising lead | The commodity gap signal looks more informative at slower horizons ([HYP-0003](docs/hypotheses/0003-commodity-currencies-catch-up.md)) |
| Open hypotheses | See the [docs index](docs/README.md#open-questions-right-now) |

## How it works

1. **Scrapers** pull free daily data for 9 currencies, 10 interest rates, oil, gas, copper, the S&P 500 and the VIX ([REF-0003](docs/reference/0003-data-sources.md)).
2. **Strategies** are one file each and turn that data into target weights. Any of them can be removed at any time ([DEC-0003](docs/decisions/0003-strategies-are-plugins.md)).
3. **One backtester** holds those weights, charges costs, credits interest carry and can scale everything to the same risk as the S&P 500.
4. **Metrics** compare each strategy with the S&P 500 and measure how much information each signal has ([REF-0002](docs/reference/0002-kpis.md)).
5. **A nightly job** runs everything and publishes results to a private dashboard.

More detail in [REF-0001](docs/reference/0001-architecture.md).

## Running the engine

```bash
make setup     # Python env, dashboard packages, git hooks
make fetch     # download data (about 10 seconds)
make run       # backtest everything and print a summary
make web       # dashboard at http://localhost:5173
make check     # everything CI runs
```

Step by step: [GDE-0001](docs/guides/0001-getting-started.md).

## Docs

Everything we decide, test and read is written down in [docs/](docs/README.md), filed by kind, tagged and cross-linked. A script checks the structure, links and wording on every commit ([DEC-0004](docs/decisions/0004-docs-are-checked-by-a-script.md)).

| Start here | |
| --- | --- |
| Why we are doing this | [INT-0001](docs/intent/0001-initial-intent.md) |
| What "beat the S&P 500" means | [DEC-0006](docs/decisions/0006-how-we-define-beating-the-sp-500.md) |
| Background theory | [RES-0004](docs/research/0004-exchange-rate-theory-primer.md) |
| What to read | [RES-0001](docs/research/0001-reading-list.md) |
| How to add a strategy | [GDE-0002](docs/guides/0002-adding-a-strategy.md) |
| How to write a doc | [GDE-0003](docs/guides/0003-writing-docs.md) |
| Session history | [docs/log/](docs/README.md#log) |

## Working together

See [CONTRIBUTING.md](CONTRIBUTING.md). Code changes are in [CHANGELOG.md](CHANGELOG.md).

## Disclaimer

Nothing here is investment advice. No real money is traded.
