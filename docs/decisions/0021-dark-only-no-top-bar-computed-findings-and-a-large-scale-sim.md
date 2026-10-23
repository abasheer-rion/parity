---
id: DEC-0021
title: Dark only, no top bar, computed findings and a large scale sim
type: decision
status: accepted
created: 2026-10-22
updated: 2026-10-22
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

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0023: Public pages search engines can read, and a pipeline that keeps them fresh](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)
- [RES-0016: How the ingredients behave in crises, and what Sim World should show](../research/0016-how-the-ingredients-behave-in-crises-and-what-sim-world-should-show.md)
- [LOG-0012: Crisis behaviour, and a check of Sim World](../log/2026-10-22-crisis-behaviour-and-a-check-of-sim-world.md)
<!-- backlinks:end -->
