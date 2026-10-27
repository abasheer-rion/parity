---
id: DEC-0072
title: Public pages are cached up to 3 days, the desktop app stays signed in, and a download page
type: decision
status: accepted
created: 2026-10-27
updated: 2026-10-27
authors: [ayan]
tags: [infra, ui]
related: [DEC-0041, DEC-0048, DEC-0049, DEC-0062, REF-0024]
---

# Public pages are cached up to 3 days, the desktop app stays signed in, and a download page

## In plain words

Three owner requests in one change. Public pages now load from the browser's own copy or Cloudflare's for up to 3 days, and anything signed in is never kept. The desktop app no longer asks you to log in again after a few weeks away. A new page at `/download/` has the Mac and Windows installers, and its buttons always fetch the newest version.

## Context

Before this change every public page, the sitemap and the front page counts were sent with `max-age=0`, so each visit asked Cloudflare again (measured on 27 October 2026 with `curl`: 8 of 10 public addresses answered `public, max-age=0, must-revalidate`, the other two 4 hours). Only built files were kept a year ([REF-0024](../reference/0024-app-speed-how-we-measure-it-and-what-we-changed.md)).

The desktop app kept the website's session cookie for 30 days after it was last written. A person who did not open the app for a month had to log in again. A window left open overnight, or hidden with "Keep running when windows close", stopped renewing its hourly token, because the website's Supabase client renews only while the page is visible. The bundled offline copy has its own storage, so starting the app offline showed the log-in page even for a signed-in person.

There was no page to download the app. The README pointed at GitHub's releases page.

## Decision

**Caching.** One policy, in `web/src/lib/cachePolicy.ts`, mirrored in `web/public/_headers` (one Cache-Control per path, because Pages joins two matching values with a comma; a test checks this):

| What | Cache-Control |
| --- | --- |
| Built files with a hash in the name (`/assets/*`) | `public, max-age=31536000, immutable` (unchanged) |
| Public pages: `/`, `/legal/`, `/developers/`, Learn, Ideas, Notes, Blog, News, authors, tags, `/download/` | `public, max-age=600, stale-while-revalidate=259200` |
| Pictures, icons, `/brand/`, `/content/` | `public, max-age=86400, stale-while-revalidate=259200` |
| `sitemap.xml`, `robots.txt`, the web manifest | `public, max-age=3600, stale-while-revalidate=86400` |
| `stats.json`, `seo-manifest.json` (change hourly) | `public, max-age=60, stale-while-revalidate=600` |
| Sign-in pages (`/login/`, `/signup/`, `/reset/`, `/verify/`, `/connect/`, `/oauth/`) | `no-store` |
| Signed-in apps and `/data/` | `private, no-cache` (unchanged, middleware) |
| Live feeds and status (`/live/*`) | 2 seconds to 1 day by source, team feeds `private, no-store` (unchanged) |
| Download links (`/download/latest/*`) | 5 minutes, kept in the data centre's cache |

The front page passes through the middleware, which applies the same policy (`withPublicCache`). Pages replaces its own edge copies on every deploy. The deploy job also purges the zone cache when `CLOUDFLARE_PURGE_TOKEN` and `CLOUDFLARE_ZONE_ID` are set; until the owner adds them it says so in the job summary and skips. A browser shows at most one stale page view after a deploy, then the new page.

**Staying signed in.** Supabase Auth already had no time limit and no inactivity limit on sessions, with refresh token rotation on and 1-hour access tokens; those stay. The refresh token reuse interval went from 10 to 60 seconds, so a renewal whose answer was lost (a laptop waking on a weak connection) can be retried without the session being ended as a stolen token. The previous settings are backed up in `~/.config/parity/supabase-auth-backups/auth-config-20261027T045052Z.json` on the owner's Mac. In the app (`desktop/electron/session.js`):

- the website asks for a 400-day session cookie inside the app (30 days in a browser), and at launch the app moves an older cookie's expiry out to 400 days
- when the computer wakes, when someone logs back in to it, when the connection comes back and every 30 minutes, the app asks each page to check its session, and the page renews a token that ends within 10 minutes
- started offline, the bundled copy asks the app who is signed in (an id and an email from the cookie, never a token) and shows its pages to that person until the live site is back

The app never renews the token itself and never copies the refresh token, so rotation never sees one token used twice.

**Download page.** `/download/` lists the Apple silicon and Intel disk images and the Windows installer, with version, size, SHA-256 checksums from GitHub, system requirements, the signing note and how updates work. Its buttons link to `/download/latest/<platform>`, a Function that redirects to the newest published desktop release, the same one the update feed serves. Links to it are in the site header and footer, the front page, Settings, Account in the apps and the desktop app's Help menu.

## Consequences

- Fewer requests reach Pages and Functions for public pages. This does not change Supabase egress directly: public pages do not read the database. The egress fix is separate (pull request 151).
- A public page edited and deployed can be stale in a browser for one view after its first 10 minutes. Signed-in pages and data never are.
- The download page needs no edit when a version ships. If GitHub cannot be reached, the buttons answer an error for that request and the page says the details could not be loaded.
- A person who signs out in the app is signed out as before: the cookie is removed, not extended.
- Owner step, optional: a Cloudflare token with Zone, Cache Purge on paritytrading.app as `CLOUDFLARE_PURGE_TOKEN`, and the zone id as `CLOUDFLARE_ZONE_ID`, in the repository's Actions secrets.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0024: App speed, how we measure it and what we changed](../reference/0024-app-speed-how-we-measure-it-and-what-we-changed.md)
<!-- backlinks:end -->
