---
id: DEC-0038
title: Every page gets its tags from one table and every view has a link
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [infra, ui]
related: [DEC-0015, DEC-0020, DEC-0023, DEC-0036, REF-0016]
---

# Every page gets its tags from one table and every view has a link

## In plain words

When someone pastes a Parity link into a chat, the chat now shows a proper card: a title, a line of text and a picture made for that page. A Verify record shows its own verdict and how many tries it survives. Every view in the apps has an address that opens it again as it was, with its filters, and that address still works if you have to log in first. The site's address is written in one place, so moving to the real domain later is a one-line change.

## Context

The front page had hand-written share tags, the legal pages had a canonical link and one image, and the sign-in pages and apps had almost nothing. The four share images were drawn by hand with a browser and committed, with the address baked in. In the apps, the page lives after the `#` in the address, which the server never sees: a signed-out visitor to `/app/#/strategy/fx_carry` was sent to log in with only `/app/` kept, so they landed on the home page. Search filters, the chart timeframe and the Verify input were not in the address at all. Search engine work is out of scope for now: the site is on a temporary address (`parity.endyland.com`) and the existing [DEC-0023](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md) setup stays as it is.

## Decision

### One table, one address

| Part | Where |
| --- | --- |
| The site's address, name, legal name, contact email, theme colour | `web/src/lib/site.json`. `origin` is the one line to change for a new domain |
| Every page's title, description, canonical link, share image, robots hint, manifest and structured data | `PAGES` in `web/src/lib/meta.ts`, one entry per built HTML file |
| Writing those tags | `web/plugins/meta.ts`, which runs last on every page in dev and in the build and removes any copy a page or another plugin wrote, so a page never has two |
| In-app pages (`#/strategy/<id>`, `#/verify`, Terminal workspaces) | `ROUTES_META` and `routeMeta()` in the same file. The apps update the tab title and share tags on every move |
| The generated public pages (`/learn/`, `/ideas/`, `/notes/`) | `scripts/seo/build_public.py`, which now reads its address and names from `site.json` |

The front page carries three kinds of structured data: the company (Parity Trading, Inc.), the website, and Parity Verify as a free web application. The derived values follow the address: the domain that shares the sign-in cookie (`endyland.com` today, the apex itself for a two-part domain) and the Terminal's address (`sim.` on that domain).

### Share images

| Image | How |
| --- | --- |
| One per main page (`/og/default.png`, `verify`, `app`, `research`, `sim`, `trade`, `strategy`, `login`, `legal`, `badge`, `learn`, `ideas`, `notes`) | Drawn at build from `OG_CARDS` and committed nowhere |
| A Verify badge, `/og/badge/<id>.png` | A Cloudflare Pages function reads the badge through `verify_badge_public()` and draws its verdict and "survives up to N tries" |
| A strategy, `/og/strategy/<id>.png` | A function draws its name and kind. Never its results, which stay behind sign-in ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)) |

All of them are one SVG drawing (`web/src/lib/og/card.ts`) turned into a PNG by resvg running as WebAssembly, with Inter loaded from two small font files. The same renderer runs in Node at build and inside the function, so no outside service or paid plan is needed. The function bundle is about 1 MB compressed. Live cards are cached at the edge for an hour, ids are checked before anything is looked up, and every drawing is logged. If drawing fails, the request is sent to the general card.

`/v/<id>` now puts that badge's own title, description and image in the page head, so a shared record previews with its verdict. A withdrawn or missing badge never shows an old verdict.

### Deep links

| View | Link |
| --- | --- |
| A strategy | `/app/#/strategy/<id>`, short form `/s/<id>` (a public page that previews with the strategy's card and goes straight on to the app) |
| Strategy search filters | `/research/#/search?q=carry&asset=fx&family=trend&beats=1` |
| A chart | `/app/#/trade?s=<symbol>&tf=W` |
| A Verify input | `/app/#/verify?mode=describe&example=1`, `/app/#/verify?mode=strategy&strategy=<id>` |
| A Terminal workspace or scenario | `/sim/#/<workspace>`, `/sim/#/scenario?type=...`, short form `/sim/<workspace>` and `/sim/scenario?type=...` |
| A badge | `/v/<id>` (unchanged) |

Filters are written with `replaceState`, so they do not add history entries or reload the page. A "Copy link" button sits beside every page title and copies the short form where there is one.

### Links survive logging in

The server keeps the path and query in `?next=`. When it answers a request for `/app/#/strategy/x` with a redirect, the browser keeps the `#/strategy/x` part by itself and brings it to `/login/`. The log-in page puts that part back on the end of `next` (`nextFromQuery()` in `web/src/auth/redirect.ts`), so after logging in the visitor lands on the exact view. Only in-app hashes, which start with `#/`, are carried; a hash a sign-in provider leaves behind is ignored, and the existing checks on `next` still refuse other sites. Short paths such as `/sim/scenario?type=war` need no hash at all, so they survive even without the log-in page's help.

### Search engines

No sitemap submission and no indexing requests. Public pages get no `noindex`. The signed-in apps (`/app/`, `/research/`, `/sim/`, and `/trade/` when it arrives) carry `noindex, nofollow` in the page as well as in the existing headers. The badge pages and the `/s/` share pages also say `noindex`, since they front signed-in or link-only content.

## Consequences

- Change a page's title or description in `web/src/lib/meta.ts`, not in its HTML. A tag left in an HTML file is replaced at build.
- `npm run deeplinks` checks the tags on three pages, the share images, and that five protected deep links send a signed-out visitor to log in with the exact address kept. It runs against a local `wrangler pages dev` or the live site. It never signs in.
- A new page needs a `PAGES` entry; a test fails if any HTML file has none.
- Moving to the real domain means changing `origin` in `site.json`, then the parts outside this repo's code: Supabase's redirect allow-list, the Cloudflare custom domain, `public/robots.txt` (its sitemap line), `public/_headers` (the sim address line) and the Search Console property.
- Open: the Terminal's other panels and the Markets pages keep only their page in the address, not every setting.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0023: Public pages search engines can read, and a pipeline that keeps them fresh](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)
- [DEC-0041: Parity as an installable site and a desktop app for Mac and Windows](0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md)
- [DEC-0042: Parity Academy, a full-screen course player of its own](0042-parity-academy-a-full-screen-course-player-of-its-own.md)
- [DEC-0043: Parity Workbench, one full-screen tool for strategy work](0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)
- [DEC-0044: One sign-in panel that fades in over the front page](0044-one-sign-in-panel-that-fades-in-over-the-front-page.md)
- [LOG-0016: Ayan work log, front page, Trade, links, copy and apps](../log/2026-10-25-ayan-work-log-front-page-trade-links-copy-and-apps.md)
<!-- backlinks:end -->
