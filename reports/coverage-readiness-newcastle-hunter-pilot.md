# Coverage Readiness: newcastle-hunter-pilot

## Date

2026-04-03

## Scope

- Precinct config: `mvp/config/precinct-focus-map-newcastle.json`
- Configured councils: `5`
- Configured precincts: `20`

## Gate Verdict

- Precinct mapping: `PASS`
- Risk layer availability: `PASS`
- Stable shortlist and report output: `PASS`
- Overall: `READY TO EXPAND`

## Mapping Coverage

- Precincts with any signal: `20 / 20` (100%)
- Precincts with mapped proposals: `18`
- Precincts with mapped applications: `20`
- Total mapped proposals: `249`
- Total mapped applications: `2,588`

| Council | Precincts | With Signals | Recent Apps | Active Pipeline | With Constraints |
| --- | --- | --- | --- | --- | --- |
| Lake Macquarie | 4 | 4 | 581 | 0 | 4 |
| Maitland | 4 | 4 | 558 | 2 | 4 |
| Port Stephens | 4 | 4 | 526 | 2 | 4 |
| Newcastle | 4 | 4 | 525 | 1 | 2 |
| Cessnock | 4 | 4 | 369 | 1 | 3 |

## Risk Layer Availability

- Precincts with at least one constraint: `17 / 20` (85%)

| Constraint Type | Severity | Count |
| --- | --- | --- |
| biodiversity_spatial_sample | medium | 2 |
| bushfire_spatial_sample | high | 15 |
| flood_metadata_signal | high | 11 |
| flood_metadata_signal | medium | 2 |
| policy_withdrawal_friction | medium | 2 |

## Shortlist And Report Stability

- Shortlist items in pack: `19`
- Rating mix: `A=0`, `B=9`, `C=10`

| Rank | Precinct | Council | Rating | Risk | Recent Apps | Pipeline |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Mayfield | Newcastle | B | 0 | 213 | 0 |
| 2 | Broadmeadow | Newcastle | B | 0 | 28 | 0 |
| 3 | Newcastle City Centre | Newcastle | B | 2 | 190 | 1 |
| 4 | Nelson Bay | Port Stephens | B | 2 | 169 | 1 |
| 5 | Rutherford | Maitland | B | 2 | 142 | 0 |
| 6 | Thornton | Maitland | B | 2 | 126 | 1 |
| 7 | Kotara | Newcastle | B | 2 | 94 | 0 |
| 8 | Charlestown | Lake Macquarie | B | 3 | 205 | 0 |
| 9 | Raymond Terrace | Port Stephens | B | 3 | 101 | 0 |
| 10 | Medowie | Port Stephens | C | 4 | 235 | 1 |
| 11 | East Maitland | Maitland | C | 4 | 199 | 0 |
| 12 | Belmont | Lake Macquarie | C | 4 | 176 | 0 |
| 13 | Warners Bay | Lake Macquarie | C | 4 | 143 | 0 |
| 14 | Maitland | Maitland | C | 4 | 91 | 1 |
| 15 | Branxton | Cessnock | C | 4 | 63 | 0 |

## Interpretation

- Mapping has moved beyond council-level heat and is now usable at precinct level.
- The risk layer is already changing shortlist order, which means the expanded pack is doing more than just surfacing hotter places.
- The current expanded pack can already produce a stable enough shortlist and report set.
