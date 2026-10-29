---
id: DEC-0057
title: Blog and news pages with labelled posts and real bylines
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [process, ui]
related: [DEC-0023, DEC-0038, DEC-0015, REF-0017, GDE-0009]
---

# Blog and news pages with labelled posts and real bylines

## In plain words

Parity now has a blog at `/blog/` and a news page at `/news/`. The blog carries research write-ups, analysis, explainers and opinion. The news page carries company updates and press releases, and points to the market news that already lives in the app. Every post says, under its title, whether it is fact-based reporting, analysis or opinion, and the site refuses to build if an opinion piece is not labelled as one. Research, analysis and news posts must list their sources, and every picture must say who made it and under what licence.

Posts are signed by real people on the team or by a house byline such as "Parity Research". We do not make up writers. Only posts marked published go on the site. A machine can suggest a draft, but a named person has to approve it before it can be published.

This is the structure only. The three posts on the site today are marked as samples, are hidden from search and are left out of the feeds.

## Context

The owner asked for "a very, very good blog page and news page on our website, like how Anduril or Palantir have it; authors, stock images, sources, etc. Varying types of things, opinion vs fact. Not now, but get the structure set up."

The site already builds public pages from files in the repo ([DEC-0023](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)) and takes its address, names and share cards from one place ([DEC-0038](0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md)). The site is on a temporary address, so nothing is pushed to search engines. The copy rules in [REF-0017](../reference/0017-parity-copy-rules.md) apply to every public page.

### What Anduril and Palantir do

We loaded both newsrooms in a browser on 25 October 2026.

| | Anduril, [anduril.com/news](https://www.anduril.com/news) | Palantir, [palantir.com/newsroom](https://www.palantir.com/newsroom/) and [blog.palantir.com](https://blog.palantir.com/) |
| --- | --- | --- |
| Front of the section | Black page, one large featured post with its picture, then a grid of posts | A hub with one link per stream: media coverage, press releases, blog, letters from the CEO, thought leadership, investor news |
| Filters | A search box and a filter button | One page per stream. The blog has topic tabs (engineering, company, AI, life at Palantir, privacy) |
| List item | Date, title, picture, "Read more" | Press releases: date and title, grouped by year |
| Paging | Numbered pages (21 of them) | Year headings for press releases. The blog loads more as you scroll |
| Article | Title, date, a house byline ("By Anduril Industries"), share buttons for X, LinkedIn and Reddit, a wide picture, then the text | Blog posts carry the writer's own name, a reading time and a hero picture |
| For machines | An RSS feed with a picture per item, Article and NewsArticle schema, `article:published_time` and `article:section` tags | The blog has an RSS feed |
| Press versus editorial | One stream, everything is "News" | Kept apart: press releases, editorial blog and outside coverage each have their own page |

What we took: the featured post on top, a grid with real pictures, filters as plain links, numbered pages, a house byline for team work, share links, RSS, NewsArticle schema, and Palantir's split between company news and editorial. What we left: Palantir's hub of many streams (we have two) and the all-caps labels both sites put over titles, which [REF-0017](../reference/0017-parity-copy-rules.md) rule 6 rules out. The type and stance label sit under the title instead, in sentence case.

## Decision

### Content model

Posts are Markdown files in `content/newsroom/posts/`, with TOML front matter between two `+++` lines. Drafts sit in `content/newsroom/drafts/`. TOML is read by Python's standard library, so the build needs no extra package and a typo fails loudly.

| Field | What it holds |
| --- | --- |
| `title`, `dek`, `slug`, `date`, `updated` | The headline, the line under it, the address and the dates |
| `type` | Research, Analysis, Opinion or Explainer (blog), News, Company update or Press release (news page) |
| `stance` | Fact-based reporting, Analysis or Opinion. Required and shown on the page |
| `status` | draft, review or published. Only published builds publicly |
| `authors`, `tags`, `markets`, `related` | Bylines from `content/newsroom/authors.toml`, topic tags, markets as free text, other posts |
| `[hero]`, `[[images]]` | Pictures with alt text, credit, licence and source page |
| `[[sources]]` | Title and URL, or `ref` to a key in our references file. Cited in the text as `[^id]` and shown as numbered references |
| `[[corrections]]` | A dated log of fixes, shown at the end of the post |
| `disclosure` | Defaults to "Research and education only. Not investment advice." |
| `sample`, `featured` | A sample banner and noindex; the large spot at the top of a section |
| `[review]` | For machine-written drafts: which job wrote it, who approved it and when |

### The rules the build enforces

`scripts/newsroom/model.py` checks every post before anything is written. CI runs the same check and its tests on every pull request.

- An Opinion post must carry the Opinion label, and nothing else may. News, Company update and Press release must be Fact-based reporting. Analysis must be Analysis.
- Research, Analysis and News posts must list at least one source, and every `[^id]` in the text must match one.
- Every image needs alt text. Photos and outside images need a credit and an allowed licence: Unsplash License or Pexels License with the photo's page on that site, CC0, CC BY 4.0, public domain, or our own work. Images from sites whose licence does not allow reuse cannot be used.
- No em dashes, en dashes, curly quotes or ellipsis characters.
- A post written by a machine cannot be published until `review.approved_by` names a team member and `review.approved_on` is set.
- After the pages are built, each post's page is checked for its stance label, so a template change cannot drop it.

### Bylines

We do not invent writers. A made-up name and face presented as staff would be a false byline.

- **Team members.** Amanda Sourivong and Abanish Khadka, both "Co-founder, Parity", and Ayan. No photos: the author page shows their initials until they supply a picture. Amanda's one-line bio is drawn only from her pull requests in this repository and is marked "pending author review" in the file. Abanish has no bio until he supplies one. No employers, schools or credentials are added that they have not given us.
- **House bylines.** Parity Research, Parity Markets Desk and Parity Editorial, for work the team did together. They are always named for Parity, show the Parity mark rather than a face, and are marked up as an organisation, not a person.

Every byline has a page at `/authors/<id>/` listing its posts. The three samples use house bylines, because none of them draws on Amanda's or Abanish's own work in the repo.

### Images

- **Charts from our own data** come first. A post names a chart from `scripts/newsroom/charts.py`, which reads the catalog when the site builds, so the numbers on the picture are always current and the caption names the file they came from. Charts never read results, the ledger or `/data/` ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)).
- **Photos and our own graphics** go through `web/scripts/newsroom-media.mjs`: AVIF, WebP and JPEG at 480, 960 and 1600 pixels wide (never wider than the original), a tiny blurred copy shown while the picture loads, width and height on every image so the page does not jump, and lazy loading below the fold.
- **Share cards.** Each post gets its own 1200 by 630 card with the same layout and font as the other cards, drawn at build.

### Pages

| Address | What it is |
| --- | --- |
| `/blog/`, `/news/` | Featured post, category links, search, a grid of posts, numbered pages of 12 |
| `/blog/category/<type>/`, `/news/category/<type>/` | One page per type, so the filters work without script |
| `/blog/<slug>/`, `/news/<slug>/` | The article |
| `/authors/`, `/authors/<id>/`, `/tags/`, `/tags/<tag>/` | Bylines and tags |
| `/blog/feed.xml`, `/blog/atom.xml`, `/news/feed.xml`, `/news/atom.xml` | RSS 2.0 and Atom, newest 20, samples left out |

An article has, in order: the title, the dek, the stance label with a one-line note on what it means, the type, the byline, the dates and the reading time, the hero picture with its credit, the text with pull quotes and numbered citations, the sources, the corrections, the disclosure, tags and markets, share links (X, LinkedIn, email and Copy link) and three related posts. A thin bar at the top shows how far down the page the reader is. The structured data is AnalysisNewsArticle, OpinionNewsArticle, NewsArticle or Article, depending on the type.

The pages are static HTML in the style of the other public pages, built by `scripts/newsroom/build.py`, which `scripts/seo/build_public.py` calls at the end of `npm run build`. A small inline script adds the search box, the progress bar and Copy link. Everything else works without it. The header of every public page and the front page footer now link to Blog and News.

### Search engines

The section pages, real posts, author pages and tag pages go in `sitemap.xml`. They are left out of `seo-manifest.json`, so the deploy never sends them to IndexNow while the site is on its temporary address. Sample posts, later pages and drafts are marked noindex.

### Writing pipeline

- `npm run newsroom:new` starts a draft from a template.
- `npm run newsroom:preview` builds everything, drafts included, with a banner and noindex on every page, and serves it on 127.0.0.1.
- `npm run newsroom:check` runs the rules and their tests.
- `scripts/newsroom/hook.py` is how the SEO pipeline ([DEC-0023](0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)) can later propose a post. It only ever writes a draft with a house byline and `[review] generated_by`. It never publishes, commits or deploys.

How to write a post: [GDE-0009](../guides/0009-writing-a-blog-or-news-post.md).

## Alternatives considered

- **Fictional writers with names, faces and biographies.** Refused. It would mislead readers about who wrote a post.
- **A hosted blog (Medium, Ghost, a headless CMS).** Palantir's blog is on Medium. It would split the site's style, its share cards and its rules, and the checks above could not run before publishing.
- **MDX rendered by the React app.** Search engines read static pages more reliably, and the other public pages are static.
- **YAML front matter.** It needs a package Python does not ship, and it accepts many typos silently.
- **Opinion as a tag.** A tag can be forgotten. A required label that the build checks cannot.

## Consequences

- Adding a post is: `npm run newsroom:new`, write, set `status = "published"`, open a pull request. The site rebuilds when it merges.
- The three sample posts stay until the first real posts replace them. Delete them or set `sample = false` only for a real post.
- Amanda's bio waits for her review, and Abanish's for him to supply one.
- Moving to the real domain changes nothing here. The pages read their address from `site.json`.
- The image work needs Node and the `sharp` package at build. Without them the pages still build with the original files.
- Open: a press kit page, an email newsletter and syncing posts into the in-app News section are not built.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0073: Search and content run by themselves, with caps, a log and a kill switch](0073-search-and-content-run-by-themselves-with-caps-a-log-and-a-kill-switch.md)
- [GDE-0009: Writing a blog or news post](../guides/0009-writing-a-blog-or-news-post.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
