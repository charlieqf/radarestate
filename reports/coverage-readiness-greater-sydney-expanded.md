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
- Overall: `READY TO EXPAND`

## Mapping Coverage

- Precincts with any signal: `55 / 56` (98%)
- Precincts with mapped proposals: `50`
- Precincts with mapped applications: `55`
- Total mapped proposals: `696`
- Total mapped applications: `10,505`

| Council | Precincts | With Signals | Recent Apps | Active Pipeline | With Constraints |
| --- | --- | --- | --- | --- | --- |
| The Hills Shire | 4 | 4 | 1,096 | 7 | 3 |
| Blacktown | 5 | 5 | 1,068 | 6 | 4 |
| Cumberland | 3 | 3 | 856 | 0 | 3 |
| Inner West | 3 | 3 | 627 | 2 | 3 |
| Ryde | 4 | 4 | 616 | 0 | 4 |
| Sutherland Shire | 4 | 4 | 612 | 9 | 3 |
| Parramatta | 3 | 3 | 600 | 4 | 3 |
| Penrith | 2 | 2 | 555 | 5 | 2 |
| Campbelltown | 4 | 4 | 522 | 5 | 4 |
| Georges River | 4 | 4 | 506 | 1 | 4 |
| Willoughby | 1 | 1 | 505 | 2 | 1 |
| Fairfield | 2 | 2 | 476 | 3 | 2 |
| Canterbury-Bankstown | 2 | 2 | 329 | 1 | 2 |
| Canada Bay | 2 | 2 | 282 | 3 | 0 |
| Ku-ring-gai | 2 | 2 | 266 | 0 | 2 |
| Woollahra | 2 | 2 | 252 | 6 | 2 |
| Liverpool | 1 | 1 | 220 | 2 | 1 |
| Bayside | 2 | 2 | 219 | 2 | 0 |
| Hunters Hill | 1 | 1 | 217 | 2 | 0 |
| Burwood | 1 | 1 | 192 | 1 | 1 |
| Strathfield | 2 | 1 | 121 | 0 | 2 |
| North Sydney | 2 | 1 | 50 | 0 | 1 |

## Risk Layer Availability

- Precincts with at least one constraint: `47 / 56` (84%)

| Constraint Type | Severity | Count |
| --- | --- | --- |
| biodiversity_spatial_sample | medium | 2 |
| bushfire_spatial_sample | high | 14 |
| bushfire_spatial_sample | medium | 3 |
| flood_metadata_signal | high | 35 |
| flood_metadata_signal | medium | 5 |
| heat_vulnerability_proxy | high | 3 |
| heat_vulnerability_proxy | medium | 4 |
| low_tree_canopy_proxy | high | 9 |
| low_tree_canopy_proxy | medium | 3 |
| policy_withdrawal_friction | high | 1 |
| policy_withdrawal_friction | medium | 2 |

## Shortlist And Report Stability

- Shortlist items in pack: `55`
- Rating mix: `A=4`, `B=35`, `C=16`

| Rank | Precinct | Council | Rating | Risk | Recent Apps | Pipeline |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Gladesville | Hunters Hill | A | 0 | 217 | 2 |
| 2 | Five Dock | Canada Bay | A | 0 | 113 | 2 |
| 3 | Edgecliff | Woollahra | A | 1 | 70 | 5 |
| 4 | Cabramatta | Fairfield | A | 2 | 257 | 2 |
| 5 | Gables | The Hills Shire | B | 0 | 429 | 2 |
| 6 | Seven Hills | Blacktown | B | 0 | 282 | 1 |
| 7 | Bexley | Bayside | B | 0 | 201 | 1 |
| 8 | Cronulla | Sutherland Shire | B | 0 | 191 | 0 |
| 9 | Drummoyne | Canada Bay | B | 0 | 169 | 1 |
| 10 | Croydon | Burwood | B | 1 | 192 | 1 |
| 11 | Double Bay | Woollahra | B | 1 | 182 | 1 |
| 12 | Beverly Hills | Georges River | B | 1 | 64 | 1 |
| 13 | Castle Hill | The Hills Shire | B | 2 | 483 | 2 |
| 14 | Merrylands | Cumberland | B | 2 | 415 | 0 |
| 15 | Hurstville | Georges River | B | 2 | 280 | 0 |

## Interpretation

- Mapping 已经从 council-level 走到了可用的 precinct-level，不再只是区域热度判断。
- 风险层已经能真实改变 shortlist 排序，说明 expanded pack 不会只输出“更热的地方”。
- 当前 expanded pack 已经能持续产出足够丰富的 shortlist 和报告内容。
