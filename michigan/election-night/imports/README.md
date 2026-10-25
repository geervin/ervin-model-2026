# Michigan election-night precinct source intake

This directory is deliberately empty before November 3, 2026. The Ervin Model **never** fabricates precinct results.

## Source strategy
The Michigan Secretary of State directs readers to local [county election result websites](https://www.michigan.gov/sos/elections/election-results-and-data/candidate-listings-and-election-results-by-county). Each county can publish different election-night formats and timelines. There is no verified free single machine-readable statewide feed of all 2026 precinct candidate vote counts suitable for automatic 30-second retrieval. Open America's [statewide Senate API](https://openamerica.io/elections/api/) is used independently for state totals (60-second checks) and is **never added to precinct totals**.

## Loading precinct results
When a county clerk publishes attributable 2026 U.S. Senate precinct numbers, prepare an independently checked CSV file in this directory named, for example, `wayne.csv`. Each file must represent the **latest complete snapshot for that county**, rather than an appended increment; individual reporting-unit IDs must be stable across updates. Include exactly these required columns:

`county,precinct,dem,rep,other,as_of,source_url`

The `precinct` can also be a separate absentee/early-vote counting board: make its title explicit so the same votes are not included twice. Dem/rep columns refer to the Michigan U.S. Senate Democratic and Republican candidates, **not president, governor, district or overall ballot counts**. Only use report timestamps on or after November 3, 2026 8pm Eastern; never import test or pre-election numbers. Each `source_url` must be a real HTTPS link to the cited unofficial county result. A reviewer must check the election, county, candidates, precinct IDs, source times, and absentee-counting-board convention before merging.

Commit the CSV to `main` or manually dispatch the ingestion workflow. It validates counties against the 83-county index, unique row IDs, nonnegative counts, source URLs and plausible timestamps. Invalid files cause deployment failure; the last good feed stays in place. The workflow republishes GitHub Pages; **GitHub Pages deployment latency is not a 30-second ingest guarantee**.

The public election-night page checks its `results.json` for changes every 30 seconds while the page is visible after polls close. If a source has no new precinct returns, the page must continue saying it is waiting or unchanged.

## Do not mix data scopes
2024 county histories are model context; they are not live votes. Unreported precincts are not zeros. A county subtotal based on imported precincts is incomplete unless the actual reporting-unit denominator is known. The Open America statewide total may already include those precincts; do not sum statewide and precinct datasets. A source timestamp is never the same as the viewer's last-check timestamp.
