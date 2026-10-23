# Ervin + 2016–2024 partially pooled calibration

**Implemented October 23, 2026.** Deployed on [the Ervin Model website](https://geervin.github.io/ervin-model-2026/), under the **Ervin +** model setting (default on Ervin's Take).

## Scope and traceability

- [Machine-readable archived historical observations](calibration_events_2016_2024.json): **88 election-specific polling observations** across all **17** tracked states. These are reconstructed margins from polling archives, not 88 independent pollsters or cycles.
- [Executable shared calibration implementation](../scripts/calibration_engine.js): the website and Node backtest use the **same formula**.
- [Executable past-only backtest](../scripts/backtest_calibration.js): run `node scripts/backtest_calibration.js` from the repository root. It writes `research/calibration_walkforward_2016_2024.csv` and `research/calibration_backtest_summary.json`.
- [Existing Original Ervin benchmark](../blend_backtest_2024.csv): a separate four-race, multi-publisher comparison. The four-publisher Ervin's Take blend weights have **not** been changed by this calibration work.

Data provenance: [FiveThirtyEight 2016–2022 archived raw polling rows](https://github.com/fivethirtyeight/data/blob/master/pollster-ratings/raw_polls.csv), [Whitcomb collection of RCP-listed 2024 Senate poll rows with outcomes](https://github.com/Jack-Whitcomb/All-US-Senate-polls-2006-2024/blob/main/2006_to_2024_senate_polls_with_actuals.csv), and individual 2024 presidential sources explicitly recorded per event.

**Selection:** for 2016–2022, require a Democratic vs. Republican general-election comparison with reported actual shares, field date within 21 days of election, no labeled partisan sponsor, and at least two distinct pollsters; retain each pollster's latest eligible observation. For 2024 Senate we apply the same timing/two-pollster rule but **could not validate partisan sponsorship** in the source archive, so those races carry that warning. Some curated 2024 presidential inputs are **single published snapshots**, not full final polling averages. Elections with missing suitable data are excluded rather than imputed. Presidential and Senate events in one state-year remain correlated.

### State coverage (events, not independent election cycles)

| State | Historical events | Distinct years represented |
|---|---:|---|
| Maine | 4 | 2016, 2020, 2024 |
| Michigan | 5 | 2016, 2018, 2020, 2024 |
| Ohio | 6 | 2016, 2018, 2020, 2022, 2024 |
| Texas | 5 | 2016, 2018, 2020, 2024 |
| Iowa | 6 | 2016, 2020, 2022, 2024 |
| Kansas | 5 | 2016, 2020, 2024 |
| Minnesota | 6 | 2016, 2018, 2020, 2024 |
| Alaska | 3 | 2016, 2020, 2024 |
| Georgia | 9 | 2016, 2020, 2022, 2024 |
| North Carolina | 6 | 2016, 2020, 2022, 2024 |
| New Hampshire | 6 | 2016, 2020, 2022, 2024 |
| Nebraska | 2 | 2016, 2024 |
| South Carolina | 4 | 2016, 2020, 2024 |
| Mississippi | 4 | 2016, 2018, 2020 |
| Florida | 7 | 2016, 2018, 2020, 2022, 2024 |
| South Dakota | 4 | 2016, 2020, 2024 |
| Montana | 6 | 2016, 2018, 2020, 2024 |

## Model formula

1. Transform each eligible polling margin into a signed **D minus R polling error** (polling margin less actual result). A **positive** error indicates Republican underestimation.
2. Weight historical Senate observations at **1**, presidential observations at **0.65**, and dated curated observations at lower reliability than multi-pollster samples. Apply recency decay `exp(-(targetYear - historicalYear)/7)`, and a quality factor based on the number of distinct pollsters.
3. First group same-state **and same-election-year** Senate/presidential records into **one state-cycle estimate**, so correlated errors (including Georgia double Senate elections) do not create separate independent cycles.
4. Estimate the nationwide baseline by first averaging each state's cycle observations, then averaging states equally (excluding the **target** state). Compute a region baseline similarly, using the same-state-excluded neighboring states only if at least two qualify. Set prior to **75% national + 25% region**.
5. Shrink the state's own error estimate toward that prior by **n / (n + 4)**, where `n` is **distinct historical election years**, not surveys or race rows.
6. Multiply that pooled error by a **conservative 0.40** to limit overfitting and cap final corrections at **±6 margin points**. Subtract a positive correction from the 2026 non-Republican polling lead.

This is a documented **heuristic partial-pooling method**, not a fitted hierarchical Bayesian posterior. Region definitions and hyperparameters are in `scripts/calibration_engine.js`.

### Candidate-continuity exceptions

The Ervin + view preserves audited returning-candidate evidence, while ordinary original/shrink settings remain available:

- **Alaska:** 70% Peltola 2022/2024 House plus Sullivan 2020 Senate and 2024 presidential evidence with ranked-choice caution, combined with 30% pooled statewide correction. The prior surveys include partisan and final-round RCV differences; not tested in the general-party backtest.
- **Nebraska:** 55% Dan Osborn's 2024 independent Senate polling error, 45% pooled state baseline. Different Republican opponent.
- **South Dakota:** 35% Brian Bengs's 2022 Senate candidate polling error **capped at 8 points**, 65% pooled baseline. Party and opponent changed; this remains very weak evidence.
- **Montana:** no transfer of the statewide D/R error to its three-way independent-vs-Republican scenario.

These proportions are **judgmental sensitivity weights**, not independently validated optimal coefficients.

## Past-only walk-forward accuracy

Each target election was evaluated against a historical correction trained **only on earlier election years**. Elections in 2016 train later years but are not evaluated as a backtest year. Data include correlated state-year events, so the 63 event rows are **not 63 independent test cases**.

| Held-out year | Observations | Raw polling MAE | Pooled Ervin + MAE |
|---|---:|---:|---:|
| 2018 | 8 | 2.28 | **2.82** (worse) |
| 2020 | 30 | 4.74 | **3.58** (better) |
| 2022 | 7 | 2.71 | **3.10** (worse) |
| 2024 | 18 | 4.25 | **3.05** (better) |
| **All** | **63** | **4.06** | **3.28** |

**Overall MAE improves ~19%.** Overall raw RMSE **5.05**, pooled RMSE **4.07**. Senate-only MAE **3.74 to 3.47** across **35** observations; presidential MAE **4.46 to 3.04** across **28** observations.

**Important qualifications:** The model's fixed formulas and weights were chosen with knowledge of historical polling behavior, so this is a **past-only-data diagnostic**, not fully independent, preregistered validation of model selection. The 2024 presidential coverage differs from earlier years, Georgia has multiple correlated Senate contests, and pollster overlap remains. Two of the four test years deteriorated. The result does **not** prove a 19% future-forecast improvement, nor validate the website's 80/90% scenario bands as true predictive coverage intervals.

## Deployment and reproducibility

The Pages deployment now verifies the original audit, checks browser JS syntax, and runs `node --check` and `node scripts/backtest_calibration.js`. The 88-event evidence travels in the website's embedded JSON, so the every-six-hour polling refresh recalculates against the same historical calibration. No 2026 election outcomes are used before Election Day. The site retains the prior Original Ervin and Shrink modes; only **Ervin +** was upgraded.

**Recommended subsequent improvement:** normalize 2024 Senate poll sponsorship, backfill more 2024 presidential averages and missing early-cycle state offices, fit hyperparameters on historical training folds rather than selecting them subjectively, and validate uncertainty-band empirical coverage grouped by state and election cycle. Governor-election evidence can inform common statewide error but is **not** in this quantitative 88-event Senate/presidential model.
