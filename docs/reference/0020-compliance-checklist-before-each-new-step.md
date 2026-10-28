---
id: REF-0020
title: Compliance checklist before each new step
type: reference
status: current
created: 2026-10-25
updated: 2026-10-27
authors: [ayan]
tags: [process]
related: [RES-0026, DEC-0019, DEC-0032, DEC-0046, DEC-0022, DEC-0076]
---

# Compliance checklist before each new step

## In plain words

Parity is free and trades nothing, so few licences apply today. Each new step, such as charging money, giving advice to one person, or letting people trade for real, brings new rules. This page lists what has to be done before each step, and who does it: the owner, a lawyer, or us. The reasons and the laws are in [RES-0026](../research/0026-laws-and-rules-that-apply-to-parity-now-and-later.md). Nothing here is legal advice.

## Summary

- **Do now:** decide which state the company operates from. The postal address was added and the owner reported the lawyer review as passed, both on 25 October.
- **Every step after that needs a lawyer first.** The biggest open question is whether the Verify Score, the Seller tier and the AI connector keep Parity outside the investment adviser and CTA definitions.
- The public page that users are pointed to is `/legal/regulatory/`. Update it, and its last-reviewed date, whenever a step below is taken.

Owner means the owner of Parity Trading, Inc. Lawyer means outside counsel (securities and commodities, plus privacy). Team means us.

## Now, before anything new

| Action | Who | Why |
| --- | --- | --- |
| Add a postal address to the privacy policy, terms and regulatory page | Owner | Done 25 October: 7213 Continental Drive, Newark, Delaware, on the privacy, terms, cookies, accessibility and regulatory pages. No ZIP code was given; add it when known |
| Have counsel review all six legal pages, including `/legal/regulatory/` | Owner, lawyer | The owner reported on 25 October that the lawyer reviewed and passed them. Keep the reviewer's name and date with the company records |
| Confirm the state the company operates from, and register there as a foreign corporation if needed | Owner, lawyer | Delaware is the state of incorporation only |
| Keep the Delaware registered agent and file the annual franchise tax report by 1 March | Owner | 8 Del. C. 132; Delaware Division of Corporations |
| Keep every page impersonal: no "buy", no advice for one person, no ranking by return | Team | Publisher exclusion and CFTC 4.14(a)(9) |
| No affiliate or referral links to offshore perps venues for US users | Team | Could be acting as an unregistered introducing broker |
| Confirm the Supabase region and data processing agreements | Owner, lawyer | Privacy policy sections 8 and 9 rely on them |
| Reply to complaints within the targets on the regulatory page, and log them | Team | Complaint handling we promise publicly |

## Before paid tiers (DEC-0032, DEC-0046)

| Action | Who |
| --- | --- |
| Lawyer's opinion that charging for Pro, Seller and API tiers does not make Parity an investment adviser or a CTA. Specifically: does being paid by sellers whose records we score break the "disinterested" part of *Lowe*? | Lawyer |
| Subscription terms that meet ROSCA and state auto-renewal laws: clear price and renewal terms, express consent, online cancellation, renewal reminders where required | Lawyer, team |
| Refund and cancellation policy page | Owner, lawyer |
| Sales tax registration where SaaS is taxable, or a merchant of record | Owner |
| Stripe account, live keys stored per the dev box rules, credentials register row | Owner |
| Badge wording reviewed under FTC Section 5 and 16 CFR 465 (no implied endorsement; disclose that sellers pay) | Lawyer, team |
| Check each data source's licence allows commercial use; remove or license any that do not | Team, owner |
| Update the privacy policy for payment data held by Stripe | Team, lawyer |
| Update `/legal/regulatory/` | Team |

## Before selling the dataset or the API

| Action | Who |
| --- | --- |
| Confirm the rows are deidentified under the CCPA (reasonable measures, public commitment, contracts binding buyers) and anonymous under GDPR Recital 26 | Lawyer |
| Data licence contract with a no-reidentification clause and no resale of vendor prices | Lawyer |
| Confirm California data broker registration does not apply | Lawyer |
| API keys with limits and a log, on their own subdomain | Team |

## Before personalised signals, alerts or AI advice

Tailored advice is the clearest trigger for registration.

| Action | Who |
| --- | --- |
| Decide whether to register (state investment adviser; CTA with NFA) or to keep the feature impersonal | Owner, lawyer |
| Check that MCP tools and AI connector answers cannot read a user's holdings and recommend trades in their name | Team |
| Paid alerts: keep them on a regular schedule and the same for everyone, or get counsel's view first | Lawyer |
| If registering as an adviser: compliance manual, Form ADV, Marketing Rule policies, books and records, a chief compliance officer, privacy notices under Regulation S-P, the Safeguards Rule | Owner, lawyer |
| If any feature auto-trades or copies signals into accounts: treat as directing accounts, so CTA registration and NFA membership unless counsel finds an exemption | Owner, lawyer |

## Before real trading through a broker partner (DEC-0019, DEC-0046)

| Action | Who |
| --- | --- |
| Pick the partner (Alpaca Broker API first for US stocks, per DEC-0046) and sign its agreement | Owner |
| Lawyer's opinion that our role and pay stay outside broker-dealer registration: no transaction-based pay, no account opening, no order handling, no custody (FINRA Rule 2040 limits what the partner can pay us) | Lawyer |
| Partner's review of all communications under FINRA Rules 2210 and 2214 | Partner, team |
| Disclosures: who the broker is, SIPC, how to check it on BrokerCheck, that Parity is not the broker | Lawyer, team |
| Customer data protection for data passed to or from the partner (GLBA and Safeguards Rule may now apply) | Lawyer, team |
| Complaint handling and record keeping as the partner contract requires | Team |
| Forex: OANDA-style integration paid per trade needs NFA introducing broker registration; do not start without it | Owner, lawyer |
| Crypto: partner must be the licensed party; we never hold coins or money (state money transmitter, BitLicense) | Owner, lawyer |
| Update `/legal/regulatory/` to name the partner and its regulators | Team |

## Before serving EU or UK users on purpose

| Action | Who |
| --- | --- |
| Decide whether Parity offers services to the EU or UK (marketing, languages, prices), which decides GDPR Article 3(2) | Owner, lawyer |
| If yes: appoint an EU representative (Article 27) and a UK representative, unless counsel says the exception applies | Owner, lawyer |
| Records of processing and a data protection impact check for Verify and the dataset | Team, lawyer |
| Analytics only with opt-in consent (ePrivacy, PECR) | Team |
| MAR Article 20: add who produced each signal and our interests, if counsel says strategy signals are investment recommendations | Lawyer, team |
| UK: get advice on FSMA s21 financial promotions for signals, crypto content and any broker link, or block those features for UK users | Lawyer |
| EU: personal investment advice needs MiFID II authorisation and crypto advice needs MiCA authorisation; do not offer either | Owner |
| Digital Services Act: check whether badge hosting needs a point of contact and an EU legal representative | Lawyer |
| European Accessibility Act: check whether Parity is in scope or exempt as a microenterprise | Lawyer |

## Trade profile and the leaderboard (DEC-0076)

The leaderboard of demo results ([DEC-0076](../decisions/0076-trade-profile-a-private-demo-calendar-and-an-opt-in-leaderboard-ranked-by-risk-adjusted-return.md)) is opt-in, off by default and seen only by signed-in people. The privacy policy covers it in section 5. These items are still open.

| Action | Who | Why |
| --- | --- | --- |
| Decide whether ranking people by risk-adjusted demo results fits the "no ranking by return" rule in the first table, or needs an exception written down | Owner, lawyer | The rule protects the publisher exclusion and CFTC 4.14(a)(9). The board ranks people, not strategies, shows no trades or positions, and uses virtual money, but it is still a ranking by a return measure |
| Stop or flag forged ranks. Demo fills are computed in the browser, and RLS lets a signed-in person insert their own `paper_fills` rows with any `realized_pnl` and set their own starting cash on reset, so any rank can be typed in. Options: recompute fills on the server from orders and stored prices, plausibility checks, or a note on the board | Team | A forged rank shown to other people could mislead them (FTC Act Section 5), and it makes the board untrustworthy |
| Handle rules: block offensive handles and names that impersonate Parity, staff, real firms or public figures; reserve words such as `parity`, `admin` and `support`; a way to report a handle and a way for the team to remove it | Team, owner | Handles and display names are content users write that other people see. Today nothing filters them |
| Add acceptable use rules to the terms for handles, display names and editing demo records to change a rank, so the team can act on them | Owner, lawyer | Terms section 7 does not mention them, and adding them changes legal substance |
| Record when each person switched the leaderboard on and which wording they saw, not only `updated_at` | Team | GDPR Article 7(1): we must be able to show that consent was given |
| Hide a person from the board as soon as they ask to delete their account, not only when the row is deleted | Team | Deletion can take up to 30 days (privacy section 7), and a person who asks to be deleted expects to disappear |
| Decide whether a handle freed by a deleted account can be taken by someone else at once, or is held for a period | Team, owner | Someone could take over a known handle and pose as its old owner |
| Decide whether to block handles for under 18s beyond the age line in the terms, given that the board makes people visible to other users | Owner, lawyer | Accounts are 18 and over by declaration only; there is no age check |
| Add the leaderboard to the records of processing and the data protection impact check, if Parity serves EU or UK users on purpose | Team, lawyer | Ranking people is a form of profiling made visible to others |
| Check every label on the board after the web work lands: "Demo money", "Past demo results do not predict future results.", the luck check wording and the minimum trade counts | Team | The privacy policy names these, so the page must match |

## Legal pages open items

On 25 October the owner asked for the public legal pages to read like other companies' legal pages, with no draft labels. The items below were marked on the pages before then. They are still open; the pages now use neutral wording until each is decided.

| Item | Page and section | Who | What the page says now |
| --- | --- | --- | --- |
| Lawyer review of all six legal pages and the legal index | All of `/legal/` | Owner, lawyer | No draft label. The regulatory page keeps "This page is general information, not legal advice." |
| Postal address for Parity Trading, Inc. | Privacy 1, Regulatory 1 | Owner | Contact by email at contact@paritytrading.app |
| Supabase backup period for our plan | Privacy 7 | Owner | Backup copies "expire on their schedule" |
| Data processing agreements with each provider, and the Supabase region | Privacy 9 | Owner, lawyer | Relies on the safeguards in the providers' data processing terms, such as the standard contractual clauses |
| Lawyer review of the research dataset wording and the sale of aggregate data, before launch | Privacy 3 | Owner, lawyer | The current wording, unchanged |
| Host the web fonts ourselves so Google no longer receives visitors' IP addresses | Privacy 2, Cookies 6 | Owner, team | Google Fonts is listed as a provider |
| Personalization and experiments (DEC-0068): a written balancing test for legitimate interest on in-app actions, and whether the session storage item `parity.p.session` needs consent under ePrivacy and PECR | Privacy 4 and 6, Cookies 3 and 5.2 | Owner, lawyer | Legitimate interest with an off switch in Settings; analytics signals only with consent; the session item is listed |

When an item is decided, change the page, its "Last updated" date and this table.

## Open questions for counsel

1. Do the Verify Score and the Seller tier keep Parity within the Advisers Act publisher exclusion and the CEA publisher exclusion?
2. Does charging at all change the analysis, given the SEC reads "compensation" broadly?
3. Could the AI connector make our tools give tailored advice, and who is responsible for an outside model's answer that uses our data?
4. Does the GDPR apply to us today? Do we need EU and UK representatives?
5. Do strategy signals count as investment recommendations under MAR, or as financial promotions in the UK?
6. Does any state require more than the federal publisher exclusion?
7. Is Parity a "financial institution" under GLBA while it stays free and holds no financial data?
8. Does ordering "What's new" by a person's profile, including strategies, ever count as tailored advice, given it never says to invest and shows the same research results to everyone (DEC-0068)?
9. Could a ranked leaderboard of demo results be read in the UK as an invitation or inducement to engage in investment activity under FSMA s21, or in the EU as marketing that encourages trading, given that UK and EU regulators have raised concerns about game-like features in trading apps? Does showing it only to signed-in people, with virtual money and the "Demo money" label, change that (DEC-0076)?
10. Could the leaderboard be read as touting particular traders, so that it is no longer "disinterested" under *Lowe*, even though it shows no trades, positions or signals that anyone could copy (DEC-0076)?
11. Is consent the right lawful basis for showing a person on the leaderboard, and is it valid when joining is the only way to see one's own rank on the board? Is a statement that showing it to other users is not a sale or sharing under the CCPA, because the person directed it, correct?
12. How should we handle requests about public handles: an access or erasure request from someone who says a handle is theirs, a complaint from a third party that a handle impersonates them, and a request to remove a screenshot of the board posted elsewhere? Does the Digital Services Act's notice and action duty apply to handles and display names?
13. Does the board need more than "Past demo results do not predict future results." and "Demo money", such as the hypothetical performance warning in the spirit of NFA Rule 2-29, because demo fills are simulated?

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0046: Payments through Stripe, and real trading only through a regulated broker](../decisions/0046-payments-through-stripe-and-real-trading-only-through-a-regulated-broker.md)
- [DEC-0068: Personalization learns from use, ranks What's new and runs experiments, with an off switch](../decisions/0068-personalization-learns-from-use-ranks-what-s-new-and-runs-experiments-with-an-off-switch.md)
- [DEC-0076: Trade profile, a private demo calendar and an opt-in leaderboard ranked by risk-adjusted return](../decisions/0076-trade-profile-a-private-demo-calendar-and-an-opt-in-leaderboard-ranked-by-risk-adjusted-return.md)
- [RES-0026: Laws and rules that apply to Parity now and later](../research/0026-laws-and-rules-that-apply-to-parity-now-and-later.md)
- [REF-0029: Going live with real trading](0029-going-live-with-real-trading.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
- [LOG-0020: Trade profile and leaderboard docs and privacy policy](../log/2026-10-27-trade-profile-and-leaderboard-docs-and-privacy-policy.md)
<!-- backlinks:end -->
