---
id: RES-0021
title: How trading platforms lay out a workspace
type: research
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [ui]
related: [DEC-0040, DEC-0024, DEC-0031, DEC-0034]
---

# How trading platforms lay out a workspace

## In plain words

Before moving Trade out of the product app we looked at how serious trading apps arrange their screens. They all look alike: the chart fills the middle, the order form sits on one side, your positions and orders sit in a strip along the bottom, and almost nothing on screen is there to explain. Every panel can be resized or hidden, and the whole arrangement can be saved and reloaded. This note lists what we saw and the pattern Parity Trade copies ([DEC-0040](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)).

## Summary

Gathered on 24 October 2026 from the platforms' own help pages and, for Hyperliquid, the live app measured at 1440 by 900. IBKR's and Bloomberg's own sites refused our requests (HTTP 403), so those rows rest on an IBKR guide mirror and a university library guide. Robinhood's hotkeys page returned 404; its trading help page lists the same keys.

| Platform | Layout | Charts | Order entry | Account panel | Saved layouts and linking |
| --- | --- | --- | --- | --- | --- |
| TradingView | Top toolbar (symbol, interval, style, indicators, layout), left drawing tools, right widget bar | Up to 8 per layout, symbol and interval can sync | Buy and Sell by the chart legend; full ticket from the account panel | Bottom Account Manager: orders, positions, history, notifications | Named layouts; charts join sync groups |
| Robinhood Legend | Widgets on a canvas, up to 9 layout tabs | Chart widgets | Buy and Sell on the chart, draggable order pills | Positions and recent orders widgets | Saves on its own; colour links between widgets |
| Webull desktop | Preset and custom layouts, widgets stacked as tabs | Chart widgets | Classic ticket or a fast trader panel | Positions and orders widgets | Layouts saved locally or to the account; numbered link groups |
| thinkorswim | Collapsible left sidebar of gadgets, main tabbed areas | Grid up to 32 cells (8 by 4), flexible splits | Active Trader ladder | Monitor tab | Grids saved and shared; colour links |
| IBKR Mosaic and Desktop | Snap-docked windows | Chart windows | Order entry panel, usually on the left | Orders table at the bottom | Named layouts; colour links |
| Hyperliquid | Top nav, then a stats strip (pair, mark, change, volume, funding) | One chart at about 62% of the width | Order form on the right, about 260 px | Bottom dock: balances, positions, open orders, trade, funding and order history | Fixed layout |
| Binance futures | Fixed beginner layout or a Pro layout | Up to 6 charts | Order form under or beside the chart | Positions panel | Pro panels drag, resize and close |
| Bloomberg Launchpad | Monitors and components grouped into views and pages | Chart components | Separate functions | Monitor components | Views must be saved; groups link components |

## The common pattern

- The chart is in the centre and is the largest thing on screen.
- The order form is a fixed column on one side (crypto venues) or a docked panel (brokers).
- Positions, orders and history share a tabbed dock along the bottom.
- A watchlist or widget rail sits on one side and folds away.
- A thin top strip carries symbol search and the latest numbers.
- Panels drag, resize and close; layouts have names and can be reloaded.
- Linking a symbol across panels is close to universal. By default the watchlist, chart and order form follow one symbol.
- Labels are small and there is almost no help text on screen.
- On phones, one panel at a time behind a bottom tab bar.

## Keyboard conventions

| Action | Common key |
| --- | --- |
| Market buy and sell | Shift+B and Shift+S (TradingView, Robinhood Legend); thinkorswim uses Alt+B and Alt+S |
| Limit buy and sell | Shift+Alt+B and Shift+Alt+S (Robinhood Legend) |
| Symbol search | Start typing anywhere (TradingView) |
| Quick search, commands | Ctrl+K (TradingView) |
| Indicators | / (TradingView) |
| Interval | Type it, such as 1D, then Enter (TradingView) |
| Drawing tools | Alt+T trend line, Alt+H horizontal line, Alt+F Fibonacci |
| Next chart, maximise | Tab, and Alt+Enter to maximise (TradingView) |
| Save layout | Ctrl+S |
| Trading keys | Off by default on several platforms, and remappable everywhere |

Parity Trade keeps Tab for moving between controls, which keyboard users need, and uses [ and ] to move between charts instead.

## What Parity Trade takes from this

| Pattern | In Parity Trade |
| --- | --- |
| Full viewport, no site chrome | Its own page at /trade/ (trade.endyland.com), no product sidebar |
| Left rail | Chart, Watchlists, Screener, Portfolio, Orders, Alerts, Strategies, Settings |
| Top strip with symbol search | Symbol button, timeframe, chart type, indicators, drawings, compare, log, grid |
| Multi-chart grid | 1, 2 or 4 charts, each with its own symbol and timeframe; Alt+Enter maximises one |
| Order form on the side | Order ticket on the right (or left), linked to the active chart |
| Bottom dock | Positions, open orders, fills and P&L |
| Resizable, collapsible, dockable | Drag handles, collapsible sections, side panel docks left or right |
| Saved layouts | Named layouts in the account, the working layout in this browser |
| Keyboard first | The keys in the table above, a command palette and a key sheet (?) |
| No explanatory copy | Labels and numbers only; one legal line at the bottom |

## Sources

- TradingView chart UI elements: https://www.tradingview.com/charting-library-docs/latest/ui_elements/
- TradingView trading terminal: https://www.tradingview.com/charting-library-docs/latest/trading_terminal/
- TradingView account manager: https://www.tradingview.com/charting-library-docs/latest/trading_terminal/account-manager/
- TradingView shortcuts: https://www.tradingview.com/charting-library-docs/latest/getting_started/Shortcuts/
- TradingView hotkeys help: https://www.tradingview.com/support/solutions/43000629990-what-are-hotkeys-and-how-to-use-them/
- Robinhood Legend layouts: https://robinhood.com/us/en/support/articles/layouts-on-legend/
- Robinhood Legend widget linking: https://robinhood.com/us/en/support/articles/widget-linking-on-legend/
- Robinhood Legend trading: https://robinhood.com/us/en/support/articles/trading-with-robinhood-legend/
- Webull layouts: https://www.webull.com/learn/2uYwVO/dwHBFK/What-is-a-layout
- Webull hotkeys: https://www.webull.com/learn/courseware/jMIB8w/How-to-Use-the-Hotkey-Function-on-Webull-Desktop-Platform
- thinkorswim left sidebar: https://toslc.thinkorswim.com/center/howToTos/thinkManual/Left-Sidebar
- thinkorswim flexible grid: https://toslc.thinkorswim.com/center/howToTos/thinkManual/charts/Flexible-Grid
- thinkorswim keyboard shortcuts: https://toslc.thinkorswim.com/center/howToTos/thinkManual/Getting-Started/Keyboard-Shortcuts
- IBKR Mosaic layout: https://ibkrguides.com/traderworkstation/mosaic-layout.htm
- IBKR colour grouping: https://ibkrguides.com/traderworkstation/color-grouping-linked-panels.htm
- Hyperliquid trade view (live app): https://app.hyperliquid.xyz/trade
- Binance futures interface: https://www.binance.com/en-BH/support/faq/how-to-customize-binance-futures-trading-interface-a784518335b0492a9ebfa4a72e1ca092
- Binance advanced interface: https://www.binance.com/en/academy/articles/advanced-interface-guide
- Bloomberg Launchpad guide: https://lippincottlibrary.wordpress.com/2013/03/11/bloomberg-launchpad-part-one/

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0040: Parity Trade, a full-screen trading app of its own](../decisions/0040-parity-trade-a-full-screen-trading-app-of-its-own.md)
- [DEC-0047: Competitor profiles and a feedback collector that runs by itself](../decisions/0047-competitor-profiles-and-a-feedback-collector-that-runs-by-itself.md)
- [RES-0022: How trading and market data platforms are built](0022-how-trading-and-market-data-platforms-are-built.md)
- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](../competitors/0001-ux-patterns-users-praise-most.md)
- [CMP-0002: Bloomberg Terminal, the data, news and chat desk of professional finance](../competitors/0002-bloomberg-terminal.md)
- [CMP-0003: LSEG Workspace, the Reuters-backed data terminal that replaced Eikon](../competitors/0003-lseg-workspace.md)
- [CMP-0004: MetaTrader 4 and 5, the free broker platform most FX traders use](../competitors/0004-metatrader-4-and-5.md)
- [CMP-0005: cTrader, a modern broker platform with copy, algos and a store](../competitors/0005-ctrader.md)
- [CMP-0006: TradingView, browser charts and a social network for traders](../competitors/0006-tradingview.md)
- [CMP-0007: Interactive Brokers, a global broker with four trading apps](../competitors/0007-interactive-brokers.md)
- [CMP-0008: thinkorswim, Schwab's dense pro trading platform for options and futures traders](../competitors/0008-thinkorswim.md)
- [CMP-0009: Robinhood, the simple trading app that added a pro desktop called Legend](../competitors/0009-robinhood.md)
- [CMP-0010: Webull, a zero-commission broker with pro desktop tools and paper trading](../competitors/0010-webull.md)
- [CMP-0011: OANDA, a long-running forex broker and currency data provider](../competitors/0011-oanda.md)
- [CMP-0012: LMAX, an institutional FX exchange with a broker for professional traders](../competitors/0012-lmax.md)
- [CMP-0013: Hyperliquid, an onchain exchange for crypto perpetuals and spot](../competitors/0013-hyperliquid.md)
- [CMP-0014: Binance, the largest crypto exchange with futures and copy trading](../competitors/0014-binance.md)
- [CMP-0015: Coinbase Advanced, the pro trading screen inside Coinbase](../competitors/0015-coinbase-advanced.md)
- [CMP-0016: Kraken Pro, a customisable crypto trading app with a native desktop](../competitors/0016-kraken-pro.md)
- [CMP-0017: eToro, a social investing broker built around copying other investors](../competitors/0017-etoro.md)
- [CMP-0018: QuantPad, an AI quant workspace that grades strategies A to F](../competitors/0018-quantpad.md)
- [CMP-0023: QuantConnect, cloud backtesting and live trading on open-source LEAN](../competitors/0023-quantconnect.md)
- [LOG-0015: Parity Trade becomes its own app](../log/2026-10-24-parity-trade-becomes-its-own-app.md)
- [LOG-0017: Ayan work log, competitor profiles, feedback collector and architecture](../log/2026-10-24-ayan-work-log-competitor-profiles-feedback-collector-and-architecture.md)
<!-- backlinks:end -->
