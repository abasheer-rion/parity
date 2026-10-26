---
id: REF-0027
title: Going live with real trading
type: reference
status: current
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [infra, process]
related: [DEC-0046, DEC-0019, REF-0020, DEC-0040]
---

# Going live with real trading

## In plain words

Parity Trade can buy and sell through Alpaca, but only with pretend money. There are three modes. Demo is on now. Sandbox gives each person their own pretend account and turns on when the owner adds two keys. Live means real money, and the code refuses it until four separate switches are all on and a database change is made on purpose. This page lists what each mode does, the owner's steps to turn on the sandbox, and the steps before real money. Nothing here is legal advice.

## Summary

- **Demo (on now):** pretend money in Alpaca's paper trading account, using the paper keys already set for market data. Each person starts with $100,000 of pretend cash; their orders, fills and positions are tracked separately. If the server has no paper keys or cannot record orders, orders stay in the browser as before.
- **Sandbox (off until keys exist):** each person gets their own account in Alpaca's Broker API sandbox, opened with Alpaca's published test identity. Pretend funding uses Alpaca's test bank. No real name, tax number, date of birth, address or bank detail is asked for.
- **Live (refused):** needs a live key, a trading admin switch in the database, a deploy setting and a completed checklist in the repo. The database refuses live order rows until a later migration allows them.
- Every ticket, position list and confirmation shows "Demo money" or "Sandbox". The badge cannot be closed.

## What each mode does

| | Demo | Sandbox | Live |
| --- | --- | --- | --- |
| Money | Pretend | Pretend | Real |
| Where orders go | Alpaca paper account (shared, split per person by Parity) | The person's own Alpaca Broker API sandbox account | The person's own Alpaca Broker API account |
| Turned on by | Default | `TRADING_MODE=sandbox` and both sandbox keys | All four live gates below, plus a migration |
| Identity check | None | Alpaca test values only | Alpaca's real KYC |
| Funding | $100,000 pretend cash per person | Alpaca's test bank, up to $50,000 a time | Real bank transfers at Alpaca |
| Badge | Demo money | Sandbox | Real money |

Orders: market, limit, stop, stop limit and bracket (take profit and stop loss), by share quantity or by dollar amount (market orders only), with day, GTC, IOC or FOK time in force (crypto: GTC or IOC). Stocks, ETFs and crypto. People can preview the cost and fees, confirm, cancel, change open orders and export their history as CSV. Order updates arrive as a stream.

## What the server checks on every order

- The mode, decided on the server for each request.
- The caller's sign-in.
- An idempotency key, so a retried order, cancel or change is sent once.
- A rate limit of 20 order actions a minute per person.
- Risk checks: at most $25,000 and 10,000 shares an order; limit and stop prices within 10% of the last price; no short selling (sell only what you hold and have not already offered); enough buying power; a warning before a fourth day trade in five days under $25,000 of equity.
- An append-only audit log of every request, refusal, send, fill, cancel and change. Each person reads only their own rows. Only the server writes, and nobody can change or delete a row.
- Broker outages and key errors go to the warnings table, which the team reads. A person's own mistakes (a bad price) do not.

## Owner steps: turn on the sandbox

1. Go to [alpaca.markets/broker](https://alpaca.markets/broker) and sign up for the Broker API dashboard. Sandbox access is self-serve and free; it does not need the partner agreement.
2. In the dashboard, make sure the environment switch says Sandbox, open API Keys and generate a key. Copy the key id and the secret.
3. Store both in the Keychain on the dev box, named `parity-alpaca-broker-key-id` and `parity-alpaca-broker-secret`, and add a row for each to the credentials register (service Alpaca Broker API, sandbox, purpose Parity Trade sandbox accounts).
4. Set them as encrypted secrets on the Pages project `parity-research`, read straight from the Keychain: `ALPACA_BROKER_KEY_ID` from `parity-alpaca-broker-key-id`, and `ALPACA_BROKER_SECRET` from `parity-alpaca-broker-secret`.
5. Set the Pages variable `TRADING_MODE` to `sandbox` and redeploy.
6. Confirm the Pages secret `SUPABASE_SERVICE_ROLE_KEY` is set. Without it the server cannot record orders and every mode falls back to the browser demo.

To turn the sandbox off again, set `TRADING_MODE` back to `demo` or remove either key.

## Steps before real money

Live needs all of these. Each is checked by the code; leaving out any one keeps trading on pretend money.

1. **Registration items.** Every item under "Before real trading through a broker partner" in [REF-0020](0020-compliance-checklist-before-each-new-step.md) is done: the signed Alpaca partner agreement, the lawyer's opinion on broker-dealer registration, the partner's review of the screens, disclosures, data protection, complaints and records, crypto licensing and the regulatory page.
2. **The checklist file.** Mark each item done with written evidence (who, what and when) in `web/src/lib/trading/live-checklist.json`, set `"complete": true`, and merge it through a pull request. A checklist marked complete without evidence for every item does not count.
3. **The database.** A reviewed migration that allows `mode = 'live'` on the broker tables. Until then the database refuses every live order even if the other gates pass.
4. **Live keys.** Alpaca issues production Broker API keys after its review. Store them in the Keychain and set them on Pages as `ALPACA_LIVE_BROKER_KEY_ID` and `ALPACA_LIVE_BROKER_SECRET`.
5. **The admin switch.** The database owner adds the admin's user id to `trading_admins` in the Supabase SQL editor (no app or server role can). That admin then calls `set_trading_live(true)` while signed in with a second factor (multi-factor sign-in); a token given to a connected AI app is refused. A trigger refuses the switch from anyone else.
6. **The deploy setting.** Set `TRADING_LIVE_DEPLOY=on` and `TRADING_MODE=live` on Pages and redeploy.
7. **Before launch.** Replace the sandbox onboarding with Alpaca's real KYC flow, which collects identity details through the partner, and check the real-money badge and disclosures with the lawyer.

To stop live trading at once, any one of these is enough: the admin calls `set_trading_live(false)`, or `TRADING_LIVE_DEPLOY` is removed, or a live key is removed. The server then falls back to the sandbox or demo.

## Settings

| Name | Where | What it does |
| --- | --- | --- |
| `TRADING_MODE` | Pages variable | `demo` (default), `sandbox` or `live` |
| `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY` | Pages secrets (set) | Alpaca paper account: demo orders and prices |
| `ALPACA_BROKER_KEY_ID`, `ALPACA_BROKER_SECRET` | Pages secrets (not set) | Broker API sandbox |
| `ALPACA_LIVE_BROKER_KEY_ID`, `ALPACA_LIVE_BROKER_SECRET` | Pages secrets (must not be set yet) | Broker API production |
| `TRADING_LIVE_DEPLOY` | Pages variable (not set) | One of the four live gates; only `on` counts |
| `SUPABASE_SERVICE_ROLE_KEY` | Pages secret | Lets the server record orders and the audit log |

The code is in `web/src/lib/trading/` and `web/functions/api/trade/`; the tables are in `supabase/migrations/20261108120000_broker_sandbox.sql`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0046: Payments through Stripe, and real trading only through a regulated broker](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md)
- [DEC-0051: AI apps connect to Parity through a hosted MCP server, and people bring their own model](../decisions/0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)
<!-- backlinks:end -->
