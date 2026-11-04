---
id: DEC-0091
title: Verify reads trades from brokers with read-only keys and marks the record broker-connected
type: decision
status: accepted
created: 2026-11-03
updated: 2026-11-03
authors: [ayan]
tags: [infra, method, ui]
related: [DEC-0032, DEC-0079, DEC-0081, DEC-0084, REF-0016, REF-0030, DEC-0071]
---

# Verify reads trades from brokers with read-only keys and marks the record broker-connected

## In plain words

A trader can now let Parity read their trades straight from Interactive Brokers, Alpaca, Coinbase, Kraken, Binance or Bybit, with a key that can only read. Parity checks the key cannot trade, move or withdraw money before it reads anything, runs the same checks as on an uploaded file, and signs the result. The badge then says "Broker-connected" with the venue, a one-way code for the account and when we read it, instead of "Self-reported". By default the key is used once and dropped. It is switched on in pull request previews and the test build, and stays off on paritytrading.app until the owner turns it on.

## Context

- Every badge so far says "Self-reported", because a CSV can be edited ([REF-0016](../reference/0016-parity-verify-mvp-spec.md)). [DEC-0032](0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md) named broker-connected badges as the next step and the one that makes a badge worth something to prop firms and buyers.
- [DEC-0081](0081-verify-is-a-public-page-with-broker-imports-embeds-and-a-citable-method.md) left a switched-off scaffold for read-only connections and said turning it on needs keys, a security review and its own decision. This is that decision.
- On 3 November 2026 the owner asked to build it.

## Decision

### 1. Venues, and how each is kept read-only

Each connector follows the venue's official documentation only (links in `web/src/lib/connect/venues.ts` and below). A credential that can do more than read is refused before any trade is read, with a plain message, and the refusal is logged for the person.

| Venue | What the person gives | How we know it only reads | Limits |
| --- | --- | --- | --- |
| Interactive Brokers | Flex Web Service token and an Activity Flex Query id | A Flex token can only fetch reports; it is not the IB login ([send request](https://www.interactivebrokers.com/docs/web-api/api-reference/send-request), [get statement](https://www.interactivebrokers.com/docs/web-api/api-reference/get-statement)) | 365 days a read; 1 request a second and 10 a minute per token ([error codes](https://www.interactivebrokers.com/docs/web-api/flex-web-service/error-codes)); the query must name one account |
| Alpaca | Sign-in at Alpaca (OAuth), no key | Parity asks for no scope, which Alpaca documents as read-only; a token that comes back with any scope is refused ([OAuth](https://docs.alpaca.markets/docs/using-oauth2-and-trading-api)). Alpaca keys cannot be made read-only, so keys are never taken | 200 requests a minute ([limits](https://alpaca.markets/support/usage-limit-api-calls)); fills carry no fee ([activities](https://docs.alpaca.markets/us/docs/account-activities.md)); live use for other people needs Alpaca to approve the app |
| Coinbase | Advanced Trade key name and ECDSA private key | `key_permissions`: refused unless `can_trade` and `can_transfer` are false ([permissions](https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/data-api/get-api-key-permissions.md), [auth](https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication.md)) | Spot fills only ([fills](https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/orders/list-fills.md)); no Ed25519 keys; EU accounts that need a two-step check cannot be read |
| Kraken | API key and private key | `GetApiKeyInfo`: refused unless every permission is a query or export one; an unknown permission is refused ([key info](https://docs.kraken.com/api-reference/account-data/get-api-key-info.md), [auth](https://docs.kraken.com/exchange/guides/rest/authentication.md)) | Trade history costs 2 on a small counter, so about a thousand trades a read ([rate limits](https://docs.kraken.com/exchange/guides/rest/ratelimits.md), [trades](https://docs.kraken.com/api-reference/account-data/get-trades-history.md)) |
| Binance | API key, secret key and the markets traded | `apiRestrictions`: refused unless reading is the only flag on; an unknown flag that is on is refused ([permissions](https://developers.binance.com/docs/wallet/account/api-key-permission)) | No "all my trades" call, so markets are named (up to 20); spot only; Binance.com refuses US addresses ([spot API](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md)) |
| Binance.US | Not taken | It has no call that says what a key may do (404 when we checked), so Parity cannot prove a key only reads ([docs](https://docs.binance.us/)) | Upload its trade history file instead |
| Bybit | API key and secret key | `query-api`: refused unless `readOnly` is 1 and the wallet permissions have no withdrawal ([key info](https://bybit-exchange.github.io/docs/v5/user/apikey-info)) | Two years of history, seven days a request ([trade history](https://bybit-exchange.github.io/docs/v5/order/execution), [rate limits](https://bybit-exchange.github.io/docs/v5/rate-limit)); funding not taken off; refuses US addresses |

The trades go through the same pairing and the same method (`verify-1.2` today) as a file. Profit in different money is not added up: the record keeps its main money (dollar coins count as dollars) and names what was left out.

### 2. Security

- **Server side only.** `/api/connect` is a Pages Function (`web/functions/api/connect/[[path]].ts`, logic in `web/src/lib/connect/server.ts`). Only Parity's own pages may call it, only with the person's own session, never with a connected AI app's token.
- **Use once by default.** The credential lives for one request and is never logged, put in an error message, returned or stored. The page clears it the moment it is sent.
- **Keep in sync, only when ticked.** The credential is sealed with AES-GCM under a data key for that person, which is itself sealed with `BROKER_CREDENTIAL_KEY`, a Cloudflare secret. Each sealed value is tied to the person, the connection and the venue. Revoking in Settings, Broker connections, deletes it. A kept connection is read again only when the person asks.
- **Logged.** Every read, refusal, failure, save, use and revoke is a row in `broker_events` the person can see. No credential is ever in it.
- **Limits.** 10 reads an hour and 40 a day per person (database), 30 calls a minute per address (server), 10 kept connections, 25 seconds and 300 venue calls a read, 50,000 fills.
- **Plain errors.** Every failure is a sentence that says what to do; a venue's raw reply never reaches the page.

### 3. Trust levels on badges and reports

- The server signs what it read and worked out (Ed25519, a compact JWS) with `BROKER_RECORD_SIGNING_KEY`: venue, live or paper, a one-way account code (keyed HMAC, same code for every record from that account), fetch time, dates asked for, the verdict, a fingerprint of the cards, the SHA-256 of the trades file Parity read, and a hash tying it to the person.
- A badge carries the proof. The database checks it was made for the person publishing, is under 7 days old and used once, and copies the venue and account code from it. Every place a badge is drawn (the page, the image, the card, the share image) checks the signature with the public key and that every number matches; otherwise it shows "Self-reported". The public key is at `/api/connect/keys`, so anyone can check a badge.
- A withdrawn broker-connected badge loses its numbers and proof but keeps the venue and account code, so withdrawals stay visible.
- `/methodology/#trust` says what broker-connected shows and what it does not: tries and the starting balance are still stated by the owner, other accounts are not seen, and costs a venue books apart from fills are not taken off.

### 4. Switched on in testing only

The build flag `VITE_VERIFY_CONNECTIONS=on` turns on the page and, through `/verify/connections.json`, the server. Pull request previews and the E2E build set it; production reads the repository variable `VERIFY_CONNECTIONS`, which is unset, so **production stays off until the owner turns it on**. `BROKER_CONNECT=off` in the Pages environment switches it off anywhere. `/api/connect/keys` stays on, so published badges can always be checked.

### 5. Bybit's file layouts

Checked against real exports: Bybit's closed-positions file for a Unified Trading Account is now read ("Layout copied from a real export"), with time-first dates and profit after opening, closing and funding fees, which Bybit's help centre states and the file's own columns confirm. No real file with the older "Closed P&L" columns was found, and the only spot trade history file found looked made by hand, so those two stay "Unverified layout". Bybit's transaction log is refused with what to export instead.

### 6. Owner steps

None of these was created or set by us.

1. Generate and set `BROKER_RECORD_SIGNING_KEY` (32 random bytes, base64url) as a Cloudflare Pages secret, for preview and later production. Without it, reads answer "not set up".
2. Generate and set `BROKER_CREDENTIAL_KEY` (32 random bytes, base64url) the same way. Without it, "keep in sync" is off and keys are always used once.
3. Register Parity as an Alpaca Connect app, add the redirect `https://<host>/api/connect/alpaca/callback` for each host, and set `ALPACA_OAUTH_CLIENT_ID` and `ALPACA_OAUTH_CLIENT_SECRET`. Alpaca must approve the app before live accounts other than the owner's.
4. Add each new key to the credentials register.
5. To go live: set the repository variable `VERIFY_CONNECTIONS=on` and deploy.

## Consequences

- A record can now carry where it came from, which is the trust upgrade prop firms and buyers asked for. The luck check still depends on stated tries, and the page says so.
- Badges published before this have no proof and stay self-reported.
- Open items: confirm with a real read-only Bybit key what its permission lists contain; confirm Interactive Brokers' XML attribute names against a real XML statement (CSV is read with the reader tested on real exports); Kraken keys with a two-step code and Binance Ed25519 or RSA keys are not supported yet.
- Files: `web/src/lib/connect/`, `web/functions/api/connect/`, `web/src/pages/verify/ConnectInput.tsx`, `Connected.tsx`, `web/src/pages/BrokerConnections.tsx`, `supabase/migrations/20261117100000_broker_connections.sql`, tests in `web/tests/connect/`, `web/e2e/verify-connect.spec.ts` and `supabase/tests/test_broker_connections.sql`, recorded venue answers in `web/tests/fixtures/connect/`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0030: Parity Verify methodology](../reference/0030-parity-verify-methodology.md)
- [LOG-0022: Read-only broker connections built](../log/2026-11-03-read-only-broker-connections-built.md)
- [LOG-0023: Verify QA sweep on production](../log/2026-11-04-verify-qa-sweep-on-production.md)
<!-- backlinks:end -->
