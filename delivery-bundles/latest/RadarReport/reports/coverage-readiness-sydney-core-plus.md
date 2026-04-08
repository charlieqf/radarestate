# Coverage Readiness: sydney-core-plus

## Date

2026-04-05

## Scope

- Precinct config: `mvp/config/precinct-focus-map-sydney-core-plus.json`
- Configured councils: `28`
- Configured precincts: `73`

## Gate Verdict

- Precinct mapping: `PASS`
- Risk layer availability: `PASS`
- Stable shortlist and report output: `PASS`
- Overall: `PRODUCTION-STABLE WITHIN CONFIGURED SCOPE`

## Mapping Coverage

- Scope note: this page describes only the configured precinct universe in the named focus map. These counts are not full-region totals for every proposal or application in Sydney.
- Precincts with any signal: `72 / 73` (99%)
- Precincts with mapped proposals: `65`
- Precincts with mapped applications: `72`
- Total mapped proposals: `768`
- Total mapped applications: `13,554`

| Council | Precincts | With Signals | Recent Apps | Active Pipeline | With Constraints |
| --- | --- | --- | --- | --- | --- |
| The Hills Shire | 4 | 4 | 1,096 | 7 | 3 |
| Blacktown | 5 | 5 | 1,068 | 6 | 5 |
| Sydney | 6 | 6 | 946 | 6 | 6 |
| Cumberland | 3 | 3 | 859 | 0 | 3 |
| Parramatta | 4 | 4 | 833 | 3 | 4 |
| Inner West | 3 | 3 | 628 | 2 | 3 |
| Sutherland Shire | 4 | 4 | 612 | 5 | 3 |
| Ryde | 4 | 4 | 557 | 0 | 4 |
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
| Bayside | 2 | 2 | 219 | 2 | 2 |
| Lane Cove | 1 | 1 | 205 | 2 | 1 |
| Burwood | 1 | 1 | 195 | 1 | 1 |
| Waverley | 1 | 1 | 182 | 1 | 1 |
| Strathfield | 2 | 1 | 121 | 0 | 2 |
| North Sydney | 2 | 1 | 50 | 0 | 1 |
| Hunters Hill | 1 | 1 | 42 | 2 | 0 |

## Risk Layer Availability

- Precincts with at least one constraint: `68 / 73` (93%)

| Constraint Type | Severity | Count |
| --- | --- | --- |
| biodiversity_spatial_sample | medium | 3 |
| bushfire_spatial_sample | high | 18 |
| bushfire_spatial_sample | medium | 3 |
| flood_metadata_signal | high | 43 |
| flood_metadata_signal | medium | 5 |
| heat_vulnerability_proxy | high | 15 |
| heat_vulnerability_proxy | medium | 4 |
| low_tree_canopy_proxy | high | 30 |
| low_tree_canopy_proxy | medium | 13 |
| policy_withdrawal_friction | high | 1 |
| policy_withdrawal_friction | medium | 2 |

## Shortlist And Report Stability

- Shortlist items in pack: `71`
- Rating mix: `A=3`, `B=42`, `C=26`

| Rank | Precinct | Council | Rating | Risk | Recent Apps | Pipeline |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Mosman / Spit Junction | Mosman | A | 2 | 491 | 2 |
| 2 | Chatswood | Willoughby | A | 2 | 506 | 2 |
| 3 | Lane Cove | Lane Cove | A | 2 | 205 | 2 |
| 4 | Gables | The Hills Shire | B | 0 | 429 | 2 |
| 5 | Cronulla | Sutherland Shire | B | 0 | 191 | 1 |
| 6 | Waitara / Wahroonga | Hornsby | B | 0 | 66 | 0 |
| 7 | Gladesville - Hunters Hill | Hunters Hill | B | 0 | 42 | 2 |
| 8 | Redfern | Sydney | B | 1 | 135 | 0 |
| 9 | Double Bay | Woollahra | B | 1 | 182 | 1 |
| 10 | Ultimo / Broadway | Sydney | B | 1 | 107 | 3 |
| 11 | Edgecliff | Woollahra | B | 1 | 70 | 5 |
| 12 | Castle Hill | The Hills Shire | B | 2 | 483 | 2 |
| 13 | Drummoyne | Canada Bay | B | 2 | 169 | 1 |
| 14 | Bondi Junction | Waverley | B | 2 | 182 | 1 |
| 15 | Miranda | Sutherland Shire | B | 2 | 223 | 2 |

## Interpretation

- Mapping is now dense enough to support production client reporting across the configured precinct universe, with only marginal residual gaps.
- The risk layer is already changing shortlist order, which means the expanded pack is doing more than just surfacing hotter places, but it is still a first-pass proxy layer.
- The current expanded pack is stable for client-facing reporting inside the configured precinct scope, but it should still be described as configured-scope coverage rather than full metro-complete market coverage.
