---
id: DEC-0068
title: Personalization learns from use, ranks What's new and runs experiments, with an off switch
type: decision
status: accepted
created: 2026-10-26
updated: 2026-10-26
authors: [ayan]
tags: [kpis, process, ui]
related: [DEC-0015, DEC-0053, DEC-0042, REF-0017, REF-0020]
---

# Personalization learns from use, ranks What's new and runs experiments, with an off switch

## In plain words

The product app now learns what each signed-in person uses and shows them more of it:

- **A profile per person.** How much they learn, how much they trade in demo accounts, their demo trading style, how often they come back, how much they use the larger tools, and which markets and kinds of strategy they look at.
- **A "What's new" feed on the home page.** New algorithms from the search, Academy lessons, Workbench tools, markets, Sim scenarios and Verify, sorted for that person. Each item says why it is there.
- **A home page that shrinks what you never use.** Widgets you keep scrolling past fold up after a few visits. You can open them again with one click. The account and disclaimer items never fold.
- **Experiments.** The team can show two versions of something to two groups and see which works better, with an automatic stop if a version makes things worse.

Anyone can see their profile, reset it or switch it off in Settings, Personalization. The privacy and cookie policies say all of this.

## Context

The owner asked for "an internal app algorithm" that understands each person and pushes the right things to them: tell learners from traders, gauge risk appetite and engagement, fill a What's new feed with things that might interest them, reduce home page bloat, and run experiments.

Parity already had the pieces to build on:

- Opt-in product analytics ([DEC-0053](0053-our-own-product-analytics-opt-in-stored-in-postgres.md)): page views, time, clicks and named actions such as `verify_run`, stored with a keyed hash of the user id.
- Product actions the app stores for its own features, which need no analytics consent: Academy progress ([DEC-0042](0042-parity-academy-a-full-screen-course-player-of-its-own.md)), demo orders, watchlists and Verify badges.
- The research results, the data registry and the strategy search, which produce new algorithms to show.
- The home widget list being built at the same time, where each widget has a fixed id.

Two rules shaped the design. The product and research sides stay apart ([DEC-0015](0015-two-sides-a-product-app-and-a-research-app-kept-apart.md)), and Parity never tells anyone to invest.

## Decision

### 1. The profile

A database job rebuilds each profile every 6 hours from the last 90 days. A person can also ask for a rebuild from the Personalization page, at most once every 5 minutes.

| Score | Built from |
| --- | --- |
| Learner, 0 to 1 | Lessons opened and finished, quick check results, and Academy page time when analytics is on |
| Trader, 0 to 1 | Demo orders, watchlist items, and Trade page time when analytics is on |
| Demo trading style, 0 to 1 or unknown | Demo trades only: position size against the account, total exposure against the account, the share of orders in volatile markets such as crypto, and how often a stop is set |
| Engagement, 0 to 1 | Days with any activity in the last 30 days |
| Larger tools use, 0 to 1 | Verify runs, connected AI apps and Workbench use |
| Interests | Market types and strategy families from demo orders, watchlists and What's new clicks |
| Widget use | How often each home widget is used or passed over |

Each score saturates, so a few actions move it and many actions do not push it past 1. The profile also keeps the counts it was built from, and the Personalization page shows them.

From the scores, each person gets one group: new, learner, trader, both or browser. The style score gives a band (careful, moderate, bold or unknown) and engagement gives one too (new, light, regular, heavy). The style score describes behaviour in the demo simulator. It is never used to suggest a product, a trade or an amount.

### 2. What's new

Candidates come from what the app already loads: new algorithms from the search and the registry, Academy modules, Workbench tools, markets, Sim scenarios and Verify. Each candidate gets a score that is the sum of four parts:

1. **Fit.** How well its tags (market type, strategy family, kind) match the person's interests and group.
2. **Popularity.** Its click rate across everyone, from counts with no ids.
3. **Recency.** Newer items score higher, fading over a few weeks.
4. **Exploration.** A draw from a Beta distribution over the item's clicks and shows (Thompson sampling), so new items get a fair chance and items nobody clicks fade out.

Each item shows "Why you see this", built from the parts that scored highest, such as "You finished 3 lessons on trend following" or "New this week".

A hook line may sit under the title. Hooks are built from numbers in our own data, and a hook is shown only when the number behind it exists and the sentence is true, for example "This bot won 99.1% of trades and still lost money". Hooks describe research results. They never say a strategy is good to invest in, and the research only disclaimer stays on the page. Items a person dismisses do not come back.

### 3. Home widgets

Widgets are ordered by how much each person uses them. A widget that was on screen but not used for 5 visits in a row folds to a single line. One click opens it again, and the choice to keep it open is saved. Required items, the account item and the disclaimer, are never folded, moved below the fold or removed. With personalization off, everyone sees the default order.

### 4. Experiments

- **Assignment.** A person's group comes from a hash of the experiment name and their user id, so it stays the same on every device.
- **Exposure.** The database records when a person first saw an experiment, and later outcomes count only after that.
- **Guardrails.** Each experiment names metrics that must not get worse, such as dismissals or people switching personalization off.
- **Stop rules.** An hourly job stops an experiment when a guardrail is worse in a variant than in control (one sided z above 2.58, with at least 100 people in each group), when its time limit passes, or when every group reaches its planned size. It never stops early to declare a winner.
- **Results.** The Metrics page shows each group's rate with a 95% confidence interval and the difference against control, computed with the same statistics code as Verify (`web/src/lib/verify/stats.ts`).
- **Who is included.** Only signed-in people with personalization on.

The first three experiments:

| Experiment | Control | Variant | Main metric | Guardrails |
| --- | --- | --- | --- | --- |
| What's new order | Newest first | Sorted by the model | What's new clicks | Dismissals, switching off |
| Hook wording | Title only | Title and hook line | What's new clicks | Dismissals |
| Widget defaults | Never fold | Fold after 5 unused visits | Widget use | Widgets reopened, switching off |

### 5. Rules

- **The two sides stay apart.** Recommendations may show research results. Product use, profiles and experiment data never feed a research test, a search or a ranking of strategies by return. The research writer role has no access to the personalization tables, and a database test checks this.
- **Not advice.** Nothing in What's new is a recommendation to invest. The research only disclaimer stays.
- **Analytics opt-out.** When analytics is off, or the browser sends Do Not Track or Global Privacy Control, the profile uses only the product actions listed above. Page use is never read for that person.
- **No sensitive inferences.** Parity never infers health, religion, politics, ethnicity, sexuality, age, gender, income, wealth, debt or real money trading ability. The style score is about the demo simulator only.
- **Retention.** Inputs cover the last 90 days. What's new feedback is deleted after 180 days. Experiment rows are deleted 90 days after the experiment stops. The profile and widget state are deleted 13 months after a person's last visit. The profile, widget state and feedback are deleted when a person resets or switches off personalization, and with the rest of their data when they delete their account.
- **Team pages.** The Metrics page shows group sizes, What's new click rates and experiment results. Counts from 1 to 4 show as "under 5".
- **Copy.** Every line follows [REF-0017](../reference/0017-parity-copy-rules.md).

## Consequences

- New people see a sensible default feed, because recency and exploration work without a profile.
- The team can test changes on the home page and see the result with an interval instead of a guess.
- The feed depends on the widget list from the home page rebuild for widget ids. Until it lands, widget adaptation has nothing to order.
- Personalization based on behaviour is disclosed in the privacy and cookie policies. Open legal questions live only in [REF-0020](../reference/0020-compliance-checklist-before-each-new-step.md).
- Small numbers make early experiments slow to conclude. The stop rules prefer waiting to a false winner.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0075: The app home is a full-width grid of widgets each person arranges](0075-the-app-home-is-a-full-width-grid-of-widgets-each-person-arranges.md)
<!-- backlinks:end -->
