# Ervin Model · 2026 U.S. Senate Forecast Lab

Experimental Senate polling dashboard, built October 23, 2026.

**Website:** https://geervin.github.io/ervin-model-2026/

## What's here
- 50-state interactive tile map; 17 tracked Senate races
- Five independent source **views** (RCP, DDHQ, 270toWin, Wikipedia average of aggregators, Silver Bulletin)
- Adjusted margins using state historical polling error; historical backtests and provenance
- 80% / 90% sensitivity bands, proxy indicators, interactive comparisons, exports, mobile layout

## Important data caveats
Data are a **dated October 23, 2026 research snapshot**, not automatically current. Some displayed polling inputs are explicitly labeled reference proxies, not genuine estimates from that provider. Averages may share underlying constituent polls and should not be treated as independent evidence. Scenario intervals are **heuristic sensitivity bands**, not statistically validated election-win probabilities.

## Deployment
GitHub Actions deploys the root `index.html` to GitHub Pages on push to `main`. If the initial workflow fails because Pages has not been enabled, visit **Settings → Pages → Build and deployment → Source: GitHub Actions**, then rerun the Publish Ervin Model website workflow.

## Automatic polling updates
The original local package includes a six-hour polling refresh implementation. This repository currently publishes the historical website snapshot; the source collection/update workflow must be installed and verified separately before any new poll input is claimed as refreshed.
