---
id: DEC-0039
title: Parity Trade, a full-screen trading app of its own
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [process, ui]
related: [RES-0021, DEC-0024, DEC-0031, DEC-0033, DEC-0034, DEC-0020]
---

# Parity Trade, a full-screen trading app of its own

## In plain words

Trading used to be four tabs inside the product app. Nobody trades from a small corner of a website, so Trade is now its own app that fills the whole screen, the way Parity Terminal does. It has its own sidebar, its own settings and its own keyboard shortcuts. The charts sit in the middle, the order form on the side and your positions along the bottom, and you can resize, hide or move every panel. It shows labels and numbers, not explanations; the explaining stays on the main website. It lives at trade.endyland.com and at /trade/, behind the same sign-in.

## Context

The owner asked for it on 24 October 2026: "it needs to become another view, separate from this main, like simming is, different sidebar, settings, controls, and purpose, the trade needs to take the full page and you can control it absolutely ... we dont explain things as much for this trade like no footnotes for this. Only on the main website."

The parts already existed in the product app: pro charts with 11 indicators and drawings ([DEC-0031](0031-trade-charts-pro-charting-on-delayed-data.md)), watchlists, alerts and a screener ([DEC-0033](0033-trade-trackers-watchlists-alerts-and-a-screener.md)), and demo accounts with paper trading and forward tests ([DEC-0034](0034-demo-accounts-paper-trading-on-delayed-data.md)). Each was a tab with a paragraph of explanation above it. How the serious platforms lay out a workspace is in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).

## Decision

1. **A separate entry and build.** `web/trade/index.html`, marked `<html data-space="trade">`, loads `src/trade/main.tsx` and nothing from the product or research app. `vite build --mode trade` writes it to `/trade/` with its files under `/trade/assets/`, like the Terminal's `--mode sim` ([DEC-0020](0020-sim-world-plays-every-tab-like-the-race-on-its-own-full-screen-site.md)).
2. **Addresses.** `/trade/` on parity.endyland.com and `trade.endyland.com`, which the owner approved and set up on 24 October 2026. The Pages middleware serves `/trade/` at the subdomain's front page, keeps the sign-in pages and assets public there, and sends the other apps back to the main address. `tradeUrl()` in `src/lib/space.ts` points at the subdomain on endyland.com and at `/trade/` elsewhere; one constant, `TRADE_SUBDOMAIN`, switches it back to `/trade/`. The session cookie is already shared across endyland.com, so no second sign-in is needed.
3. **The workspace.** A slim left rail (Chart, Watchlists, Screener, Portfolio, Orders, Alerts, Strategies, Settings). A top strip with symbol search, timeframe, chart type, indicators, drawing tools, compare, log scale, a 1, 2 or 4 chart grid, layouts, the command palette, alerts and account equity. On the Chart view: the chart grid in the middle, an order ticket and a watchlist on the side, and a dock with positions, open orders, fills and P&L along the bottom. The active chart drives the ticket, the watchlist highlight and the dock.
4. **You control it.** The side panel and the dock resize by dragging (or with arrow keys on the handle), collapse, and the side panel docks left or right. Any chart maximises. Layouts save by name to the account (a new table, `trade_layouts`, one row per layout, each person sees only their own rows). The working layout and the settings stay in this browser, in storage wrapped so a blocked browser still works.
5. **Keyboard first.** Typing a letter opens symbol search; Ctrl+K opens a palette of every command and symbol; Shift+B and Shift+S open the ticket to buy or sell; Shift+Alt adds a limit; Shift+D, W and M set the timeframe; / opens indicators; Alt+H, T and F draw; Alt+1, 2 and 4 set the grid; [ and ] move between charts; Alt+Enter maximises; Alt+R and Alt+B fold the panels; Ctrl+S saves the layout; ? shows them all. One-key orders (Shift+B places a market order at once) are off by default, as on most platforms.
6. **Terse.** No footnotes, explainer paragraphs, glossary links or page blurbs inside Trade. Labels and numbers only, with tooltips where a control is otherwise ambiguous (order types, indicator names, icons). One persistent line at the bottom: "Demo account. Delayed data. Not advice." The legal pages and the chart credit are under Settings. The explaining stays on the main website and in the product app.
7. **One way back.** A Back button closes the tab when Trade was opened as one, or goes to the product app.
8. **One home for trading.** The product app's sidebar has a single Trade entry that opens Parity Trade in a new tab. Its four trade tabs are gone. Old links keep working: `#/trade` opens the chart, `#/trade/watchlists` the watchlists, `#/trade/screener` the screener and `#/trade/demo` the portfolio, with `?s=` carried over. The code moved from `src/pages/trade/` to `src/trade/`; nothing is duplicated.

## Alternatives considered

- **Keep Trade in the product app and add a full-screen button.** Rejected. The product sidebar, the explanations and the page scroll would still be there, and the owner asked for a separate app.
- **Put trading inside Parity Terminal.** Rejected. The Terminal is for looking at markets and simulations; Trade acts on a demo account and needs its own ticket, dock and keys. They link to each other instead.
- **A free-form widget canvas, as Robinhood Legend does.** Not now. A fixed frame with resizable, foldable and dockable panels covers what people do with a trading screen and never leaves a half-built layout. A canvas can come later on the same layout record.
- **Layouts in browser storage only.** Rejected for named layouts, which should follow a person between devices. The working layout stays local so dragging a handle does not write to the database.

## Consequences

- `/trade/` and `trade.endyland.com` are behind the sign-in, like `/app/`, `/research/` and `/sim/`; the middleware tests cover both.
- One migration adds `trade_layouts` with row level security, the same policy shape as the other trade tables.
- The layout shift audit and the accessibility audit now include the Trade pages.
- The academy and the product pages that link to `#/trade` now open Parity Trade in a new tab.
- Real trading is still a future decision for the owner ([DEC-0019](0019-real-trading-later-what-it-would-legally-take.md)); everything in Trade acts on the demo account with delayed data.

## Other sections that should get the same treatment

The owner asked which other parts would benefit. Recommendations, not built:

| Section | Recommendation | Why |
| --- | --- | --- |
| Academy | Its own full-screen course player: a lesson rail, a large lesson canvas, keyboard next and back | Courses are read and played, not browsed beside other pages |
| Lab: Try settings, Compare, Strategy search, Edge Lab | One strategy workbench app with its own rail and saved workspaces | These are long working sessions with many controls, like Trade |
| Markets (crypto, perps, ETFs) and News | Fold into Parity Terminal as panels rather than a new app | They are monitors of the same series the Terminal already shows |
| Verify | Keep on the main site | It is public, shareable and needs its explanations; only the checker's results view could go full screen |
| Home, Discover, What if, Glossary, Start here | Keep on the main site | This is where the explaining belongs |

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [RES-0021: How trading platforms lay out a workspace](../research/0021-how-trading-platforms-lay-out-a-workspace.md)
- [LOG-0015: Parity Trade becomes its own app](../log/2026-10-24-parity-trade-becomes-its-own-app.md)
<!-- backlinks:end -->
