---
id: DEC-0079
title: Parity is an AI-native verification platform for retail traders of all sizes
type: decision
status: accepted
created: 2026-10-27
updated: 2026-10-27
authors: [ayan]
tags: [method, process, ui]
related: [INT-0003, DEC-0032, REF-0016, DEC-0036, DEC-0051, DEC-0071, DEC-0015]
---

# Parity is an AI-native verification platform for retail traders of all sizes

## In plain words

Parity now does one thing up front: it checks whether a trading record holds up. You can do that on the website, through the API, or from the AI you already use, such as Claude or ChatGPT. It works for a strategy, a bot, a list of trades or a seller's claim. Everything else we built (the Trade app, Sim World, the Academy, the Workbench and the Terminal) stays online, but it is no longer what the front page and the menus lead with.

The line we use is: **AI-native verification platform for retail traders of all sizes.**

## Context

On 27 October 2026 the owner said (paraphrased): cut scope to Verify right now. Keep the larger site as something to keep working on. For now, Verify is reached through the website, the API or a connector, and checks algos, trades and whatever else we can isolate. Put a tagline on it and make it defensible.

Before this, Parity had grown into many products at once: a trading app, a simulator, courses, a research workbench and a terminal, with Verify as one page among them ([INT-0003](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md) already named Verify as the product). The parts Verify needs already exist:

- the checks, run in the browser ([DEC-0036](0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md));
- a hosted MCP server that AI apps sign in to ([DEC-0051](0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md));
- API keys and a versioned API ([DEC-0071](0071-people-make-their-own-api-keys-for-a-versioned-parity-api.md));
- public badges with withdrawal kept visible ([REF-0016](../reference/0016-parity-verify-mvp-spec.md)).

## Decision

### 1. What Parity is

Parity checks trading records. It says whether a strategy, bot, trade history or claim holds up, why, and how many tries it would survive. It gives no advice and never ranks by return.

"AI-native" means two concrete things, not a model of our own:

- AI apps and agents can call Verify directly, through MCP tools and the API, so an agent can check a strategy before a person ever sees it.
- The checks are built for the way AI writes strategies: fast, many tries, tuned to the past. Counting tries is the core of the method.

"Retail traders of all sizes" means one person checking a bot they are about to buy, up to a trader showing a record to a prop firm or investors.

### 2. In scope now

| Way in | What it does |
| --- | --- |
| Verify on the web | `/verify/`: upload a trade file, describe a bot, pick a tested strategy or paste a claim. Checking needs no account; publishing a badge does |
| Verify API | `/api/v1/verify/...` with a personal API key, documented first on `/developers/` |
| Verify through AI connectors | MCP tools `verify_trades`, `verify_strategy` and `verify_claim` on the hosted server, with example prompts on `/connect/` for Claude, ChatGPT, Gemini and agents |
| Trade imports | CSV exports from common brokers and exchanges first. Read-only API connections are built as a switched-off scaffold until a connection can be offered safely |
| Shareable badges | A public record page per badge, an image badge and embed snippets. Withdrawn badges stay listed as withdrawn |
| Methodology | A public, versioned page at `/methodology/` describing every check, which anyone can cite |

### 3. Parked, still live

The Trade app, Sim World, the Academy, the Workbench (lab) and the Parity Terminal stay online at their addresses and keep their data jobs running. They move out of the main path: the front page links to them in a small "Explore Parity" area, and they get fixes but no new features unless a feature feeds Verify. The research side carries on as before and still never takes Verify data ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)).

### 4. What makes it defensible

1. **The counted-trials dataset.** Our always-on search had counted 246,869 tries by 27 October 2026, each with its result, and every opted-in Verify check adds a row with its stated tries and failure reason. Nobody else records what was tried and failed. It grows with use and gets more valuable as records age and we see what happened next.
2. **An open method others cite.** The methodology page is public, versioned and citable. Every badge names the method version that judged it. If platforms, journalists and educators point to "the Parity method" when they ask whether a record survives its tries, the method becomes the standard and we are its reference implementation.
3. **Badges and profiles with network effects.** Each shared badge is a link back. Once buyers of bots and signals expect a badge, sellers need one, and a withdrawn badge stays visible, so the badge cannot be gamed by deleting losers.
4. **B2B buyers.** Prop firms (screening challenge takers before funding them), copy-trading platforms and bot or signal marketplaces (a score on every listing), and brokers (honest statistics instead of win rates). They buy through the API, which creates switching costs once their rules depend on the score. The front page asks them to write to contact@paritytrading.app.

### 5. Pricing

The tiers in [DEC-0032](0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md) are shown as a preview. Checking is free today. Nothing is charged until the owner switches payments on.

## Alternatives considered

- **Keep the wide product and add Verify to it.** Rejected: a new visitor meets too many products to understand any one.
- **Switch the other apps off.** Rejected: they cost little to keep, people use them, and they hold work worth returning to.
- **Verify as a website only.** Rejected: the people most likely to produce overfit strategies are now AI agents, and platforms buy through an API.

## Consequences

- The front page, the corner menu and the app's first menu item lead with Verify. The other products appear lower and quieter.
- New work is judged by whether it makes Verify better, easier to reach, or harder to copy.
- The kill criteria in DEC-0032 now apply to Parity as a whole.
- Owner items that matter more now: the AI directory submissions for Claude, ChatGPT and Gemini, a licensed source of daily highs and lows for the timing check, and the first prop-firm and copy-trading conversations.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
