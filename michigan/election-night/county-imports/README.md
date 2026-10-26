# County-wide Michigan 2026 US Senate election results

This is a **separate** reviewed intake for faster county-level election reporting; it does not imply every clerk exposes an automatic API.

Each reviewed CSV must contain one row per county, with exactly these mandatory fields:

`county,dem,rep,other,as_of,source_url,reporting_status`

- `as_of` is the county clerk report publication timestamp in ISO 8601 with timezone offset; not volunteer entry time.
- `reporting_status` is `partial` or `complete`, reflecting only the clerk's explicit disclosure.
- `source_url` must be the original HTTPS clerk report. All results must be for November 3, 2026 Michigan US Senate and cannot be ingested before that county's 8 p.m. local closing.
- Use latest full county snapshot to replace the previous entry; no cumulative append or double counting.
- A county-wide clerk row **supersedes any precinct subtotal for that county** on the map. It must never be added to the precinct subtotal.
- Corrected county figures should have a fresh publication timestamp; row deletions and timestamp rollbacks are blocked.
- CSV publication runs `.github/workflows/michigan-county-results.yml`, which deploys `county_totals.json` after validation. GitHub Pages deployments and clerk release times are not guaranteed 30-second delivery.
