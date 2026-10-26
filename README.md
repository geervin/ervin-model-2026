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
The website contains a dated **Oct 23, 2026** research snapshot. Publication alone does **not** guarantee newly published polls are ingested. A GitHub Actions polling checker runs approximately every six hours and accepts only matching current-year general-election aggregate tables that satisfy its candidate/source/date guards. Its public [refresh audit](refresh_log.json) distinguishes checked sources, accepted updates, and errors. The website does not claim that a successful check means every publisher has a new average.

## Research lab additions (October 23, 2026)
The dashboard now includes per-race side-by-side comparisons of all five publisher views (raw, full correction, shrunken correction), the spread among non-proxy publishers, deep links such as `?race=AK#researchLab`, and dated **Cook Political Report ratings from October 20, 2026**. These ratings are a static independently published qualitative benchmark, **not** added polling observations or statistical win probabilities. See https://www.cookpolitical.com/ratings/senate-race-ratings?check_logged_in=1 for publisher context. The scheduled poll update leaves these dated ratings unchanged.

## Pilot blend backtest, October 23, 2026
On the initial October 23 pilot, the **Ervin’s Take** blending starting shares were **RCP 35%, DDHQ 26%, 270toWin 19%, and Silver Bulletin 20%**. They are **provisional** and deliberately remain close to the previous 40/25/15/20 setup. See [the row-level benchmark](blend_backtest_2024.csv) for historical inputs and sources.

The pilot compares **2024 Ohio, Texas, Florida and Montana Senate** final aggregate margins for the first three publishers against election margins. To avoid direct look-ahead leakage, the **Original Ervin correction for each tested state is reconstructed exclusively from its pre-2024 historical records** in the project. Backtest average absolute errors, in margin points: **RCP 3.95, DDHQ 3.77, 270toWin 4.12** (four races each). The results are sensitive to the Montana 2020-derived error; these sample sizes cannot support aggressive model tuning. Since comparable Silver Bulletin *Senate polling-average* history was not verified for these four, **Silver has no tested accuracy number and initially retained a 20% provisional weight**, not a claimed measured ranking. DDHQ's final polling average must not be conflated with its probability forecast. No overlapping constituent poll is treated as an additional observation. This is a pilot retrospective diagnostic, not out-of-sample proof of predictive accuracy. Actual 2026 forecasts still apply **Ervin +** after the composite, not the tested Original Ervin mode; those are distinct methodology stages.

## Ervin + historical calibration (October 23, 2026)
**Ervin +**, now an optional adjustment (the **Original Ervin** correction is the default), uses [88 reconstructed 2016–2024 Senate/presidential historical polling-error events](research/calibration_events_2016_2024.json) for the 17 tracked states. It partially pools each state's historical error toward common regional and national patterns, discounts older and thinner evidence, and guards the independent/returning-candidate races separately. Reconstructed averages do not imply 88 independent election cycles. Original Ervin and Shrink small samples preserve the previous limited historical-calibration method.

[Full methodology, coverage and validation](research/CALIBRATION_2016_2024_REPORT.md) · [Calibration source code](scripts/calibration_engine.js) · [Past-only backtest command](scripts/backtest_calibration.js) · [Evidence synchronization and finite-forecast validator](scripts/validate_calibration.js).

The 63-event past-only diagnostic found raw mean absolute error **4.06 points** vs pooled correction **3.28 points**. The 2018/2022 subsets became worse, the 2020/2024 subsets improved. This is not a proof of true out-of-sample superiority or calibrated 80/90% uncertainty coverage. Silver/DDHQ/270toWin/RCP blend weights remain provisional and unchanged. Governor elections were not added to the historical calibration; they need a separate reliably matched source archive and office-effects validation.

## Current Ervin's Take publisher shares (October 23, 2026 revision)

| Publisher | Starting share |
|---|---:|
| RealClearPolling | **40%** |
| Decision Desk HQ | **29%** |
| 270toWin | **21%** |
| Silver Bulletin | **10%** |

At the user's request, Silver Bulletin was reduced from 20% to 10% because a matched, reliable historical Senate-polling-average backlog has not been established for that product. The freed ten percentage points were reallocated approximately pro rata among RCP, DDHQ and 270toWin (rounded to whole percentage points). These are **user-directed, provisional starting shares**, not fitted accuracy probabilities. The website excludes flagged proxies and duplicate publisher identities (not merely identical citation URLs), adjusts for freshness, renormalizes the actually available publishers within each state, and then applies Ervin + calibration. Different publisher averages often appear on the same Wikipedia page; dropping them solely for sharing the citation would incorrectly collapse the blend to one source. Earlier archived source-ranking reports record the then-current shares for historical context.

## Automatic 83-county clerk website checking
The [county watcher workflow](.github/workflows/watch-michigan-clerks.yml) checks the official county election website directory and selected verified local result portals. It runs on GitHub's best-effort scheduler (every six hours normally, up to every 15 minutes during the configured election-night interval), compares link/page changes, and publishes the [83-county source status](michigan/election-night/clerk_watch.json) and [change notices](michigan/election-night/clerk_watch_events.json). The Election Night page includes a searchable table of the checks. A website responding, a report link appearing, or an HTML page changing **does not mean real precinct votes have been captured**. Most counties still require independently verified report-to-CSV intake; the separate experimental Kent fast lane can publish only when its exact post-close source checks succeed. Source pages with login restrictions or anti-bot blocks may not be machine-readable. See the [operator runbook](research/ELECTION_NIGHT_RUNBOOK_2026.md).

## Interactive Michigan county results and fast-source pilot
The [Michigan Election Night dashboard](michigan/election-night/) includes a fullscreen-expandable county map, candidate portrait hover cards and pinned county totals. Figures are **not forecasts**. Verified whole-county clerk totals supersede, rather than add to, partial precinct sums.

- [Experimental automated Kent Senate feed](.github/workflows/kent-senate-fast-lane.yml): official Kent results page checked approximately every five minutes in the election-night window with strict post-close, election/candidate, reporting denominator and timestamp validation. It currently rejects pre-election test values; no guaranteed live access once results are published.
- [County-wide reviewed CSV intake](michigan/election-night/county-imports/README.md) publishes a separate verified [county results JSON](michigan/election-night/county_totals.json) without needing to parse all local precincts first.
- [Automatic county feed JSON](michigan/election-night/county_auto.json) and the manual clerk feed are checked by the browser every 30 seconds after local closing. GitHub scheduling and Pages publication are not guaranteed to keep pace with those checks.
- Other counties are not promised automatic source ingestion. The 83-county website checker highlights new documents; volunteers or further verified publisher adapters are needed for exact votes.

## Michigan election-night readiness (October 25)
- [Election-night map and reporting board](michigan/election-night/) with official 2026 county portal links, local 83-county geometry, 2026 precinct GIS geometry, current-source connectivity checks, and date-separated vote totals.
- [Source health record](michigan/election-night/source_health.json) independently probes public portals, precinct geometry and statewide API contracts on a scheduled basis. A responding endpoint is not a guarantee of precinct return data.
- **Precinct results require verified imports** into [the public results snapshot](michigan/election-night/results.json). The 30-second page refresh checks *that file*, not all 83 county sites directly. See the [operator runbook](research/ELECTION_NIGHT_RUNBOOK_2026.md) and [source audit](research/MICHIGAN_2026_ELECTION_NIGHT_SOURCES.md).
- The [Michigan source monitor](.github/workflows/michigan-source-audit.yml) and [precinct import workflow](.github/workflows/michigan-election-night.yml) have independent validation. Real precinct counts will not appear before the relevant county's 8 p.m. local close.
