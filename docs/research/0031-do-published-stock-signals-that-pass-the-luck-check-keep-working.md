---
id: RES-0031
title: Do published stock signals that pass the luck check keep working
type: research
status: current
created: 2026-11-02
updated: 2026-11-02
authors: [amanda]
tags: [data, method, open-source]
related: [RES-0030, INT-0003, DEC-0079, DEC-0032]
---

# Do published stock signals that pass the luck check keep working

## In plain words

Verify promises that most records it calls "Holds up" will still make money over the next 6 months ([INT-0003](../intent/0003-parity-verify-the-lie-detector-for-trading-strategies-and-bots.md)). Our own records need a year before we can check that. So we borrowed 212 stock-picking rules from published papers, where we already know what happened next. We ran Parity's luck check on each rule's record from its paper's own years, then looked at the 6 months after.

The luck check only means something once it counts how many rules were tried. Without that count it passes 197 of 212 rules, and those do no better than average afterwards. Counting 212 or 316 tries, it passes 56. Three in four of those made money over the next 6 months, which clears the 60% target. For the rules it failed, the figure was 58%.

## Summary

- **Source.** Open Source Asset Pricing, release 2026.10 ([DAT-0048](../datasets/0048-open-source-asset-pricing.md)) [@chen2022; @url-fbe25501]. It has 212 predictors with monthly long-short returns to December 2025 and each paper's sample years and publication year. RES-0030 had two open questions about this source, and both are now answered. The signal document does carry the sample end and publication year. The data are **CC BY 4.0**, so commercial use is allowed with credit. RES-0030 said no licence was stated; that was before the move to Hugging Face.
- **The luck check needs the count of tries.** Deflated Sharpe at 0.95 [@bailey2014a], on the in-sample months only:

| Tries counted | Pass | Positive next 6 months, passed | Positive next 6 months, failed |
| --- | --- | --- | --- |
| 1 (no count) | 197 of 212 | 63% (CI 56 to 70%) | 57% (14 rules) |
| 212 (this release) | 56 | **75% (CI 63 to 86%)** | 58% (CI 50 to 67%) |
| 316 (Harvey, Liu and Zhu) | 55 | **75% (CI 64 to 86%)** | 58% (CI 51 to 66%) |

  "Next 6 months" means the first 6 months after the paper's sample ended, which matches Verify's "data we did not see". CI is a 95% bootstrap interval. Across all 211 rules with data, 63% were positive over those 6 months, so that is the base rate a verdict has to beat.
- **After publication the gap narrows but holds.** Over the first 6 months after the publication year, 68% of passes were positive against 57% of fails. Over the whole period after publication (a median of 19 years), 95% of passes stayed positive against 79% of fails.
- **Decay matches the published estimate.** Scaling each rule's returns by its in-sample average, returns fell 21% between the sample end and publication and 47% after publication. McLean and Pontiff found 26% and 58% [@mclean2016]. Median annual Sharpe went from 0.68 in-sample to 0.49 and then 0.26.
- **What it means for Verify.**
  - The 60% target is reachable with the method we already have, but only when a real count of tries goes in. This is evidence for RES-0030's step 2: make the factor census count (316, or 382 from the later census [@harvey2019]) the default `prior_trials` for stock-factor claims. That is a method change, so it still needs a decision doc.
  - A "Holds up" verdict with the count left at 1 would have been right 63% of the time, which is no better than not checking.
  - 6 months is noisy: the edge over failed rules is about 17 points, and the intervals overlap at the edges. Accuracy over 12 months or more separates passes from fails more clearly.

## Method

1. Downloaded `SignalDoc.csv` and `Portfolios/Full Sets OP/PredictorLSretWide.parquet` from branch `Data-Release-2026.10`. These are monthly long-short returns in percent, built each paper's own way (its quantiles and weights).
2. For each predictor: in-sample months are the paper's `SampleStartYear` to `SampleEndYear`. The out-of-sample months run from the sample end to the publication `Year`. Post-publication means every month after the publication year.
3. Ran `parity.metrics.performance.deflated_sharpe` on the in-sample months with 1, 212 and 316 tries. A pass is 0.95 or above, the same bar the gauntlet uses.
4. The label is whether the mean return over the next 6 months is above zero, the same as a positive Sharpe over that window.
5. Reproduce with `python scripts/osap_labelled_rows.py OUT_DIR`. It writes one labelled row per predictor (id, sample, publication year, in-sample, next-6, out-of-sample and post-publication stats, deflated Sharpe at each trial count) and prints every number above. Rows are not committed. Loading them into the dataset is RES-0030's next step and is not done here.

## Limits

- **These are published winners.** Every rule here already got through peer review, so the sample is far kinder than what retail users will bring. The pass rate and base rate will both be lower for Verify's real inputs. What carries over is the gap between passed and failed rules, not the levels.
- **Gross of costs.** The long-short returns ignore trading costs, and some rules trade small, costly stocks. A cost haircut would push some 6-month results below zero.
- **One kind of strategy.** All US stock cross-section, monthly. It says nothing directly about FX, crypto, intraday or AI-agent records.
- **The in-sample record is OSAP's rebuild, not the paper's own numbers.** For most rules they are close (that is the project's point), but 26 predictors moved materially between releases. Pin the release.
- **Sharpe variance across tries is the single-estimate stand-in.** We used the same stand-in as `deflated_sharpe`'s default. A real cross-trial variance from the census would change the cut-off a little.

## Next

1. Decision doc: the factor census count as the default `prior_trials` for stock-factor claims (RES-0030 step 2), citing this result.
2. Load the rows as labelled outside research rows, kept apart from opt-in Verify rows, with source and licence on each row ([DEC-0032](../decisions/0032-parity-verify-as-a-data-and-api-business-with-a-free-retail-tier.md)).
3. Rerun with a cost haircut and with 12-month labels, and repeat on Jensen, Kelly and Pedersen's 93 countries (research-only licence) to see whether the gap holds outside the US.

## Sources

| Source | Link |
| --- | --- |
| Open Source Asset Pricing data release 2026.10 | <https://huggingface.co/datasets/OpenSourceAP/CrossSection> |

<!-- backlinks:start (generated by scripts/docs.py) -->
## Sources cited

- [@chen2022](../REFERENCES.md#chen2022): Chen and Zimmermann (2022), Open Source Cross-Sectional Asset Pricing
- [@url-fbe25501](../REFERENCES.md#url-fbe25501): Chen and Zimmermann (2026), Open Source Cross-Sectional Asset Pricing, data release 2026.10
- [@bailey2014a](../REFERENCES.md#bailey2014a): Bailey and López de Prado (2014), The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality
- [@mclean2016](../REFERENCES.md#mclean2016): McLean and Pontiff (2016), Does Academic Research Destroy Stock Return Predictability?
- [@harvey2019](../REFERENCES.md#harvey2019): Harvey and Liu (2019), A Census of the Factor Zoo

## Referenced by

- [RES-0030: Outside data to grow the counted-trials dataset](0030-outside-data-to-grow-the-counted-trials-dataset.md)
<!-- backlinks:end -->
