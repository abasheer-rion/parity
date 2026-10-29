---
id: GDE-0005
title: Google Search Console and the SEO pipeline
type: guide
status: draft
created: 2026-10-22
updated: 2026-10-26
authors: [ayan]
tags: [process]
related: [DEC-0023, DEC-0073]
---

# Google Search Console and the SEO pipeline

## In plain words

The public pages, the sitemap and IndexNow already work without Google ([DEC-0023](../decisions/0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)). To get Google's numbers, the owner has to prove to Google that we own the site, then let our robot account read it. Steps 1 and 2 below are already done. Step 3 is one command for the owner; after that the deploy verifies the site and everything in step 4 runs by itself.

## Summary

What already exists:

- Google Cloud project: `parity-endyland-seo`, under the owner's personal Google account.
- Search Console API: enabled in that project.
- Service account: `parity-search-console@parity-endyland-seo.iam.gserviceaccount.com`.
- GitHub repo secret `GSC_SERVICE_ACCOUNT_JSON`: set to the service account's key.
- Weekly job: `.github/workflows/seo.yml` (Mondays, or run it by hand). Until step 3 is done it reports "no_access" and still passes.

## Steps

### 1. Google Cloud project (done)

For the record, this is how it was made. Never paste the key into a chat or a file in the repo.

```sh
gcloud auth login                       # the owner's personal Gmail
gcloud projects create parity-endyland-seo
gcloud config set project parity-endyland-seo
gcloud services enable searchconsole.googleapis.com
gcloud iam service-accounts create parity-search-console --display-name "Parity Search Console"
```

### 2. The key, stored safely (done)

The key was made once and stored as the GitHub secret `GSC_SERVICE_ACCOUNT_JSON`, without printing it. Keep one copy in the vault (macOS Keychain or the password manager) with a row in the credentials register: name, service (Google Cloud), account (the service account above), purpose (Search Console reports), scope (Search Console only), created date and expiry. If a key is ever shown on screen, delete it in Google Cloud and make a new one.

### 3. Turn on the Site Verification API (owner, one command)

The deploy verifies the site by itself with the HTML tag method ([DEC-0073](../decisions/0073-search-and-content-run-by-themselves-with-caps-a-log-and-a-kill-switch.md)). For that, the Google Cloud project needs one more API:

```sh
gcloud services enable siteverification.googleapis.com --project parity-endyland-seo
```

After the next production deploy, the service account asks Google for a tag, the build puts it in the front page, and the deploy asks Google to check it. The property is the URL-prefix one for the site's address in `web/src/lib/site.json` (paritytrading.app since 26 October 2026, [DEC-0069](../decisions/0069-parity-moves-to-paritytrading-app.md)). No DNS record is needed.

To see the property in your own Search Console, set the repository variable `GSC_OWNER_EMAILS` to your Google address (a comma list for more). The deploy adds each one as an owner.

If you prefer to verify by hand: in Search Console add a URL-prefix property, pick "HTML tag", copy only the `content` value into the repository variable `GSC_VERIFICATION` (not a secret), rerun "Deploy dashboard", then click Verify. Then add the service account under Settings, Users and permissions, with **Full** permission.

A Domain property (`sc-domain:paritytrading.app`) is optional and needs a DNS TXT record. Only the owner changes DNS: note the current records first, then add the TXT record Google shows.

The old `endyland.com` addresses redirect with a 301. In Search Console, use the Change of Address tool only if an `endyland.com` property was ever verified.

### 4. What runs by itself

- **Every production deploy:** sitemaps rebuilt, IndexNow told what changed, the sitemap index submitted to Search Console, the tag verified.
- **Mondays:** the "SEO report" job. Coverage from the URL Inspection API, queries, clicks, rankings and their change against the four weeks before, keyword suggestions and pages that need links. On the run page and in the `seo-report` artifact.
- **The content engine** ("Auto posts"): market comparison on Saturdays, news commentary checked daily (two a week at most), press release on Fridays.
- **Status:** every 30 minutes with the live feed probe. The site redeploys only when the warnings change.

### 5. Stop any of it

Set the repository variable `SEO_AUTOMATION` to `off` to stop every job, or to a comma list such as `news_commentary,press_release` to stop some. Or set a switch to false in `content/seo/automation.toml`. Each run logs what it did in its summary and artifact.

### 6. Language model drafting (owner, optional)

News commentary is written from templates until Parity has its own key. To allow model drafting, create a key under a Parity account, store it in the vault as `parity-anthropic-api-key` (or `parity-openai-api-key`) with a row in the credentials register, and add it as the repository secret `PARITY_ANTHROPIC_API_KEY` (or `PARITY_OPENAI_API_KEY`). Model drafts publish only after the automatic fact checks pass.

### Bing (optional)

In Bing Webmaster Tools, choose "Import from Google Search Console" after step 3. Bing already hears about changed pages through IndexNow after every deploy. For a tag instead, set the variable `BING_VERIFICATION`.

## Good to know

- **Google's Indexing API is not for us.** Google allows it only for job postings and live event pages. Sitemaps are the supported way.
- **The IndexNow key is public by design.** It is the file `web/public/86c7d7885454f6b74980f4cc83667fd6.txt`. It proves we own the site and is not a secret.
- **New pages appear by themselves.** Add a glossary term, a catalog idea or a doc with an "In plain words" section, and the next deploy publishes it, adds it to the sitemap and pings IndexNow.
- **Run it locally:** `cd web && npm run build`, then open `dist/learn/`. `python3 scripts/seo/search_console.py` without the key just says it skipped.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0023: Public pages search engines can read, and a pipeline that keeps them fresh](../decisions/0023-public-pages-search-engines-can-read-and-a-pipeline-that-keeps-them-fresh.md)
- [DEC-0069: Parity moves to paritytrading.app](../decisions/0069-parity-moves-to-paritytrading-app.md)
- [DEC-0073: Search and content run by themselves, with caps, a log and a kill switch](../decisions/0073-search-and-content-run-by-themselves-with-caps-a-log-and-a-kill-switch.md)
<!-- backlinks:end -->
