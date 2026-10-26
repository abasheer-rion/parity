---
id: DEC-0051
title: AI apps connect to Parity through a hosted MCP server, and people bring their own model
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-27
authors: [ayan]
tags: [infra, process, ui]
related: [RES-0024, DEC-0025, GDE-0006, DEC-0034, DEC-0040, DEC-0036]
---

# AI apps connect to Parity through a hosted MCP server, and people bring their own model

## In plain words

Parity has no AI model of its own, so people use the AI they already pay for. There are two ways in.

**Your AI app connects to Parity.** Parity now has a public MCP server at `https://parity.endyland.com/mcp`. Paste that address into Claude, ChatGPT, Gemini CLI, Cursor, VS Code or Codex. The app opens a Parity sign-in page, you log in and choose Allow, and the app can look up tested strategies and their 11 tests, run Verify on numbers, read market data and news impact, and read Academy lessons. It acts as you and sees only what you can see. It cannot change anything unless you tick "May make changes" for that app, and even then only demo orders and Trade layouts. The how-to page is `/connect/`.

**Parity calls your model.** Workbench, Verify and Trade get a small "Ask AI" panel. You connect OpenRouter with a real sign-in, or paste an Anthropic, OpenAI or Google key. The key stays in your browser and goes straight to that company: your key, your bill. The panel is off until the owner turns it on.

The research behind this is [RES-0024](../research/0024-ai-apps-connecting-to-parity-and-bringing-your-own-model.md).

## Context

- The local server `parity mcp` ([DEC-0025](0025-ai-assistants-get-parity-tools-through-a-local-mcp-server.md)) needs the repo and Python, and ChatGPT only takes servers on the internet. The owner item "hosted MCP for ChatGPT" was open.
- The hosted server runs on Cloudflare Pages Functions next to the site. Python backtests cannot run there, so the hosted tools read what the site already publishes (`/data/...`) and the person's own rows in Supabase. Verify's checks are TypeScript and run there unchanged.
- Parity already signs people in with Supabase Auth, whose OAuth 2.1 server can sign in MCP apps. Its tokens are ordinary Supabase tokens for that person, so the database's row rules apply to everything an app reads. The only scopes it issues are openid, email, profile and phone.

## Decision

1. **Supabase Auth is the sign-in server.** We do not run our own. `/.well-known/oauth-protected-resource/mcp` names `https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1`; a call without a valid token gets a 401 pointing there. `/.well-known/oauth-authorization-server` on our host copies Supabase's metadata for older apps.
2. **The consent page is `/oauth/consent/`.** It shows which app is asking, where you return to, and what it can do, with "Also let it make changes" unticked. `/connect/` lists the apps you connected, with that same choice and Disconnect.
3. **One endpoint, both MCP eras, no state.** `web/functions/mcp.ts` answers MCP 2026-07-28 (headers checked against the body, `server/discover`) and 2025-03-26 to 2025-11-25 (an `initialize` handshake, no session id). Every answer is plain JSON. GET and DELETE get 405. Browser calls are allowed only from our own domains, localhost, and the web apps of AI clients (claude.ai, chatgpt.com, vscode.dev and a few more, listed in `web/src/lib/mcp/auth.ts`). That is safe because `/mcp` takes only a bearer token, never a cookie.
4. **Read tools:**
   - `search_strategies` and `get_strategy`: tested strategies, with the gauntlet verdict and all 11 tests.
   - `search_leads`: the always-on search's best variations, with the luck check.
   - `verify_record` and `verify_description`: Verify's checks on numbers the app sends. They run in memory and are not stored.
   - `list_market_series` and `get_market_series`: delayed market data, thinned.
   - `news_impact`: what followed kinds of news, against random days.
   - `list_academy_lessons` and `get_academy_lesson`: the courses, from `/data/academy/courses.json`, which the site build writes.
   - `search` and `fetch`: the pair ChatGPT uses for company knowledge.
   - `list_demo_accounts`: your demo accounts.
5. **Write tools, off twice.** `place_demo_order` (limit and stop orders only, virtual money) and `save_trade_layout` are listed only while the Pages variable `MCP_WRITE_ENABLED` is `on`. Even then they run only for an app the person allowed in `ai_grants`, and they go through database functions that check that grant again.
6. **Connected apps read but never write directly.** A token issued to an app carries a `client_id`. Restrictive row rules on every table people write to block inserts, updates and deletes from such tokens. So an app cannot use its token to go around our tools, and it can never grant itself changes. The person's browser, the desktop app and the assistant panel have no `client_id` and are unaffected. A new table people write to should get the same three rules.
7. **Limits and a log.** For each person, across every app: 30 calls a minute, 1000 a day, 30 changes a day. Each call is logged in `mcp_calls` with the app, the tool, the time, ok or not and how long it took. Arguments and results are not stored. Rows go after 90 days. If the log cannot be written, the call does not run.
8. **Bring your own model.** OpenRouter connects with OAuth and PKCE, the only open sign-in that gives an app a key on the person's own bill without registering the app. Anthropic, OpenAI and Google take a pasted key. Keys live in the browser's local storage on that address only. They go straight from the browser to the provider and never reach Parity, its logs or a URL. The panel calls the same `/mcp` tools with the person's Parity session, so it only reads.
9. **The panel is off by default.** It shows only when the build has `VITE_AI_ASSISTANT=on` (the repository variable `AI_ASSISTANT`), or when a browser opts in with `?assistant=on` to try it first.

## Consequences

- Nothing connects until the owner switches on Supabase's OAuth server. Until then `/mcp` answers 401 and the sign-in page cannot start.
- The hosted tools cannot backtest or run the gauntlet; that needs Python. The local server keeps doing that. A later hosted backtest would need a service with the engine behind it.
- Supabase's tokens carry the audience `authenticated`, not our server's address, so the audience check is the issuer and audience Supabase sets. The MCP spec asks for an audience tied to the server. An access token hook could add it later.
- Supabase does not support custom scopes, so "may make changes" is our own per-app setting rather than an OAuth scope. Apps will not show it on their side.
- A connected app can read everything the person can read through Supabase directly, including their demo accounts and payment rows. That is the same as signing in as them, and the consent page says it acts as you.
- An app holds a real Supabase token, so it could call the two change functions straight from the database rather than through `/mcp`. They still need the person's per-app permission, and each change needs a call started with `mcp_begin_call`, which counts it against the limit of 30 a day. The `MCP_WRITE_ENABLED` switch only hides the tools on `/mcp`, so the database rule is the real gate. Orders are always dated today, so an app cannot backdate one against prices it has already seen.
- The `/oauth/` pages and `/.well-known/` are never cached by the service worker.
- Each app has its own setup page: `/connect/claude/`, `/connect/chatgpt/` and `/connect/gemini/`, plain HTML built from `web/connect/<app>/index.html` with shared parts in `web/plugins/guides.ts`. `/connect/` stays the hub. The directory submission materials are in [REF-0027](../reference/0027-ai-connector-directory-submissions-for-claude-chatgpt-and-gemini.md).

## Owner steps

Nothing below was done by us. Each is an exact step.

1. Supabase dashboard, project `ttqvpxvctnomfbeoqbbs`: Authentication, then OAuth Server. Turn on the OAuth server. Turn on dynamic client registration. Set the authorization path to `/oauth/consent`. Check the Site URL is `https://parity.endyland.com`.
2. Before step 3 below, and before telling people about write access: with a token issued to a test app, check that Supabase Auth refuses password changes and new two-step factors (`PUT /auth/v1/user`, `POST /auth/v1/factors`). The repo's `supabase/config.toml` asks for a fresh sign-in before a password change, but we could not confirm the live project matches. If an app's token can do either, keep `MCP_WRITE_ENABLED` off and tell us.
3. Optional: to allow AI-made demo orders and layouts, set the Cloudflare Pages variable `MCP_WRITE_ENABLED=on` on the `parity-research` project. People still have to tick it per app.
4. Optional: to show the assistant panel to everyone, set the GitHub repository variable `AI_ASSISTANT=on`, then redeploy.
5. Optional: `MCP_ENABLED=off` on the Pages project switches `/mcp` off at once.
6. Optional, for Hugging Face as a sign-in provider: register a Hugging Face OAuth app with the `inference-api` scope. Not built.
7. No keys, OAuth apps or accounts were created at any provider, and no DNS was changed. A separate subdomain such as `mcp.endyland.com` is not needed; it remains an option.

## Manual test plan

Run after owner step 1, on a test account.

**Claude (claude.ai):**

1. Settings, then Connectors, then Add custom connector. Name "Parity", address `https://parity.endyland.com/mcp`. Choose Connect.
2. Expect the Parity log-in page, then the consent page naming Claude, with "Also let it make changes" unticked. Choose Allow. Expect to land back in Claude, connected.
3. Ask "Using Parity, which strategies beat the S&P 500?" Expect a `search_strategies` call and an answer that matches the Discover page.
4. Ask "Check these trades with Parity Verify:" with a few dates and profits. Expect `verify_record` and a verdict.
5. Ask it to place a demo order. Expect it to say changes are not allowed (or that the tool does not exist, while `MCP_WRITE_ENABLED` is off).
6. On `/connect/`, see Claude listed. Tick "May make changes" (with `MCP_WRITE_ENABLED=on`) and retry step 5: a pending limit order appears in Parity Trade's Orders.
7. Choose Disconnect. The next Claude call must fail and ask to sign in again.

**Claude Code:** `claude mcp add --transport http parity https://parity.endyland.com/mcp`, then `/mcp`, choose parity, sign in. Ask for `get_strategy` on any id.

**ChatGPT:**

1. Settings, then Apps and Connectors, then Advanced: turn on developer mode. Create a connector with the address and OAuth.
2. Sign in and allow as above. Expect ChatGPT to show the read tools.
3. Ask a question that needs `search` then `fetch`. Expect a strategy page's numbers.

**Checks for both:**

- In Supabase, `select tool, client_id, ok, ms from mcp_calls order by id desc limit 20` as the test user shows each call, with no arguments.
- More than 30 calls in a minute gets the limit message.
- A forged or expired token gets 401 with the `resource_metadata` header (`curl -i -X POST https://parity.endyland.com/mcp`).

**Assistant panel:** open `/lab/?assistant=on`. Choose Connect OpenRouter, approve at OpenRouter, and expect to return connected. Ask "What does the gauntlet test?" and expect tool chips such as `list_academy_lessons`. Paste an Anthropic key instead and ask again. Choose "Forget all keys" and check local storage holds no `parity.ai.key.*`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0054: The data model is strict, indexed and keeps an append-only trade ledger](0054-the-data-model-is-strict-indexed-and-keeps-an-append-only-trade-ledger.md)
- [DEC-0060: A getting started checklist and first-run tours, and no bank details until a broker partner](0060-a-getting-started-checklist-and-first-run-tours-and-no-bank-details-until-a-broker-partner.md)
- [DEC-0069: Parity moves to paritytrading.app](0069-parity-moves-to-paritytrading-app.md)
- [DEC-0071: People make their own API keys for a versioned Parity API](0071-people-make-their-own-api-keys-for-a-versioned-parity-api.md)
- [RES-0024: AI apps connecting to Parity, and bringing your own model](../research/0024-ai-apps-connecting-to-parity-and-bringing-your-own-model.md)
- [RES-0026: Laws and rules that apply to Parity now and later](../research/0026-laws-and-rules-that-apply-to-parity-now-and-later.md)
- [GDE-0006: Connecting AI tools to Parity with MCP](../guides/0006-connecting-ai-tools-to-parity-with-mcp.md)
- [REF-0021: Parity database schema and data model](../reference/0021-parity-database-schema-and-data-model.md)
- [REF-0027: Going live with real trading](../reference/0027-going-live-with-real-trading.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
