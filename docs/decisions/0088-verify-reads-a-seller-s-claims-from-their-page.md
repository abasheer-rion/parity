---
id: DEC-0088
title: Verify reads a seller's claims from their page
type: decision
status: accepted
created: 2026-11-03
updated: 2026-11-03
authors: [ayan]
tags: [method, ui]
related: [DEC-0079, DEC-0081, DEC-0082, DEC-0083, DEC-0051, REF-0030]
---

# Verify reads a seller's claims from their page

## In plain words

A trader can now paste the address of a seller's page on `/verify/`, such as a bot's sales page, a signal's statistics page or a public account page, and Verify lists every claim on it: returns, win rate, largest fall, number of trades, how long it ran and more. Each claim shows the words it came from, with a link that opens the page at those words. Attach the account's trade history and each claim is set against it: agrees, differs, or cannot be checked from that record. Without a record, each claim says what would check it. Pasting the words works the same way. The API and the AI tool `verify_claim` take an address too. The page is read once by our server, only where the site allows it, with no login, and nothing is kept.

## Context

On 3 November 2026 the owner asked for "the actual product" ([DEC-0083](0083-verify-runs-a-strategy-from-its-code-on-our-prices.md)). Verify could already check a claim typed as words or fields ([DEC-0082](0082-verify-tools-and-endpoints-for-ai-apps-and-programs.md)), but most claims a trader meets are on a page, and checking one meant copying numbers by hand into the file form, three at a time.

What we found on 3 November 2026 when reading the common pages as a program would:

- MQL5 signal pages are written on the server with labelled values, and their robots.txt allows them ([MQL5 Signals](https://www.mql5.com/en/signals)).
- FX Blue account pages allow readers but fill in their numbers with scripts after the page opens, so the HTML has none ([FX Blue robots.txt](https://www.fxblue.com/robots.txt)).
- Myfxbook answers automatic readers with a bot check.
- X asks every automatic reader to stay out, and so does its embed service ([X robots.txt](https://x.com/robots.txt)).

## Decision

1. **One reader, three ways in.** `POST /api/verify/claim-url` for the page (a Pages Function, public like the page), `url` on `POST /api/v1/verify/claim`, and `url` on the MCP tool `verify_claim`, all on `web/src/lib/verify/claims/fetch.ts`.
2. **Only where allowed.** robots.txt is read first and followed as [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) says, for our product token `ParityVerify`. No cookies or login are ever sent; a login wall or a bot check is reported, not worked round. X is refused before any request, with the reason. Only http and https on ports 80 and 443, a real host name (no IP addresses or local names), at most 3 redirects each checked again, the first 2 MB, 8 seconds.
3. **Limits and a log.** The page's endpoint answers only our own pages (the Origin header), 6 pages a minute per address and 120 a minute in all, held in the worker's memory. One log line per call: the host, the result and the time, never the full address or the page. `CLAIM_URL_ENABLED=off` switches it off. The API and the MCP tool keep their own limits.
4. **Fixed patterns first** (`extract.ts`): labelled values on statistics pages and claims in sentences, in a fixed order, so the same words always give the same claims. Each keeps its words and where they are. A label beats a sentence; of several drawdowns the largest is used, the reading kindest to the seller. Negations ("No martingale, no grid") are respected. Forecasts, leverage, fees and risk per trade are not claims. Tested on small made-up pages that copy the layouts we saw (`web/tests/fixtures/verify/pages`, `SOURCES.md`).
5. **The person's own model only if they have connected one** ([DEC-0051](0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)): "Ask my AI model for more" sends the page's words from the browser to their provider with their key. Every claim it returns must quote words that are on the page, or it is left out and counted. Parity never pays for a model call.
6. **Against a record** (`against.ts`): win rate, monthly return, largest fall and now total return can change the verdict; number of trades, profit factor, start date, length of time and yearly return are shown and do not. Pips and a site's own Sharpe ratio are not compared. "Claim against file" also compares the total return (method `verify-1.2`): more than 5 points and more than a tenth apart fails it, unless the claim names a length of time more than a quarter away from the record's.

## Alternatives considered

- **Log in or get round bot checks to read more pages.** Rejected: the owner asked for no logins, and a site that says no means no.
- **A paid model reads every page.** Rejected: answers would change from one run to the next, and Parity does not pay for model calls.
- **Use X's embed service for posts.** Rejected: its robots.txt rules it out. People paste a post's words instead.

## Consequences

- A trader can go from a seller's page to a verdict on the record behind it in two steps, with every number traceable to its words.
- Pages that build themselves with scripts, or block readers, still need the words pasted. The page says which.
- The method version is `verify-1.2`; badges made before keep `verify-1.1`.
- Files: `web/src/lib/verify/claims/`, `web/functions/api/verify/claim-url.ts`, `web/public/_routes.json`, `web/src/pages/verify/ClaimInput.tsx`, `web/src/pages/verify/report/Claims.tsx`, `web/src/lib/mcp/verify.ts`, tests in `web/tests/verify/claims-page.test.ts`, `web/tests/verify-ai.test.ts` and `web/e2e/verify-report.spec.ts`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0089: Every Verify check ends in one report that can be shared and printed](0089-every-verify-check-ends-in-one-report-that-can-be-shared-and-printed.md)
- [REF-0030: Parity Verify methodology](../reference/0030-parity-verify-methodology.md)
<!-- backlinks:end -->
