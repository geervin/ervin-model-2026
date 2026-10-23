# Expanded historical polling backtest — October 23, 2026

## Executive finding
A larger historical archive does **not** justify a confident four-publisher blend reweighting. The matched RCP-derived **raw poll archive** covers 61 Senate race-years across 2018, 2020, 2022 and 2024; the **publisher-specific** backtest remains four races in 2024 for RCP, DDHQ and 270toWin, with **no comparable verified Silver Senate archive**. These are different samples and must never be pooled as if the RCP-derived sample measured DDHQ, 270toWin or Silver accuracy. **Current composite source weights remain unchanged pending sufficiently broad matched-source backfill.**

## Senate raw-poll backtest
Source: https://github.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024
Archive: [race-level 61-race aggregate](senate_2018_2024_raw_poll_aggregate_audit.csv); [past-only adjustment outcomes](senate_2018_2024_walk_forward.csv).

Method: filter general-election polls to 2018/2020/2022/2024, requiring numeric D, R and actual D/R shares, poll end 0–21 days before the general election; use most recent observation per pollster within state, year and reported overlapping-special-election indicator; require at least two distinct pollsters. The race-level raw margin is an equal-pollster average, **not** an official RealClearPolling published average, nor a DDHQ, Silver or 270toWin average. Poll sponsorship, candidate-pair normalization and Alaska voting rules warrant further checking; historical races with multiple matchups can remain problematic.

| Year | Senate race-years included | Mean absolute error, raw margin | Mean absolute error, past-only state-corrected margin | Prior same-state election available |
|---|---:|---:|---:|---:|
| 2018 | 19 | 3.33 | 3.33 | 0 |
| 2020 | 13 | 5.97 | 6.14 | 4 |
| 2022 | 15 | 3.95 | 4.84 | 11 |
| 2024 | 14 | 3.51 | 4.20 | 13 |

Past-only correction is a decayed weighted mean of prior observed polling-error margins for the same state and special-election flag. It has no future data leakage from the target race. **It is not the identical incumbent/candidate-aware Ervin or Ervin + correction** and does not establish the real model's performance. For 2018, no correction was possible within the bounded 2018+ sample. The error deterioration is a risk indicator, not proof that every historical correction is harmful.

## Gubernatorial evidence and office transfer
Two independent research summaries offer broader office-specific checks, although neither ranks the four publishers by a like-for-like historical set:

- [Polling Forecast: measuring American polling error](https://www.pollingforecast.com/research/us-polling-error) — combined Senate/governor final-poll samples of 66 races in 2018, 35 in 2020, 54 in 2022, and 34 in 2024, with mean absolute errors 3.66, 7.12, 4.16, and 4.55 respectively. This is an independent **cross-office reference**, not a sample imported into the four-publisher scoring.
- [Final midterm polling error, 2018 and 2022 (Ruffini)](https://x.patrickruffini.com/polling-index/midterm-error/) — typical **governor** misses 4.4 margin points in 2018 and 4.1 in 2022; **Senate** 3.7 and 4.5. This supports considering governor polling as relevant to common-cycle survey error, with an office-specific adjustment.
- [FiveThirtyEight pollster-ratings raw-polls codebook](https://github.com/fivethirtyeight/data/blob/master/pollster-ratings/README.md) documents a separate, much larger 2018–2023 source containing general-election Sen-G and Gov-G survey rows. Polls are not identical to the four historical publisher averages, and an independent result-matching audit is required before fitting any source weights.

## Four-publisher comparability audit
| Source | Verified historical matched publisher data in current repo | Scope | Safe to treat as a measured blend weight? |
|---|---:|---|---|
| RealClearPolling | Four 2024 Senate averages; plus 61 **RCP-listed raw-poll reconstructions** | 2024 publisher final averages; raw polls 2018–24 | No: incomplete four-publisher comparison |
| Decision Desk HQ | Four 2024 Senate averages | 2024 only, same four races | No: small sample |
| 270toWin | Four 2024 Senate averages | 2024 only, same four races | No: small sample |
| Silver Bulletin | None matched to the same four archived Senate averages | Not scored | No: cannot claim empirical relative accuracy |

See the [four-race publisher archive](../blend_backtest_2024.csv). The old 35/26/19/20 percentage allocation remains an **editorial provisional blend**, not one fitted on 61 matching comparisons. Other publishers' sources cannot be "scored" by applying results learned from RCP raw polls.

## Required next audit before statistically fitted source weights
1. Obtain an **as-of-Election-Eve** final general-election polling average per provider, race and year; match candidates, office, date and voting-round convention.
2. Add 2018, 2020, 2022, 2024 Senate and gubernatorial events wherever at least **two** publishers can be compared for the same contest. Record missing publisher/race cells explicitly; never proxy them into the backtest.
3. Reconstruct the Original Ervin correction using **earlier cycles only** for each target year, not that election's own error.
4. Evaluate mean absolute margin error, RMSE, winner correctness, close-race subset, office-specific performance, and bias. Score against a common set of races for each pair of publishers to avoid coverage artifacts.
5. Tune weights on training years and evaluate on held-out years, with cluster bootstrap by state and election cycle. Penalize overfitting and limit the role of governor elections when forecasting the Senate.
6. Do not label 80/90% scenario bands as calibrated confidence levels until their empirical coverage has been tested.

## Sources and limitations
Values in this report are traceable to linked datasets. Archived publisher aggregates are not consistently available for earlier cycles in the public sources checked. A truly "statistically complete" four-way ranking **cannot honestly be claimed** from the evidence currently verified. The expanded raw-poll and independent governor evidence is nevertheless valuable for testing whether historical polling corrections generalize.
