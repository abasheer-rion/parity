---
id: DEC-0021
title: Dark only, no top bar, computed findings and a large scale sim
type: decision
status: accepted
created: 2026-10-22
updated: 2026-10-24
authors: [ayan]
tags: [ui]
related: [DEC-0015, DEC-0016, DEC-0017, DEC-0020]
---

# Dark only, no top bar, computed findings and a large scale sim

## In plain words

The owner asked: "keep the website in dark mode, but also more elegant. And intelligent, we need to show a large scale sim, also dont like the top bar". Now:

- **Dark is the only theme**, on the front page and in both apps ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)). The light theme switch is gone.
- **The look is calmer.** The blacks are deeper, with a faint blue tint. There are fewer lines and more space. Cards have one radius. Inter is used for all text. The wordmark's serif, Cinzel, is used only for a few big headings.
- **There is no top bar in the apps.** Search, the run picker and settings moved into the sidebar. On phones a small floating button opens it.
- **The home pages show short findings** worked out from the data on the page, such as the best return for the risk, or how many variations the search tried and how many passed.
- **The front page has a large scale sim**: thousands of illustrative paths fanning out from today, next to real counts and a link to Sim World.
- **Update, 24 October:** the owner said the light blue section did not belong on the site and the page did not look advanced or powerful enough. The front page is now dark from top to bottom, with a preview of Parity Terminal, a strip of real market closes and a grid of what you can do. See "The front page, fully dark" below.

## Context

The app had a light theme and a dark theme, and the light one was still the design target in places. A 48 pixel top bar held search, the run picker and a settings button. The owner finds the bar unnecessary. The home pages listed strategies but did not say what stood out. The front page showed what Parity is, but not the scale of what it checks.

## Decision

### Dark only

1. `applyTheme()` always sets `data-theme="dark"`. A saved light or system choice is ignored. The light tokens stay in the stylesheets but nothing turns them on.
2. Settings has only Account now, since there is no theme to pick.
3. `web/src/ui/dark.css` loads last and refines the tokens:
   - page `#07080d`, cards `#0c0e15`, menus `#141722`;
   - lines at 7 to 12 percent of a pale blue, instead of solid borders;
   - text from `#f4f5fa` (titles) to `#8a8fa2` (the faintest), all at least 5.4:1 on the cards, so WCAG AA passes;
   - the accent blue `#2a5ff0` for fills only. Text that used it gets `#8fb0ff`, because the fill blue is under 4.5:1 as text;
   - a visible blue focus ring on everything that can be focused.
4. Cinzel is used in four places only: the product home greeting (the class `.display`), the research home's "The question" label, the front page headline and the sim heading.

### No top bar

| What was in the bar | Where it is now |
| --- | --- |
| Search | A "Search or ask" row near the top of the sidebar. `/` and Cmd+K still open it from anywhere. |
| Run picker | The sidebar footer, labelled "Results from", only on pages that read a run. |
| Settings button | The account menu, as "Account and settings", with a Search item. |
| Phone menu button | A small floating button at the top left, shown only on narrow screens. |

Every page keeps its own title and actions in its page header.

### Computed findings

`web/src/lib/insights.ts` works out up to four lines per home page. Each line comes from the selected run or the search file, and is left out if its data is missing. A note under the row says what it was computed from.

- **Product home:** best return for the risk (highest Sharpe ratio, with the market's), how many strategies are ahead of the market this year, the smallest worst fall among strategies that grew, and the most tests passed.
- **Research home:** what the search tried and how many passed the luck check, which family it tried most, the test most strategies fail, and the strategy closest to an answer.

No line is written by hand or by a model.

### The large scale sim on the front page

1. A full-width section after the hero. Thousands of paths (3,000 on wide screens, 1,400 on phones) grow from "today" over two years, coloured from the worst ending to the best. When they land, the middle path and the best and worst 5 percent are drawn and labelled. Then the next scenario starts: calm years, rough years, or a sudden shock and recovery.
2. **It is labelled as illustrative.** The paths come from a simple random model with fat tails and clustered calm and rough weeks (`web/src/site/simModel.ts`). The page says they are not a forecast and not Parity's research data.
3. **The counts beside it are real:**
   - paths drawn on this page, counted as they are drawn;
   - other histories in each research run: strategies tested times 1,500, because every strategy is rerun on 1,000 reshuffled histories and 500 with its timing scrambled (`N_BOOTSTRAP` and `N_PLACEBO` in `engine/src/parity/gauntlet.py`);
   - variations searched, from `/stats.json`.
4. "Open Sim World" links to Sim World on its own full-screen site ([DEC-0020](0020-sim-world-plays-every-tab-like-the-race-on-its-own-full-screen-site.md)).
5. **Performance**, within the motion rules of [DEC-0017](0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md):
   - two canvases, not DOM nodes. Each scenario's paths are stroked once onto a hidden canvas, and each frame copies one thin new slice, plus a point cloud of the moving front;
   - the code (`web/src/site/paths.ts`, about 3 kB compressed) loads only when the section comes near the screen, after the page has loaded;
   - it pauses when off screen or when the tab is hidden, and does not load with data saving on;
   - with reduced motion it draws one finished still picture and stops;
   - a still SVG of 90 paths, drawn at build time, shows before the script runs and when there is no script.

### The front page, fully dark (24 October)

1. **No light or pastel section anywhere.** The light blue "wall between them" band is gone. Its three rules now sit under the two sides, as dark cards. The headline gradient is white to the brand blue, with no mint. Depth comes from hairline borders, a faint blue grid that fades out, and soft glows in the brand blue `#2f6bff`.
2. **Above the fold:** the headline, and next to it an HTML recreation of Parity Terminal's market monitor, with its command bar, function keys, rows and one-year sparklines. Below them, four counters: strategies tested, variations searched, market series in the terminal, and free Academy lessons. Then a scrolling tape of recent closes.
3. **The numbers are real.** The terminal rows and the tape show daily closes, each with its date. `scripts/export_front_strip.py` runs at deploy after the terminal export and adds them to `/stats.json`: up to 14 series, the series count and the newest date. Only series the terminal already shows go in, so its licence rules still apply. Prices only: no results and no ledger. The lesson count is read from `academy/courses/` at build time.
4. **Honest labels.** Until the closes load, the terminal preview shows example values and says so. Under the tape: "Daily closes from public sources. Not live prices. Not investment advice." The moving cursor in the preview only walks the rows; the values never change.
5. **What you can do:** six cards with icons: backtest with honest stats, paper-trade forward with pretend money, Parity Terminal, Parity Academy, AI tools through MCP ([DEC-0025](0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)) and Sim World.
6. **The 3D globe** moved from the hero to a "Every market, one method" section, and loads only when that section comes near the screen.
7. **Performance.** The page is still plain HTML and inline CSS. The preview rows and the tape have fixed heights, so filling them in moves nothing. The web fonts load with `display=optional`, which removed the jump when they arrived: layout shift on the front page is 0.003 at desktop and 0 at phone width, also on a slow network (it was 0.065 to 0.075 before). With reduced motion, the tape, the typing and the cursor stay still.

## Alternatives considered

- **Keep the light theme behind a setting.** Rejected. Two themes double the design work, and the owner wants one look.
- **WebGL for the sim.** Not needed. Copying one thin slice a frame draws thousands of paths smoothly, with no library.
- **Real reshuffled market weeks for the paths.** Better, but the front page is built without engine data, and the full run file is 15 MB. The illustrative model is honest as long as it is labelled, and Sim World ([DEC-0016](0016-sim-world-2-a-world-map-scenarios-on-it-and-simulated-paths.md)) has the real reshuffled paths.
- **Findings written by a language model.** Rejected. Every sentence must come from the numbers, and must be checkable.

## Consequences

- The run picker is not visible on phones until the sidebar is opened.
- `--topbar-h` remains as a token, because Sim World's own stylesheet still reads it.
- The UI library's colour page shows the dark values only.
- The front page HTML grows from about 18 kB to about 26 kB compressed, mostly the still picture of the sim.
- `/stats.json` now carries a few public market closes, not only counts. A licence change in the terminal's list changes the front page too.
- On a first visit over a slow network the headline may show in a fallback serif, because the fonts no longer swap in late.
- The front page has no light section left, and new sections should stay dark.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0023: Public pages search engines can read, and a pipeline that keeps them fresh](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)
- [DEC-0028: Parity Academy, short courses with moving pictures](0028-parity-academy-short-courses-with-moving-pictures.md)
- [DEC-0030: Pages that hold still, open in place and come from one library](0030-pages-that-hold-still-open-in-place-and-come-from-one-library.md)
<!-- backlinks:end -->
