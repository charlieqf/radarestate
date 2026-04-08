# Coverage Readiness: greater-sydney-expanded

## Date

2026-04-03

## Scope

- Precinct config: `mvp/config/precinct-focus-map-greater-sydney-expanded.json`
- Configured councils: `22`
- Configured precincts: `56`

## Gate Verdict

- Precinct mapping: `PASS`
- Risk layer availability: `PASS`
- Stable shortlist and report output: `PASS`
- Overall: `SELECTIVE EXPANSION ONLY`

## Mapping Coverage

- Precincts with any signal: `44 / 56` (79%)
- Precincts with mapped proposals: `40`
- Precincts with mapped applications: `44`
- Total mapped proposals: `505`
- Total mapped applications: `7,769`

| Council | Precincts | With Signals | Recent Apps | Active Pipeline | With Constraints |
| --- | --- | --- | --- | --- | --- |
| Blacktown | 5 | 5 | 1,068 | 6 | 4 |
| Inner West | 3 | 3 | 627 | 2 | 3 |
| Ryde | 4 | 4 | 627 | 0 | 4 |
| Penrith | 2 | 2 | 555 | 5 | 2 |
| Campbelltown | 4 | 4 | 522 | 5 | 4 |
| Georges River | 4 | 4 | 506 | 1 | 4 |
| Willoughby | 1 | 1 | 505 | 2 | 1 |
| Fairfield | 2 | 2 | 476 | 3 | 2 |
| Canterbury-Bankstown | 2 | 2 | 329 | 1 | 2 |
| Ku-ring-gai | 2 | 2 | 266 | 0 | 2 |
| Cumberland | 3 | 1 | 260 | 0 | 1 |
| Woollahra | 2 | 2 | 252 | 6 | 2 |
| Sutherland Shire | 4 | 1 | 223 | 2 | 1 |
| Liverpool | 1 | 1 | 220 | 2 | 1 |
| Bayside | 2 | 2 | 219 | 2 | 0 |
| Hunters Hill | 1 | 1 | 217 | 2 | 0 |
| Burwood | 1 | 1 | 192 | 1 | 1 |
| Strathfield | 2 | 1 | 121 | 0 | 2 |
| Canada Bay | 2 | 1 | 113 | 2 | 0 |
| The Hills Shire | 4 | 1 | 105 | 2 | 1 |
| Parramatta | 3 | 1 | 51 | 2 | 1 |
| North Sydney | 2 | 1 | 50 | 0 | 1 |

## Risk Layer Availability

- Precincts with at least one constraint: `39 / 56` (70%)

| Constraint Type | Severity | Count |
| --- | --- | --- |
| biodiversity_spatial_sample | medium | 1 |
| bushfire_spatial_sample | high | 10 |
| bushfire_spatial_sample | medium | 3 |
| flood_metadata_signal | high | 29 |
| flood_metadata_signal | medium | 5 |
| heat_vulnerability_proxy | high | 3 |
| heat_vulnerability_proxy | medium | 4 |
| low_tree_canopy_proxy | high | 9 |
| low_tree_canopy_proxy | medium | 3 |
| policy_withdrawal_friction | medium | 2 |

## Shortlist And Report Stability

- Shortlist items in pack: `43`
- Rating mix: `A=4`, `B=27`, `C=12`

| Rank | Precinct | Council | Rating | Risk | Recent Apps | Pipeline |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Gladesville | Hunters Hill | A | 0 | 217 | 2 |
| 2 | Five Dock | Canada Bay | A | 0 | 113 | 2 |
| 3 | Edgecliff | Woollahra | A | 1 | 70 | 5 |
| 4 | Cabramatta | Fairfield | A | 2 | 257 | 2 |
| 5 | Seven Hills | Blacktown | B | 0 | 282 | 1 |
| 6 | Bexley | Bayside | B | 0 | 201 | 1 |
| 7 | Croydon | Burwood | B | 1 | 192 | 1 |
| 8 | Double Bay | Woollahra | B | 1 | 182 | 1 |
| 9 | Beverly Hills | Georges River | B | 1 | 64 | 1 |
| 10 | Hurstville | Georges River | B | 2 | 280 | 0 |
| 11 | Auburn | Cumberland | B | 2 | 260 | 0 |
| 12 | Epping | Ryde | B | 2 | 250 | 0 |
| 13 | Miranda | Sutherland Shire | B | 2 | 223 | 2 |
| 14 | Smithfield | Fairfield | B | 2 | 219 | 1 |
| 15 | St Marys | Penrith | B | 2 | 204 | 1 |

## Interpretation

- Mapping has moved beyond council-level heat and is now usable for selective precinct screening, but coverage gaps still remain.
- The risk layer is already changing shortlist order, which means the expanded pack is doing more than just surfacing hotter places, but it is still a first-pass proxy layer.
- The current expanded pack can support selective corridor-by-corridor reporting, but it should still be treated as beta coverage rather than broad market-grade maturity.
