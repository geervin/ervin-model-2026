# 2026 Michigan precinct outlook: data, matching and caveats

## Implemented October 26, 2026

The Election Night page lets a reader choose a county, **click or tap an individual 2026 precinct polygon**, or choose the precinct by name in the accessible dropdown. A precinct panel shows the current geography name, the 2024 historical Slotkin/Rogers Senate votes when uniquely matched, and 2026 modeled *two-party percentages* for El-Sayed/Rogers. The model does not invent a ballot count or declare a race winner.

### Input data
- **Historical precinct vote counts (2024):** OpenElections Michigan 2024 official result compilation, [2024 November general-election precinct CSV](https://github.com/openelections/openelections-data-mi/blob/master/2024/20241105__mi__general__precinct.csv). Specifically, `office = U.S. Senate` and major-party votes, retaining county/precinct names.
- **Current GIS:** [Michigan Bureau of Elections 2026 Voting Precincts](https://www.arcgis.com/home/item.html?id=c349bc2bb6c2468594d341a09f520ea8), 3,895 precinct polygons (2026 reporting geographies).
- **County model:** the site's Original Ervin Michigan Senate county model, calculated using 2024 Senate (55%), 2022 governor (25%), and 2024 president (20%), plus the latest statewide polling-adjusted county target.

The extracted history file [`precinct_history_2024.json`](../michigan/election-night/precinct_history_2024.json) contains 4,431 named reporting units from 83 counties. Source aggregation omits turnout lines, non-major-party Senate candidates, invalid vote-count fields and obviously separate early/absentee county-wide counting units rather than pretending those votes belonged to a particular precinct. Historical data may have additional unrecognized counting-unit categories; therefore historical per-precinct votes are **not guaranteed to capture all votes in a locality**.

### Conservative 2024 → 2026 geography join
- Normalizes common naming differences (`City of X` / `X City`, `Township` / `Twp`, `Precinct` / `Pct`) while preserving ward, precinct and municipality identity.
- Requires a **unique matching historic row and a unique 2026 polygon** within the same county. Ambiguous collisions, changed names, split precincts and low-sample (<60 major-party ballots) records are excluded from the precinct-specific projection.
- Live browser validation on October 26 matched **3,108 of 3,895 polygons (79.8%)**. The other **787** are explicitly assigned a *county-level fallback* rather than fictitious local voting patterns. This is a name-based crosswalk, **not** certified proof of identical 2024 and 2026 geographic boundaries.
- Changing the official GIS layer or revising the historical dataset can alter the match count; the interface reports its current count.

### Local forecast formula
For a uniquely matched precinct:
1. Let `p24` be its two-party 2024 Senate Democratic share, and `c24` its county's corresponding historic share. Smooth the observed precinct share toward `c24` with an 80-vote prior, avoiding extremes from very small reporting units.
2. Calculate the precinct's 2024 deviation in log-odds from its county share.
3. Shrink that deviation by `n/(n+180)`, where `n` is the number of observed 2024 major-party votes, and cap extreme deviations.
4. Add the local historical deviation to the **2026 county model's** log-odds two-party share and apply the logistic function. This produces a *modeled 2026 two-party percentage*, not a projected precinct vote count.
5. If a valid, attributed 2026 county-wide clerk vote total arrives, the county two-party share can replace the projected county target. The historic local pattern is still historical, not proof of an election-night precinct tally.

For an unmatched precinct, display only its 2026 county two-party share, clearly marked **COUNTY-ONLY MODEL · NO MATCH**. The actual precinct returns map is a separate layer and uses independently verified, uniquely joined 2026 rows only.

### Interpretation and uncertainty
This is a descriptive precinct-level **scenario extrapolation**. It does not account for differential precinct turnout in 2026, changes in residents, candidate-specific local preferences, geographic redraws beyond unique-name checks, unallocated absentee votes, or the uncertainty in polling adjustments. No quantified precinct confidence interval is claimed. Do not cite map colors as actual votes or independent polling evidence. The official precinct GIS is geography, not an election return source.

Related: [Election Night operations runbook](ELECTION_NIGHT_RUNBOOK_2026.md).
