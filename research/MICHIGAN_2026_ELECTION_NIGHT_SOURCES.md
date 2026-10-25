# Michigan 2026 election night — live result source investigation

Research date: October 24, 2026. Target: **U.S. Senate general election, November 3, 2026**, with 83-county coverage and precinct/absentee reporting-unit vote counts. This is an evidence and integration audit, not an assertion that November general results are already available.

## What can be used now

### 1. Open America — operational statewide fallback (already integrated)
- Free keyless API: https://openamerica.io/elections/results.json?year=2026&office=Senate
- Documentation: https://openamerica.io/elections/api/
- 2024 replay for integration testing: https://openamerica.io/elections/results.json?year=2024&office=Senate
- Michigan is in its documented 22-state set; returns state Senate candidate totals, report share where available, official source timestamp, and stale/live indicators, with a documented cross-origin policy.
- Provider requests **60-second** polling while live; its shared cache is 30s browser/60s edge. Do not hammer every 30 seconds. The provider's current September 27 documentation specifies `Access-Control-Allow-Origin: *` for its results API when requests omit cookies, enabling cross-origin browser reads; continue to treat an HTTP/CORS failure as an unavailable feed, not zero votes. This is **not individual precinct data**, and must never be summed together with partial county or precinct returns.
- The existing `michigan/election-night/app.js` already implements this feed and polls it no more often than once per 60 seconds.

### 2. Michigan counties — original records / authoritative local fallback
- Official directory of county clerk election result webpages:
  https://www.michigan.gov/sos/elections/election-results-and-data/candidate-listings-and-election-results-by-county
- The state says that county clerks may post unofficial returns on election night; local datasets and publication schedules are not standardized.
- Concrete county publications and technical sources:
  - Livingston County publishes a **November 3, 2026 election** section with links for an **All Candidate and Proposal Report, Statement of Votes Cast, and Precinct Status Report**. Before 8 p.m. Eastern, that page cautions that displayed data can be **test results**, not real vote totals. https://milivcounty.gov/elections/election-results/
  - Oakland County official archive: https://elections.oaklandcountymi.gov/government/clerk-register-of-deeds/elections-voting/past-election-results
  - Wayne County results: https://www.waynecounty.com/elected/clerk/election-results.aspx
  - Macomb County historical searchable election materials: https://pastelections.macombgov.org/eng/docs/search/
- These sources are uneven: JSON/HTML/vendor reports versus PDF/tallies. The **precinct 30-second website refresh** checks only the site's own normalized precinct JSON snapshot. It cannot manufacture new data or force counties to publish faster.

### 3. Nominate.AI / Campaign Brain — highest-potential external precinct data vendor
- Product: https://www.nominate.ai/ ; case study: https://campaignbrain.dev/field/mi-2026-primary ; platform contact: https://campaignbrain.dev/contact
- In its **own** Michigan August 4, 2026 primary retrospective, it reports coverage of 83 counties, ~5,500 precincts and 268 contests, involving JSON, HTML, PDFs and attributed manual entry. On election night, 31 counties had machine-readable returns; verified coverage rose to 50/83 by two days later. The vendor describes both county/precinct results and an API/query/export surface. These are **vendor-published claims**, not third-party performance benchmarks.
- An openly documented, unauthenticated **Michigan precinct election-night JSON endpoint with schema and permissible redistribution terms was not established**. Its public website offers a walkthrough and access plans. Do NOT pretend its August-primary numbers are November general returns or silently ingest a vendor dashboard.
- For a working integration, request:
  1. 2026 Michigan statewide US Senate reporting-unit or precinct returns access (no current voters or personal info), exact API/export URL, schema and example payload.
  2. Update frequency, latency SLA, rate limits, credentials, browser CORS support and license/public redistribution rights.
  3. Stable county FIPS+precinct/counting-board identifier, separate absentee/early-vote units, D/R/other candidate totals, reported status, publication timestamps and attributed clerk page.
  4. A **pre-election test or 2026 August primary replay** and documented county/result-level reconciliation.
- On delivery, build an authenticated **server-side** adapter outside GitHub Pages (or vendor webhook) to normalize to `results.json`/a separately hosted JSON endpoint. Never put credentials in client JS or the public repo.

### 4. Commercial alternatives
- Associated Press election API: https://developer.ap.org/ap-elections-api/ and reporting-unit examples https://developer.ap.org/ap-elections-api/docs/Elections_Response_Examples.htm . Supports live votes and reporting units where available; requires a key and commercial agreement. Confirm whether the licensed Michigan product includes *individual precincts* rather than only county/FIPS units.
- Decision Desk HQ election results API: https://results-api-docs.decisiondeskhq.com/ . Credentials and confirmed per-Michigan precinct coverage are required before relying on it.

### 5. Historical precinct baselines
- OpenElections machine-readable Michigan election history: https://github.com/openelections/openelections-data-mi
- Michigan certified statewide election result/precinct datasets: https://www.michigan.gov/sos/elections/election-results-and-data
- These are useful to fit precinct or county turnout expectations and check reporting-unit identifiers; do not treat historical files as a live precinct feed.

## Recommended source hierarchy on the Ervin Model

1. **County clerk published 2026 US Senate precinct/absentee counting-board results**, with attribution and date, parsed by validated county adapter or reviewed CSV.
2. **Nominate.AI's API/export**, contingent on contractual access and a validated schema; its claimed coverage could save building 83 scrapers. Cross-check to county clerks.
3. **Open America** as a separate statewide cross-check only; do not combine totals with local data. Show timestamps and stale flags.
4. **AP or DDHQ** as contingency if terms, latency and precinct granularity are established.

## Accuracy safeguards
- Suppress results before the applicable *local poll closing time*; Michigan crosses Eastern and Central time zones. Different counties can report at different times.
- Treat "precinct reporting" or "units reporting" as unknown without a consistent known denominator; never call a winner from an incomplete count.
- Deduplicate absentee counting boards, precinct splits and corrected replacement reports using stable identifiers, not just repeated county names.
- Require field-level provenance and dated release; reject stale 2024/2022 reports and pre-election test payloads.
- Avoid double-counting statewide Open America counts and any precinct dataset derived from county reports.
- **30-second client checks** are already supported for the site's precinct JSON. New official figures may arrive far less frequently. GitHub Pages cannot itself execute an authenticated continuously running precinct scraper; for true low-latency data acquisition a backend, webhook, hosted feed or a licensed vendor is required.

## Present implementation / remaining dependency
- Existing: `michigan/election-night/` website with compact official county source links and manual refresh; `results.json` validated precinct contract; `scripts/ingest_michigan_election_night.py` reviewed CSV importer; GitHub Action on CSV upload; real-time **Open America statewide** browser cross-check. Local-closing safeguards keep Dickinson, Gogebic, Iron and Menominee results gated until **9:00 p.m. Eastern / 8:00 p.m. Central**. A browser regression test covers both demo and pre-election cases.
- Still required: functioning *November 2026 general-election precinct source ingestion* (vendor agreement or county adapter infrastructure). **The current precinct feed is empty** until authenticated official returns are supplied. Its 30-second browser refresh is ready but is not itself an ingestion pipeline.

## October 24 corrections and verified primary reporting links

Direct county result sources surfaced on the shortened Results page: [Michigan SOS 83-county clerk directory](https://www.michigan.gov/sos/elections/election-results-and-data/candidate-listings-and-election-results-by-county), [Livingston County election results](https://milivcounty.gov/elections/election-results/), [Kent County election reporting](https://www.kentcountymi.gov/elections), [Wayne County clerk results](https://www.waynecounty.com/elected/clerk/election-results.aspx) and [Oakland County clerk](https://elections.oaklandcountymi.gov/government/clerk-register-of-deeds/elections-voting). The Michigan SOS directory explicitly describes these county result webpages as possible election-night unofficial sources. Livingston warns that anything displayed *before Election Night* may be test data, which must never be ingested as real results.

The browser statewide read now validates API version, year, office, candidate totals, source timestamps and declared freshness, with a 12-second timeout and 60-second minimum source check. The precinct checker still checks its static JSON every 30 seconds when the page is open. No reviewed 2026 precinct votes have been connected yet; this is a source limitation rather than a site-rendering bug. The site's external source status is not a claim of a confirmed live feed until data actually pass validation.
