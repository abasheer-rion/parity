---
id: DEC-0076
title: Trade profile, a private demo calendar and an opt-in leaderboard ranked by risk-adjusted return
type: decision
status: accepted
created: 2026-10-27
updated: 2026-10-27
authors: [ayan]
tags: [kpis, method, ui]
related: [DEC-0034, REF-0017, REF-0020, DEC-0068, RES-0026, REF-0002]
---

# Trade profile, a private demo calendar and an opt-in leaderboard ranked by risk-adjusted return

## In plain words

Settings gets a new tab, Trade profile, with two parts:

- **A private part.** A calendar that shows how much each day of demo trading made or lost, and your own trades from best to worst. Only you can see it.
- **A leaderboard you can join.** It is off until you switch it on. You pick a public name (a handle), and you can add a display name and a country if you want. Other signed-in people then see your handle and your demo results, never your email or your trades.

The board ranks people by how steady their demo results are, not by who made the most. It needs a few trades before anyone appears, and it says how likely a result is to be luck. Everything is virtual money, and the board says "Demo money" and "Past demo results do not predict future results."

## Context

Demo accounts ([DEC-0034](0034-demo-accounts-paper-trading-on-delayed-data.md)) give every signed-in person virtual money, orders and fills, but no single place to see how their days went. The owner asked for a trade profile with a calendar of daily results and an opt-in leaderboard of demo traders, grouped by region.

A leaderboard puts one person's data in front of other people, so it has to be built for privacy first. It also sits close to rules Parity already follows:

- Pages stay impersonal and never rank strategies by return, to keep the publisher exclusion ([RES-0026](../research/0026-laws-and-rules-that-apply-to-parity-now-and-later.md), [REF-0020](../reference/0020-compliance-checklist-before-each-new-step.md)).
- Parity's own numbers come with a luck check, because a high return over a few days says little ([REF-0002](../reference/0002-kpis.md)).
- Personal data is used only for what the privacy policy says, with an off switch ([DEC-0068](0068-personalization-learns-from-use-ranks-what-s-new-and-runs-experiments-with-an-off-switch.md)).

## Decision

### 1. The private part

The calendar and the ranked trades read only the person's own demo records, which row level security already limits to their owner. Nothing new is collected. Daily profit and loss is the sum of closed trades' realised results for each day, with the same rule for fees on the page and in the database.

### 2. Opt-in, off by default

One row per person in `trader_profiles` holds the handle, an optional display name, an optional country and the choice to be on the board, which starts as false. The database refuses to put someone on the board without a handle.

We chose opt-in because the board makes a person's data visible to people they do not know. The GDPR asks that, by default, personal data is not made accessible to an indefinite number of people without the person acting (Article 25(2)), and consent is the plain basis for a choice a person makes and can undo. Default on would have filled the board faster, but with people who never chose to be there.

### 3. Ranked by risk-adjusted return, with minimum trades

The rank is the t-statistic of daily results: the average daily return divided by its standard deviation, times the square root of the number of days with trades. Ties go to the person with more trades.

| Choice | Why |
| --- | --- |
| Not total return | Total return rewards the biggest bet. On a board of virtual money, that teaches the wrong thing and lets one lucky day win |
| Not an annualised Sharpe ratio | Sharpe ignores how many days it rests on, so three good days can beat a steady year |
| The t-statistic | It grows with both steadiness and evidence. A short streak ranks below a long steady record. It is also the number behind the luck check |
| Minimum trades: 5 for the last 7 days, 10 for the last 30 days, 20 for all time | Below these counts the number is mostly noise, so the person is left off that period rather than shown with a misleading rank |

The board also shows trades, days with trades, total return, win rate, largest fall from a peak and a luck check, so a reader can see what the rank rests on.

### 4. Region from a country the person chooses

A person may pick a country from a list, or leave it blank. `country_region` maps it to one of seven regions, and the board can be grouped by region. We never infer the country from an IP address or from analytics. Guessing from an IP address is often wrong (travel, VPNs, mobile networks), and it would turn a network detail into something shown to other people. Regions keep the groups large enough to be useful.

### 5. A live view of totals, never a copy

`leaderboard_public` is a view that only signed-in people can read. It reads from a function in a schema the API does not expose, which returns only people who are on the board, only periods they qualify for, and only totals: no user id, email, trade, order, position or amount of money. Because it is worked out each time it is read:

- leaving the board removes the person at once, for everyone;
- there is no copy to keep in step, to expire or to delete;
- deleting the account deletes the profile row (`on delete cascade`), and the person is gone.

Showing totals only also means nobody can copy another person's trades from the board, which keeps it away from copy trading and from directing anyone's account.

### 6. Copy

All text follows [REF-0017](../reference/0017-parity-copy-rules.md). The board says "Demo money" and "Past demo results do not predict future results." The privacy policy has a section on the trade profile and the leaderboard.

## Consequences

- People can see their demo days at a glance and, if they choose, compare steady demo results with others.
- Demo fills are computed in the browser and a person can write their own demo records ([DEC-0034](0034-demo-accounts-paper-trading-on-delayed-data.md)), so a rank can be forged. That was acceptable for a private demo; on a shared board it is an open item.
- The board ranks people by a return measure, which sits next to the rule against ranking by return. Counsel's view on this, on UK and EU promotion rules, on handle moderation, on minors and on requests about public handles is tracked only in [REF-0020](../reference/0020-compliance-checklist-before-each-new-step.md#trade-profile-and-the-leaderboard-dec-0076).
- Small boards will be thin at first, because the minimum trade counts leave out new people.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0020: Compliance checklist before each new step](../reference/0020-compliance-checklist-before-each-new-step.md)
- [LOG-0020: Trade profile and leaderboard docs and privacy policy](../log/2026-10-27-trade-profile-and-leaderboard-docs-and-privacy-policy.md)
<!-- backlinks:end -->
