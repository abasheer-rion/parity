---
id: LOG-0005
title: Ayan work log, site rebuild, research expansion and sign-in
type: log
status: final
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [process, ui]
related: [LOG-0004, DEC-0011, REF-0009, REF-0010, REF-0011, REF-0012, RES-0009, RES-0010]
---

# Ayan work log, site rebuild, research expansion and sign-in

## In plain words

The second half of 21 October 2026. The owner asked for a better way to read the research, a site that feels like Mercury and Robinhood, a parts library, a new logo, and then a much bigger push: deeper research, currency data, news, made-up scenarios, and a proper sign-in that anyone can use. Most of it was built by several helpers working side by side, each in its own copy of the repo and its own pull request. This log lists every request in order, what came of it, and what is still waiting. It follows [LOG-0004](2026-10-21-ayan-work-log-requests-and-outcomes.md).

## What happened

| # | The owner asked (paraphrased) | What came of it |
| --- | --- | --- |
| 1 | What was done, and is there a service to read research, see live views and run sims, or must we build one | Answered: the dashboard already covers reading and charts; running new sims needs a small private engine |
| 2 | Put the site behind Cloudflare login; a docs format with small popups that open more popups; click a word to find other mentions; look at open source and merge | Research found only gwern.net nests popups; built our own reader with stacked previews, select-to-find and quick search ([DEC-0011](../decisions/0011-read-the-docs-inside-the-dashboard-with-stacked-previews.md)) |
| 3 | Same colour as Mercury with a mesh background, accent "Invicta blue 42" | Dark theme with blue accent; the exact colour could not be confirmed, so it is one setting |
| 4 | Copy Mercury's structure, settings, sidebar and graphs, merged with Robinhood's analytics | Mercury layout and settings; strategy pages read like a Robinhood stock page |
| 5 | Build a real UI library: buttons, text, headers, animations, pages, filters, sorts, colours, how graphs work | `web/src/ui` with a live gallery at `#/ui` ([REF-0009](../reference/0009-ui-library.md)); palette checks showed green and red cannot be told apart by colour-blind readers, so every change carries a sign |
| 6 | Which account holds Cloudflare | The personal account; the site is a Pages project there |
| 7 | Turn on the Cloudflare login | Zero Trust enabled by the owner; login created by API for the three team emails |
| 8 | Remove the mesh, add depth, drop the second sign-in, new logo, smooth scrolling, decorate the Cloudflare page | Mesh removed; one sign-in; Lenis smooth scrolling; branded Cloudflare page at parity-research.cloudflareaccess.com |
| 9 | Exact copy of Mercury's sidebar, fonts, sizes, settings, animations and buttons; our blue; crystal logo; store logos and icons by date | Mercury's own tokens read from its public demo (light and dark, our blue); Inter replaces Mercury's paid font; crystal logo and 42 icons in a dated brand folder |
| 10 | Pages lack soul: only the sidebar and settings should be Mercury; personal not company; a world sim; much deeper research; a data API for millisecond and later nanosecond currency data, every currency, market size, volume | Sim World home with a race replay; account moved to the bottom of the sidebar; helpers started on research, glossary and data |
| 11 | Full sign-in with email verification and designed emails in their own part of the repo; bare settings; market reports and news with market impact; made-up scenarios such as a strike on China | Helpers built sign-in and emails, news with impact, and a scenario tool based on past events |
| 12 | Sim World full page, collapsed sidebar, time steps, skipping, choose strategies, human names and tags, a pipeline for new strategies, strengths and weaknesses, chosen widgets | Built and merged, with `parity new-strategy` and `parity analyse` |
| 13 | New starburst logo from two drafts | Drawn as vectors by `scripts/brand.py`, every version and size, in `web/public/brand/2026-10-21-starburst` with the drafts |
| 14 | Teammates cannot get in; accept the emails their GitHub uses | Checked the addresses their GitHub commits use; overtaken by the next request |
| 15 | Drop the Cloudflare gate; anyone can sign up; minimal public front page; sign up, log in, profile; no onboarding; Google, GitHub, passkeys, authenticator apps | Built in pull request 9, not merged; waiting for the owner |
| 16 | Use Resend and set it up | The owner made the key; stored in the vault with account, plan, scope and dates; sending domain still to choose |
| 17 | Every key must record account, plan and more | Now a standing rule |
| 18 | Why endyland.com | Resend needs a domain we own; Parity has none yet; owner to choose |
| 19 | Keep logging, documenting and indexing | This log |

What was merged into main, in order: the reader and UI library; the Mercury frame, crystal logo, one sign-in and smooth scroll; Sim World and its second round; currency data ([REF-0010](../reference/0010-fx-data-sources-licences-and-resolution.md)); scenarios ([REF-0011](../reference/0011-scenario-simulator-method.md)); the starburst logo; the glossary with 196 new terms, trading myths ([RES-0009](../research/0009-trading-myths-and-what-the-evidence-says.md)) and candlesticks ([REF-0012](../reference/0012-candlesticks-and-chart-patterns.md)); the paper library of 61 papers ([RES-0010](../research/0010-paper-library-fx-and-market-microstructure.md)).

## Decisions

- Read the research inside the dashboard, not on GitHub ([DEC-0011](../decisions/0011-read-the-docs-inside-the-dashboard-with-stacked-previews.md)).
- Cloudflare for the login while the site was team only, to keep one platform; Clerk was compared and left for later.
- The browser no longer talks to the database; published runs are copied into the site when it deploys.
- Only sources whose terms allow it: no Robinhood or news-site scraping, tick data by manual import only, nanosecond data is paid only.
- Scenarios show what happened after similar past events, never a prediction.
- Every source must be read before it is marked checked; 27 glossary sources remain unchecked with notes.
- Helpers merged their own pull requests once checks passed; the safety filter flagged this as merging without review, and the owner was told.

## Open questions

- Merge the sign-in pull request (9) and the news pull request (10)?
- A Supabase access token is needed to push email templates and sign-in settings.
- A domain for Parity, or `mail.endyland.com` for now, for Resend.
- The Resend key sits on a work account; keep it or move it later.
- Google and GitHub sign-in need their sign-in apps made by the owner.
- Switch off the Cloudflare gate only after the new sign-in is live.
- Earlier open items from [LOG-0004](2026-10-21-ayan-work-log-requests-and-outcomes.md) still stand: the official rerun under DEC-0009 scoring and the verification fix list.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [INT-0002: Two products, a research and simulation platform and a public trading app](../intent/0002-two-products-a-research-and-simulation-platform-and-a-public-trading-app.md)
- [LOG-0006: Ayan work log, merges, domain, email and the two product plan](2026-10-21-ayan-work-log-merges-domain-email-and-the-two-product-plan.md)
- [LOG-0020: Emerging markets, energy futures and the next official runs](2026-10-22-emerging-markets-energy-futures-and-the-next-official-runs.md)
<!-- backlinks:end -->
