---
id: DEC-0069
title: Parity moves to paritytrading.app
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [infra]
related: [DEC-0038, DEC-0041, DEC-0051, DEC-0062, DEC-0023]
---

# Parity moves to paritytrading.app

## In plain words

Parity now lives at `paritytrading.app`. The front page, the product app (`/app/`) and Research (`/research/`) are on the main address, and Trade, the Terminal, Academy and Workbench each have their own: `trade.`, `sim.`, `academy.` and `lab.paritytrading.app`. `www.paritytrading.app` sends people to the main address. The old `endyland.com` addresses send people to the same page on the new domain, except for a few paths that old apps and old emails still need, which keep working there until 25 November 2026. People sign in once more on the new domain, because a browser never shares a sign-in between two different domains. Sign-in emails now come from `no-reply@paritytrading.app` and their links point at the new domain. Desktop 0.2.3 opens the new domain and checks it for updates.

## Context

The site ran on a borrowed address, `parity.endyland.com`, with its apps on `sim.`, `trade.`, `academy.` and `lab.endyland.com` ([DEC-0038](0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md) kept the address in one place for this move). The owner approved the move to `paritytrading.app` on 26 October 2026. The zone is in the same Cloudflare account as `endyland.com`, and every address is served by the same Pages project, `parity-research`.

## Decision

### Before and after

| What | Before | After |
| --- | --- | --- |
| Front page, `/app/`, `/research/`, `/connect/`, `/mcp` | `parity.endyland.com` | `paritytrading.app` |
| Trade, Terminal, Academy, Workbench | `trade.`, `sim.`, `academy.`, `lab.endyland.com` | `trade.`, `sim.`, `academy.`, `lab.paritytrading.app` |
| `www` | none | `www.paritytrading.app`, a 301 to the main address |
| Sign-in cookie | shared on `.endyland.com` | shared on `.paritytrading.app`; `.endyland.com` still works on the old hosts |
| Supabase Site URL | `https://parity.endyland.com` | `https://paritytrading.app`, so the OAuth consent page is `https://paritytrading.app/oauth/consent` |
| Auth email sender | `no-reply@parity.endyland.com` (Resend domain `parity.endyland.com`) | `no-reply@paritytrading.app` (Resend domain `paritytrading.app`) |
| Desktop app | opens and updates from `parity.endyland.com` | 0.2.3 opens and updates from `paritytrading.app` |

### How it is set up

1. **Addresses.** Six Pages custom domains on `parity-research`, each a proxied CNAME to `parity-research.pages.dev` in the `paritytrading.app` zone. The apex uses Cloudflare's CNAME flattening. The old five custom domains stay attached.
2. **Code.** `origin` in `web/src/lib/site.json` is `https://paritytrading.app`. A new `legacy` list in the same file names `endyland.com` and its main host, `parity.endyland.com`. `siteDomainOf()`, `mainHostFor()` and `originsFor()` in `web/src/lib/meta.ts` use it, so a page on an old host keeps its links, its cookie and the middleware's "back to the main address" redirect on that old domain, and a page on the new domain uses the new one. The safe-`next` check, the live feed's CORS list and the MCP server's allowed browser origins accept both domains. The desktop app trusts both domains and maps both onto its in-app paths (`LEGACY_DOMAINS` in `desktop/electron/routes.js`, kept equal to `site.json` by a test), but opens new pages on the new domain only.
3. **Redirects.** One account-level Bulk Redirect list, `parity_domain_move`, and one rule in the account's `http_request_redirect` phase. Each Parity host on `endyland.com` (`parity.`, `sim.`, `trade.`, `academy.`, `lab.`) sends a 301 to the same host on `paritytrading.app` (`parity.` goes to the apex), with the path and query kept. The browser keeps a `#/...` part across a redirect by itself. The rule skips these paths on the old hosts until 25 November 2026, so nothing loops and nothing old breaks: `/live/*` (old apps' live prices), `/mcp` and `/.well-known/*` (AI apps already connected), `/desktop/updates/*` (desktop 0.2.2 and older), `/verify/`, `/oauth/*`, `/auth/*` and a `/login/` that carries a `code=` (links in emails already sent and sign-ins already started). The same list sends `www.paritytrading.app` to the apex. A zone Redirect Rule was the first choice, but the API token cannot write that phase; Bulk Redirects needed no new key. No other `endyland.com` record or rule was changed.
4. **Search engines.** No indexing requests. The public pages on the new domain have no `noindex`, the subdomain apps and `www` say `noindex, nofollow`, and so does `parity.endyland.com` for the paths it still serves. The SEO report now looks for the `sc-domain:paritytrading.app` property. The owner's steps are in [GUIDE-0005](../guides/0005-google-search-console-and-the-seo-pipeline.md).
5. **Email.** Resend domain `paritytrading.app` (DKIM `resend._domainkey`, SPF and MX on `send.`, and the `rsend` tracking CNAME), added with the existing Resend key. Supabase's SMTP sender changes only after Resend shows the domain as verified.
6. **Copy.** The privacy and cookie pages, the desktop README, the guides and the email templates name the new domain.

### Rollback

Each step undoes on its own, newest first. The records from before the move are in `~/.config/parity/dns-backups/*-20261026T222704Z.json` and `~/.config/parity/supabase-auth-backups/auth-config-20261026T222704Z.json` on the dev box.

1. Redirects: delete the rule in the account `http_request_redirect` phase and the `parity_domain_move` list. The old hosts serve the site again at once.
2. Supabase: set Site URL back to `https://parity.endyland.com` and the sender back to `no-reply@parity.endyland.com` (the old Resend domain is still verified). The extra allow-list entries can stay.
3. Code: revert this change (set `origin` in `site.json` back to `https://parity.endyland.com` and drop `legacy`), then redeploy. Desktop 0.2.3 still works on the old domain, since it trusts it, but its update check would then need the redirect from `paritytrading.app/desktop/updates/` or a 0.2.4.
4. Domains: remove the six `paritytrading.app` custom domains from `parity-research`, then delete their six CNAME records, the four Resend records and the two firewall rules in the `paritytrading.app` zone, and the Resend domain `paritytrading.app`.

## Consequences

- Everyone signs in once more on the new domain. Nothing else is lost: accounts, data and connected AI apps live in Supabase, not in the address.
- After 25 November 2026, remove the skipped paths from the redirect rule, remove `legacy` from `site.json` and `LEGACY_DOMAINS` from the desktop app, drop the `endyland.com` entries from the Supabase allow-list, and detach the five `endyland.com` custom domains if nothing still needs them.
- Owner steps: verify `paritytrading.app` in Google Search Console as a Domain property (DNS TXT) and add the service account, and decide whether to add a DMARC record for `paritytrading.app`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [GDE-0005: Google Search Console and the SEO pipeline](../guides/0005-google-search-console-and-the-seo-pipeline.md)
<!-- backlinks:end -->
