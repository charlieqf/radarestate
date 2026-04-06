# Deep Dive: Campbelltown

## Date

2026-04-05

## Executive Summary

Campbelltown is worth tracking because activity and policy signals are real, but it should be treated as a risk-adjusted watchlist item rather than a clean priority precinct.

## Quick Scorecard

- Council: `Campbelltown`
- Current rating: `C`
- Policy score: `3`
- Timing score: `5`
- Friction score: `5`
- Recent applications: `219`
- Recent application window start: `2025-01-01`
- Active planning proposals: `5`
- State significant projects: `10`
- Recommended action: `Watch`
- Map centroid: `-34.064183, 150.812546`

## Why This Precinct Surfaced

- Trigger summary: 5 active proposals, 219 recent applications (62 DA, 139 CDC), 10 state significant projects. Risks: bushfire_spatial_sample (high), flood_metadata_signal (high), low_tree_canopy_proxy (high), heat_vulnerability_proxy (medium)
- Recent development activity is sufficiently strong to justify immediate attention.
- There is already a meaningful stock of made-stage planning history in this precinct.

## Policy And Planning Context

- Current score uses `5` active planning proposal items.
- Current mapped source rows at active stages: `5`. Distinct rows shown below after de-duplication / evidence cleanup: `5`.
- Rows below show the currently mapped active proposals behind that count. When a row is not precinct-explicit in its wording, it is still shown and labeled so the score can be audited rather than hidden.

| Stage | Title | Location | Evidence Scope |
| --- | --- | --- | --- |
| Under Assessment | East Village Menangle Park Planning Proposal | Campbelltown | Precinct-explicit |
| Under Assessment | Glenfield Industrial Precinct | Campbelltown | Precinct-explicit |
| Pre-Exhibition | Glenfield West | Campbelltown | Precinct-explicit |
| Pre-Exhibition | Proposed Rosalind Park urban release area | Campbelltown | Precinct-explicit |
| Finalisation | Macarthur Gardens North | Campbelltown | Precinct-explicit |

| Historical Stage | Title | Location |
| --- | --- | --- |
| Made | 194 Campbelltown Road, Denham Court (0 Dwellings, 0 Jobs) | 194 Campbelltown Road Denham Court |
| Made | 194 Campbelltown Road, Denham Court: Additional Use | 194 Campbelltown Denham Court 2565 |
| Made | 22-32 Queen Street, Campbelltown (Amendment No.21) - (779 Dwellings , 809 new Construction Jobs, 558 full time jobs) | 22-32 Queen Street Campbelltown |
| Made | Amendment to Clause Application Map - 158 Queen St, Campbelltown | 158 Queen Street Campbelltown 2560 |
| Made | Campbelltown (Urban Area) Local Environmental Plan 2002 (Amendment No 23) - Ambarvale and Rosemeadow public housing estates | Nurra Reserve Dickens Road Campbelltown Ambarvale 2560 & more |
| Made | Campbelltown LEP 2015 - Rezone land at Glenlee to IN1 General Industrial, SP2 Infrastructure and E2 Environmental Conservation (1200 jobs across Campbelltown and Camden LGA) | Campbelltown |
| Made | Campbelltown LEP 2015 (Amendment No 13) - Caledonia Precinct - Bensley, Mercedes and Oxford Roads, Ingleburn (170 dwellings) | 26 Mercedes Road Campbelltown Ingleburn 2565 & more |
| Made | Campbelltown LEP 2015 (Amendment No 14) - Heritage listing at 2 Kent Street, Minto | Campbelltown |

## Development Activity Context

Recent applications below are screening signals with lodgement date on or after `2025-01-01`. The application-type table is shown as mutually exclusive DA / CDC / Modification / Other buckets so it stays consistent with the `Recent applications` count above. State-significant signals stay separate in the quick scorecard.
Current mix note: this precinct is presently **CDC-led** (139 CDC vs 62 DA), so raw activity volume should not be read as pure acquisition-quality momentum.

| Status | Count |
| --- | --- |
| Approved | 126 |
| Determined | 55 |
| Under Assessment | 24 |
| Withdrawn | 8 |
| Additional Information Requested | 4 |
| Rejected | 2 |

| Application Type | Count |
| --- | --- |
| DA | 62 |
| CDC | 139 |
| Modification | 18 |

| Lodgement | Status | Type | Location |
| --- | --- | --- | --- |
| 2026-03-30 | Approved | Complying Development Certificate Application | 33 CARCOOLA STREET CAMPBELLTOWN 2560 |
| 2026-03-30 | Approved | Complying Development Certificate Application | 190 BROUGHTON STREET CAMPBELLTOWN 2560 |
| 2026-03-30 | Approved | Complying Development Certificate Application | 192 BROUGHTON STREET CAMPBELLTOWN 2560 |
| 2026-03-27 | Under Assessment | Complying Development Certificate Application | 12 BARWON PLACE CAMPBELLTOWN 2560 |
| 2026-03-26 | Under Assessment | Development Application | 13 DAN STREET CAMPBELLTOWN 2560 |
| 2026-03-24 | Additional Information Requested | Development Application | 1 VALINDA CRESCENT CAMPBELLTOWN 2560 |
| 2026-03-24 | Under Assessment | Development Application | 22 MOORE STREET CAMPBELLTOWN 2560 |
| 2026-03-22 | Under Assessment | Development Application | 20 LAWSON STREET CAMPBELLTOWN 2560 |
| 2026-03-22 | Additional Information Requested | Development Application | 118 MACQUARIE AVENUE CAMPBELLTOWN 2560 |
| 2026-03-19 | Under Assessment | Development Application | 102 MILKY WAY CAMPBELLTOWN 2560 |
| 2026-03-19 | Approved | Modification to Complying Development Certificate | 30 BLAXLAND ROAD CAMPBELLTOWN 2560 |
| 2026-03-17 | Under Assessment | Development Application | 94 MILKY WAY CAMPBELLTOWN 2560 |

## Risk And Friction

Friction is very high. Treat this as a constrained or contested precinct until more specific site-level evidence proves otherwise.

Context proxies can help explain why a precinct is ranked up or down, but they should not be mistaken for parcel-level blockers on their own.

| Constraint Type | Severity | Signal Use | Source | Evidence | Source URL |
| --- | --- | --- | --- | --- | --- |
| bushfire_spatial_sample | high | Transaction-facing screening signal | BushFire Prone Land Spatial Sample | Matched categories: Vegetation Buffer | https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_BushFire_Prone_Land/FeatureServer/0 |
| flood_metadata_signal | high | Transaction-facing screening signal | Flood Data Portal Metadata Signal | Matched flood records: Campbelltown Flood Mitigation Scheme - Bunbury Curran & Bow Bowing Creeks; Georges River Flood Mitigation - Reconnaissance Geological Investigation Of Five Potential Dam Sites in the Campbelltown Area; Bow Bowing Bunbury Curran Creek Strategic FRMSP - WaterRIDE | https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=Campbelltown |
| low_tree_canopy_proxy | high | Precinct / council context proxy | Housing Targets Council Snapshot | Council-level proxy based on urban tree canopy 18.00% for Campbelltown | https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets/campbelltown-councils-snapshot |
| heat_vulnerability_proxy | medium | Precinct / council context proxy | Housing Targets Council Snapshot | Council-level proxy based on high heat vulnerability 19.00% for Campbelltown | https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets/campbelltown-councils-snapshot |

## Council Context

| Council | 5-year Target | Recent Apps | Active Pipeline | Tree Canopy % | High Heat Vulnerability % |
| --- | --- | --- | --- | --- | --- |
| Campbelltown | 10,500 | 2,591 | 5 | 18 | 19 |

## What To Do Next

1. Keep `Campbelltown` in the `C`-rated watchlist and treat `Watch` as the current workflow state.
2. Use `dashboard/2026-04-05-report.html` to inspect the surrounding precinct cluster before doing any street-level or owner-contact work.
3. Explicitly validate the current risk stack (bushfire_spatial_sample, flood_metadata_signal, low_tree_canopy_proxy, heat_vulnerability_proxy) before promoting this precinct into a transaction-facing shortlist.

## References

- `dashboard/2026-04-05-report.html`
- `reports/weekly-radar-2026-04-05.md`
