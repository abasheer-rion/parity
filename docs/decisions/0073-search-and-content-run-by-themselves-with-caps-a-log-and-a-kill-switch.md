---
id: DEC-0073
title: Search and content run by themselves, with caps, a log and a kill switch
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [data, process]
related: [DEC-0015, DEC-0023, DEC-0038, DEC-0057, DEC-0061, DEC-0063, DEC-0064, GDE-0005, GDE-0009, REF-0017]
---

# Search and content run by themselves, with caps, a log and a kill switch

## In plain words

The owner asked for search work to run inside the project with open tools: the site gets found by itself, posts get written from our own data, and people can see what we released and what is broken. This decision covers what now runs on its own:

- **After every deploy** the sitemaps are rebuilt, search engines that use IndexNow hear which pages changed, and Google Search Console gets the sitemaps again. Google checks the site through a tag in the front page, so no DNS change is needed for it.
- **Every Monday** a report says how many pages Google has indexed, which searches show us, how many people clicked and where we rank, against the four weeks before. It suggests keywords from real searches and pages that need more links.
- **Every page** has a title, a description and structured data made by the build. CI fails on a title or description that is too long, too short or used twice, and on slow pages (Lighthouse).
- **Posts write themselves from our data.** A weekly comparison of markets with a chart, short reports on the new headlines that moved markets most, and a weekly press release of what shipped. Each one carries a stance label, its sources and a house byline.
- **Three new public pages:** a changelog of release and patch notes, announcements, and a status page. Warnings also show as a banner across the site. Each has an RSS feed and a link in the footer and in the desktop app's Help menu.
- **Every job can be stopped** with one switch, and logs what it did.

## Context

[DEC-0023](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md) made public pages and pinged IndexNow. [DEC-0057](0057-blog-and-news-pages-with-labelled-posts-and-real-bylines.md) added the newsroom, with stance labels, sources and real bylines. Neither submitted to Google, chose keywords, checked metadata, or wrote anything by itself. The site is also moving to `paritytrading.app` (the address lives in one file, `web/src/lib/site.json`, per [DEC-0038](0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md)), so every address here comes from that file.

Google's rules shape this. The Indexing API is only for job postings and live streams, so we do not use it ([Google](https://developers.google.com/search/apis/indexing-api/v3/quickstart)). Pages made in bulk mainly to rank count as scaled content abuse ([Google](https://developers.google.com/search/docs/essentials/spam-policies)), so automatic posts are few, capped and built from data nobody else has.

## Decision

1. **Search plumbing on every deploy.** The build writes a sitemap index (`/sitemap.xml`) with one sitemap per section, so Search Console counts pages per section ([sitemaps.org](https://www.sitemaps.org/protocol.html)). It writes `robots.txt`; a Pages function serves it only on the real address and answers every other host, such as preview addresses and the old address, with `Disallow: /`. After a production deploy: IndexNow gets the changed pages ([IndexNow](https://www.indexnow.org/documentation)), Search Console gets the sitemap index, and the Site Verification API checks the meta tag. The tag comes from the repository variable `GSC_VERIFICATION`, or from the API when that is empty.
2. **The weekly report** pulls clicks, impressions, click rate and position by query and by page for 28 days and the 28 before, inspects up to 40 sitemap pages with the URL Inspection API (section fronts first, then a sample that moves each week), and writes keyword suggestions. Keywords sit in `content/seo/keywords.toml` as five topic clusters; Search Console queries are sorted into them by seed words. Google Trends is not used: the only free client scrapes Google without permission.
3. **Metadata is checked, not hoped for.** `scripts/seo/meta_check.py` fails CI on a title outside 10 to 65 characters, a description outside 50 to 160, a duplicate of either, a wrong canonical link, broken JSON-LD, an article without headline, date or author, or a planned keyword missing from its page. It lists pages no other page links to. Lighthouse CI fails on an SEO score under 0.95, performance under 0.8, or Core Web Vitals over budget.
4. **The content engine** (`scripts/autopost/`) runs on a schedule and commits posts to `main`:
   - a weekly market comparison from our own exports, with a chart, labelled as reporting or analysis;
   - news commentary on the week's highest-impact headlines by our measured moves, citing each headline by title and link only and quoting nothing else;
   - a weekly press release of merged features and new desktop versions.
   Data posts and release notes publish by themselves. Text written by a language model is allowed only with a key Parity owns (`parity-anthropic-api-key` or `parity-openai-api-key`), and only after automated fact checks pass: every number matches its data, every link is one of the cited headlines. A draft that fails stays a draft for a person. Until a key exists, posts come from templates. Automatic posts are signed by a house byline, never by a person.
5. **Caps.** At most one market comparison, two news posts, one press release and four automatic posts in all per week, each at least 250 words. Near duplicates are skipped.
6. **Changelog, announcements and status.** `/changelog/` lists release notes (features) and patch notes (fixes) from merged pull requests, and desktop versions from their tags. `/announcements/` holds written entries and one per desktop release. `/status/` and the site-wide banner show manual entries plus warnings from the data health checker ([DEC-0064](0064-one-data-registry-finds-enrols-tests-and-watches-every-series-by-itself.md)) and the live feed probe ([DEC-0063](0063-the-public-sees-live-prices-from-our-own-on-chain-feed.md)). The probe job redeploys only when the set of warnings changes. Each page has an RSS feed.
7. **One kill switch, one log.** `content/seo/automation.toml` holds a switch per job and the caps. The repository variable `SEO_AUTOMATION` stops everything (`off`) or named jobs without a commit. Every job logs one line per run, to the job summary and the run's artifact.

## Tools

All open source or free: Python's standard library, the sitemaps and IndexNow protocols, Lighthouse CI ([GitHub](https://github.com/GoogleChrome/lighthouse-ci)), and Google's free Search Console, URL Inspection and Site Verification APIs through the service account from [GDE-0005](../guides/0005-google-search-console-and-the-seo-pipeline.md).

## Consequences

- New pages and posts reach search engines within minutes of a deploy, with no one pressing a button.
- A bad title or a slow page fails CI before it ships.
- Automatic posts can be wrong if our data is wrong. The fact checks compare text with data, not data with the world, so data health warnings matter more now.
- Owner steps are in [GDE-0005](../guides/0005-google-search-console-and-the-seo-pipeline.md).

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [GDE-0005: Google Search Console and the SEO pipeline](../guides/0005-google-search-console-and-the-seo-pipeline.md)
<!-- backlinks:end -->
