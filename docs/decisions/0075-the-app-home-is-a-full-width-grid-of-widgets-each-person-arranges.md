---
id: DEC-0075
title: The app home is a full-width grid of widgets each person arranges
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [data, process, ui]
related: [DEC-0015, DEC-0056, DEC-0058, DEC-0060, DEC-0061, DEC-0068, REF-0014, REF-0017]
---

# The app home is a full-width grid of widgets each person arranges

## In plain words

The owner asked for a different app home. What changed:

- **Invicta blue.** The accent is now blue instead of red, everywhere, from one set of values in `web/src/ui/tokens.css` (`--palette-invicta-*`). No published hex for "Invicta blue" was found. The deep royal blue `#1F4FBF` is the glow behind the glass. Buttons, tabs and other controls must reach 3:1 against every panel (WCAG 1.4.11), and `#1F4FBF` reaches only 2.2 to 2.8:1 on our dark panels, so the fill colour is `#3E6CE6`, the nearest lighter step that passes (3.0:1 on the lightest panel, white text on it 4.7:1). To swap the brand blue, change those values and run `npm run tokens`.
- **Graphite, not black.** In the manner of Mercury's dark mode, the page is a soft charcoal (`#131418`) with panels a step lighter and menus a step above that (`--palette-ink-*`), instead of near-black. Front page and app share the tokens. To keep every text and control at WCAG AA on the lighter panels, the faint text grey and the control edge grey are a little lighter, the blue fill is `#3E6CE6`, and the pressed overlay is softer.
- **Full width.** App pages (product, research and the desktop app, which loads them) use the whole width beside the sidebar, with gutters from 16 to 48 pixels. Grids gain columns on wide screens. Reading text keeps its own line length. Marketing pages keep their margins.
- **"Hi Ayan".** Home greets people by first name in the normal font, sentence case. The name comes from the sign-in profile (`first_name`, `given_name`, or the first word of a full name of two or more words). A single word there may be a username, so it is not used. When there is no first name, Home asks once ("What should we call you?") and saves it to the profile; Account settings can change it. An email or username is never shown in the greeting.
- **Setup moves to the top right.** The getting started list (DEC-0060) opens from a small progress ring at the top right of the product app. A gentle reminder appears only when verifying the email or two-step sign-in is still to do, at most once every three days. The ring goes away once every item is done or the list is hidden.
- **Widgets.** Home is a grid of nine widgets: ticker tape, sims running now, What's new, your account, market heatmap, market news, biggest movers, new algos and training. Each can be dragged by its handle or moved with its menu (dragging is never the only way), folded or hidden, and the layout is saved to the person's account. Each kind of person (new, learner, trader, both, browser) starts from a different order.
- **Less clutter.** The personalization engine (DEC-0068) moves used widgets up and folds one the person keeps passing over, with a note saying why and a way to open it again. With personalization off, nothing folds by itself. Where there is no account to read (signed out or the local preview), Home folds a widget left unclicked for 8 sessions in a row.

## Cards, news and strategies (follow-up)

- **Bigger, bolder cards.** Widgets have larger titles, more room, a colour mark per widget from the chart series colours, and a small lift on hover (none with reduced motion).
- **Strategy cards.** A new widget shows the three strongest strategies by our tests (verdict first, then the luck-adjusted Sharpe ratio). Each has its last 12 months as candles, drawn in by a new `candles` scene in the signature chart system (DEC-0067), and a plain "Up 13.5% over the last 12 months" or "Down" line. Names come from `nameOf`, which uses the plain-name table once it lands.
- **Market news.** A lead story (the biggest move among the 12 newest stories) with a chart of the market's path after the headline, drawn from our own price data, and a grid of six smaller stories. Each shows the market, region and size of move as tags, the time, the source and the moves after 1 hour, 1 day and 1 week. Publishers' images are not shown: the feed stores none and no terms we read allow it.

## Context

The old home was a centred column with a large checklist card in the middle and the user name in a capitalised serif. The owner wanted the space used, a quieter setup prompt, and a home that shows what is going on: sims, news, the account, the market.

## Decision

1. Widgets live in one registry (`web/src/home/registry.ts`) with stable ids. Every view, click, dismiss, fold, move, hide and restore goes through `track()`, which feeds product analytics (only with consent, DEC-0053) and any listener. `setHomePlanner()` lets the personalization engine rank, fold and hide widgets and fill What's new; until it is set, Home uses the default order for the person's segment. Once a person moves or hides a widget, their order wins.
2. Layouts are stored in a new table, `home_layouts` (one row per person, own row only, migration `20261109060000_home_layouts.sql`), with a copy in the browser so Home draws in its final order at once.
3. Every widget holds its height while it loads, so the page does not jump (`npm run cls` is 0.000 at desktop and phone width, 0.015 on a slow network).
4. **Hooks are true.** What's new is the personalization engine's ranked feed (DEC-0068), drawn inside the widget. Its lines may grab attention, such as a bot that won most of its trades and still lost money, but each comes from our own data, says why it is there, and never says or implies that a strategy is a good investment.
5. **Data we may show.**
   - Coins: CoinGecko, about a minute late, credited next to the data.
   - Other ticker prices: the Terminal's daily series, at the last close, each with its delay.
   - ETFs and single stocks: no free source allows them on a public site (REF-0014). The heatmap and the movers show them only to team members, from the team-only feeds (DEC-0056). Everyone else sees the heatmap sized but not coloured, with a line saying why.
   - Heatmap size: each company's public float from its latest annual report to the SEC (`dei:EntityPublicFloat`, public information). This is a dated dollar figure, so no price is needed. Members come from Wikipedia's lists (CC BY-SA 4.0, credited). `parity markets fetch` gets both (`wiki-index-members`, `sec-public-float`); `parity markets export` writes `markets/heatmap.json`.
6. Sims running now lists the always-on sims service and the runs this person started (stress tests in Sim World, kept in this browser, because they run in this browser).

## Consequences

- To colour the public heatmap and fill the public ETF and stock movers, the owner needs to license a stock price feed with display rights (the options and prices are in DEC-0052). The widget code already reads colours from any such feed.
- Home's old blocks (feature cards, themes, What if, This year) are gone from Home. The same content is on Discover, Workbench and the strategy pages.
- The first-run Home tour now points at the setup ring and the Customise button.

## App-wide visual fixes

A follow-up to this decision, from the owner's review of every app:

- Left rails (Workbench, Trade, Academy) mark the open page with a 3px Invicta bar at the rail's edge and a blue icon. There is no highlight box.
- Hovering or focusing a rail icon shows its name at once, in a small tip beside it (`data-tip` with the shared `.ui-tipped` rule). The link keeps its `aria-label`.
- The slim status and disclaimer bar at the bottom of the apps is gone. The disclaimer stays on the legal pages, in each app's settings (About, Links or Legal), once at the bottom of a strategy page, and on a Verify result.
- App pages use the full width with small gutters, including Verify's public badge page and the Academy. Reading text keeps a readable measure.
- The shared segmented control is now underline tabs: one Invicta line slides under the chosen option with a transform. Verify's three ways to start are large cards with icons, a radio group with arrow keys.
- The shared select opens Parity's own menu instead of the browser's pop-up, with the keyboard of a native select.
- Page titles and section heads are bigger and bolder (`--type-title`, `--weight-title`, `--type-section`). Table headers are a solid band (`--color-table-head`), rows take a blue hover (`--color-row-hover`), and verdict badges carry a coloured edge. tests/contrast.test.ts checks the new pairs.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
