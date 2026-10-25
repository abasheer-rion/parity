---
id: DEC-0039
title: A front page for Verify, dark glass and scroll scenes
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [ui]
related: [DEC-0017, DEC-0021, DEC-0032, DEC-0035, DEC-0036, INT-0003, REF-0016]
---

# A front page for Verify, dark glass and scroll scenes

## In plain words

The owner said the front page still looked light in places, the top bar should go, the main picture was not abstract enough, scrolling did not feel powerful, and the page should say plainly what Parity sells and who supports it. Later notes asked for plain, factual words with no slogans or labels above headings, much more space between sections, a red glow behind dark glass instead of blue, and the same look on the sign-in pages. Now:

- **Verify leads.** The headline is "The lie detector for trading strategies and bots" ([INT-0003](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)). The main button opens the free checker. Real counts sit under it: tries in our search, strategies tested, and how many beat the market.
- **No top bar.** The logo sits small in the top left. Log in and Sign up float in the top right and step aside while you scroll down.
- **An abstract hero.** Thousands of faint paths drift left to right. Most fade out part way, the way most tries turn out to be luck. A few survive and settle onto one thin bright line.
- **Scenes that follow the scroll.** A Bot Battle chart where 99.1% of trades win and $10,000 still falls to $992 ([DEC-0035](0035-bot-battle-and-shareable-clips-win-rate-is-not-profit.md)). A Verify check where a file drops in, five checks light up and the verdict appears with "survives up to 6 of 40 tries" ([REF-0016](../reference/0016-parity-verify-mvp-spec.md)).
- **The markets in very large type**: Currencies, Rates, Stocks, Commodities, Crypto, each with its series count.
- **Supported by NVIDIA Inception and Cloudflare for Startups**, as plain text.
- **Dark glass over slow red orbs**, on the front page and the sign-in pages. The sign-in pages fade in from the front page.

## Context

[DEC-0021](0021-dark-only-no-top-bar-computed-findings-and-a-large-scale-sim.md) made the site dark only and removed the top bar from the apps. The front page kept a sticky header, a globe, a terminal preview and a light gradient in an old preview. The product became Parity Verify on 23 October ([DEC-0032](0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)), but the front page still described a strategy app.

## Decision

### Layout and copy

1. Sections, in order: hero, backers, Bot Battle, Verify, every try is counted, markets, how our strategies are tested, also on Parity, closing.
2. Copy is plain and factual. No labels above headings, no slogans. Numbers wherever we have them.
3. Sections are 200 pixels apart on desktop, 140 on tablets and 112 on phones.

### No top bar

The logo (the starburst and PARITY, no subtitle) is fixed in the top left. Log in and Sign up are fixed in the top right. Both turn to glass once the page scrolls and slide away while scrolling down; scrolling up or moving focus to them brings them back. A skip link comes first in the tab order.

### The hero field

1. Plain WebGL, about 3 kB, not three.js. Every point's position is worked out on the GPU from its path's numbers and the time (`web/src/site/field.ts`).
2. The paths come from `web/src/site/fieldModel.ts`. The build draws the same paths as a still SVG (`web/plugins/site.ts`). It shows first, and instead of the field for reduced motion, data saving, no WebGL, or a device with 2 or fewer cores or 2 GB or less of memory.
3. The field starts after the page has loaded and the browser is idle. It stops off screen and in a hidden tab, and halves its points if frames run slow.
4. It is an illustration, not research data.

### Scroll scenes

1. Two sections are pinned and driven by scroll position: Bot Battle and Verify. Each picture sits in one framed panel beside its text, centred and sized to its content.
2. Bot Battle's end figures are the real Double down result on US stocks from 1928. The path between is drawn for illustration (`web/src/site/botPath.ts`), and the panel says so.
3. The Verify example is a made-up record, labelled as one.
4. Three small framed demos loop while on screen: a plan being sealed, the 11 tests ticking on with the score counting, and a result line drawing.
5. Every finished state is the default. With no script or reduced motion, nothing is pinned and everything shows.
6. Motion uses transform, opacity and clip-path only, so nothing shifts the layout.

### Real numbers

1. `scripts/export_site_data.py` adds `strategies_beat_market` (strategies whose gauntlet says they beat the S&P 500) and `search_passed_luck` to `stats.json`. `scripts/export_front_strip.py` adds `series_by_group`. Counts only.
2. A new deploy step, `scripts/bake_front_stats.py`, writes those numbers into the built `index.html`, so they show with no script. The page still refreshes them from `/stats.json`.

### Backers

1. The names live in one constant, `web/src/site/backers.ts`, and the build writes them into the page.
2. They read "Supported by NVIDIA Inception and Cloudflare for Startups". These are startup programs, not investors, so the page never says "backed by" or "invested in".
3. Plain text, not logos. Cloudflare's trademark guidelines allow its marks "in word form only (word marks, not logos)" without written permission, and its logos only with it [@url-90a7c7fc]. NVIDIA's program page says members get "official badges" to use [@url-94c34b0c]. Those come from the member portal under NVIDIA's own rules, so a badge can be added once we download it from there.
4. The owner confirms that Parity, not another company, is the enrolled member of both programs.

### Look

1. Background: three large, blurred red orbs drift slowly behind everything. They stand still for reduced motion.
2. Panels and the sign-in card are dark frosted glass: a translucent dark fill, a strong blur, a faint 1 pixel light border and a little grain.
3. Primary buttons are white with dark text. Secondary buttons are glass with a light border. The old bright blue pill is gone. Red is the only accent, used for the glow and the one bar that counts strategies beating the market.
4. Muted text stays at least 5.4 to 1 against the darkest glass, so WCAG AA holds over the orbs.

### Sign-in pages

1. Same backdrop, glass card, inputs, focus rings and buttons as the front page. The logo sits in the top left and goes home. No top bar.
2. The card and its parts rise in on load. The Password and Email code switch slides, and the form under it fades across. Email fields show a tick or a message once you leave them.
3. Going from the front page to Log in or Sign up, the front page fades out and the sign-in page fades in, with the logo held in place. Browsers with cross-document view transitions (`@view-transition`) do it themselves; elsewhere the front page fades out by script before it navigates.
4. Every sign-in behaviour is unchanged: Supabase calls, the redirect back to the page you came from, error messages and labels.

## Alternatives considered

- **three.js for the hero.** Rejected: 130 kB for points a 3 kB shader can draw.
- **A video or GIF hero.** Rejected: heavier, blurry on large screens, and it cannot match the still picture.
- **Official logos for the backers.** Rejected for now, see the rules above.
- **Keeping the globe and terminal preview.** Rejected: they described a different product, and the owner found them literal.

## Consequences

- `web/src/site/hero3d.ts`, `nodes.ts`, `paths.ts` and `simModel.ts` are removed. Sim World keeps its own paths.
- The front page's "light blue gradient" from [DEC-0017](0017-motion-on-the-site-3d-on-the-front-page-and-quiet-movement-in-the-app.md) and the globe are gone; DEC-0017's rules for motion still hold.
- The deploy runs one more short step after the market strip.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@url-90a7c7fc](../REFERENCES.md#url-90a7c7fc): Trademark guidelines | Cloudflare (n.d.)
- [@url-94c34b0c](../REFERENCES.md#url-94c34b0c): NVIDIA Inception Program for Startups (n.d.)

## Referenced by

- [DEC-0042: Parity Academy, a full-screen course player of its own](0042-parity-academy-a-full-screen-course-player-of-its-own.md)
- [DEC-0043: Parity Workbench, one full-screen tool for strategy work](0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)
- [DEC-0044: One sign-in panel that fades in over the front page](0044-one-sign-in-panel-that-fades-in-over-the-front-page.md)
- [LOG-0016: Ayan work log, front page, Trade, links, copy and apps](../log/2026-10-25-ayan-work-log-front-page-trade-links-copy-and-apps.md)
<!-- backlinks:end -->
