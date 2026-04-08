# Coverage Readiness: coverage-pack

## Date

2026-04-04

## Scope

- Precinct config: `mvp/config/precinct-focus-map.json`
- Configured councils: `17`
- Configured precincts: `32`

## Gate Verdict

- Precinct mapping: `PASS`
- Risk layer availability: `PASS`
- Stable shortlist and report output: `PASS`
- Overall: `SELECTIVE EXPANSION ONLY`

## Mapping Coverage

- Scope note: this page describes only the configured precinct universe in the named focus map. These counts are not full-region totals for every proposal or application in Sydney.
- Precincts with any signal: `31 / 32` (97%)
- Precincts with mapped proposals: `27`
- Precincts with mapped applications: `31`
- Total mapped proposals: `380`
- Total mapped applications: `5,086`

| Council | Precincts | With Signals | Recent Apps | Active Pipeline | With Constraints |
| --- | --- | --- | --- | --- | --- |
| Inner West | 3 | 3 | 627 | 2 | 3 |
| Ryde | 4 | 4 | 627 | 0 | 4 |
| Campbelltown | 4 | 4 | 522 | 5 | 4 |
| Georges River | 4 | 4 | 506 | 1 | 4 |
| Willoughby | 1 | 1 | 505 | 2 | 1 |
| Canterbury-Bankstown | 2 | 2 | 329 | 1 | 2 |
| Ku-ring-gai | 2 | 2 | 266 | 0 | 2 |
| Cumberland | 1 | 1 | 260 | 0 | 1 |
| Sutherland Shire | 1 | 1 | 223 | 2 | 1 |
| Liverpool | 1 | 1 | 220 | 2 | 1 |
| Hunters Hill | 1 | 1 | 217 | 2 | 0 |
| Burwood | 1 | 1 | 192 | 1 | 1 |
| Strathfield | 2 | 1 | 121 | 0 | 2 |
| Canada Bay | 1 | 1 | 113 | 2 | 0 |
| The Hills Shire | 1 | 1 | 105 | 2 | 1 |
| Parramatta | 1 | 1 | 51 | 2 | 1 |
| North Sydney | 2 | 1 | 50 | 0 | 1 |

## Risk Layer Availability

- Precincts with at least one constraint: `29 / 32` (91%)

| Constraint Type | Severity | Count |
| --- | --- | --- |
| biodiversity_spatial_sample | medium | 1 |
| bushfire_spatial_sample | high | 7 |
| bushfire_spatial_sample | medium | 1 |
| flood_metadata_signal | high | 22 |
| flood_metadata_signal | medium | 3 |
| heat_vulnerability_proxy | high | 3 |
| heat_vulnerability_proxy | medium | 4 |
| low_tree_canopy_proxy | high | 9 |
| low_tree_canopy_proxy | medium | 3 |
| policy_withdrawal_friction | medium | 2 |

## Shortlist And Report Stability

- Shortlist items in pack: `30`
- Rating mix: `A=2`, `B=18`, `C=10`

| Rank | Precinct | Council | Rating | Risk | Recent Apps | Pipeline |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Gladesville | Hunters Hill | A | 0 | 217 | 2 |
| 2 | Five Dock | Canada Bay | A | 0 | 113 | 2 |
| 3 | Croydon | Burwood | B | 1 | 192 | 1 |
| 4 | Beverly Hills | Georges River | B | 1 | 64 | 1 |
| 5 | Hurstville | Georges River | B | 2 | 280 | 0 |
| 6 | Auburn | Cumberland | B | 2 | 260 | 0 |
| 7 | Epping | Ryde | B | 2 | 250 | 0 |
| 8 | Miranda | Sutherland Shire | B | 2 | 223 | 2 |
| 9 | Lindfield | Ku-ring-gai | B | 2 | 196 | 0 |
| 10 | West Ryde | Ryde | B | 2 | 148 | 0 |
| 11 | Kogarah | Georges River | B | 2 | 99 | 0 |
| 12 | Riverwood | Georges River | B | 2 | 63 | 0 |
| 13 | Westmead | Parramatta | B | 2 | 51 | 2 |
| 14 | St Leonards | North Sydney | B | 2 | 50 | 0 |
| 15 | Marrickville | Inner West | B | 3 | 360 | 2 |

## Interpretation

- Mapping has moved beyond council-level heat and is now usable for selective precinct screening, but coverage gaps still remain.
- The risk layer is already changing shortlist order, which means the expanded pack is doing more than just surfacing hotter places, but it is still a first-pass proxy layer.
- The current expanded pack can support selective corridor-by-corridor reporting, but it should still be treated as beta coverage rather than broad market-grade maturity.
