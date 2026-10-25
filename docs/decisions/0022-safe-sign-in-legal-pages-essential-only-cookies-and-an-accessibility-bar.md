---
id: DEC-0022
title: Safe sign-in, legal pages, essential-only cookies and an accessibility bar
type: decision
status: accepted
created: 2026-10-22
updated: 2026-10-22
authors: [ayan]
tags: [process]
related: [DEC-0012, DEC-0015, DEC-0019, INT-0002]
---

# Safe sign-in, legal pages, essential-only cookies and an accessibility bar

## In plain words

The owner asked (2026-10-22) that sign up, log in, forgot password, verification and the account page all work, and that the site has a privacy policy, a cookie notice, accessibility, terms and the other legal basics. Now:

- Sign-in takes you back to where you started, including the research side and Sim World, and never to another website.
- Email confirmation is expected to be on, with Resend sending the emails. The owner turns it on with one command ([auth/CHECKLIST.md](../../auth/CHECKLIST.md)).
- There are six public legal pages under `/legal/`. All are drafts for a lawyer to review.
- The site uses only essential cookies, and says so in a small notice. Analytics cannot be added without asking first.
- We aim for WCAG 2.2 AA, and an automated check keeps the serious problems at zero.

## Context

Sign-in worked for the simple case, but had gaps:

- After logging in, only `/app/` addresses were followed, so people starting from `/research/` or Sim World landed in the wrong place.
- The address to return to was not carried through sign-up, password reset or email links.
- Password rules were only checked on submit, there was no way to see the password, and error messages were not always read out by screen readers.
- Email links always went to the product app. Email confirmation was off ([DEC-0012](0012-open-sign-up-with-supabase-auth-replaces-the-cloudflare-login.md)) because Supabase's own sender only reaches the team.
- There was no privacy policy, terms, cookie policy, accessibility statement or risk notice, even though the product now shows crypto, perpetual futures and ETFs ([DEC-0019](0019-real-trading-later-what-it-would-legally-take.md)) and is open to anyone ([INT-0002](../intent/0002-two-products-a-research-and-simulation-platform-and-a-public-trading-app.md)).

## Decision

1. **Where sign-in returns to.** Every `?next=` is checked by one function (`web/src/auth/redirect.ts`). It accepts a path on this site, or a secure (https) address on `endyland.com` or its subdomains. Anything else, including the sign-in pages themselves, falls back to `/app/`. The product, research and Sim World apps share one guard, so they behave the same.
2. **Emails return to the starting host.** The browser sends the starting address as Supabase's redirect address, and each email link carries it as `&next={{ .RedirectTo }}`. The link itself always opens `/verify/` on `parity.endyland.com`, which checks `next` like any other.
3. **Email confirmation on, through Resend.** `auth/push_templates.sh --apply --smtp --settings` connects Resend as the sender, turns confirmation on, sets the site address to `parity.endyland.com` and allows `parity.` and `sim.endyland.com` as return addresses. It saves the old settings first and never prints a key.
4. **Tests.** Vitest runs in CI (`npm test`). It covers the redirect rules, the password rules, the consent API, the middleware, and each sign-in flow against a fake Supabase client.
5. **Legal pages.** `/legal/` with privacy, terms, cookies, accessibility and risk. Plain HTML, marked "Draft for lawyer review" with a date. They claim no licence, registration or certification. Blanks the owner must fill are highlighted on the page.
6. **Cookies.** Only essential cookies and browser storage are used. A notice says so on first visit, with OK and Preferences. Analytics is listed but off and unavailable. Any analytics code must call `whenAllowed("analytics", ...)` from `web/src/legal/consent.ts`, which stays false until a tool is named in the cookie policy and the notice asks again.
7. **Accessibility bar.** WCAG 2.2 AA is the target. `npm run a11y` runs axe-core on the public pages, sign-in pages and app homes at desktop and phone width. Serious and critical problems must stay at zero, and nothing may scroll sideways at 390 pixels.
8. **Links.** The public pages, the sign-in pages and the app's account menu and Settings link to the legal pages, with a "not investment advice" line.

## Consequences

- The owner must push the settings and run the test once ([auth/CHECKLIST.md](../../auth/CHECKLIST.md)). Until then the hosted project keeps its old settings.
- The legal pages are not final. They need the operator's legal name, a contact address, the governing law and a lawyer's review.
- Pages still load fonts from Google, which sees visitors' IP addresses. The privacy policy says so. Hosting the fonts ourselves would remove it.
- Adding analytics later is a new decision: name the tool, update the cookie policy, switch on `ANALYTICS_AVAILABLE` and bump the consent version so everyone is asked.
- The middleware still checks only that a session exists, not the second step ([DEC-0012](0012-open-sign-up-with-supabase-auth-replaces-the-cloudflare-login.md)).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0023: Public pages search engines can read, and a pipeline that keeps them fresh](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)
- [DEC-0049: The desktop app opens on the log-in page, with a menu button and its own controls](0049-the-desktop-app-opens-on-the-log-in-page-with-a-menu-button-and-its-own-controls.md)
- [RES-0026: Laws and rules that apply to Parity now and later](../research/0026-laws-and-rules-that-apply-to-parity-now-and-later.md)
- [REF-0016: Parity Verify MVP spec](../reference/0016-parity-verify-mvp-spec.md)
- [REF-0020: Compliance checklist before each new step](../reference/0020-compliance-checklist-before-each-new-step.md)
<!-- backlinks:end -->
