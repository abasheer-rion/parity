---
id: DEC-0071
title: People make their own API keys for a versioned Parity API
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [infra, process]
related: [DEC-0032, DEC-0046, DEC-0051, DEC-0064, DEC-0054]
---

# People make their own API keys for a versioned Parity API

## In plain words

Anyone with a Parity account can now make API keys in **Settings, API keys** and call the Parity API from their own programs at `/api/v1/` on the Parity site. The API serves tested strategies and their 11 test results, the strategy search leaderboard, public market data, news impact, and Verify checks on numbers you send. The guide with curl, Python and TypeScript examples is at `/developers/`, and the full description is at `/api/v1/openapi.json`.

A key is shown once. We keep only a fingerprint of it, so a copy of our database cannot be turned back into keys. Each key has scopes, an expiry (90 days unless you pick otherwise), an optional list of allowed addresses, and can be rotated with an overlap or revoked. Anyone who finds a leaked key can send it to us and it is revoked at once.

The API stays switched off, answering "not configured", until the owner sets one server secret.

## Context

- [DEC-0032](0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md) makes the API a business line, and the payments scaffold ([DEC-0046](0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md)) already has API plans and entitlements, but there was no API and no way to make a key.
- The hosted MCP server ([DEC-0051](0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)) already reads every dataset the API needs from the files the site publishes, through tested TypeScript. The API reuses those functions, so both always answer the same.
- Supabase is at its free plan's traffic limit. The API must not query Supabase on every request.
- Supabase's OAuth 2.1 server issues tokens through sign-in with a browser (authorization code with PKCE) only. It has no client credentials grant, so OAuth for servers does not fit today.

## Decision

1. **Key format.** `pk_test_` plus 43 base62 characters (32 random bytes from the platform's secure source) plus 6 base62 characters of CRC32 checksum. The fixed prefix and checksum let GitHub and other secret scanners find real keys with no false matches, and let us refuse a typo without a database read. `pk_live_` is reserved for paid plans.
2. **Storage.** Only HMAC-SHA-256 of the key, keyed with the server secret `PARITY_API_KEY_PEPPER`, plus the prefix and the last 4 characters. No person can read the HMAC column back: column grants leave it out. The key appears once, in the answer to the request that made it.
3. **Keys page.** Settings, API keys lists your keys (name, last 4, scopes, made, expires, last used, today's requests), makes keys (name, scopes, expiry of 30, 90, 180 or 365 days, optional IP allowlist), rotates them (the old key keeps working for 0, 1, 24 or 168 hours) and revokes them, and shows the last 20 key events. Up to 10 active keys per account.
4. **Making and rotating need the server** (`/api/keys`, which holds the pepper). Listing and revoking go straight to Supabase, where row rules show a person only their own rows. Only Parity's own session may make, rotate or revoke keys: a token issued to a connected AI app (it carries a client id) is refused, by the server and again by the database.
5. **No service role secret.** The API server looks a key up, records usage and revokes leaked keys through three database functions that take the key's HMAC. Only the server can compute it, because only it holds the pepper, and 256 bits cannot be guessed, so the HMAC is the proof.
6. **Versioned REST at `/api/v1/`** on Pages Functions: `Authorization: Bearer`, scopes per endpoint (`read:strategies`, `read:markets`, `read:verify`, `write:verify`), errors as RFC 9457 problem details, an OpenAPI 3.1 description generated from the same route table and input schemas the code checks against.
7. **Reads are cached, never per request from Supabase.** Data comes from the published `/data/` files through the worker's asset binding, cached for a minute. A key lookup is cached for 30 seconds in the worker and 30 in Cloudflare's cache, so a revoke takes up to a minute everywhere. Usage and request logs are sent in batches of 25 requests or 30 seconds.
8. **Limits per plan** from the entitlements: Free 30 a minute and 1,000 a day, API Starter 300 and 20,000, Platform 1,200 and 200,000. The minute limit is counted in each worker, the daily quota in the database across all of a person's keys. Answers carry `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and, on 429, `Retry-After`.
9. **Starting endpoints**, all read only and cached: strategies and one strategy with its 11 tests, the search leaderboard, market series and one series, a market snapshot, news impact, Verify's list of checks, and Verify on a posted trade list, equity curve or description (nothing stored). The Verify endpoints are now `/verify/trades`, `/verify/strategy` and `/verify/claim` ([DEC-0082](0082-verify-tools-and-endpoints-for-ai-apps-and-programs.md)). Market data is only what the site export may show publicly ([DEC-0064](0064-one-data-registry-finds-enrols-tests-and-watches-every-series-by-itself.md)): research-only and team-only series never appear.
10. **Leaked keys.** `POST /api/v1/leaked-keys` takes `{"key": ...}` or GitHub secret scanning's format and revokes each real key at once. Holding the key is the proof, so it needs no sign-in, and revoking a leaked key is always safe. It answers with each token's SHA-256, never the token, and is rate limited by address.
11. **No OAuth client credentials yet.** The Supabase OAuth server does not offer that grant. If it does later, it can issue tokens for the same scopes.
12. **No webhooks yet**, so no webhook signing. When they come, they get HMAC-SHA-256 signatures with a timestamp.

### Security, against the OWASP API Security Top 10 (2023)

- **API1 object level authorization:** the API serves no per-person objects. Key rows are read through row rules (`user_id = auth.uid()`); revoke and rotate check the owner in the function.
- **API2 broken authentication:** 256-bit random keys, checksum, HMAC with a server secret, a second constant-time comparison, expiry required, revocation, rotation, IP allowlists, leaked-key revocation.
- **API3 object property level authorization:** answers are built field by field by the shared tool functions; the HMAC column is not granted to anyone.
- **API4 unrestricted resource consumption:** per-minute and per-day limits, 1 MB bodies, at most 5,000 trades or points per Verify call, 10 tokens per leak report, and 20 unknown keys a minute per address before we stop looking them up.
- **API5 function level authorization:** each route names one scope and the server checks it before running anything.
- **API6 sensitive business flows:** at most 10 active keys; making keys needs a Parity session, never an AI app token.
- **API7 server side request forgery:** the API fetches nothing named by the caller. Data paths come from our own index.
- **API8 security misconfiguration:** HSTS on the whole site, `no-store` on keyed answers, problem details without stack traces, browsers on other sites refused (CORS allows only our own domains).
- **API9 improper inventory management:** one versioned prefix, an index at `/api/v1/` and a generated OpenAPI file.
- **API10 unsafe consumption of APIs:** database answers are checked field by field before use.

### What the owner sets (once, with approval)

The API answers 503 "not configured" until this exists. Nobody else sets it.

1. Make a random value of 32 bytes: `openssl rand -base64 32`.
2. Store it in Cloudflare Pages, project `parity-research`, as an encrypted secret named `PARITY_API_KEY_PEPPER`, for Production (and Preview if previews should work): `npx wrangler pages secret put PARITY_API_KEY_PEPPER --project-name parity-research`, or Settings, Variables and Secrets, Add, type Secret.
3. Add a row for it to the owner's credentials register and keep a copy in the owner's password manager.
4. Redeploy (or wait for the next deploy). A request to `/api/v1/strategies` on the site with any key then answers 401 instead of 503.

Changing the pepper later makes every existing key stop working, so treat it as permanent.

## Consequences

- People and partners can build on Parity with a key they manage themselves, and the plans in DEC-0046 now have something to meter.
- The API adds almost no Supabase traffic: about one lookup per key per minute per data centre and one usage write per 25 requests.
- Revoking takes up to a minute to reach every data centre, because lookups are cached. Leaked-key revocation clears the cache where it lands.
- The minute limit is per worker, so a burst spread over many Cloudflare locations can briefly exceed it; the daily quota holds overall.
- Live keys, paid metering to Stripe, webhooks and OAuth for servers are later steps.
- Files: `web/src/lib/api/`, `web/functions/api/v1/`, `web/functions/api/keys/`, `web/src/pages/ApiKeys.tsx`, `web/developers/index.html`, `supabase/migrations/20261109000000_api_keys.sql`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0079: Parity is an AI-native verification platform for retail traders of all sizes](0079-parity-is-an-ai-native-verification-platform-for-retail-traders-of-all-sizes.md)
- [DEC-0082: Verify tools and endpoints for AI apps and programs](0082-verify-tools-and-endpoints-for-ai-apps-and-programs.md)
<!-- backlinks:end -->
