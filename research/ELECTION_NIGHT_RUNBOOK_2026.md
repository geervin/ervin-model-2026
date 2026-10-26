# Ervin Model | Michigan 2026 election-night operations
**Election:** November 3, 2026 · Michigan U.S. Senate · unofficial results.
**Status as of October 25:** reporting UI and source probes exist; fully automatic statewide precinct ingestion DOES NOT.

## County-informed precinct layer (model, not reported precincts)
The default 2026 precinct boundary map now shows an **Original Ervin modeled county two-party share applied uniformly to all precinct polygons in that county**, not an invented local precinct vote estimate. It reproduces the historical 55% 2024 Senate + 25% 2022 governor + 20% 2024 president county baseline and the statewide modeled polling adjustment used by the Michigan forecast dashboard. During election night, a directly attributed clerk county-wide result can replace the county share for shading **without being split into made-up precinct totals**. The map lets viewers switch to uniquely joined, actually reported precinct vote figures, or to the 2024 historical *county* Senate baseline. Model projections and observed county totals remain visibly separate in the county inspector.

**Limit:** A genuine per-precinct projection needs historical precinct results matched to the Bureau of Elections **2026 precinct boundaries** and a documented treatment of absentee/early vote aggregation and precinct splits. County totals alone cannot empirically predict which 2026 precincts depart from their county's average. The statewide 2024 county senate baseline remains authoritative only at the county level. The site does not pretend otherwise.

The shared square-E navigation now links all three dashboards, includes mobile navigation and a back-to-top utility. Election Night county selections can be shared by query parameter (e.g. `?county=Oakland`).

## Interactive county reporting center and fast lane

The [Michigan Election Night dashboard](../michigan/election-night/) now has an expandable 83-county map. Hovering shows the two major-party candidate portraits, names, attributed vote counts, and reporting status; clicking pins a detailed source card and zooms precinct geography. Before any verified report arrives, it displays **awaiting results**, never invented zeros.

**Source priority (no double counting):**
1. Most recent validated **whole-county clerk total**, from either the reviewed CSV feed `county_totals.json` or the optional direct Kent adapter `county_auto.json`.
2. If there is no county-wide result for that county, its individually attributed, potentially partial `results.json` precinct/counting-board subtotal.
3. Else grey/awaiting. The independent Open America *statewide* cross-check is displayed separately and is never summed with either.

**Kent experimental automatic fast lane:** [Kent County November 2026 official election portal](https://app.enhancedvoting.com/results/public/kent-county-mi/elections/11032026_20261005115447). The [scheduled Kent job](https://github.com/geervin/ervin-model-2026/actions/workflows/kent-senate-fast-lane.yml) checks on a best-effort five-minute schedule during Nov 3 8 p.m. Eastern through early Nov 4. The parser requires a browser-rendered official page, the exact November 3 general-election heading and U.S. Senate candidate set, a post-8 p.m. local source update timestamp, a nonzero reporting fraction, and plausible positive votes. It writes no data if any check fails. Its first real source test reached the page and **correctly rejected October pre-election test figures**; it is *not yet proof that post-election values will be machine-readable*.

**Reviewed county-wide fast import:** [`county-imports/`](../michigan/election-night/county-imports/README.md) uses one row per county (`county,dem,rep,other,as_of,source_url,reporting_status`). The [county publishing workflow](https://github.com/geervin/ervin-model-2026/actions/workflows/michigan-county-results.yml) validates each county's local close, original HTTPS report, candidate totals and source timestamp; every upload creates a replacement county record. County-wide results take priority, so operators needn't await precinct spreadsheets. Submitting source reports still requires someone or a verified upstream adapter.

**Freshness:** The browser polls both county feeds every 30 seconds *after polls close*. This is a display refresh interval, **not** a guaranteed source-to-screen latency: county publication, GitHub's schedule and repository/Pages deployment may add minutes. Other county sources still need validated adapters, verified imports, or access to a licensed feed. The 83-county clerk watcher detects changed pages, not their certified vote totals.

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

## Automatic 83-county clerk website watcher (now deployed)

- [Watch workflow](https://github.com/geervin/ervin-model-2026/actions/workflows/watch-michigan-clerks.yml): automatically probes each of Michigan's 83 clerk election websites starting from the [source registry](../michigan/election-night/county_watch_sources.json). Seeds are based on the Secretary of State county directory, with verified county-specific replacements.
- The checker follows **at most one** same-domain results-hub link when the landing page has no qualifying November 2026 report links. It looks for November general-election result/report URLs and compares changes against its previous saved baseline, filtering out older/primary election reports. It never reads personally identifiable voter records or attempts to evade website access controls.
- [Current all-county snapshot](../michigan/election-night/clerk_watch.json) and [recent changes](../michigan/election-night/clerk_watch_events.json) are automatically republished to GitHub Pages. The [Election Night page](../michigan/election-night/) has search/filter controls across the 83 counties, current source reachability and links to candidate reports.
- **Normal cadence:** approximately every six hours. **Election day and overnight:** every 15 minutes during Nov 4 00:00–08:59 UTC (Nov 3 evening into Nov 4 early morning in Michigan) and every 30 minutes Nov 3 18:00–23:59 UTC. GitHub Actions cron is best-effort; checks, deployments and county publication can run late.
- **Critical distinction:** page-access success, change detection and new report links do not constitute verified precinct vote ingestion. Real results still require verified county CSV imports via the separate protected workflow. No guarantee of every county having a public machine-readable results feed.
- **Operational fallback:** if an automated probe returns 403, 202 or times out, mark the county unavailable/inconclusive and open the official clerk link manually. A vendor results portal can update through browser-side scripts without changing its static HTML; the watcher may therefore miss such changes. Do not interpret a quiet monitor as proof that returns have not been published.
- **False positives:** do not import data from sources identified only by filename or page changes. Check that the report covers November 3, 2026, Michigan U.S. Senate, that the publication happened after the proper local 8 p.m. close, and that reporting unit IDs are not duplicated.

## November 3 checklist (operator)
1. **Before 8:00 p.m. Eastern:** open the production [election-night page](https://geervin.github.io/ervin-model-2026/michigan/election-night/), check 83 county polygons, source-readiness timestamps, links, and the latest successful [GitHub Pages workflow](https://github.com/geervin/ervin-model-2026/actions). Before polls close the election board must NOT show actual 2026 votes. Oakland/Kent vendor pages may be pre-populated with *test* data: ignore it.
2. **After 8:00 p.m. Eastern:** collect official published county **2026 November general-election U.S. Senate** precinct/AVCB vote counts. For Dickinson, Gogebic, Iron and Menominee, wait until **9:00 p.m. Eastern / 8:00 p.m. Central**. Reject test figures, prior elections, primary returns, hypothetical results, and totals that are not attributable to a clerk.
3. **Verify every source:** jurisdiction/contest/candidate identity; reporting-unit definition (in-precinct vs AVCB / early vote); publication timestamp; clear source URL. Check that the same absentee votes are not already folded into in-person precinct figures. Get independent verification before posting.
4. **Produce latest complete county CSV:** put `<county>.csv` under `michigan/election-night/imports/`; use header:
   `county,precinct,dem,rep,other,as_of,source_url`
   `as_of` requires ISO 8601 with offset (e.g. `2026-11-04T01:18:00Z`), NOT the time a volunteer typed the row. Keep stable reporting-unit IDs; replace a county CSV as one coherent snapshot rather than appending duplicates.
5. **Publish:** commit CSV to `main`, verify [Publish Michigan election-night precinct reports](https://github.com/geervin/ervin-model-2026/actions/workflows/michigan-election-night.yml) succeeds. It runs the guarded importer, writes `results.json`, and deploys to GitHub Pages.
6. **Verify on the published site:** compare sums from `results.json` against the actual clerk report. Look at both map and table. Freshness timestamp reflects the feed's publishing time; individual row timestamps come from reporting sources. Keep the Open America state tally **separate**.
7. **On correction:** replace the affected county CSV with a reviewed corrected complete snapshot and repeat the publish/verification. Never add correction votes to an earlier total. The importer deliberately rejects silent disappearance of previously published reporting units or older source timestamps. If a **verified correction** really requires deleting a unit or rolling its publication time back, first review the original county document and explicitly use `ERVIN_REVIEWED_RETRACTION=YES` for that one ingestion run; the default GitHub Actions workflow does not enable that override.

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
