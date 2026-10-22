# Changelog

Changes to code and infrastructure that someone else would notice. Reasoning and results live in [docs/](docs/README.md); this file links to them rather than repeating them.

## Unreleased

- Product Markets area (`/app/#/markets`): crypto prices and risks, perps with funding as a cost of holding and leverage risk, every US ETF by theme, new fund filings and trending coins with "what to check" lists, hype terms explained, and Practice positions with pretend money ([DEC-0018](docs/decisions/0018-markets-on-the-product-side-crypto-perps-etfs-and-what-is-new.md)). Real trading needs legal work first ([DEC-0019](docs/decisions/0019-real-trading-later-what-it-would-legally-take.md)).
- Engine: `parity markets fetch|status|export` from CoinGecko, Hyperliquid and SEC EDGAR, no keys ([REF-0014](docs/reference/0014-markets-data-crypto-perps-and-etf-sources-and-their-terms.md)).
- Glossary: 21 "New products and hype terms" with a "what can go wrong" line.
- Dashboard: Scenarios page (`#/scenarios`). Describe a made-up event and see what oil, currencies, stocks, the VIX and US rates did after similar past events; looks backwards only, does not predict.
- Engine: `parity scenario` lists past events like a made-up one (76 sourced events in `catalog/events/`) with the median, middle half and hit rate of what followed; `parity scenario export` feeds the page. Method and limits in REF-0011.
- News page (`#/news`): newest headlines from central banks, US statistics offices, regulators and GDELT, tagged by currency, commodity, region and kind, each with the market move after it as a signed change and a z-score; an article drawer with the price path; and the biggest market days since 1999 ([REF-0013](docs/reference/0013-news-sources-and-market-impact.md)).
- Engine: `parity news fetch|list|impact|records|export`. Only headline, link and an allowed short summary are stored.
- Hourly `News` workflow (no secrets, commits nothing); the deploy job exports the News JSON from the data cache.
- Six new news sources in the catalog, and a "News use" section (licence, display rights, limits) on each news source page.
- UI library: `Drawer` and a `news` icon.

## 0.3.0 (2026-10-20)

- Algorithm catalog (54 entries) and data source catalog (36 entries), each with a generated report page and stage tracking enforced by the docs check.
- Tamper-evident ledger, pre-registration and the official-run workflow ([DEC-0007](docs/decisions/0007-official-results-come-only-from-the-ledger.md)). First official runs: RUN-000001 and RUN-000002.
- Results tables in docs are generated from the ledger and cannot be edited by hand.
- Data fingerprints on every fetch.
- Dashboard: Catalog, printable algorithm reports, Lab, Explore, Ledger and Data sources pages.
- Supabase: write-only login for the nightly job, read-only for signed-in team members, batch kind and market series columns.

## 0.2.0 (2026-10-20)

- The gauntlet: eleven fixed tests every strategy faces on every run, six on beating the S&P 500 and five on whether the effect is real ([REF-0006](docs/reference/0006-the-gauntlet.md)). Results in [EXP-0002](docs/experiments/0002-baseline-gauntlet.md).
- Glossary of 75 terms, each explained three ways (simple, analogy, precise), generated from one file into [REF-0004](docs/reference/0004-glossary.md) and the dashboard's new Learn tab.
- Every doc now starts with an "In plain words" section, enforced by the docs check. Experiments must also list threats to validity.
- Dashboard: gauntlet scorecard on each strategy page, glossary links on every metric.
- Research surveys of open-source projects and forums ([RES-0002](docs/research/0002-open-source-and-public-results.md), [RES-0003](docs/research/0003-forums-and-practitioners.md)).

## 0.1.0 (2026-10-20)

First version. See [LOG-0001](docs/log/2026-10-20-project-start.md).

- Research engine: scrapers for 30 free series, a shared backtester with costs, carry and volatility targeting, and performance, robustness and signal metrics.
- Strategies: S&P 500 benchmark, G10 carry, G10 time-series momentum, and the commodity gap (CAD and NOK against oil).
- Baseline results in [EXP-0001](docs/experiments/0001-baseline-backtests.md).
- Dashboard: overview against the S&P 500, strategy detail, signal decay and data coverage.
- Supabase tables with row level security for results.
- CI, Cloudflare Pages deploys with previews, a nightly research run and database migrations.
- Docs system with a checker and generated index ([DEC-0004](docs/decisions/0004-docs-are-checked-by-a-script.md)).
