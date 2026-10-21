---
id: RES-0008
title: Independent audit of our methods and code
type: research
status: current
created: 2026-10-21
updated: 2026-10-21
authors: [ayan]
tags: [method, process]
related: [DEC-0007, DEC-0009, RES-0007]
---

# Independent audit of our methods and code

## In plain words

We asked an independent reviewer to attack our work the way a journal referee would. It found two serious bugs: our scoring gave strategies credit for interest that cash earns anyway, and it let them borrow money for free. Both made stock market rules look better and currency strategies look worse than they are. We fixed both ([DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md)). It also found that our tests are too strict to spot a modest real edge, that plans froze settings but not code, and that the repository owner could still rewrite the record. Its spot check of 12 research numbers found all 12 real, with 5 needing clearer wording.

## Summary

Audit run 2026-10-21 by a separate reviewer with read access only. 2 critical, 6 high, 7 medium and 9 low findings. Status of each fix is tracked in [DEC-0009](../decisions/0009-excess-returns-financed-leverage-frozen-code.md#status-of-every-finding). The reviewer's report follows unchanged except for headings.

## Findings at a glance

The engineering is careful and the timing of signals is correct. The main problems are in what the numbers are compared against. The headline "nothing beats the market" is probably right in spirit, but for partly the wrong reasons, and the gauntlet as built would not have been able to say yes to most real but modest edges.

Severity counts: 2 critical, 6 high, 7 medium, 9 low.

| Id | Severity | One line |
| --- | --- | --- |
| C1 | critical | Sharpe uses a zero risk-free rate on total returns, so holding cash "beats the market" on all six A tests |
| C2 | critical | Leverage is free and the "same risk" test is not at the same risk (benchmark at 19%, FX capped below 15%) |
| H1 | high | The gauntlet has little power: a strategy with true Sharpe 0.8 (market 0.54) passes the A tests about 17% of the time |
| H2 | high | Trial count of 188 mixes unrelated families and counts extra check reruns; it alone sets the A3 bar |
| H3 | high | No true out-of-sample test or walk-forward; the "holdout" is the last 5 years, already seen |
| H4 | high | A registration freezes names and parameters, not code; the engine and strategy code can change after registering |
| H5 | high | Registration and ledger can be gamed by the owner (local commit plus dry run, force push on a private free repo, recomputable hash chain) |
| H6 | high | Standalone FX books are judged against equities, which is the wrong test for the stated question; as an overlay, carry looks useful |
| M1 | medium | The stocks plus FX trend overlay leaves half its capital idle at 0%, understating the project's lead idea |
| M2 | medium | One negative WTI print switches off the CAD leg of the commodity gap for over a year |
| M3 | medium | Rate data: month-average values used from the first day of the month, interbank rate as "cash", stale EUR and GBP rates, no JPY rate before 2002 |
| M4 | medium | Cost model is flat 1 bp with no forward roll cost, financing spread or slippage |
| M5 | medium | A5 and A6 are point comparisons with no uncertainty, against eras where the market's Sharpe was 0.90 and 0.78 |
| M6 | medium | B3 "not run" is shown and counted as "fail"; B3 grids are not neighbourhoods |
| M7 | medium | Results are not fully reproducible from release assets (unpinned packages, private repo) |
| L1 to L9 | low | Annualisation with 252 on a 261-day calendar, rank ties, IC details, placebo details, benchmark splice, breakeven definition, doc drift, owner DB credential in CI, research wording (12 of 12 cited numbers checked out, 5 need wording fixes) |

## Code bugs and lookahead

### C1 (critical). Zero risk-free Sharpe on total returns makes cash look like skill

**What is wrong.** `metrics/performance.py:33` and `gauntlet.py:60` compute Sharpe as mean over standard deviation with no risk-free rate. The benchmark `eq.US_TOTAL` is a total return (French Mkt-RF plus RF, `data/sources.py:120`), and the stock timing rules hold `cash.USD`, which earns the US 3-month rate (`backtest/engine.py:59`). The FX strategies are unfunded long-short books whose returns are already excess returns (spot move plus rate gap, no collateral interest). So the benchmark and the cash-holding rules get credit for the T-bill rate inside their Sharpe, and the FX books do not. The module docstring says this "flatters nothing"; it does.

**Evidence.**
- A strategy that only holds `cash.USD` (chk5.py, run through `run_gauntlet` with 188 trials) passes all six A tests and 9 of 11 overall. A1: Sharpe 17.99 vs 0.54. A2: 9.6% vs 8.8% a year. A3: 1.00. A5: 31.6, 14.6, 23.3 vs 0.08, 0.90, 0.78. A6: 41.9 vs 0.71. B1, B4 and B5 also pass. Verdict: "Looks like it beats the S&P 500".
- Market Sharpe: 0.54 with zero risk-free rate, 0.43 on excess returns over the 3-month T-bill (chk1.py).
- Excess-return Sharpe of the stock rules (chk1.py, chk2.py): golden cross 0.54, 10-month trend 0.59, vol-managed 0.51 after paying for its leverage, sell in May 0.42, turn of month 0.35, stocks plus FX trend 0.49 once its idle half earns cash (see M1). Turn of month and sell in May pass A1 today (0.61 and 0.57 vs 0.54) only because of the cash yield; on excess returns they are below the market's 0.43.
- `fx_carry` Sharpe is 0.41 and already excess. Against the market's 0.43 excess Sharpe it is almost a tie, not the clear loss the table suggests (0.41 vs 0.54).

**What it could change.** Which strategies pass A1, A4, A5 and A6; the B1 and B4 results for cash-heavy rules; the A3 deflated Sharpe (it tests Sharpe above zero, and cash alone clears that); the narrative that FX is far behind stocks on risk-adjusted terms.

**Fix.** Compute every Sharpe, Sortino, deflated Sharpe, bootstrap and placebo on excess returns over the T-bill (French RF, or DTB3 shifted by a day). For total-return CAGR comparisons, credit unfunded FX books with the T-bill on their collateral. Add a cash-only strategy and a coin-flip strategy as permanent negative controls in the test suite; the gauntlet must fail both.

### C2 (critical). Leverage is free, and A2 is not at the same risk

**What is wrong.**
- `backtest/engine.py:80-85` scales positions by up to `max_leverage` 4 with no borrowing cost. On funded assets (`eq.US_TOTAL`, `cash.USD`) this creates return from nothing: 4x cash earns 4x the rate. `stocks_vol_managed` (`strategies/stocks_and_mixed.py:118-122`) holds up to 2x stocks with `cash = (1 - w).clip(lower=0)`, so the borrowed part is free.
- In A2 (`gauntlet.py:152-159`) only the strategy is scaled to 15% volatility. The benchmark is left at its own volatility, which is 19.1% over 1999 to 2026, not 15%. DEC-0006 says both are compared "when scaled to SPY's long-run volatility".
- For FX books the 4x cap binds, so `fx_carry` reaches only 12.7% realised volatility in A2 (average gross 3.7x), and is then compared with a benchmark at 19.1% that also earns the T-bill.

**Evidence (chk2.py).** Benchmark CAGR at its own 19.1% volatility: 8.8%. Benchmark scaled to 15%: 7.2%. `stocks_vol_managed` holds 1.21x stocks on average, above 1x on 62% of days; paying the T-bill on the borrowed part cuts its CAGR from 11.0% to 10.4%. In A2, `stocks_trend_10m` runs at an average 1.69x gross and `stocks_golden_cross` at 1.76x, all unfinanced. Cash-only scores 9.6% in A2 (C1).

**What it could change.** A2 currently favours stock rules (free leverage) and penalises FX books (no collateral interest, cap, benchmark at higher risk). The headline "8 of 11" for `stocks_vol_managed` partly rests on free borrowing.

**Fix.** Charge the T-bill plus a spread (for example 50 bp) on any gross funded exposure above 1, and credit the T-bill on unused collateral. Scale the benchmark to the same target, or scale the strategy to the benchmark's realised volatility over the same window. Report how often the leverage cap binds and fail A2 as "not testable" when the target is not reached.

### M1 (medium). The overlay leaves half its money idle

**What is wrong.** `StocksPlusFxTrend.weights` (`strategies/stocks_and_mixed.py:165-174`) holds 0.5 in stocks plus unfunded FX legs, and no `cash.USD`. The other half of the capital earns nothing.

**Evidence (chk2.py).** CAGR 6.8% as built, 7.9% if the idle half earns the T-bill. Excess Sharpe with idle cash credited: 0.49, against the market's 0.43.

**What it could change.** This is the project's lead (HYP-0007). On a consistent excess-return basis the overlay may beat the market on A1 rather than lose.

**Fix.** Put the unused half in `cash.USD`, or define the overlay as 100% market plus an FX overlay.

### M2 (medium). One negative WTI price switches off the CAD leg for over a year

**What is wrong.** `fx_commodity_gap.py:54` sets non-positive WTI prices to missing, which is sensible, but the 250-day rolling covariance and variance (lines 55-56) then return NaN for 250 days after the single bad day, and the z-score needs a further 125 valid values.

**Evidence (chk3.py).** One row with WTI at or below zero (2020-04-20). The CAD signal is NaN for all 313 rows checked from 2020-04-20 to 2021-06-30. The CAD weight is zero on 98.9% of days from 2020-04-21 to 2021-04-30. That is about a third of the A6 "last five years" window.

**What it could change.** The commodity gap's recent-years and era-3 numbers. It is unlikely to rescue the strategy, but the official numbers describe a different strategy from the one registered.

**Fix.** Pass `min_periods` (for example 200) to the rolling calls, or drop only the bad observation, or use Brent for both legs.

### M3 (medium). Rate data: dating, choice and staleness

**What is wrong.**
- The OECD series `IR3TIB01xxM156N` are monthly averages stamped on the first day of the month (for example `rate.USD` 2008-10-01 = 3.19). `data/store.py:122` forward fills them from that date, so the October average is used from 1 October, before it exists. Monthly series are filled without limit.
- `cash.USD` earns `rate.USD`, the interbank rate, not a T-bill. In October 2008 that was 3.19% against a T-bill average of 0.67%. Average 1999 to 2026: 2.30% against 2.04%.
- `rate.EUR` and `rate.GBP` end on 2026-01-01 and are carried forward for nine months.
- `rate.JPY` starts 2002-04-01 and `rate.CHF` 1999-07-01, so carry excluded the yen, the classic funding currency, for the first three years, and yen positions in other strategies accrue no carry (`engine.py:67` fills missing gaps with 0).

**Evidence (chk6.py).** Lagging all rates by 30 business days for the signal moves `fx_carry` Sharpe from 0.410 to 0.401 and `fx_dollar_carry` from 0.255 to 0.279. Using the T-bill for cash moves `stocks_turn_of_month` CAGR from 4.64% to 4.42%. So the measured effect is small, but it is a real lookahead and a real stale-data risk.

**Fix.** Shift monthly series to the first business day after the month ends plus a publication lag. Use DTB3 (daily, shifted one day) for cash. Fail a run when any required series is more than about 45 days stale. Use a different source for JPY before 2002 or start carry tests in 2002 and say so.

### L1 (low). Annualisation on a 261-day calendar

`data/store.py:117` builds the panel on `bdate_range` (Monday to Friday, 261 rows a year), while `TRADING_DAYS = 252` is used for years, Sharpe scaling and daily accruals. Benchmark CAGR prints as 8.80% but is 9.13% using calendar years (chk1.py). Cash and carry accruals per row are 3.6% too high. Affects all strategies similarly; absolute numbers in DEC-0008 and EXP-0004 are a little off. Fix: compute years from dates and accrue by calendar days.

### L2 (low). Rank ties in carry

`fx_carry.py:42-47` ranks with the default average method. On 67 days the book holds 5 or 7 positions (gross 0.833 or 1.167), for example 2004-11-30 when NOK and SEK both sit at -0.21 (chk3.py). Fix: `rank(method="first")` or a fixed tie-break.

### L3 (low). Information coefficient details

`metrics/signal.py:13-15` uses spot-only forward returns, so carry's IC measures only the spot move and leaves out the rate gap it earns. Multi-day horizons overlap (the docstring says so). With fewer than three instruments it pools by calendar year, which mixes the time-series and cross-section. Label these clearly or compute IC on total returns including carry.

### L4 (low). Placebo and bootstrap details

The placebo (`gauntlet.py:94-107`) rolls positions but subtracts the original cost series, and the p-value has no plus-one correction. The block bootstrap is standard and correctly implemented. The circular shift being harsh on slow strategies is already documented. Fix: roll turnover with positions; use (1 + count) / (N + 1).

### L5 (low). Benchmark splice

`data/store.py:57-75` adds a "dividend accrual" equal to the whole gap between the French total market and S&P 500 price return over the last year. That gap mixes dividends with the small-versus-large return difference, and it is clipped at zero. It affects only the last two months, but it changes every month, so reruns of the same registration give different numbers. Fix: use a fixed dividend yield source or stop the benchmark at French's last date for official runs.

### L6 (low). Breakeven cost for cash-holding rules

`performance.py:127` divides gross mean by turnover. For rules that hold cash, gross includes the T-bill yield and the market premium, so breakeven is overstated (for example 355 bp for the 10-month trend). Compute it on the timing return (strategy minus a matching static mix).

### Checked and found correct

- Signal timing: weights decided at close t are held over t+1 (`engine.py:78`); strategies use data up to t.
- Rebalance masks (`strategies/_util.py:9-24`), the 10-month trend, golden cross, turn of month (holds the last day and first three days, as described) and sell in May: no lookahead found.
- Volatility targeting uses realised volatility up to t-1 (`engine.py:81-83`).
- REER: 42 business days of lag on month-start stamps is adequate against BIS's roughly six-week release. Revisions (current vintage, not as first published) remain an unmeasured risk.
- Drawdown, CAGR, Sortino formulas are standard (except L1).
- Deflated Sharpe (`performance.py:63-87`) matches Bailey and Lopez de Prado (2014): expected maximum Sharpe with the Euler-Mascheroni weights, non-excess kurtosis with (kurtosis - 1) / 4, daily Sharpe with T - 1. The one departure is that V[SR] uses the sampling variance of a single estimate instead of the variance across trials (see H2).
- Moving block bootstrap indices (`gauntlet.py:66-72`) are correct.

## Statistical design

### H1 (high). The gauntlet cannot detect modest edges

**What is wrong.** "Beats the market" needs six A tests to pass together, four of them Sharpe comparisons with no allowance for noise, plus a deflated Sharpe bar set by 188 trials.

**Evidence (chk3.py, chk4.py).** Standard error of an annual Sharpe over this sample is about 0.19. Power to tell a true Sharpe of 0.3 from 0 at the 5% level, one-sided: 49%. At 188 trials the deflated Sharpe needs an annual Sharpe of about 0.82 to reach 0.95 (0.64 at 16 trials, 0.40 at 2). Simulating strategies over the real 1999 to 2026 benchmark path (2,000 draws, A1, A3, A5 and A6 only):

| True Sharpe | Correlation with market | P(pass A1, A3, A5, A6) |
| --- | --- | --- |
| 0.54 (equal to market) | 0 | 1.8% |
| 0.70 | 0 | 6.9% |
| 0.80 | 0 | 16.5% |
| 0.80 | 0.8 | 36.9% |
| 1.00 | 0 | 40.0% |

**What it could change.** The conclusion should read "we could not detect an edge, and our test could only have detected edges above roughly Sharpe 1", not "currency strategies cannot beat the market".

**Fix.** Pre-register a minimum detectable effect and report power with every verdict. Replace the conjunction of point comparisons with one primary test of the Sharpe difference against the benchmark (for example Ledoit and Wolf 2008, with a block bootstrap), and report its confidence interval. Keep the other tests as descriptive.

### H2 (high). Trial counting drives the A3 result

**What is wrong.** `official.py:54-56` uses max(declared prior trials, ledger count) plus the strategies in the run, and applies the same N=188 to every strategy. The ledger count (`official.py:77`, `ledger.py:102-110`) adds the volatility-matched and double-cost reruns as trials, though they are extra checks, not selection. N pools unrelated families (stock timing, FX carry, commodity trend) and highly correlated variants (k=2,3,4 carry). `prior_trials` is self-declared. The deflated Sharpe uses the sampling variance of one Sharpe estimate in place of the variance across the trials actually run.

**Evidence.** The A3 bar moves from Sharpe 0.64 at N=16 to 0.82 at N=188 (chk3.py). The 10-month trend rule (Sharpe 0.75 as built) would pass A3 at N=16 and fails at N=188, so N alone decides that test.

**Fix.** Count trials per hypothesis family. Estimate the effective number of independent trials by clustering the recorded variant returns (Lopez de Prado's ONC approach) and use the cross-trial variance of their Sharpes. Do not count extra check reruns. Store every exploratory variant's returns so the count is measured, not declared.

### H3 (high). No out-of-sample evidence

**What is wrong.** DEC-0006 rule 5 ("passes on a held-back period that was not used to choose parameters") is implemented as A6, the last five years, which every registration admits was already seen. Everything is one full-sample backtest; nothing is walk-forward. REF-0006 is honest about this, but the verdict labels still read as tests of "real" effects.

**Fix.** Treat only data after each registration date as out of sample and report it separately. Use combinatorially symmetric cross-validation (probability of backtest overfitting, already on the reading list) on the stored variants. Consider pre-1999 FX data (H.10 back to 1971, most rates back to the 1980s) as an extra check for rules designed on post-2000 experience.

### H6 (high). The test does not match the question for FX

**What is wrong.** INT-0001 asks whether a systematic currency strategy can beat the S&P 500 "once costs and risk are accounted for". An unfunded FX book sits on top of cash or stocks; its fair test is whether it improves a portfolio, not whether it beats equities alone. REF-0006 notes this but the official verdicts do not test it.

**Evidence (chk7.py, in-sample, sizing chosen after the fact, so exploratory only).** `fx_carry` has 0.27 correlation with the market. Market excess Sharpe 0.43; market plus a carry overlay at half the market's volatility: 0.52. Carry plus trend plus value: 0.52.

**Fix.** Register a portfolio test: alpha regression of FX returns on the market (and on known FX factors), and Sharpe of a pre-specified market plus overlay mix, with costs and the overlay's leverage charged.

### M5 (medium). A5 and A6 are strict and noisy

Market Sharpe by era: 0.08, 0.90, 0.78; last five years 0.71 (chk4.py). Even a true Sharpe of 0.8 passes A5 only 21% of the time when uncorrelated. A6 sits inside A5's third era and inside A1. A4 is nearly redundant with A1 at 1 bp for most strategies (low turnover). Fix: one pre-specified subperiod stability check with a tolerance (for example Sharpe difference above minus one standard error in each era), not a strict win in every era.

### M4 (medium). Cost model

Flat 1 bp per unit traded for every instrument and era (`engine.py:28`). No roll cost for carry, which in practice is held through forwards rolled each month (turnover shows 0.6 a year for `fx_carry`, which understates real trading). No financing spread on leverage (C2), no slippage on close-of-day fills, and the same cost for NOK, SEK and NZD as for EUR in 1999. Carry accrual uses interbank rate gaps, which ignore the cross-currency basis since 2008 and the swap markups a retail trader pays. Breakeven costs are close to realistic levels for some strategies: value 2.7 bp, commodity gap 2.9 bp, turn of month 11.4 bp at 46 round trips a year. Fix: per-currency, per-era spreads, monthly roll costs on forward positions, and a retail-cost scenario.

### Other design notes

- Benchmark: the total US market (Fama and French) is a fair and slightly harder bar than the S&P 500 (DEC-0008 says so). The docs and verdict strings still say "S&P 500" everywhere, which a referee would flag.
- Selection of strategies: textbook G10 versions only. No emerging market currencies, where carry and value are strongest in the literature; no forward-implied carry. A null on G10 spot plus monthly interbank rates says little about the strategy families in general.
- Survivorship: the G9 universe from 1999 has no survivorship problem in the usual sense, but the choice of G10 is itself made with hindsight.

## Protocol and integrity

### H4 (high). Registrations do not freeze code

**What is wrong.** A registration pins strategy names, parameters, backtest settings and pass criteria (`registration.py:24-81`). It does not pin a commit, a hash of `engine/src`, or the gauntlet thresholds. The official workflow checks out the current `main` (`official-run.yml`, `ref: main`). Anyone with push access can change a strategy's implementation, the gauntlet, or a data transform after registering, and the official run will use the new code under the old plan.

**Fix.** Store the commit SHA (or a hash of `engine/src` and the catalog) in the registration, and refuse an official run if strategy, gauntlet, metrics or data code differs from that commit.

### H5 (high). The owner can game registrations and rewrite the record

**What is wrong.**
- Dry runs need only a local commit (`official.py:48`, `ledger.py:124-131` read local git). Someone can commit a registration locally, dry-run it, see results, then `git reset` and never push. DEC-0007 rule 4 is not enforced against this.
- The repository is private on a free plan. Branch protection and rulesets are unavailable: the GitHub API answered 403 "Upgrade to GitHub Pro or make this repository public" for both. So force pushes to `main` are possible, and "pull requests may not touch ledger/" is a CI check, not a block on direct pushes.
- The hash chain is self-contained. Anyone who can write the repo can recompute every hash after editing an entry. It catches accidents, not a deliberate rewrite.
- The "independent records" (GitHub releases, weekly archive release, Supabase) all belong to the same owner. Releases and tags can be deleted or moved; the Supabase owner can edit tables. Because the repo is private, the claim "anyone can rerun from that data" is not true outside the team.

**Fix.** Publish the ledger head hash somewhere the owner cannot edit after the fact (OpenTimestamps, a public gist or repo, a Zenodo deposit, or an email to an outside party) after every official run. Require a registration to exist on `origin/main` (check with `git branch -r --contains`) before any dry run, or allow dry runs only inside the workflow. Make the repo public or mirror the ledger and releases publicly.

### M7 (medium). Reproducibility from the release alone

The release holds the outputs, the ledger details and `engine/data` (`official-run.yml`, release step). Good. But dependencies are unpinned (`engine/pyproject.toml`: `numpy>=1.26`, `pandas>=2.2`, no lock file), the package versions are not recorded in the ledger, and there is no command that reruns from a release tarball and diffs the result. Pandas behaviour around rolling windows and resampling has changed across versions. Fix: commit a lock file with hashes, record versions in each ledger entry, add `parity reproduce RUN-xxxxxx`.

### Single points of failure

- One GitHub account holds the code, the ledger, the releases, the archive and the Actions secrets.
- Data come from free endpoints (FRED CSV through curl, the French library) that can change or revise history.
- The weekly archive is published to the same repository it backs up.
- L8 (low): the archive workflow reads an owner-level `SUPABASE_DB_URL` secret. Any push to `main` can change a workflow to misuse it. Use a read-only role for the export.

### L7 (low). Document drift

README says 3 strategies tested and 2 official runs; the ledger has 3 runs and EXP-0004 tests 16. REG-0003's title says fifteen and lists sixteen (EXP-0004 records this). Hand-typed exploratory numbers sit outside the generated results blocks (for example DEC-0008 "8.8% a year against 8.4% for SPY"), which the results check does not cover. `scripts/docs.py:742` prints "fail" for a test that returned "not run" (see M6).

### M6 (medium). B3 "not run" shown and counted as "fail"

Strategies with no `param_grid` (`fx_carry_trend_value`, `stocks_plus_fx_trend`, `stocks_sell_in_may`) get B3 = None (`gauntlet.py:218`). `scripts/docs.py:742` renders it "fail", and `gauntlet.py:261` counts it as not passed, so these strategies can score at most 4 of 5 on B. The B3 grids are the first 12 entries of a product (`gauntlet.py:115`), include the default point, and are not centred on it. B3 also tests Sharpe above zero on total returns, which cash-heavy rules pass without skill (C1). Fix: show "n/a", leave it out of the denominator, centre grids on the default.

## Research content spot checks

Twelve cited numbers were checked against their sources (papers, NBER and SSRN versions, or published abstracts where the publisher blocked access). Result: **all 12 numbers exist in the cited source, none is misattributed, and 5 need a wording fix.** This is better than I expected for AI-compiled material. It does not mean the other roughly 150 cited figures are right; only these were checked.

| # | Claim (file) | Verdict |
| --- | --- | --- |
| 1 | Hutchinson et al. (2022): FX carry, momentum, value Sharpe +0.39 before publication to -0.32 after (docs/research/0001-reading-list.md:25, :144) | Numbers right, wording off. The abstract says the average out-of-sample Sharpe falls from +0.39 to -0.32, pre versus post publication. Both are out-of-sample figures; line 144 mixes "after publication" and "out of sample". |
| 2 | McLean and Pontiff (2016): 26% lower out of sample, 58% lower after publication (0001-reading-list.md:141) | Verified (abstract, 97 predictors). |
| 3 | Hou, Xue and Zhang (2020): 65% of 452 anomalies fail t = 1.96, 82% fail 2.78 (0001-reading-list.md:138) | Verified (value-weighted, NYSE breakpoints). |
| 4 | Verdelhan (2018): dollar and carry factors explain 18% to 80% of monthly moves (0001-reading-list.md:74) | Numbers right. The paper calls the first factor a slope factor built from dollar betas, not simply "dollar". Minor. |
| 5 | Hurst, Ooi, Pedersen: 1880 to 2013 Sharpe 0.77, 11.2%, 9.7%; 2000 to 2013 Sharpe 0.62, 7.9%, 9.6% (catalog/algorithms/managed-futures-trend-following.json) | Verified, net of simulated costs and 2/20 fees (gross 14.9%). |
| 6 | Frazzini and Pedersen BAB Table III: Sharpe 0.78, 8.4% a year, volatility 10.7% (catalog/algorithms/betting-against-beta.json) | Numbers right, units off. The table prints 0.70% a month; 8.4% is that times 12, not a printed value. |
| 7 | Lustig, Roussanov, Verdelhan (2014) dollar carry, developed: Sharpe 0.66, 5.6%, 8.53% (catalog/algorithms/fx-dollar-carry.json) | Verified, net of bid-ask. |
| 8 | Menkhoff et al. (2012) carry: 48 currencies Sharpe 0.74, 7.23%; 15 developed Sharpe 0.56, 5.72% (catalog/algorithms/fx-carry-g10.json) | Verified, net of bid-ask. |
| 9 | Gu, Kelly, Xiu: value-weighted long-short Sharpe 1.35 (catalog/algorithms/ml-return-prediction-elastic-net.json) | Number right but it is the best of five neural nets (NN4); NN3 and NN5 give 1.20 and 1.15. Before costs. Quoting the best model is a selection effect worth stating. |
| 10 | Fischer and Krauss (2017) LSTM: Sharpe 2.34, 82.3% a year, volatility 33.2%, drawdown -52.3% (catalog/algorithms/lstm-sequence-models.json) | Verified, after 5 bp per half-turn (before costs Sharpe 5.83). |
| 11 | Asness, Moskowitz, Pedersen (2013): currency value Sharpe 0.34, 3.3%, 9.7%; 50/50 combo 0.63 (catalog/algorithms/fx-value-ppp.json) | Verified. |
| 12 | Della Corte, Ramadorai, Sarno VRP developed: Sharpe 0.61, 4.95% (catalog/algorithms/fx-volatility-risk-premium.json) | Numbers right for the Feb 2015 working paper the URL points to. The entry cites the 2016 JFE article; the published tables were not checked. |

### L9 (low). Research wording

Fix the five wording issues above. More useful in general: for every reported result, record gross or net, which model or portfolio out of how many, and the exact table and version. Items 6, 9 and 12 show the typical failure: the number is real but its context drifts.

## Other points a referee would raise

- The conclusions in EXP-0004 ("currency trend made money in most stock market crashes", "carry looks like a small real effect") rest on the same full-sample, already-seen data and on C1 and C2.
- `commodity_tsmom` on spot gas and Brent is rightly flagged as not meaningful, but it still enters the trial count and the results table.
- The dashboard and verdict strings call a total-market benchmark "the S&P 500".
- No negative controls or known-answer tests exist (for example, a strategy with injected lookahead must pass, cash-only and random must fail). These would have caught C1 and C2.

## What the project does well

- Signal timing is correct and documented in one place; strategies cannot shift their own weights.
- One backtester for everything, so comparisons are like for like apart from the issues above.
- The deflated Sharpe is implemented to the paper, with skew and kurtosis.
- Pre-registration, a hash-chained ledger, generated results blocks and a data fingerprint per run are far beyond what most student or retail projects do.
- Failures and protocol slips are written down (the REG-0002 dry run, the REG-0003 counting slip, the known weaknesses section of REF-0006).
- Thresholds are fixed in code with plain-language explanations; data sources were moved off Yahoo for licence reasons.
- 51 unit tests pass (`pytest -q`, 1.2 s).

## Suggested order of fixes

1. C1 and C2 together (excess returns everywhere, financed leverage, matched-risk A2), plus negative-control tests. Then rerun REG-0003 as a new registration.
2. H4 and H5 (pin code in registrations, external anchor for the ledger head, no local dry runs).
3. H1, H2, H6 (power statement, family-level trial counts, a registered overlay test).
4. M1 to M7, then the low items.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0009: Score on returns above the T-bill, charge for borrowing, and freeze code with each plan](../decisions/0009-excess-returns-financed-leverage-frozen-code.md)
- [RES-0010: Paper library: FX and market microstructure](0010-paper-library-fx-and-market-microstructure.md)
- [LOG-0004: Ayan work log, requests and outcomes](../log/2026-10-21-ayan-work-log-requests-and-outcomes.md)
<!-- backlinks:end -->
