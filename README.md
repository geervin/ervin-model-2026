# Ervin Model · 2026 U.S. Senate Forecast Lab

**Repository:** https://github.com/geervin/ervin-model-2026  
**Expected GitHub Pages address:** https://geervin.github.io/ervin-model-2026/

## Dashboard
An experimental October 23, 2026 Senate election research snapshot. Includes a 50-state interactive cartogram, 17 watched Senate races, five polling-source views (RealClearPolling, Decision Desk HQ, 270toWin, Wikipedia average-of-aggregators, Silver Bulletin), adjustable historical bias, historical evidence audit, 80%/90% heuristic scenarios, and downloadable CSV files.

## Historical inputs: at least three per race
The dataset now contains **51 election comparisons across 17 races, 3 for every race**. They are *past-election calibration inputs*, not claims of three independent 2026 polling aggregates per race.

- Prioritize **2018, 2020, 2022 and 2024**. Observations from before 2018 are excluded.
- Prefer **U.S. Senate races**; use statewide **presidential elections** when fewer Senate comparisons exist. Each observation is labeled Senate or PRES in the per-race chart.
- Poll values are the non-Republican candidate's margin over the Republican candidate, so negative values are Republican leads.
- Polling error = forecast poll margin **minus** actual vote margin (positive = Republican strength understated by polling).
- Weight historical Senate observations by **1.0** and presidential observations by **0.65**. Apply recency weights: **2018: 0.70; 2020: 0.80; 2022: 0.90; 2024: 1.00**. The calibration shift is the weighted mean of the historical polling error.
- A Senate and presidential election from the same year are **correlated observations**, not independent calibration cycles. Three historical comparisons do not ensure three independent years.
- **Nebraska — Dan Osborn:** Candidate-specific 2024 Senate average **Osborn −1.6** vs. actual **Osborn −6.67**, a **+5.07-point Republican polling understatement**, applied against his 2026 margin. The Republican opponent changes from Deb Fischer to Pete Ricketts. The 2020 and 2024 presidential comparisons remain audit context only.
- **South Dakota — Brian Bengs:** Candidate-specific 2022 Senate poll **Bengs −25** vs. actual **Bengs −43.5**, a **+18.50-point Republican polling understatement**, applied as a **high-uncertainty single-observation scenario**. The 2026 contest has a new Republican opponent and Bengs runs as an independent rather than a Democrat. The 2020 Senate and 2024 presidential comparisons remain audit context only.
- **Montana — Seth Bodnar:** No suitable repeat-candidate calibration; historical partisan D/R correction **not applied** to this 2026 independent matchup.
- The **small-sample shrinkage** switch retains a stronger reduction (25% of raw candidate-specific error) for Nebraska and South Dakota. The 80%/90% uncertainty scenarios inflate uncertainty, especially in South Dakota. None of these adjustments represents a validated 2026 win probability.
- Some safely Republican states have only **single polls** or **partisan-sponsored surveys**. Such inputs are labeled; grades and scenario bands are heuristic, not validated election probabilities.

### Audit files
- [Historical polling audit (CSV)](historical_error_audit.csv): 51 poll margins, election results, errors, election types, weights, notes, and links.
- [2026 polling sources (CSV)](source_snapshot.csv): 85 source-view entries, including explicit proxy flags.
- [Automated validation script](scripts/validate_data.py): checks minimum 3 inputs per race, 2018–24 windows, office types, numeric error consistency, source links, and independent-matchup exclusions.

The historical polling audit is *not* refreshed by the live-polling checker. Extending this methodology to additional election years requires revisiting office comparability and recency weights.

## Publish on GitHub Pages
**One-time manual setup required:** open **[Repository Settings → Pages](https://github.com/geervin/ervin-model-2026/settings/pages)**; choose **Build and deployment → Source: GitHub Actions**. Then go to [Actions](https://github.com/geervin/ervin-model-2026/actions), select **Publish Ervin Model website**, and **Run workflow** (or rerun the previous failed run). GitHub Actions `GITHUB_TOKEN` cannot initially enable GitHub Pages itself.

## Freshness
The website contains a dated **Oct 23, 2026** research snapshot. Publication alone does **not** mean that any online poll source updates automatically; the six-hour polling refresh automation from the original standalone package is **not installed in this repo**. The UI will not claim a successful refresh that has not occurred.

## Research lab additions (October 23, 2026)
The dashboard now includes per-race side-by-side comparisons of all five publisher views (raw, full correction, shrunken correction), the spread among non-proxy publishers, deep links such as `?race=AK#researchLab`, and dated **Cook Political Report ratings from October 20, 2026**. These ratings are a static independently published qualitative benchmark, **not** added polling observations or statistical win probabilities. See https://www.cookpolitical.com/ratings/senate-race-ratings?check_logged_in=1 for publisher context. The scheduled poll update leaves these dated ratings unchanged.

## Pilot blend backtest, October 23, 2026
The **Ervin’s Take** blending starting shares are now **RCP 35%, DDHQ 26%, 270toWin 19%, and Silver Bulletin 20%**. They are **provisional** and deliberately remain close to the previous 40/25/15/20 setup. See [the row-level benchmark](blend_backtest_2024.csv) for historical inputs and sources.

The pilot compares **2024 Ohio, Texas, Florida and Montana Senate** final aggregate margins for the first three publishers against election margins. To avoid direct look-ahead leakage, the **Original Ervin correction for each tested state is reconstructed exclusively from its pre-2024 historical records** in the project. Backtest average absolute errors, in margin points: **RCP 3.95, DDHQ 3.77, 270toWin 4.12** (four races each). The results are sensitive to the Montana 2020-derived error; these sample sizes cannot support aggressive model tuning. Since comparable Silver Bulletin *Senate polling-average* history was not verified for these four, **Silver has no tested accuracy number and retains a 20% provisional weight**, not a claimed measured ranking. DDHQ's final polling average must not be conflated with its probability forecast. No overlapping constituent poll is treated as an additional observation. This is a pilot retrospective diagnostic, not out-of-sample proof of predictive accuracy. Actual 2026 forecasts still apply **Ervin +** after the composite, not the tested Original Ervin mode; those are distinct methodology stages.
