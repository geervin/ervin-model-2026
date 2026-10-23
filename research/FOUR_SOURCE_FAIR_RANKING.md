# Fairness audit: historical publisher ranking (October 23, 2026)

## Provisional result — common matched sample only
All three available publishers are evaluated on the exact same four **2024 U.S. Senate** contests (Ohio, Texas, Florida, Montana), with the **Original Ervin state correction reconstructed from pre-2024 historical elections**. See [underlying values](../blend_backtest_2024.csv). Signed margins use Democratic minus Republican.

| Rank by MAE | Publisher | MAE (pts) | RMSE (pts) | Mean signed error (pts) | Matched elections |
|---|---|---:|---:|---:|---:|
| 1 | DDHQ | 3.77 | 4.80 | −0.50 | 4 |
| 2 | RCP | 3.95 | 5.11 | −0.55 | 4 |
| 3 | 270toWin | 4.12 | **4.61** | +0.47 | 4 |
| **Unranked** | Silver Bulletin | Not established | Not established | Not established | 0 matched verified published aggregates |

**Rank depends on loss function:** 270toWin has the lowest root-mean-squared error, while DDHQ has the lowest mean absolute error. The MAE gap between #1 and #3 is only **0.35 points** across four races and is not a reliably estimated general-population difference.

## Leave-one-state-out sensitivity

| Omitted state | Ranking from lowest to highest MAE |
|---|---|
| Ohio | 270toWin, DDHQ, RCP |
| Texas | DDHQ, RCP, 270toWin |
| Florida | RCP, DDHQ, 270toWin |
| Montana | RCP, DDHQ, 270toWin |

**None of the three publishers wins consistently.** It would be inappropriate to say DDHQ has been shown to be the best publisher nationwide.

## Broader evidence
The independent [61-race 2018–2024 raw-poll audit](senate_2018_2024_raw_poll_aggregate_audit.csv) provides insight into historical polling error and the [walk-forward experiment](senate_2018_2024_walk_forward.csv) tests past-only state adjustment. **Neither measures DDHQ, 270toWin, or Silver Bulletin publisher averages across the same races.** It cannot be used to claim one of those sources wins a publisher comparison.

Governor races are valuable for calibrating statewide uncertainty, but no comparable verified per-publisher historical governor-average matrix has been built in this repository. They therefore cannot honestly count as scored publisher observations. DDHQ's own archived-averages documentation describes its methods but is not an independent retrospective outcome score: https://polling-api-docs.decisiondeskhq.com/reference/averages

## Practical conclusion
**Conditional MAE ranking:** 1. DDHQ, 2. RCP, 3. 270toWin, 4. Silver unranked. This is a *small matched-sample ranking*, not a statistically stable accuracy leaderboard.

**Recommended operational treatment:** use a modestly diversified blend and avoid winner-take-all reweighting. Existing starting blend (**RCP 35%, DDHQ 26%, 270toWin 19%, Silver 20%**) remains editorial/provisional; Silver's 20% must not be characterized as measured accuracy. If only demonstrably scored suppliers should count, exclude Silver instead of assuming that a missing score implies underperformance, but recognize the data-coverage tradeoff. Aggregators may share individual underlying polls; the blend is not a four-independent-source statistical ensemble.

A genuinely generalizable leaderboard needs far more **same-office, same-election-eve, matched race-by-source** final published averages, 2018–2024, scored in held-out cycles. Results should be reported separately for Senate and Governor and by election cycle, including coverage and missingness, instead of collapsing incomparable sources.
