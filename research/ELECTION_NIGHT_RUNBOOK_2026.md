# Ervin Model | Michigan 2026 election-night operations
**Election:** November 3, 2026 · Michigan U.S. Senate · unofficial results.
**Status as of October 25:** reporting UI and source probes exist; fully automatic statewide precinct ingestion DOES NOT.

## Source architecture, with accurate expectations

1. **County map:** version-controlled `michigan/counties.geojson`, 83 uniquely named county shapes. Verified locally, does not depend on election-night services.
2. **Precinct geography:** Michigan Bureau of Elections 2026 ArcGIS FeatureServer, 3,895 polygons returned on the initial independent public probe. Spatial boundaries do **not** contain votes. If the service is down, the county-boundary fallback remains.
3. **Precinct votes:** `michigan/election-night/results.json`, created from individually reviewed `imports/*.csv` source reports. This is a static site file; it is **not** downloaded from each county automatically. Website fetches it every 30 seconds *while the page is visible and after polls close*. Actual latency includes county publication, operator validation, Git commit, GitHub Actions build/deployment and CDN caching.
4. **Statewide cross-check:** Open America 2026 Senate public API in the browser, at most one fetch per minute, validated against race, year, candidates, sum, timestamp, and coverage. Do not add statewide counts to precinct counts. HTTP/CORS failure is shown as unavailable; the original precinct feed is unaffected.
5. **Source preflight:** `scripts/check_michigan_sources.py`, on a six-hour GitHub schedule and on monitor-code changes. It publishes `source_health.json` with accessibility and contract checks. HTTP 403/202 are *indeterminate*, not proof of a broken public page. Connectivity is not election-night data readiness.

### Direct official November election destinations
- [Oakland 2026 Clarity Elections portal](https://results.enr.clarityelections.com/MI/Oakland/127284/) — found on Oakland County's own 2026 Elections page. Precinct XML endpoint is **not** confirmed.
- [Kent 2026 Enhanced Voting portal](https://app.enhancedvoting.com/results/public/kent-county-mi/elections/11032026_20261005115447) — directly linked by Kent County's official 2026 Elections page. It also links an unofficial Statement of Votes Cast document. No public export contract has yet been confirmed for unattended imports.
- [Livingston official county results](https://milivcounty.gov/elections/election-results/) — a November 2026 section is present, but the clerk explicitly warns that data published before the election may be test results.
- [Michigan Secretary of State's directory of all 83 county clerk sites](https://www.michigan.gov/sos/elections/election-results-and-data/candidate-listings-and-election-results-by-county) — authoritative fallback directory.
- [Michigan statewide results and certified precinct history](https://www.michigan.gov/sos/elections/election-results-and-data) — **not** a continuously updated free precinct API.
- [Open America public API contract](https://openamerica.io/elections/api/) — separate statewide checker.

## November 3 checklist (operator)
1. **Before 8:00 p.m. Eastern:** open the production [election-night page](https://geervin.github.io/ervin-model-2026/michigan/election-night/), check 83 county polygons, source-readiness timestamps, links, and the latest successful [GitHub Pages workflow](https://github.com/geervin/ervin-model-2026/actions). Before polls close the election board must NOT show actual 2026 votes. Oakland/Kent vendor pages may be pre-populated with *test* data: ignore it.
2. **After 8:00 p.m. Eastern:** collect official published county **2026 November general-election U.S. Senate** precinct/AVCB vote counts. For Dickinson, Gogebic, Iron and Menominee, wait until **9:00 p.m. Eastern / 8:00 p.m. Central**. Reject test figures, prior elections, primary returns, hypothetical results, and totals that are not attributable to a clerk.
3. **Verify every source:** jurisdiction/contest/candidate identity; reporting-unit definition (in-precinct vs AVCB / early vote); publication timestamp; clear source URL. Check that the same absentee votes are not already folded into in-person precinct figures. Get independent verification before posting.
4. **Produce latest complete county CSV:** put `<county>.csv` under `michigan/election-night/imports/`; use header:
   `county,precinct,dem,rep,other,as_of,source_url`
   `as_of` requires ISO 8601 with offset (e.g. `2026-11-04T01:18:00Z`), NOT the time a volunteer typed the row. Keep stable reporting-unit IDs; replace a county CSV as one coherent snapshot rather than appending duplicates.
5. **Publish:** commit CSV to `main`, verify [Publish Michigan election-night precinct reports](https://github.com/geervin/ervin-model-2026/actions/workflows/michigan-election-night.yml) succeeds. It runs the guarded importer, writes `results.json`, and deploys to GitHub Pages.
6. **Verify on the published site:** compare sums from `results.json` against the actual clerk report. Look at both map and table. Freshness timestamp reflects the feed's publishing time; individual row timestamps come from reporting sources. Keep the Open America state tally **separate**.
7. **On correction:** replace the affected county CSV with a reviewed corrected complete snapshot and repeat the publish/verification. Never add correction votes to an earlier total.

## Failure and recovery matrix

| Failure | Action | What users see |
| --- | --- | --- |
| Source portal blocks an automated probe (403/202) | Open the clerk link manually; cross-check other official site/report | Indeterminate source connectivity, **not** a declaration of bad vote counts |
| Bureau of Elections GIS query fails or times out | Reload geometry once; continue county-level reporting, do not substitute 2024 polygons | Neutral county outlines remain |
| No verified precinct returns published | Preserve empty feed; obtain verified county data | Awaiting verified precinct returns; no zero-vote inference |
| Importer rejects duplicate, pre-close, missing timestamp, invalid count | Correct CSV; rerun GitHub workflow | Previously published data remain, no unvalidated replacement |
| GitHub Pages deployment fails | Inspect failed workflow and retry after fix; compare latest successful deploy SHA | Site can lag even if JSON in Git repo changed |
| Third-party statewide API unavailable | Keep precinct data independent; link back to official clerks | Statewide cross-check unavailable |
| Site polling every 30s but county votes unchanged | No new verified county CSV was published (or Pages has not deployed yet) | Latest check and *separate* publication age |

## Known outstanding dependency
The verified public sources **do not** establish an unmetered, documented, redistribution-approved, statewide automatic API for *precinct* counts on November 3. We cannot promise full 83-county automated precinct coverage or 30-second source-to-screen latency. A licensed precinct vendor or maintained server-side county-specific adapters, both tested on current-year source schemas, would be needed for that SLA. GitHub Pages has no continuously running ingestion backend. The existing reporting pipeline is safe and functional for verified manually imported county snapshots.

For deeper provenance and vendor options see [the research audit](MICHIGAN_2026_ELECTION_NIGHT_SOURCES.md).
