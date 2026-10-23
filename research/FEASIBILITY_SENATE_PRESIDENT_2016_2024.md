# 2016–2024 Senate + presidential calibration feasibility — October 23, 2026

## Decision
**Feasible as a broader state-level historical-error calibration, but not automatically a sufficient sample for statistically precise race-specific forecast probabilities or a four-publisher ranking.** Across the 17 tracked states, the 2016–2024 calendar provides about **108 separate Senate/presidential state contests (102 regular/cross-office opportunities plus six additional Senate contests arising from overlapping cycles/specials)**, or **6–7 contests per state**, on paper. Those are **not 108 independent polling-error draws**; correlated presidential and Senate polls in the same state/election year can share the same turnout error. There are only **five general-election years** (2016, 2018, 2020, 2022, 2024). Not all contests have suitable polling averages.

The completed **2026 elections are not yet available as outcomes**; 2026 polls are forecasting inputs, not backtesting observations.

## State election opportunities versus actual polling coverage

Key:
- *Possible:* 2016, 2020, 2024 presidential results (three) plus Senate elections held in 2016, 2018, 2020, 2022, 2024 as appropriate, including 2018 MN/MS, 2020 GA, and 2024 NE additional Senate elections. The number includes independent or same-party matchups **even when they cannot be used as ordinary Democratic-minus-Republican error observations**.
- *2016–2022 verified:* FiveThirtyEight's historical raw-poll archive, number of state-election/office-year slots with **at least two distinct nonpartisan pollsters** with field date at most 21 days before election; only clean Democratic versus Republican polls counted. The pre-2024 archive counts office-year, not individual races, so concurrent special/regular contests do not each get a separate count.
- *2024 538 coverage:* Count of nonpartisan 2024 state presidential polls and for relevant 2024 Senate race(s) from FiveThirtyEight's separate snapshot, whose sampling window was **180–15 days before Election Day and frozen October 28**. These are **not** final-21-day counts and not independent pollster counts. 0 means absent from this particular 538 file, not proof that no poll existed anywhere.

| State | Possible 2016–24 Senate contests | + Presidential contests | Possible total | Distinct well-polled 2016–22 office-year slots¹ | 2024 pres nonpartisan polls² | 2024 Senate nonpartisan polls² | Assessment |
|---|---:|---:|---:|---:|---:|---:|---|
| Maine | 3 | 3 | 6 | 3 | 4 | 2 | Senate 2018/2024 involved independent King; do not convert to D-R |
| Michigan | 3 | 3 | 6 | 4 | 84 | 54 | Good state-level collection |
| Ohio | 4 | 3 | 7 | 5 | 15 | 15 | Good state-level collection |
| Texas | 3 | 3 | 6 | 4 | 24 | 23 | Good state-level collection |
| Iowa | 3 | 3 | 6 | 5 | 2 | — | 2024 presidential thin |
| Kansas | 3 | 3 | 6 | 4 | 0 | — | Presidential 2024 absent from 538 snapshot; other source backfill |
| Minnesota | 4 | 3 | 7 | 4 | 21 | 12 | 2018 special + regular Senate correlated |
| Alaska | 3 | 3 | 6 | 2 | 3 | — | Sparse; 2022 Senate R-vs-R final ranked-choice round; candidate-specific Peltola House data useful separately |
| Georgia | 4 | 3 | 7 | 5 | 73 | — | Two 2020 Senate contests; Jan 2021 runoffs belong to same election cycle |
| North Carolina | 3 | 3 | 6 | 5 | 74 | — | Good state-level collection |
| New Hampshire | 3 | 3 | 6 | 5 | 15 | — | Good state-level collection |
| Nebraska | 4 | 3 | 7 | 1 | 2 | 2 (independent race); 1 (special D-R) | Sparse; Osborn independent 2024 not ordinary D-R; presidential statewide vs NE district separate |
| South Carolina | 3 | 3 | 6 | 3 | 2 | — | Sparse, especially 2024 presidential |
| Mississippi | 4 | 3 | 7 | 4 | 0 | 0 (one partisan survey) | Sparse; extra Senate special election in 2018 |
| Florida | 4 | 3 | 7 | 5 | 39 | 28 | Good state-level collection |
| South Dakota | 3 | 3 | 6 | 3 | 2 | — | Sparse; Bengs switched D to independent in 2026 |
| Montana | 3 | 3 | 6 | 4 | 6 | 7 | Usable, though 2026 independent Bodnar has no historical like-for-like matchup |

¹ The nonpartisan, two-distinct-pollster threshold applies **only to 2016–2022**, not the 2024 file.
² FiveThirtyEight 2024 snapshot covers **180–15 days** prior to the election, as of Oct. 28; not the final 14 days. Some counties/districts or independent fields are not directly comparable with 2026 candidate matchups.

**Counting nuance:** The class-based opportunity counts are administrative possibilities, not a claim that each contest was accurately polled. Also, before pooling 538's row-level polls, normalize candidate pairing, sponsors, special elections, primaries, ranked-choice round, and margin denominator.

## Primary evidence

- FiveThirtyEight **raw pollster-rating dataset** (through 2023; each row contains election cycle, office, geographic scope, poll date, candidate parties, and actual outcome):
  https://github.com/fivethirtyeight/data/blob/master/pollster-ratings/raw_polls.csv
- FiveThirtyEight **2024 snapshot source** and exact 180–15-day sampling-window notes:
  https://github.com/fivethirtyeight/data/blob/master/state-of-the-polls-2024/README.md
  https://github.com/fivethirtyeight/data/blob/master/state-of-the-polls-2024/2024_polls.csv
  https://github.com/fivethirtyeight/data/blob/master/state-of-the-polls-2024/2024_races.csv
- Federal Election Commission **official historical election results**, 2016 through 2024:
  https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/
- RealClearPolling **historical polling archive** for 2016 onward:
  https://www.realclearpolling.com/historical-polling-archive
- 270toWin **2020 President and Senate historical state-poll pages**:
  https://www.270towin.com/content/2020-presidential-and-senate-polling/

## Publisher ranking is a different task

- DDHQ says its published average series began in **2018**, so it cannot be fairly scored for 2016 under its own published methodology: https://polling-api-docs.decisiondeskhq.com/reference/averages
- Nate Silver launched **Silver Bulletin**'s own polling/forecast product in **2024**. Earlier Silver-run FiveThirtyEight models are related intellectually but **not identical source products**. Do not invent 2016–22 Silver Bulletin polling averages: https://www.natesilver.net/p/announcing-2024-election-model-plans
- RCP/270toWin have historical polls and some averages, but per-race/date average availability needs verifying. DO NOT use a provider's polls as if they were its published *poll average*.
- To compare sources, assemble a **matched election-by-provider matrix** with election-eve averages and no proxies; missing-data cells should stay empty.

## Statistical plan before expanding production calibration

1. Backfill each state × election × office with the *actual final published aggregate margin* as of a fixed pre-election date; attach publisher and source URL. Require matching candidate pair and runoff round. Preserve any existing Peltola, Osborn and Bengs candidate-specific observations rather than overwriting them with partisan averages.
2. Use a **hierarchical shrinkage model** pooling sparse states toward national, region and office baselines, rather than calling 6–7 correlated elections six independent observations. Include separate presidential, Senate, special/independent and ranked-choice factors. Compare an office-specific effect and a common-cycle effect.
3. For backtests, **walk forward**: 2016 can train later cycles but not be evaluated using later outcomes; 2020 testing may use 2016 and 2018; 2022 testing may use prior years; 2024 testing may use 2016–2022 only. Exclude target and future elections from its historical error estimate.
4. Evaluate sign/bias, MAE, RMSE, direction, true-outcome coverage of 80%/90% scenario bands, state- and cycle-clustered uncertainty, and baseline/no-adjustment performance.
5. Give each race a data-quality badge: well-supported / sparse / candidate-specific. No rigorous posterior probability or confidence label until enough genuinely independent held-out observations pass calibration.
6. **Do not change Ervin's Take's four publisher weights merely because more 538/RCP raw polls were downloaded.** Those do not equally measure the four different aggregators.

## Feasibility verdict

**Proceed with the 2016–2024 statewide baseline backfill**, using presidential error at a lower office weight than Senate and retaining a shrinkage option. Present 2016 as a real older cycle, not equally recent with 2024. Mark Alaska/Nebraska/South Dakota and independent/ranked-choice contests as special cases, and Kansas/Mississippi as source-coverage priorities. Keep the four-source blend's historical ranking separate until comparable publisher archives are available.

This report is an **archive-coverage audit**. It is not a completed 108-election quantitative regression or proof of statistically sufficient samples for each 2026 candidate matchup.
