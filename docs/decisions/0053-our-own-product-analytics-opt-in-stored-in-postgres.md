---
id: DEC-0053
title: Our own product analytics, opt-in, stored in Postgres
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [data, infra, ui]
related: [DEC-0012, DEC-0022, DEC-0045, REF-0022]
---

# Our own product analytics, opt-in, stored in Postgres

## In plain words

The owner asked to see what people do on Parity: which pages they open, how long they stay, what they click. We built our own small version of tools like PostHog. Every page loads it by itself, but it records nothing until a person says yes in the cookie settings, and never if their browser asks not to be tracked. The records go into our own database, where only the team can read them, on a new Metrics page.

## Context

- The cookie notice and policy said "essential cookies only, no analytics" ([DEC-0022](0022-safe-sign-in-legal-pages-essential-only-cookies-and-an-accessibility-bar.md)). The consent code already had an "analytics" category that could not be switched on.
- Page timing from real browsers already exists ([DEC-0045](0045-we-track-how-old-our-data-is-at-every-hop-and-how-fast-pages-get-it.md)). It is anonymous, sampled and needs no consent. It says how fast pages are, not what people do.
- There are 21 HTML pages built by Vite, 547 static public pages written by `scripts/seo/build_public.py`, six signed-in apps with hash routes, and the desktop app, which loads the live site. A tracker added by hand to each entry would miss the next one.
- The Supabase project is on a small plan. Pages Functions have no secret for the database: the existing `/rum` function calls a checked database function with the public key.
- Email confirmation is off, so an email address on the team list proves nothing ([DEC-0012](0012-open-sign-up-with-supabase-auth-replaces-the-cloudflare-login.md)).

## Decision

1. **First party only.** No third-party script, cookie or service. The tracker is `web/src/lib/analytics/`; the event list and its rules are in [REF-0022](../reference/0022-product-analytics-events.md).
2. **On every page by itself.** A Vite plugin (`web/plugins/analytics.ts`) adds a small boot script to every HTML file in every build and in dev. The static public pages load the same file from a fixed address, `/a/boot.js`. Three checks fail CI when a page is not wired: a unit test that every HTML page and every route maps to a named app and route, a check of every built HTML file, and the smoke test, which asserts the boot script ran on every route at desktop and phone size.
3. **Consent.** Analytics is off by default. The cookie notice offers "Essential only" and "Allow analytics" as equal buttons, and the notice version moved to 2 so everyone is asked again. Do Not Track and Global Privacy Control keep it off in the browser, and `/e` drops any request that carries either header. Switching it off stops the tracker and deletes its two browser IDs. The desktop app shows no notice, so analytics there stays off unless switched on in Cookie settings.
4. **What is recorded.** Page views per route (hash routes included, ids and queries removed), visible time on page from the Page Visibility API, deepest scroll, clicks on controls by role and label (never field values), rage clicks, uncaught errors with addresses and numbers masked, and named actions through `track()`. Batches go to `/e` with `sendBeacon`. The desktop app reports the same events as `app=desktop`, with the window's app as `surface`.
5. **No personal data in events.** A random visitor ID and session ID made in the browser after opt-in. For signed-in people, the database stores a keyed hash (HMAC-SHA-256 with a secret salt that never leaves the database) of the user ID, computed from the caller's own verified sign-in token, so nobody can write events as someone else. No IP address is stored or sent on: `/e` keeps a shortened address in memory for one minute for its rate limit. No user agent is stored; it is read only to drop bots. Country comes from Cloudflare.
6. **Storage: Postgres, not Cloudflare Analytics Engine.**
   - Analytics Engine keeps data for 3 months; the brief asks for 13. Reading it needs an account API token on the server, which would be a new key. It cannot join to accounts for the user hash or the deletion path.
   - Postgres keeps everything in one place under row level security, joins to accounts for "delete my data", and lets the Metrics page read through the same sign-in as the rest of the app.
   - Volume is small. At 1,000,000 events the raw table and its indexes take 253 MB, and the expected volume is far below that per year. A global cap of 3,000 batches a minute bounds a flood.
7. **Partitions: our own, not pg_partman.** pg_partman is available on the hosted project but not installed, and not available in the local Postgres we test on. The raw table is partitioned by month with declarative partitions. `analytics.maintain()` makes this month's and the next two months' partitions and drops months older than 13; pg_cron (already installed) runs it hourly. A default partition catches anything early, and `ensure_month()` moves those rows across when it makes the month. Without pg_cron the ingest function makes a missing month itself.
8. **Indexes and rollups.** BRIN on time (small, fits append-only data), `(visitor_id, at)` for the funnel, `(kind, name, at)` for named events, and the user hash for deletion. Daily totals per route, per click target, per named event, per error, and per visitor-day are rebuilt every 15 minutes for today and yesterday by `analytics.refresh()`, idempotently. Totals keep no IDs and are kept 25 months; per-visitor days and the raw events 13 months.
9. **Writes and reads.** The `analytics` schema is not exposed by the API. The only write path is `public.analytics_ingest()`, which checks every field again and applies the global cap; calling it directly with the public key gets the same checks. Reads are `public.metrics_*()` functions that answer only user IDs on `analytics.viewers`, added by hand. `analytics.forget_user()` deletes a person's events, and the events of every browser they used while signed in, for account deletion.
10. **Metrics page.** `#/metrics` in the research app: people now, visitors per day, top pages with time and scroll, a click map per page, the funnel from the front page to sign-up to the first Verify run, weekly retention, named actions, errors, and the Latency page's speed panels underneath. Anyone not on the team list sees a short note and nothing else.

## Consequences

### Timings on made-up data

1,000,000 events from 20,000 visitors over 60 days, local Postgres 17, `PARITY_BENCH=1 supabase/tests/local.sh`:

| Query | Time |
| --- | --- |
| People now (last 5 minutes), BRIN before tuning | 42 ms |
| People now, BRIN with 32 pages a range and autosummarize | 0.5 ms |
| Weekly retention, first version (scan of every visitor day) | 1,791 ms |
| Weekly retention, with a first-seen table | 29 ms |
| Top pages, 7 days | 4 ms |
| Click map, 30 days | 1.5 ms |
| Visitors per day, 30 days | 65 ms |
| Funnel, 30 days | 680 ms |
| Refresh of today and yesterday (every 15 minutes) | 548 ms |
| Rebuild of 60 days of totals | 9.6 s |

### Owner steps

- Add the team's user IDs to the Metrics list: `insert into analytics.viewers (user_id, note) values ('<user id>', '<name>');` in the Supabase SQL editor.
- Have a lawyer review the new cookie notice text and the analytics sections of the cookie policy and privacy policy before relying on them.

### Limits

- Sign-ups through Google or GitHub are not counted as "account made" in the funnel yet, because the page cannot tell a new account from a returning one.
- Consent is stored per site address, so `trade.`, `academy.` and `lab.` ask separately.
- A person who calls `analytics_ingest()` directly can add events that skip the bot filter, within the same caps. Moving the write to a service key would close that, at the cost of a new secret.
- Single-page apps that never change their address record one page view per load.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0060: A getting started checklist and first-run tours, and no bank details until a broker partner](0060-a-getting-started-checklist-and-first-run-tours-and-no-bank-details-until-a-broker-partner.md)
- [REF-0022: Product analytics events](../reference/0022-product-analytics-events.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
