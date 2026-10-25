---
id: REF-0022
title: Product analytics events
type: reference
status: current
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [data, ui]
related: [DEC-0053, DEC-0045]
---

# Product analytics events

## In plain words

The list of everything our own analytics records, where it is kept and for how long, and how to add a new named action. It only records anything for people who switched analytics on in the cookie settings. Why it works this way is in [DEC-0053](../decisions/0053-our-own-product-analytics-opt-in-stored-in-postgres.md).

## Summary

Every page loads `web/src/lib/analytics/boot.ts`. After an opt-in it loads the tracker, which sends batches of the six event kinds below to `/e`. The function checks them and passes them to `public.analytics_ingest()`, which stores them in `analytics.events`. Daily totals are rebuilt every 15 minutes, and the Metrics page (`/research/#/metrics`, team only) reads them.

## Event kinds

| Kind | When | `name` holds | Numbers |
| --- | --- | --- | --- |
| `pageview` | A page opens, or a hash route changes inside an app | empty | none |
| `leave` | The route changes, the tab is hidden or the page closes | empty | `ms`: visible time since the last leave; `value`: deepest scroll in % |
| `click` | A click on a link, button, tab, switch, checkbox, option, summary, select, label or anything with `data-track` | role and label, such as `button:Run checks` | none |
| `rage` | 3 or more clicks within 800 ms and 24 px | same as the click | none |
| `error` | An uncaught error or rejected promise, at most 5 different ones per page | the message, masked | none |
| `custom` | A call to `track(name, props)` | the action name | `props`: at most 8 short values |

## Named actions

| Name | Where | Properties |
| --- | --- | --- |
| `verify_run` | Verify shows a result (`web/src/pages/Verify.tsx`) | `mode`: file, describe or strategy; `format`: the file kind |
| `sign_up` | An email sign-up succeeds (`web/src/auth/pages/SignUp.tsx`) | `method`: email |
| `log_in` | A password sign-in succeeds (`web/src/auth/pages/SignIn.tsx`) | `method`: password |
| `order_placed` | A demo order or bracket is placed (`web/src/lib/paper/account.ts`) | `type`; `filled`: true or false |
| `lesson_done` | An Academy lesson is finished (`web/src/academy/progress.ts`) | `course`, `lesson`, `score`, `total` |

To add one:

1. Import `track` from `web/src/lib/analytics` and call `track("thing_done", { kind: "x" })` where the action succeeds.
2. Names are lowercase letters, digits and underscores, starting with a letter. Property keys follow the same rule. Values are strings (60 characters at most, masked like labels), numbers or true/false.
3. Never pass anything that identifies a person: no email, name, account ID, file name, typed text or amount of real money.
4. Add a row to the table above.

## What each event carries

| Field | Where it comes from | Kept |
| --- | --- | --- |
| `at` | the server's time minus how long ago the browser saw it (at most a day) | yes |
| `app` | `site`, `auth`, `legal`, `connect`, `badge`, `product`, `research`, `sim`, `trade`, `academy`, `lab` or `desktop` | yes |
| `surface` | for `desktop`, the app the window shows | yes |
| `route` | the page pattern from `routeOf()`: `/app/#/strategy/:id`, `/legal/privacy/`, `/v/:id` | yes |
| `session_id`, `visitor_id` | random IDs made in the browser after opt-in (`parity.a.sid`, `parity.a.vid`) | yes |
| `user_hash` | for signed-in people, HMAC-SHA-256 of the user ID with a secret key held only in the database | yes |
| `country` | Cloudflare's two-letter country code | yes |
| `device` | `phone` under 640 px wide, `tablet` under 1,024 px, else `desktop` | yes |
| `referrer` | the linking site's host name, on a visit's first batch only, never our own sites | yes |
| IP address | read by `/e`, shortened, held in memory for one minute for the rate limit | no |
| User agent | read by `/e` to drop bots and headless browsers | no |

Routes keep a segment as written only when it is short lowercase words. Anything with a digit, an underscore, a dot, a capital or a percent sign becomes `:id`. Query strings are never kept. Labels and messages are cut to 60 characters, with web addresses, email addresses and runs of four or more digits masked, in the browser, in `/e` and again in the database.

## Tables

| Table | Holds | Kept | Read by |
| --- | --- | --- | --- |
| `analytics.events` | raw events, one partition per month | 13 months | the functions below |
| `analytics.daily_routes` | views, visitors, sessions, visible time and scroll per day and page | 25 months | `metrics_pages`, `metrics_daily` |
| `analytics.daily_clicks` | clicks and rage clicks per day, page and control | 25 months | `metrics_clicks` |
| `analytics.daily_events` | named actions per day | 25 months | `metrics_events` |
| `analytics.daily_errors` | errors per day, page and message | 25 months | `metrics_errors` |
| `analytics.daily_visitors`, `analytics.visitors` | which visitors came on which day, and their first and last day | 13 months | `metrics_daily`, `metrics_retention` |
| `analytics.viewers` | user IDs allowed to open the Metrics page | until removed | `metrics_allowed` and every `metrics_*` function |

## Checks

| Check | Fails when |
| --- | --- |
| `web/tests/analyticsWiring.test.ts` | a new HTML page has no app in `appOf()`, or any app's route would be recorded as `:id` |
| `npm run analytics:check` (CI, after the build) | any built page lacks the boot script |
| `npm run smoke` (CI) | the boot script did not run on any route, at desktop or phone size |
| `supabase/tests/test_analytics.sql` (`supabase/tests/local.sh`) | anonymous callers can read events, a raw user ID is stored, masking fails, partitions or retention break, or a non-member can read metrics |

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0053: Our own product analytics, opt-in, stored in Postgres](../decisions/0053-our-own-product-analytics-opt-in-stored-in-postgres.md)
<!-- backlinks:end -->
