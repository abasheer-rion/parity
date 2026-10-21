# Changelog

Changes to code and infrastructure that someone else would notice. Reasoning and results live in [docs/](docs/README.md); this file links to them rather than repeating them.

## Unreleased

Nothing yet.

## 0.1.0 (2026-10-20)

First version. See [LOG-0001](docs/log/2026-10-20-project-start.md).

- Research engine: scrapers for 30 free series, a shared backtester with costs, carry and volatility targeting, and performance, robustness and signal metrics.
- Strategies: S&P 500 benchmark, G10 carry, G10 time-series momentum, and the commodity gap (CAD and NOK against oil).
- Baseline results in [EXP-0001](docs/experiments/0001-baseline-backtests.md).
- Dashboard: overview against the S&P 500, strategy detail, signal decay and data coverage.
- Supabase tables with row level security for results.
- CI, Cloudflare Pages deploys with previews, a nightly research run and database migrations.
- Docs system with a checker and generated index ([DEC-0004](docs/decisions/0004-docs-are-checked-by-a-script.md)).
