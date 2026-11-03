---
id: DEC-0087
title: Free pilots for prop firms with a batch screen, a back-test and a sample report
type: decision
status: accepted
created: 2026-11-03
updated: 2026-11-03
authors: [ayan]
tags: [infra, process]
related: [DEC-0079, DEC-0080, DEC-0081, DEC-0082, DEC-0071, DEC-0056, REF-0016]
---

# Free pilots for prop firms with a batch screen, a back-test and a sample report

## In plain words

On 3 November 2026 the owner decided to chase free pilots with prop firms. This is what a pilot needs, built and live:

- **A batch screen.** A firm drops one file of many challenge accounts and gets, for each, one of three verdicts: holds up, likely luck, or not enough trades. Each comes with the numbers behind it and one line saying why. The page runs in the firm's browser, so the traders' data never reaches Parity. Larger jobs go through the API, which stores nothing.
- **A back-test of the screen itself.** When the firm adds what happened later (a payout or a blow-up), the report shows how often "likely luck" was followed by a blow-up, how many blow-ups it caught, and how often it flagged a trader who was later paid, each with a 95% interval. This is the pilot's proof.
- **A sample report** on 500 made-up challenge accounts, clearly marked synthetic, with the generator in the repo.
- **Pages for firms** with one action, "Start a free 30-day pilot", which opens a short form. Requests are stored and emailed to contact@paritytrading.app.

## Context

- Parity is a verification platform for retail traders ([DEC-0079](0079-parity-is-an-ai-native-verification-platform-for-retail-traders-of-all-sizes.md)). The front page's "For businesses" area ([DEC-0080](0080-the-front-page-leads-with-verify-three-ways-in-and-planned-prices.md)) only offered an email address.
- Verify ([REF-0016](../reference/0016-parity-verify-mvp-spec.md), [DEC-0081](0081-verify-is-a-public-page-with-broker-imports-embeds-and-a-citable-method.md), [DEC-0082](0082-verify-tools-and-endpoints-for-ai-apps-and-programs.md)) checks one record at a time. A prop firm has hundreds of short records a month.
- Verify's five verdicts fail every challenge account on the "short sample" check (100 trades and 12 months), because a challenge lasts weeks. A firm needs a verdict that judges a short record on what it can show.
- A trader with no edge who keeps trading until an 8% target or a 10% loss limit passes about 56% of the time (the loss limit over the two added together). Passing says little on its own.

## Decision

1. **Three verdicts, method `screen-1.0`** (`web/src/lib/screen/score.ts`): not enough trades under 30; likely luck when the record loses money per trade after fees, has a red flag on Verify's worst-losses card (worst loss over 20 average wins, size growing after losses, a fall over 50%), or is below 0.95 on the luck check (the deflated Sharpe ratio of each trade's profit at the account's own attempts); otherwise holds up. One setting multiplies every account's tries by the batch size, the strictest reading.
2. **Concentration is a number and a firm rule, not a reason on its own.** In a few dozen trades the best 5 can make half the profit with a real edge: in the first synthetic run it flagged 36 of 65 skilled passers.
3. **Firm rules are reported, not judged.** For likely-luck passers the report counts how many each common rule would also have stopped (best day over 30% of the profit, fewer than 5 trading days, size growing after losses, best 5 trades over half the profit), how many good passers each would also stop, and how many only the luck check sees.
4. **The back-test** (`backtest.ts`) gives hit rate, catch rate and false alarms with Wilson intervals, and the gap in blow-up rates with Newcombe's interval. Groups under 20 accounts are called rough.
5. **Input shapes** (`read.ts`, `unzip.ts`): a long CSV with an account column, a zip or several files with one trade file per account, and an optional details file (balance, attempts, passed, outcome). Each account goes through Verify's own format readers, so every broker export Verify reads works. The zip reader uses the browser's own `DecompressionStream`; no library.
6. **Where it runs.** `/business/screen/` in the browser, up to 200 MB. `POST /api/v1/verify/batch` (scope `write:verify`): at most 500 accounts and 50,000 trades a request, bodies up to 5 MB (the other endpoints keep 1 MB), nothing stored. It is not an MCP tool.
7. **The synthetic sample** (`simulate.ts`, `npm run pilot:sample`): seeded, 500 accounts in three styles (skilled, no edge, gambling), an 8% target, 10% loss limit, 5% daily limit and 30 days. Passers then trade a funded account the same way, one in eight with bigger positions and a worse edge, until a 6% payout or a 6% fall from the high. The screen never sees that phase. The files and `summary.json` are committed; a test fails when they drift from the code, and the business pages print their numbers from `summary.json` at build time.
8. **Pilot requests** go into `public.pilot_requests` (`20261116000000_pilot_requests.sql`): anyone can insert the form's columns only, only the team (`is_team()`, [DEC-0056](0056-team-members-see-real-time-venue-feeds-the-public-does-not.md)) can read, nobody updates through the API. A trigger rate-limits with no captcha: 3 an hour per address, 3 a day per email, 60 an hour in all. Addresses are kept only as salted hashes. The page then calls the `pilot-notify` Edge Function, which claims the row once within 15 minutes and emails contact@paritytrading.app through Resend with the firm as reply-to. If the email fails the row is still there.
9. **Pages** `/business/prop-firms/`, `/business/copy-trading/`, `/business/bot-marketplaces/`, `/business/screen/` and `/business/prop-firms/sample/` use the front page's look: no top bar, big statements, solid cards, one blue action. The front page's "For businesses" cards link to them.

## Consequences

- A firm can run the screen on its own history before talking to us, and a pilot has a measurable result: the back-test on the firm's outcomes.
- The sample's numbers are synthetic and say so everywhere they appear. They show what the report looks like, not how well the screen works on real firms.
- The screen's verdict differs from Verify's on the same record: Verify would say "could be luck" for every challenge, because the sample is short. The methodology page explains both.
- A batch request counts as one request against the API's daily quota. Revisit if a firm's volume makes that a problem.
- The `pilot-notify` Edge Function is deployed by hand, like `send-email`. It uses the existing `RESEND_API_KEY`; no new secret.
- Files: `web/src/lib/screen/`, `web/src/business/`, `web/business/`, `web/plugins/business.ts`, `web/scripts/pilot-sample.mjs`, `web/public/business/prop-firms/sample/`, `web/src/lib/api/server.ts`, `supabase/migrations/20261116000000_pilot_requests.sql`, `supabase/functions/pilot-notify/`, tests in `web/tests/screen/` and `supabase/tests/test_pilot_requests.sql`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
