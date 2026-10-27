# Live market data

Who sees which live prices, and the owner's steps to switch more on. The reasons are in [DEC-0052](../docs/decisions/0052-live-prices-stream-through-our-own-edge-and-every-chart-says-how-late-they-are.md) (the pipe, the public feed) and [DEC-0056](../docs/decisions/0056-team-members-see-real-time-venue-feeds-the-public-does-not.md) (team-only feeds).

**Status:** everyone sees CoinGecko, about a minute behind. People on the team list also see Hyperliquid, Kraken, Coinbase, Gemini and Binance.US in real time, with order books, recent trades and a Markets overview of every pair. US stocks stream for the team once a stock data key is set. Nobody is on the team list until the owner adds them.

## Who sees what

| Feed | Who | Why |
| --- | --- | --- |
| CoinGecko, 100 largest coins, about 1 min behind | Everyone, signed in or not | Its terms allow display with "Data provided by CoinGecko" linked |
| Hyperliquid, Kraken, Coinbase, Gemini, Binance.US, real time | Team list only | Their terms allow internal use, not public display |
| Alpaca or Finnhub, US stocks, real time | Team list only, once keyed | The account holder's own data subscription |

The server checks the team list on every connection (`web/functions/live/`, `web/src/lib/live/teamGate.ts`). Hiding a button in the page is never the check.

## Add someone to the team list

In the Supabase dashboard for project `ttqvpxvctnomfbeoqbbs`, open the SQL editor and run, with the person's sign-in email:

```sql
insert into public.team_members (user_id, note) select id, 'owner' from auth.users where email = lower('you@example.com') on conflict (user_id) do nothing;
```

The person must have signed up first. They see the team feeds after reloading Trade (within a minute). To remove someone: `delete from public.team_members where user_id = (select id from auth.users where email = lower('them@example.com'));`. Their open connection closes when their sign-in next renews, within the hour.

## US stocks: Alpaca (recommended)

1. Sign up at https://app.alpaca.markets/signup. A paper trading account is enough for market data; no money is needed.
2. Plan: the free **Basic** plan streams real-time trades from IEX only (a small share of US volume) for up to 30 symbols at once. For every US exchange and no symbol limit, subscribe to **Algo Trader Plus** (about 99 USD a month) under Plans in the dashboard, and tell Claude, which then sets `ALPACA_FEED=sip`.
3. In the dashboard, on the Paper account's home page, choose **Generate New Keys** under API Keys. You get a Key ID and a Secret Key. The secret is shown once.
4. Put both in this Mac's Keychain, never in a chat or a file. In Keychain Access, add two passwords (File, New Password Item): name `parity-alpaca-key-id` with the Key ID, and name `parity-alpaca-secret` with the Secret Key.
5. Tell Claude "the Alpaca keys are in the Keychain". Claude then:
   - sets `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY` as encrypted secrets on the Pages project `parity-research` (production) and on the worker `parity-live`, reading them straight from the Keychain;
   - adds both rows to `~/.claude/CREDENTIALS.md` (account, plan, scope, created, expiry);
   - checks that stock charts stream and that the badge says "Internal use, real-time".

## US stocks: Finnhub (only with the right plan)

Finnhub's terms say the free plan is personal use only and cannot be used by a business, even internally, without written approval. Use it only after one of:

- a paid plan that allows business use (https://finnhub.io/pricing), or
- written approval from Finnhub (support@finnhub.io) for internal use of the free plan.

Then sign up at https://finnhub.io/register, copy the API token from the dashboard, store it in the Keychain as `parity-finnhub-token`, and tell Claude, which sets `FINNHUB_TOKEN` on the Pages project and the worker and adds the CREDENTIALS.md row. Alpaca wins when both are set.

## Deploying the fan-out worker

The worker `parity-live` (`web/live/`) holds the connections to every venue. CI deploys it before the site on every push to main when the GitHub secret `CLOUDFLARE_WORKERS_TOKEN` exists: a Cloudflare API token with **Account, Workers Scripts, Edit** on the account that holds the Pages project. Without it the step is skipped and the worker stays at its last version. By hand: `cd web/live && npx wrangler deploy` with such a token.

Secrets the worker and the Pages project read, all optional:

| Name | Where | What |
| --- | --- | --- |
| `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY` | Pages and worker | Alpaca keys; both needed |
| `ALPACA_FEED` | Pages and worker | `sip` on Algo Trader Plus; leave unset for the free IEX feed |
| `FINNHUB_TOKEN` | Pages and worker | Finnhub token, only with a plan that allows business use |
| `LIVE_DENY` | Pages and worker | Comma separated source ids to switch off at once, for example `binanceus` |

## Checking it works

- `https://paritytrading.app/live/status` lists every source's line, viewers, reconnects and the exchange-to-edge lag (p50, p95, p99).
- In Trade, the badge on each live chart shows the median exchange-to-screen time; click it for the 95th percentile, every hop, reconnects and lost updates.
- The Latency page shows the same per feed from real browsers over 7 days.
