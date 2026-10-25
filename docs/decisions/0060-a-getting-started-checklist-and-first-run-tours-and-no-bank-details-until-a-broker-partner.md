---
id: DEC-0060
title: A getting started checklist and first-run tours, and no bank details until a broker partner
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [process, ui]
related: [DEC-0046, DEC-0051, DEC-0053, DEC-0044, DEC-0040, DEC-0049, REF-0017]
---

# A getting started checklist and first-run tours, and no bank details until a broker partner

## In plain words

New users now get two kinds of help.

**A getting started checklist** sits on Home (and so in the desktop app, which loads the live site). It has a progress ring and eight things to try. Each one ticks itself when the person does it, without pressing anything:

1. Verify your email.
2. Connect your AI (Claude, ChatGPT, Gemini, Cursor) through `/connect/`. Done when an AI app first signs in.
3. Run your first Verify check.
4. Place a demo trade.
5. Add a watchlist or alert, or follow a strategy.
6. Take an Academy lesson.
7. Turn on two-step sign-in, when the project offers it.
8. Add a crypto wallet, read only.

A ninth line says "Link a brokerage account, coming later", with a "Notify me" switch. The list can be hidden and comes back from Account settings. What the person picked in the welcome after sign-up ([DEC-0044](0044-one-sign-in-panel-that-fades-in-over-the-front-page.md)) comes first.

**Short tours** of 3 to 6 steps open once, the first time someone visits Home, Verify, Trade, Workbench, Research, Terminal, Academy, Account and the desktop app's bar. Each step lights up one part of the page with a short tip. Every tour has Skip, and "Skip all tours" turns them all off until "Show tours again" in Account settings.

**No bank or card details.** Parity holds no money and has no broker partner yet ([DEC-0046](0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md)), so it collects no bank account numbers, routing numbers or card details anywhere. Brokerage linking will go through a regulated broker partner when there is one.

## Context

- The owner asked for simple first to-dos for new users, such as connecting an AI agent and adding a bank account or crypto wallet, and for tutorial guides everywhere with a skip all button.
- Parity already had the pieces each to-do points at: the AI connector ([DEC-0051](0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)), demo trading in Trade ([DEC-0040](0040-parity-trade-a-full-screen-trading-app-of-its-own.md)), Verify, Academy progress, watchlists and alerts, and two-step sign-in.
- A bank account is a different matter. Without a broker partner there is nothing it could be used for, and holding bank details would bring duties we cannot meet.

## Decision

1. **One row per person.** `onboarding_state` keeps when each item was first done, whether the checklist is hidden, which tours the person has seen, whether every tour is off, and the brokerage "Notify me" choice. Row level security lets a person read and write only their own row. A trigger never clears a done time, never moves it later and never dates it in the future, so two tabs saving in either order cannot undo an item.
2. **Items tick themselves from data the person already owns.** The checklist reads, through the person's own session: the confirmed email, verified authenticator factors, approved AI apps from Supabase's OAuth server and any call from an AI app in `mcp_calls`, demo orders, alerts, a second watchlist (everyone gets one starter list), finished Academy lessons and saved wallets. Verify, adding a symbol to a watchlist and following a strategy also mark their item where they happen. Once marked, an item stays done.
3. **Crypto wallets are read only.** `crypto_wallets` keeps the public address, the chain (Ethereum or Solana) and the time a signature proved it, and nothing else. A person can type an address, saved as not verified, or sign a Sign-In With Ethereum (EIP-4361) message, or the same message on Solana. `/api/wallet/verify` checks the signature, the site, the Parity account named in the message and a 10 minute window, then saves the time with the service role key. The browser can never set that time itself. The page says Parity never asks for a seed phrase or private key, and refuses anything that looks like one before it leaves the box.
4. **Brokerage is a placeholder.** The ninth line never counts toward progress and only stores "Notify me". No table has a column for bank, routing or card numbers.
5. **One tour component.** The tour lives in `web/src/ui/tour.tsx` with the UI library's tokens, so the library consolidation can adopt it. It floats on the page with fixed positions, so nothing moves. A step whose target is hidden on that screen size is skipped, and the count only counts what can be shown. Escape skips, the arrow keys move, Tab stays in the tip, and no other key reaches the page while a tour is open. Reduced motion turns off its transitions.
6. **The desktop app's bar is outside the page,** so its tour points up from the top edge of the window instead of lighting up a button.
7. **Events.** Each finished item, tour step, tour end, skip all, reset, wallet and "Notify me" goes through the opt-in analytics `track()` ([DEC-0053](0053-our-own-product-analytics-opt-in-stored-in-postgres.md)). Nothing is sent unless the person switched analytics on.
8. **Copy** follows [REF-0017](../reference/0017-parity-copy-rules.md). Trade's tips are one short line each.

## Consequences

- Verifying a wallet by signature needs `SUPABASE_SERVICE_ROLE_KEY` in the Pages environment. Without it `/api/wallet/verify` answers 503 and the page says signing is not switched on yet; typed addresses still work.
- "Connect your AI" ticks when Supabase lists an approved app or an app makes a call. Until the owner switches on Supabase's OAuth server, it cannot tick.
- Showing holdings or checking on-chain trades for a wallet is later work. It will read public chain data by address only.
- A tour whose page is empty on the first visit (no data yet) does not open and is not marked seen, so it opens on a later visit.
- `scripts/onboarding.mjs` runs in CI after the smoke test: a tour from start to finish, Skip all, Show tours again, a phone layout and the wallet dialog. The row rules are checked by `supabase/tests/test_onboarding.sql`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
