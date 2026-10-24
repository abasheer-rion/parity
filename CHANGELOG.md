# Changelog

Changes to code and infrastructure that someone else would notice. Reasoning and results live in [docs/](docs/README.md); this file links to them rather than repeating them.

## Unreleased

- Parity Verify at `/app/#/verify` ([DEC-0036](docs/decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)): upload a MetaTrader 4 or 5, TradingView or plain CSV trade log or an equity curve, describe a bot, or pick one of our strategies, and get a verdict, five check cards (expectancy with a break-even chart, tail risk, the luck check with "survives up to N tries", look-ahead and overfitting flags) and claim arithmetic. Files are checked in the browser and never uploaded; personal columns are dropped on read. The deploy writes `/data/verify/prices.json` for the fill checks. `node web/scripts/verify-network.mjs` checks that no request carries a file.
- Product direction: Parity Verify, a checker for trading strategies and bots ([INT-0003](docs/intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)), with market sizing and competitors ([RES-0020](docs/research/0020-verifying-trading-claims-market-size-and-competitors.md)), a proposed data and API business model ([DEC-0032](docs/decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)) and an MVP spec for `/app/#/verify` ([REF-0016](docs/reference/0016-parity-verify-mvp-spec.md)). Docs only; nothing built yet.
- Bot Battle ([DEC-0035](docs/decisions/0035-bot-battle-and-shareable-clips-win-rate-is-not-profit.md)): seven trading-bot archetypes race on US stocks, the euro, Brent oil or made-up paths with crashes, showing win rate, average win and loss, profit factor, expectancy, worst fall and time under water. A Parity Terminal panel (`BOTS`), a Sim World tab, `parity bots run|export` and an Academy course, "Win rate is not profit". `npm run content` renders shareable 9:16 and 1:1 clips and GIFs with a manifest of captions; a weekly workflow keeps them as an artifact ([GDE-0008](docs/guides/0008-rendering-shareable-clips-from-the-sims.md)).
- Private markets ([DEC-0029](docs/decisions/0029-private-markets-free-proxies-an-unsmoothing-study-and-plain-pages.md)): a sourced note ([RES-0012](docs/research/0012-private-markets-how-they-are-measured-and-how-individuals-get-in.md)); SEC Form D counts and BDC net asset values (`parity markets fetch`, need `PARITY_CONTACT`); nine FRED `pm.*` proxies; an unsmoothing study (`engine/src/parity/unsmooth.py`); a Private markets page with an IRR, TVPI, DPI and PME calculator (`/app/#/markets/private`), a research page (`/research/#/private`), a public guide (`/learn/private-markets/`) and 21 glossary terms.
- Backtests are more honest: every strategy's cash earns the T-bill it is scored against, monthly interest rates reach signals only a week after the month ends (carry still accrues at the month's own rate), and "Commodity trend" trades Brent and WTI instead of spot gas. "Rising rates" fell from 0.26 to -0.03 Sharpe; nothing else moved more than 0.04. Official ledger runs are unaffected ([EXP-0005](docs/experiments/0005-honest-cash-and-delayed-rates-before-and-after.md)).
- `parity mcp`: a local MCP server so Claude Code, Claude Desktop, Cursor, VS Code, Gemini CLI and Codex can backtest strategies, evaluate specs, read search leads, data and docs, and draft recipes. Every spec an assistant tries counts toward the luck check. Install with `pip install -e "engine[mcp]"`; setup in [GDE-0006](docs/guides/0006-connecting-ai-tools-to-parity-with-mcp.md) ([DEC-0025](docs/decisions/0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)).
- Edges: a sourced note on where market edges come from and which survive ([RES-0011](docs/research/0011-where-market-edges-come-from-and-which-survive.md)); 17 new strategies and two search shapes on CFTC positioning, the yield curve, BIS policy rates for 27 currencies, stress indexes, claims and the FOMC calendar, each with its release delay; and an Edge Lab with lessons, a pitfalls checklist and our own mistakes at `/research/#/edges` and `/learn/edge-lab/`. Best lead: wide policy-rate carry, 9 of 11 tests ([DEC-0027](docs/decisions/0027-new-edge-families-from-the-wider-data.md)).
- Site and both apps are dark only, with calmer blacks, fewer lines and Cinzel for a few big headings. The apps have no top bar: search, the run picker and settings are in the sidebar, and phones get a floating menu button. Home pages show short findings computed from the data. The front page has a large scale sim of illustrative paths with real counts and a link to Sim World ([DEC-0021](docs/decisions/0021-dark-only-no-top-bar-computed-findings-and-a-large-scale-sim.md)).
- Sign-in: after logging in, signing up, resetting a password or clicking an email link, people return to where they started, including `/research/` and Sim World; other websites are refused. Password rules show as you type, passwords can be shown, errors are read out, and Account settings handle both email change codes ([DEC-0022](docs/decisions/0022-safe-sign-in-legal-pages-essential-only-cookies-and-an-accessibility-bar.md)).
- Auth emails link back with `next`; `auth/push_templates.sh --smtp` connects Resend and `--settings` turns email confirmation on for `parity.endyland.com`. Owner steps in [auth/CHECKLIST.md](auth/CHECKLIST.md).
- Legal pages at `/legal/` (privacy, terms, cookies, accessibility, risk), drafts for lawyer review, linked from every footer and the app's account menu.
- Cookie notice (essential only) and a consent API (`web/src/legal/consent.ts`) that keeps analytics off until opted in.
- Accessibility: skip links, labelled fields, contrast and tap-target fixes; `npm run a11y` (axe-core) reports zero serious or critical issues on the public, sign-in and app pages.
- Web unit tests with Vitest (`npm test`), run in CI.

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
