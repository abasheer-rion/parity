---
id: DEC-0046
title: Payments through Stripe, and real trading only through a regulated broker
type: decision
status: proposed
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [crypto, fx, infra, process]
related: [DEC-0019, DEC-0032, DEC-0034, DEC-0040, REF-0019, RES-0022]
---

# Payments through Stripe, and real trading only through a regulated broker

## In plain words

There are two kinds of money and we keep them apart. The first is customers paying Parity for a plan, such as Verify Pro. Stripe takes the card, and we only store what plan each person has. The second is customers putting money in to trade for real. Parity should never hold that money. A licensed broker would open the account, check who the customer is, hold the cash and carry out the trades, and Parity would be the screen in front of it. This page proposes both designs. The first comes with test-mode code that is switched off; the second stays on paper until the owner, a lawyer and a broker partner say yes.

## Context

- The owner asked on 24 October 2026 to "build the architecture for actual payments" next to the study of how trading platforms are built ([RES-0022](../research/0022-how-trading-and-market-data-platforms-are-built.md)) and the latency plan ([REF-0019](../reference/0019-latency-budget-and-target-architecture.md)).
- [DEC-0032](0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md) sets the plans we would charge for: Free, Pro at $15 a month, Seller at $49, API Starter at $500 plus $0.25 per record over 2,000, Platform at $2,000 to $10,000, and data licences. It says a Stripe account and a lawyer come before any charge.
- [DEC-0019](0019-real-trading-later-what-it-would-legally-take.md) says not to become a broker, to use a partner, that crypto needs its own licences, and that a lawyer reviews everything before real money. It is still proposed.
- The demo account ([DEC-0034](0034-demo-accounts-paper-trading-on-delayed-data.md)) and Parity Trade ([DEC-0040](0040-parity-trade-a-full-screen-trading-app-of-its-own.md)) place pretend orders against delayed daily bars in the browser.
- The stack is Vite on Cloudflare Pages with Pages Functions, and Supabase Postgres and Auth with row level security.

## Decision

Proposed. Nothing charges anyone and nothing trades real money until the owner accepts this and the gates below are passed.

### 1. Parity charging its own customers

| Part | Design |
| --- | --- |
| Card payments and invoices | Stripe Checkout and Stripe Billing. Stripe hosts the card form, so card numbers never touch our servers and we stay out of most card-security (PCI) scope. |
| Prices | Created in Stripe, each with a lookup key (`pro_monthly`, `pro_yearly`, `seller_monthly`, `api_starter_monthly`). The code looks prices up by key, so changing a price needs no deploy. Platform and data licences are signed deals, invoiced from Stripe, not self-serve. |
| Starting a plan | The signed-in person clicks a plan. A Pages Function checks their Supabase sign-in, asks Stripe for a Checkout session tagged with their user id, and sends them to it. |
| Learning what happened | Stripe calls a webhook (`/api/payments/webhook`). It checks Stripe's signature (HMAC-SHA256 of the timestamp and raw body with the endpoint secret, within 5 minutes ([Stripe webhooks](https://docs.stripe.com/webhooks))), records the event once by its id, then updates the customer, the subscription and the person's entitlements. A repeated event does nothing. A failed one answers 500 so Stripe retries, for up to 3 days in live mode. |
| What a person may use | An entitlements table, one row per feature (unlimited checks, PDF export, API access and so on), derived from active, trialing or past-due subscriptions and valid until the paid period ends. The app reads only this table, never Stripe. |
| Metered API use | Each scored record becomes one Stripe meter event with a request id, so a retry is counted once ([Stripe meter events](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api)). Stripe adds them up and bills the overage. |
| Who can write | Users read their own payment rows. Only the service role, used by the webhook, writes. Signed-out visitors get nothing. |
| Fees | Cards 2.9% plus 30 cents; Billing 0.7% of billed volume on pay as you go ([Stripe pricing](https://stripe.com/pricing), [Stripe Billing pricing](https://stripe.com/billing/pricing)). A $15 Pro month costs about 84 cents in fees. |

### 2. Customers funding real trading

**Parity does not hold customer money or securities, ever.** A regulated firm opens the account, runs identity and anti-money-laundering checks, holds the cash and assets, takes deposits by ACH or wire, executes or routes orders, and sends statements and tax forms. Parity is the technology layer: the screens, the research and the order ticket, calling the partner's API with the customer's own account. Money moves between the customer's bank and the partner, never through a Parity account.

| Option | Markets | What the partner does | What Parity would need | Notes |
| --- | --- | --- | --- | --- |
| Alpaca Broker API | US stocks, ETFs, options, crypto | Self-clearing FINRA and SIPC member; custody; KYC as a service for trading apps; ACH through Plaid, wires, journals ([Alpaca Broker](https://alpaca.markets/broker), [account models](https://docs.alpaca.markets/docs/use-cases), [funding](https://docs.alpaca.markets/docs/funding-accounts)) | A partner agreement; lawyer's view on whether our role needs registration; customer support and complaint handling; disclosures | Closest fit for a small app. Revenue share and fees are not public. |
| DriveWealth | US stocks, fractional shares | Registered broker-dealer, FINRA and SIPC; onboarding, funding, statements ([DriveWealth](https://www.drivewealth.com/)) | As Alpaca | Pricing not public |
| Interactive Brokers broker accounts | Global stocks, futures, FX, options | Clearing and custody for fully disclosed or omnibus brokers ([IBKR broker accounts](https://www.interactivebrokers.com/en/accounts/broker.php)) | **We would have to be a regulated broker ourselves** | Not open to an unregistered app |
| OANDA v20 | Retail forex and CFDs (CFDs not for US customers) | OANDA is a CFTC-registered FCM and RFED, NFA member ([OANDA v20](https://developer.oanda.com/rest-live-v20/introduction/)) | Each customer's own OANDA account and token; anyone paid per trade for bringing customers needs NFA introducing broker registration | No public US white-label route found |
| Coinbase Prime or Exchange | Crypto | Custody, routing, APIs; aimed at institutions, fintechs and brokerages ([Coinbase Prime](https://docs.cdp.coinbase.com/prime/introduction/welcome)) | Crypto licensing review (state money transmitter, BitLicense) unless the partner is the licensed party facing the customer | Crypto-as-a-service terms not public |

**Licences and legal gates, per option.** A summary for planning, not legal advice.

| Gate | When it applies | Source |
| --- | --- | --- |
| SEC broker-dealer registration, FINRA membership, net capital | If Parity takes pay tied to trades, solicits or negotiates trades, or handles customer money or securities. Avoided only if the partner is the broker and our role and pay stay outside those triggers; a lawyer decides | ([SEC guide to broker-dealer registration](https://www.sec.gov/about/divisions-offices/division-trading-markets/division-trading-markets-compliance-guides/guide-broker-dealer-registration)) |
| NFA introducing broker (Form 7-R, $45,000 capital or a guarantee from an FCM) | Soliciting or accepting forex or futures orders for customers, typically when paid per trade | ([NFA introducing brokers](https://www.nfa.futures.org/registration-membership/who-has-to-register/ib.html), [17 CFR 1.17](https://www.law.cornell.edu/cfr/text/17/1.17)) |
| Retail forex dealer (RFED) or FCM, $20 million capital | Being the counterparty to retail forex. Out of reach and out of scope | ([NFA retail forex dealers](https://www.nfa.futures.org/registration-membership/who-has-to-register/rfed.html), [17 CFR 5.7](https://www.law.cornell.edu/cfr/text/17/5.7)) |
| FinCEN money services business and state money transmitter licences | Taking in and passing on customer money or crypto. Avoided by never touching the money | ([FinCEN MSB definition](https://www.fincen.gov/money-services-business-definition)) |
| New York BitLicense | Holding, exchanging or transmitting crypto for New York customers as a business | ([NYDFS virtual currency businesses](https://www.dfs.ny.gov/virtual_currency_businesses)) |
| Customer identification and due diligence | Whoever opens accounts. The partner runs it; we may store personal data passed to it and must protect it | ([31 CFR 1023.220](https://www.law.cornell.edu/cfr/text/31/1023.220), [31 CFR 1010.230](https://www.law.cornell.edu/cfr/text/31/1010.230)) |
| Investment adviser registration | Personalised recommendations. Parity's rule stays: no "buy", no personal advice ([DEC-0019](0019-real-trading-later-what-it-would-legally-take.md)) | DEC-0019 |

**Recommended order if the owner wants real trading:** Alpaca Broker API for US stocks and ETFs first, because it is built for apps that are not brokers and handles KYC, custody and funding. Forex and crypto come later, each after its own legal review.

### 3. What is built now (test mode only, behind a flag that is off)

A second pull request adds:

- **A migration** with four empty tables, `payment_customers`, `payment_subscriptions`, `payment_entitlements` and `payment_events`. They carry a `payment_` prefix so the generic names `customers` and `subscriptions` stay free. Row level security lets a signed-in person read their own rows. Only the service role writes. The Stripe event id is unique, which is the idempotency key. Every table refuses `livemode = true` rows with a check, so a live key cannot write here until a later migration removes that check on purpose.
- **Two Pages Functions**, `/api/payments/webhook` and `/api/payments/checkout`. Both answer 404 unless `PAYMENTS_ENABLED` is set to `on` in the Pages environment, which it is not anywhere. Checkout refuses any Stripe key that is not a test key (`sk_test_` or `rk_test_` ([Stripe API keys](https://docs.stripe.com/keys))) and refuses a price or session Stripe reports as live. The webhook refuses live-mode events. Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) come only from the Pages environment and are never committed.
- **A pricing page** at `#/pricing` in the product app, routed only when the build sets `VITE_PAYMENTS=on`. It lists the DEC-0032 tiers and starts a test Checkout.
- **A `Broker` interface** with two implementations: the demo account, and a stub for a real broker (Alpaca, IBKR, OANDA, Coinbase) where every call throws "Real trading is not enabled". The stub holds no keys and opens no connection.
- **Tests** for the signature check (good, tampered, wrong secret, stale, replayed, several v1 values), idempotency, live-mode refusal, entitlement logic, metering, the flag-off 404s and the broker stub.

No Stripe account is created, no key is stored, and no account is opened anywhere.

## Alternatives considered

- **Hold customer money in a Parity bank account and pass it to a broker.** Rejected. That is money transmission and likely broker activity, with licences in most states.
- **Become a broker-dealer or an NFA introducing broker ourselves.** Rejected for now. Registration, capital, audits and staff licences cost far more than a 3-person company can carry ([DEC-0019](0019-real-trading-later-what-it-would-legally-take.md)).
- **Paddle or Lemon Squeezy as merchant of record.** Worth a look if sales tax in many places becomes a burden, since they file it for us at a higher fee. Stripe first because it also handles invoiced platform deals and metering.
- **Read the plan from Stripe on every page view.** Rejected. It is slow and ties every page to Stripe being up. The entitlements table is a local copy kept fresh by the webhook.
- **Stripe Payment Links instead of a checkout function.** Simpler, but they cannot attach the signed-in person's id reliably or refuse a live key on our side.

## Consequences

- Turning payments on later is four steps, each an owner decision: create the Stripe account and test prices, set the three secrets and the flag in the Pages environment, register the webhook address in Stripe, and build with `VITE_PAYMENTS=on`. Going live also needs the lawyer's check from DEC-0032, a migration removing the live-mode checks, live keys, a refund and cancellation policy, and sales-tax settings.
- Real trading stays off. The Broker interface means a partner adapter can be added later without touching the Trade screens, but only after the owner, a lawyer and a signed partner agreement.
- Each new key gets a row in the owner's credentials register when it is created.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0054: The data model is strict, indexed and keeps an append-only trade ledger](0054-the-data-model-is-strict-indexed-and-keeps-an-append-only-trade-ledger.md)
- [DEC-0060: A getting started checklist and first-run tours, and no bank details until a broker partner](0060-a-getting-started-checklist-and-first-run-tours-and-no-bank-details-until-a-broker-partner.md)
- [RES-0022: How trading and market data platforms are built](../research/0022-how-trading-and-market-data-platforms-are-built.md)
- [RES-0026: Laws and rules that apply to Parity now and later](../research/0026-laws-and-rules-that-apply-to-parity-now-and-later.md)
- [REF-0019: Latency budget and target architecture](../reference/0019-latency-budget-and-target-architecture.md)
- [REF-0020: Compliance checklist before each new step](../reference/0020-compliance-checklist-before-each-new-step.md)
- [REF-0021: Parity database schema and data model](../reference/0021-parity-database-schema-and-data-model.md)
- [LOG-0017: Ayan work log, competitor profiles, feedback collector and architecture](../log/2026-10-24-ayan-work-log-competitor-profiles-feedback-collector-and-architecture.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
