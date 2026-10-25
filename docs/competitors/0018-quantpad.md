---
id: CMP-0018
title: QuantPad, an AI quant workspace that grades strategies A to F
type: competitor
status: current
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [competitors, data, method, strategy]
related: [CMP-0001, RES-0020, RES-0021, DEC-0032, DEC-0036, DEC-0043]
---

# QuantPad, an AI quant workspace that grades strategies A to F

## In plain words

QuantPad is a website where traders ask an AI helper to write and test trading strategies on years of real market data. It also gives each strategy a school grade, A to F, and says when a result looks too good to be true. Its users are mostly futures traders trying to pass prop firm tests. Parity should learn from how plainly the grade explains itself, and beat it by counting how many versions were tried before the winner was shown.

## Summary

| | |
| --- | --- |
| What it is | An AI coding agent, licensed tick data and cloud notebooks in one workspace, with a strategy grade ("the Verdict"), Monte Carlo and a prop firm simulator ([home](https://quantpad.ai/)) |
| Who uses it | Systematic and prop firm traders, mostly US futures. No user count or funding disclosed |
| Pricing | One plan: $169.99 a month "early subscriber" price, locked while subscribed; $299.99 a month standard price for later joiners; monthly AI usage allowance, top ups at model cost (checked 24 October 2026, [subscribe](https://quantpad.ai/subscribe)). RES-0020 found the price behind sign-in on 23 October; it is now public |
| Markets | 40+ CME futures (16 years of ticks), 8,000+ US stocks (8 years of bars), OPRA and CME options chains, 30 days of 10-level order book; FRED and SEC EDGAR data. Historical only, no live feed |
| Platforms | Web; MCP server for Claude Code, Codex and Cursor; REST API and Python package (`quantpad_data`). No mobile app found |
| Signature features | The Verdict (A to F grade with findings); prop firm pass odds for Topstep, Apex and Take Profit Trader; regime map and regime-aware Monte Carlo; Pine, NinjaScript, PowerLanguage and EasyLanguage coding with a linter; community library of clonable projects |

## Strengths and weaknesses

How it verifies: the Verdict scores four things (edge, robustness, risk, sample adequacy) and lists findings with a severity, a reason and a suggested fix. The public demo grades a 327 trade NQ backtest a D because every confidence interval on the mean trade includes zero. It also reports PSR and DSR on the daily returns. In that demo both read 81.88%, which means the DSR was run as if only one strategy had been tried ([home](https://quantpad.ai/), Verdict tab). The tool never asks how many variants were tested, so the luck adjustment that matters most is switched off. RES-0020 said it had no deflated Sharpe at all; that is now wrong, the number is there but uncorrected ([RES-0020](../research/0020-verifying-trading-claims-market-size-and-competitors.md)).

Strengths:
- Speaks plain language: each finding says why it matters and what to do next, for example "gather a larger out-of-sample set" ([home](https://quantpad.ai/)).
- Flags classic overfit tells: a suspiciously smooth curve, expectancy near zero, profit from one market regime.
- Prop firm simulator turns a trade log into pass odds, expected payout, average resets and cost to pass, against each firm's real rules.
- Data is bundled, so a user does not need a second vendor. Ticks, quotes and depth come from CME, NYSE, Nasdaq and OPRA.
- Works inside coding agents over MCP, so research can run where the trader already works.

Weaknesses:
- No trial count: the DSR equals the PSR, so a winner picked from 1,000 runs grades the same as a single honest test.
- The grade sits inside a paid workspace. We found no public, shareable certificate or badge for a third party to check.
- Its own agent generates and tweaks many variants, which is exactly the search that inflates results, yet the Verdict does not see that search history.
- No look-ahead or data leakage test is described on the public page.
- One plan at $169.99 to $299.99 a month is steep for someone who only wants a check, not a research stack.
- Small, young company: one public repo, no docs site, no status page, no changelog found.

## What users say

<!-- collector:start -->
<!-- collector:end -->

We found no independent reviews. There is no App Store app, no Hacker News thread and no GitHub issue traffic beyond one small repo (6 stars). Themes below are **unverified** guesses from the product page only.
- Liked most: **unverified**. The page leans on the prop firm calculator and the "honest grade" as the hooks.
- Complained about most: **unverified**. Price relative to single tools is the likely objection, since the page argues against it directly with a $5,070 a month "without QuantPad" comparison.

## UX notes

- **Layout**: a project workspace with files on the left, an agent chat thread in the centre, and result panels (charts, tables) that render inline in the thread. Not a trading layout like those in [RES-0021](../research/0021-how-trading-platforms-lay-out-a-workspace.md).
- **Onboarding**: sign up, then subscribe. Projects, Copilot and Social links all lead to sign up first. No free tier or trial found.
- **Navigation**: three top sections (Projects, Quant Copilot, Social). In the composer, "/" loads skills and "@" adds context.
- **Density**: the Verdict card is dense but ordered: big letter grade, one sentence reason, four dimension scores, a metrics grid, then numbered findings.
- **Charting**: equity path fans for Monte Carlo (P5 to P95 band, median), regime P&L bars, prop firm challenge and funded paths.
- **Order entry**: none. Research only.
- **Shortcuts**: "/" and "@" in the agent composer. Nothing else found.
- **Mobile**: no app; the marketing site is responsive, the workspace on a phone is **unverified**.
- **Speed perception**: the page sells parallel cloud sandboxes and bulk data over Arrow. We did not run a job.
- **Trust signals**: licensed exchange data named by venue, a "past performance" disclaimer, Stripe checkout, an AGPL Pine runner on GitHub. No method paper for the grade.

## What Parity should copy, avoid or beat

- **Copy:** the finding format (severity, plain reason, "why it matters", suggested fix). Verify's red flags should read the same way ([DEC-0036](../decisions/0036-verify-runs-its-checks-in-the-browser-and-holds-daily-prices-only.md)).
- **Copy:** a single letter or word verdict with the four or five dimension scores right under it. Verify already ranks five verdicts; showing the parts builds trust.
- **Copy:** prop firm pass odds from a trade log. Workbench "what if" could run the same rules on a strategy's history ([DEC-0043](../decisions/0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)).
- **Avoid:** reporting a DSR without a trial count. If the user does not say how many variants they tried, Verify should say so on the badge, not silently assume one.
- **Avoid:** locking the check inside an expensive research plan. Verify's free retail tier is the wedge ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
- **Beat:** count tries automatically. When Workbench runs a search, it knows the number of variants and can hand it to Verify, so the luck adjustment is real.
- **Beat:** a public, portable badge and a published method, so a third party can check a claim without a QuantPad login.
- **Beat:** look-ahead and fill realism checks, which QuantPad's public page does not describe.

## Sources

- [QuantPad home page, including the Verdict, prop firm and Monte Carlo demos](https://quantpad.ai/), checked 24 October 2026
- [QuantPad subscribe page (prices)](https://quantpad.ai/subscribe), checked 24 October 2026
- [QuantPad/pine-runner on GitHub](https://github.com/QuantPad/pine-runner), checked 24 October 2026

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [CMP-0001: What users praise most in trading platforms, and what Parity takes from it](0001-ux-patterns-users-praise-most.md)
<!-- backlinks:end -->
