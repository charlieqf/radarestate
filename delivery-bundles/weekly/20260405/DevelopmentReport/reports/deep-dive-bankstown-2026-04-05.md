# Deep Dive: Bankstown

## Date

2026-04-05

## Executive Summary

Bankstown is worth tracking because activity and policy signals are real, but it should be treated as a risk-adjusted watchlist item rather than a clean priority precinct.

## Quick Scorecard

- Council: `Canterbury-Bankstown`
- Current rating: `C`
- Policy score: `0`
- Timing score: `5`
- Friction score: `5`
- Recent applications: `238`
- Recent application window start: `2025-01-01`
- Active planning proposals: `0`
- State significant projects: `19`
- Recommended action: `Watch`
- Map centroid: `-33.917325, 151.031721`

## Why This Precinct Surfaced

- Trigger summary: 0 active proposals, 238 recent applications, 19 state significant projects. Risks: flood_metadata_signal (high), heat_vulnerability_proxy (high), low_tree_canopy_proxy (high), policy_withdrawal_friction (medium)
- Recent development activity is sufficiently strong to justify immediate attention.
- There is already a meaningful stock of made-stage planning history in this precinct.

## Policy And Planning Context

- Current score uses `0` active planning proposal items.
- Current mapped source rows at active stages: `0`. Distinct rows shown below after de-duplication / evidence cleanup: `0`.
- Rows below show the currently mapped active proposals behind that count. When a row is not precinct-explicit in its wording, it is still shown and labeled so the score can be audited rather than hidden.

No active mapped proposal records currently surfaced for this precinct.

| Historical Stage | Title | Location |
| --- | --- | --- |
| Made | 74 Rickard Road and 375 Chapel Road (part) Bankstown - Amendment to Bankstown LEP 2015 floor space ratio and building height | 74 Rickard Road And 375 Chapel Road (Part) Bankstown 2200 |
| Made | Bankstown LEP 2015 - 83-99 North Terrace and 62 The Mall, Bankstown (50 dwellings and 200 jobs) | 83 North Terrace Sydney Bankstown 2200 & more |
| Made | Reclassification of land at 3 and 5 Leonard Street, Bankstown from Community to Operational | 3 & 5 Leonard Street Bankstown Bankstown 2200 |
| Made | Weigand Avenue, Bankstown re-zoning & Bankstown CBD reclassifications | Nos. 2, 2A & 2C Weigand Avenue Bankstown Bankstown 2200 & more |

## Development Activity Context

Recent applications below are screening signals with lodgement date on or after `2025-01-01`. The application-type table is shown as mutually exclusive DA / CDC / Modification / Other buckets so it stays consistent with the `Recent applications` count above. State-significant signals stay separate in the quick scorecard.

| Status | Count |
| --- | --- |
| Approved | 138 |
| Determined | 59 |
| Under Assessment | 22 |
| Withdrawn | 12 |
| Additional Information Requested | 5 |
| On Exhibition | 1 |
| Refused | 1 |

| Application Type | Count |
| --- | --- |
| DA | 56 |
| CDC | 154 |
| Modification | 26 |
| Other | 2 |

| Lodgement | Status | Type | Location |
| --- | --- | --- | --- |
| 2026-03-30 | Under Assessment | Complying Development Certificate Application | 32 KITCHENER PARADE BANKSTOWN 2200 |
| 2026-03-25 | Under Assessment | Modification Application | 8 HILLVIEW AVENUE BANKSTOWN 2200 |
| 2026-03-25 | Approved | Complying Development Certificate Application | 72 WILKINS STREET BANKSTOWN 2200 |
| 2026-03-16 | Under Assessment | Complying Development Certificate Application | 96 PRINGLE AVENUE BANKSTOWN 2200 |
| 2026-03-09 | Additional Information Requested | Complying Development Certificate Application | 10 OGMORE COURT BANKSTOWN 2200 |
| 2026-03-08 | On Exhibition | Development Application | 175 GREENACRE ROAD BANKSTOWN 2200 |
| 2026-03-03 | Under Assessment | Complying Development Certificate Application | 327 HUME HIGHWAY BANKSTOWN 2200 |
| 2026-03-02 | Approved | Complying Development Certificate Application | 32 HOSKINS AVENUE BANKSTOWN 2200 |
| 2026-03-02 | Approved | Complying Development Certificate Application | 66 RICKARD ROAD BANKSTOWN 2200 |
| 2026-03-01 | Additional Information Requested | Complying Development Certificate Application | 117 NORTHAM AVENUE BANKSTOWN 2200 |
| 2026-03-01 | Approved | Complying Development Certificate Application | 1A NORTH TERRACE BANKSTOWN 2200 |
| 2026-03-01 | Additional Information Requested | Complying Development Certificate Application | 56 REYNOLDS AVENUE BANKSTOWN 2200 |

## Risk And Friction

Friction is very high. Treat this as a constrained or contested precinct until more specific site-level evidence proves otherwise.

Context proxies can help explain why a precinct is ranked up or down, but they should not be mistaken for parcel-level blockers on their own.

| Constraint Type | Severity | Signal Use | Source | Evidence | Source URL |
| --- | --- | --- | --- | --- | --- |
| flood_metadata_signal | high | Transaction-facing screening signal | Flood Data Portal Metadata Signal | Matched flood records: Lansdowne Catchment Flood Study - Report; Villawood Drain Works-as-Executed Study - Report; Salt Pan Creek Floodplain Risk Management Study and Plan (Draft) | https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=Bankstown |
| heat_vulnerability_proxy | high | Precinct / council context proxy | Housing Targets Council Snapshot | Council-level proxy based on high heat vulnerability 21.00% for Canterbury-Bankstown | https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets/canterbury-bankstown-councils-snapshot |
| low_tree_canopy_proxy | high | Precinct / council context proxy | Housing Targets Council Snapshot | Council-level proxy based on urban tree canopy 16.30% for Canterbury-Bankstown | https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets/canterbury-bankstown-councils-snapshot |
| policy_withdrawal_friction | medium | Planning process signal | Derived Planning Friction | Derived from 8 withdrawn / not proceeding proposals mapped to this precinct | https://www.planningportal.nsw.gov.au/ppr/withdrawn |

## Council Context

| Council | 5-year Target | Recent Apps | Active Pipeline | Tree Canopy % | High Heat Vulnerability % |
| --- | --- | --- | --- | --- | --- |
| Canterbury-Bankstown | 14,500 | 3,423 | 1 | 16.3 | 21 |

## What To Do Next

1. Keep `Bankstown` in the `C`-rated watchlist and treat `Watch` as the current workflow state.
2. Use `dashboard/2026-04-05-report.html` to inspect the surrounding precinct cluster before doing any street-level or owner-contact work.
3. Explicitly validate the current risk stack (flood_metadata_signal, heat_vulnerability_proxy, low_tree_canopy_proxy, policy_withdrawal_friction) before promoting this precinct into a transaction-facing shortlist.

## References

- `dashboard/2026-04-05-report.html`
- `reports/weekly-radar-2026-04-05.md`
