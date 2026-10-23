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
- For independent-versus-Republican 2026 contests in Nebraska, Montana and South Dakota, the D/R polling correction is **not transferred** mechanically; their three historical entries are retained for the evidence audit. Candidate-field and method changes further limit comparability.
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
