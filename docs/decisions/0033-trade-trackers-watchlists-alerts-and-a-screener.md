---
id: DEC-0033
title: Trade trackers, watchlists, alerts and a screener
type: decision
status: accepted
created: 2026-10-23
updated: 2026-10-23
authors: [ayan]
tags: [ui]
related: [DEC-0019, DEC-0030, DEC-0031, REF-0015]
---

# Trade trackers, watchlists, alerts and a screener

## In plain words

The Trade area now has two more tabs next to the chart.

- **Watchlists** (`/app/#/trade/watchlists`): your own named lists of markets. Each row shows the last delayed close, the change over a day and a week, a one-year line, the date of the last value with the word "Delayed", and a link that opens it in the chart. You can make, rename and delete lists, add and remove markets and move rows up and down. A new person starts with one list: the US stock market, the euro, bitcoin, ether, WTI oil and the 10-year Treasury yield.
- **Alerts**: on any market you can ask to be told when the price closes above or below a level, when RSI(14) rises above or falls below a level, or when the close crosses above or below its moving average. Alerts are checked against the latest delayed daily close when you set one, when Trade opens and when the watchlists tab opens. When one fires it shows a message at the bottom of the screen and goes into the list under the bell at the top of Trade, with the date and value of the close that fired it. Each alert fires once.
- **Screener** (`/app/#/trade/screener`): filter every market we can show by asset class, RSI(14), whether the close is above or below its 50 and 200 bar averages, the one-month and year-to-date change, how far it is from its one-year high and ADX(14). The table is sorted by name and every row opens the chart.

Single stocks and ETF prices are not shown, and the watchlist says so: no free source licenses them for display. Nothing here places an order, sends an email or touches real money ([DEC-0019](0019-real-trading-later-what-it-would-legally-take.md)).

## Context

The owner asked for a trading platform people can use to follow markets and test ideas without real money. The chart came first ([DEC-0031](0031-trade-charts-pro-charting-on-delayed-data.md)). The next things people expect from a trading app are a place to keep the markets they follow, a way to be told when something happens and a way to find markets that match a condition.

All our prices are delayed daily closes from sources whose terms allow display (REF-0015). There is no live feed, so an alert cannot fire during the day, and a server that watches prices around the clock would add cost without making alerts any faster.

## Decision

1. **Two new tables, each person sees only their own rows.** `trade_watchlists` (name, a list of market keys, a position) and `trade_alerts` (market, kind, level, look-back, whether it is still waiting, and when it fired with the bar date and value). Both use row level security: a signed-in person can read and write only rows with their own user id, forging another id is refused, and signed-out visitors and TRUNCATE are denied. The kinds of alert and the allowed ranges are checked in the database too. The migration only adds tables.
2. **Alerts run in the browser, on the same delayed daily bars the chart uses.** The rules live in one small tested file (`web/src/lib/alerts.ts`). An alert looks at bars from the day it was made onward; when the data is older than that, it looks at the latest close, so an alert on a level the price is already past fires at once. A cross compares each close with the one before it. When an alert fires it is marked with the bar's date and value so it never fires again.
3. **Notifications stay inside the app.** A message at the bottom of the screen and the bell list are the only ways an alert shows. Email or phone notifications would need a server job and a sender, which can come later if people ask.
4. **The screener filters and never ranks.** It loads each series once, six at a time, with a progress line. It is sorted by name. It has no "best return" view and no default sort by performance, because a ranking of past returns reads as advice. Changes are in percent for prices and in points for rates and other levels, and the page says so. Each measure uses the series' own bars, so monthly series are marked as monthly.
5. **The same layout rules as the rest of the app** ([DEC-0030](0030-pages-that-hold-still-open-in-place-and-come-from-one-library.md)): the tables, filters, dialogs, popover and messages come from the UI library, loading placeholders match the rows that follow, the bell keeps its size whether or not it has a count, and both pages pass `npm run cls` at 1440 and 390 pixels, on the fast and the slow network.

## Consequences

- People can follow markets and set alerts with no new server cost. An alert only fires when someone opens Trade, which matches data that changes once a day.
- If a person never opens Trade, an alert never fires. A future server job could check alerts after each daily export and send email; the table already has what that job would need.
- The demo account with paper trading builds on the same tables and data in a later change.
- If a licensed stock or ETF feed is added, the watchlist and screener will show those markets without other changes, since they list whatever the export holds.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0034: Demo accounts, paper trading on delayed data](0034-demo-accounts-paper-trading-on-delayed-data.md)
- [DEC-0039: Parity Trade, a full-screen trading app of its own](0039-parity-trade-a-full-screen-trading-app-of-its-own.md)
<!-- backlinks:end -->
