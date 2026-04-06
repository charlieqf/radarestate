# Coverage Readiness: sydney-core-plus

## Date

2026-04-05

## Scope

- Precinct config: `mvp/config/precinct-focus-map-sydney-core-plus.json`
- Configured councils: `28`
- Configured precincts: `72`

## Gate Verdict

- Precinct mapping: `PASS`
- Risk layer availability: `PASS`
- Stable shortlist and report output: `PASS`
- Overall: `PRODUCTION-STABLE WITHIN CONFIGURED SCOPE`

## Mapping Coverage

- Scope note: this page describes only the configured precinct universe in the named focus map. These counts are not full-region totals for every proposal or application in Sydney.
- Precincts with any signal: `71 / 72` (99%)
- Precincts with mapped proposals: `64`
- Precincts with mapped applications: `71`
- Total mapped proposals: `770`
- Total mapped applications: `13,563`

| Council | Precincts | With Signals | Recent Apps | Active Pipeline | With Constraints |
| --- | --- | --- | --- | --- | --- |
| The Hills Shire | 4 | 4 | 1,096 | 7 | 3 |
| Blacktown | 5 | 5 | 1,068 | 6 | 5 |
| Sydney | 6 | 6 | 946 | 6 | 6 |
| Cumberland | 3 | 3 | 859 | 0 | 3 |
| Inner West | 3 | 3 | 628 | 2 | 3 |
| Ryde | 4 | 4 | 618 | 0 | 4 |
| Sutherland Shire | 4 | 4 | 612 | 5 | 3 |
| Parramatta | 3 | 3 | 603 | 3 | 3 |
| Penrith | 2 | 2 | 555 | 5 | 2 |
| Campbelltown | 4 | 4 | 523 | 5 | 4 |
| Georges River | 4 | 4 | 510 | 1 | 4 |
| Willoughby | 1 | 1 | 506 | 2 | 1 |
| Randwick | 3 | 3 | 498 | 2 | 3 |
| Mosman | 1 | 1 | 491 | 2 | 1 |
| Fairfield | 2 | 2 | 476 | 3 | 2 |
| Hornsby | 4 | 4 | 426 | 0 | 3 |
| Canterbury-Bankstown | 2 | 2 | 329 | 0 | 2 |
| Canada Bay | 2 | 2 | 282 | 3 | 2 |
| Ku-ring-gai | 2 | 2 | 266 | 0 | 2 |
| Woollahra | 2 | 2 | 252 | 6 | 2 |
| Liverpool | 1 | 1 | 222 | 2 | 1 |
| Hunters Hill | 1 | 1 | 220 | 2 | 0 |
| Bayside | 2 | 2 | 219 | 2 | 2 |
| Lane Cove | 1 | 1 | 205 | 2 | 1 |
| Burwood | 1 | 1 | 195 | 1 | 1 |
| Waverley | 1 | 1 | 182 | 1 | 1 |
| Strathfield | 2 | 1 | 121 | 0 | 2 |
| North Sydney | 2 | 1 | 50 | 0 | 1 |

## Risk Layer Availability

- Precincts with at least one constraint: `67 / 72` (93%)

| Constraint Type | Severity | Count |
| --- | --- | --- |
| biodiversity_spatial_sample | medium | 3 |
| bushfire_spatial_sample | high | 18 |
| bushfire_spatial_sample | medium | 3 |
| flood_metadata_signal | high | 42 |
| flood_metadata_signal | medium | 5 |
| heat_vulnerability_proxy | high | 15 |
| heat_vulnerability_proxy | medium | 4 |
| low_tree_canopy_proxy | high | 30 |
| low_tree_canopy_proxy | medium | 13 |
| policy_withdrawal_friction | high | 1 |
| policy_withdrawal_friction | medium | 2 |

## Shortlist And Report Stability

- Shortlist items in pack: `70`
- Rating mix: `A=4`, `B=40`, `C=26`

| Rank | Precinct | Council | Rating | Risk | Recent Apps | Pipeline |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Gladesville | Hunters Hill | A | 0 | 220 | 2 |
| 2 | Chatswood | Willoughby | A | 2 | 506 | 2 |
| 3 | Mosman / Spit Junction | Mosman | A | 2 | 491 | 2 |
| 4 | Lane Cove | Lane Cove | A | 2 | 205 | 2 |
| 5 | Gables | The Hills Shire | B | 0 | 429 | 2 |
| 6 | Cronulla | Sutherland Shire | B | 0 | 191 | 1 |
| 7 | Waitara / Wahroonga | Hornsby | B | 0 | 66 | 0 |
| 8 | Double Bay | Woollahra | B | 1 | 182 | 1 |
| 9 | Redfern | Sydney | B | 1 | 135 | 0 |
| 10 | Ultimo / Broadway | Sydney | B | 1 | 107 | 3 |
| 11 | Edgecliff | Woollahra | B | 1 | 70 | 5 |
| 12 | Castle Hill | The Hills Shire | B | 2 | 483 | 2 |
| 13 | Epping | Ryde | B | 2 | 239 | 0 |
| 14 | Miranda | Sutherland Shire | B | 2 | 223 | 2 |
| 15 | Carlingford | Parramatta | B | 2 | 222 | 0 |

## Interpretation

- Mapping is now dense enough to support production client reporting across the configured precinct universe, with only marginal residual gaps.
- The risk layer is already changing shortlist order, which means the expanded pack is doing more than just surfacing hotter places, but it is still a first-pass proxy layer.
- The current expanded pack is stable for client-facing reporting inside the configured precinct scope, but it should still be described as configured-scope coverage rather than full metro-complete market coverage.
