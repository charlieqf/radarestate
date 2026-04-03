# Sydney Hotspot Development Report

## Date

2026-04-03

## Purpose

Fixed hotspot universe for demonstrating and selling the weekly DevelopmentReport layer. This report is the fixed-universe version of the second product layer: a weekly development-oriented report built around a stable hotspot range rather than the full market.

## Radar Carry-Over

- Strongest current opportunity in this fixed universe: **Gladesville** (Hunters Hill), rated **A** with risk score **0**.
- Highest current friction in this fixed universe: **Bankstown** (Canterbury-Bankstown), rated **C** with risk score **5**.
- Companion radar artifacts:
  - `dashboard/hero-visual-pack.html`
  - `reports/top-10-insights-latest.md`
  - `reports/weekly-radar-latest.md`

## Data Sources

| Module | Source | Link |
| --- | --- | --- |
| Policy layer | Planning Proposals Online | [Open source](https://www.planningportal.nsw.gov.au/ppr/pre-exhibition/club-punchbowl-planning-proposal) |
| Risk layer | Flood Data Portal / Housing Targets / Derived Planning Friction | [Source 1](https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=Bankstown) ; [Source 2](https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets/canterbury-bankstown-councils-snapshot) ; [Source 3](https://www.planningportal.nsw.gov.au/ppr/withdrawn) ; [Source 4](https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=Edgecliff) ; [Source 5](https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=Westmead) |
| Planning controls | NSW EPI Primary Planning Layers | [Zoning](https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/2) ; [FSR](https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/1) ; [Height](https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/5) |
| Parcel metrics | NSW Land Parcel and Property Theme - Lot | [Open source](https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/8) |
| Property / ownership proxy | NSW Land Parcel and Property Theme - Property | [Open source](https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/12) |
| Market comps research | NSW land value and property sales web map | [Open source](https://portal.spatial.nsw.gov.au/portal/apps/webappviewer/index.html?id=2536c8e4882140eb957e90090cb0ef97) |

## Fixed Target Universe

- Gladesville
- Edgecliff
- Five Dock
- Westmead
- Bankstown

## Module Activation Status

| Module | Status | Reason |
| --- | --- | --- |
| Planning controls | Active | 5/5 precincts passed. Matched 5/5 sample points. |
| Parcel metrics | Active | 5/5 precincts passed. Matched 5/5 sample points. |
| Property / ownership proxy | Active | 5/5 precincts passed. Matched 5/5 sample points. |
| Assembly screening | Active | 5/5 precincts passed. Underlying controls, parcel metrics and property proxy all passed minimum quality thresholds. |
| Ownership title context | Not activated | No verified public title-owner dataset is currently integrated. |
| Market comps | Not activated | A public NSW property sales map exists, but a reliable, decision-grade and automation-safe comparable sales dataset is not yet integrated. |
| Residual pricing | Not activated | Residual pricing is blocked until comps and stronger cost assumptions are integrated. |

## Precinct Data Coverage

| Precinct | Planning controls | Parcel metrics | Property proxy | Assembly screening |
| --- | --- | --- | --- | --- |
| Gladesville | Active | Active | Active | Active |
| Edgecliff | Active | Active | Active | Active |
| Five Dock | Active | Active | Active | Active |
| Westmead | Active | Active | Active | Active |
| Bankstown | Active | Active | Active | Active |

## Weekly Priority Table

| Rank | Precinct | Council | Rating | Policy | Timing | Risk | Recent Apps | Pipeline | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Gladesville | Hunters Hill | A | 4 | 5 | 0 | 217 | 2 | Prioritise |
| 2 | Five Dock | Canada Bay | A | 4 | 5 | 0 | 113 | 2 | Prioritise |
| 3 | Edgecliff | Woollahra | A | 4 | 4 | 1 | 70 | 5 | Prioritise |
| 4 | Westmead | Parramatta | B | 3 | 4 | 2 | 51 | 2 | Investigate |
| 5 | Bankstown | Canterbury-Bankstown | C | 2 | 5 | 5 | 238 | 1 | Watch |

## Why This Universe Works As A DevelopmentReport Demo

- It is narrow enough to support consistent weekly follow-up.
- It is broad enough to show different site conditions and risk profiles.
- It can carry both “good opportunity” and “high-friction caution” cases in the same weekly package.
- It creates a stable target universe into which zoning, FSR, height, assembly, ownership, comps and residual logic can be added over time.

## Current Policy Layer

Primary source: [Planning Proposals Online](https://www.planningportal.nsw.gov.au/ppr/pre-exhibition/club-punchbowl-planning-proposal)

| Precinct | Current Active Policy Context | Recent Made / Historical Context |
| --- | --- | --- |
| Gladesville | Gladesville Masterplan [on_exhibition] | Draft Hunters Hill LEP 2010 - Hunters Hill Village Centre (Amendment 1) ; Gladesville Village Shopping Centre |
| Edgecliff | Edgecliff Commercial Centre Planning Proposal [under_assessment] ; Heritage listing of eight sites and one HCA in the area of the Edgecliff Commercial Centre. [under_assessment] | 80-84 and 90 New South Head Road, Edgecliff ; Amendment No. 75 to Woollahra LEP 1995: Increase height and FSR for 240 New South Head Road, Edgecliff |
| Five Dock | Five Dock Precinct [under_assessment] | 1-7 Ramsay Road and 5 and 7 Harrabrook Ave, Five Dock (PP2020/0005) ; Amendment of Schedule 1 of Canada Bay LEP 2013 to include development of car parking in association with Canada Bay Club as an additional permitted use at 8 Bevin Avenue, Five Dock (0 dwellings, 0 jobs). |
| Westmead | Westmead South [pre_exhibition] ; 93 BRIDGE ROAD WESTMEAD 2145 [finalisation] | Amendment No 11 to Parramatta LEP 2011 - 24-26 Railway Parade, Westmead. Increase height of buildings and FSR controls ; Parramatta Local Environmental Plan 2011 (Amendment No. 4) - University of Western Sydney, Westmead |
| Bankstown | Club Punchbowl Planning Proposal [pre_exhibition] | 74 Rickard Road and 375 Chapel Road (part) Bankstown - Amendment to Bankstown LEP 2015 floor space ratio and building height ; 81-105 Wattle Street Punchbowl - Draft Bankstown LEP 2001 Amendment 44 |

## Current Risk Layer

Primary sources: [Source 1](https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=Bankstown) ; [Source 2](https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets/canterbury-bankstown-councils-snapshot) ; [Source 3](https://www.planningportal.nsw.gov.au/ppr/withdrawn) ; [Source 4](https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=Edgecliff) ; [Source 5](https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=Westmead)

| Precinct | Current Derived Risk Summary | Highest Severity | Source Mix |
| --- | --- | --- | --- |
| Gladesville | No currently surfaced derived risk row | - | - |
| Edgecliff | flood_metadata_signal (medium) | medium | Flood Data Portal Metadata Signal |
| Five Dock | No currently surfaced derived risk row | - | - |
| Westmead | flood_metadata_signal (high) | high | Flood Data Portal Metadata Signal |
| Bankstown | flood_metadata_signal (high) ; heat_vulnerability_proxy (high) ; low_tree_canopy_proxy (high) ; policy_withdrawal_friction (medium) | high | Flood Data Portal Metadata Signal ; Housing Targets Council Snapshot ; Derived Planning Friction |

## Current Planning Controls Layer

Primary sources: [Zoning](https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/2) ; [FSR](https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/1) ; [Height](https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/5)

| Precinct | Zoning | FSR | Height (m) | Clause | Sample Points |
| --- | --- | --- | --- | --- | --- |
| Bankstown | R2 - Low Density Residential | 0.5000-4.0000 | 9.0000-54.0000 | Clause 4.4 / Clause 4.3 | 5/5 |
| Edgecliff | R3 - Medium Density Residential | 0.6500-0.9000 | 9.5000-10.5000 | Clause 4.4 / Clause 4.3 | 5/5 |
| Five Dock | R2 - Low Density Residential | 0.5000-1.0000 | 8.5000-12.0000 | Clause 4.4 / Clause 4.3 | 5/5 |
| Gladesville | R2 - Low Density Residential | 0.5000 | 8.5000-9.5000 | Clause 4.4 / Clause 4.3 | 5/5 |
| Westmead | R2 - Low Density Residential | 0.8000-3.0000 | 9.0000-31.0000 | Clause 4.4 / Clause 4.3 | 5/5 |

## Current Parcel Metrics Layer

All parcel metrics below are sample-based precinct summaries derived from recent mapped application points. They are intended for screening, not as parcel-specific control sheets.

Primary source: [NSW Land Parcel and Property Theme - Lot](https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/8)

| Precinct | Example Lot | Sample Plan Area Range (sqm) | Sample Geometry Area Range (sqm) | Sample Perimeter Range (m) | Sample Frontage Candidate Range (m) | Sample Width x Depth Range (m) | Screening Output | Matched Sample Points |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bankstown | //SP100164 / SP100164 | 10833.71 | 822.15-15771.29 | 122.43-1266.02 | 14.68-252.61 | 45.49-139.62 x 32.31-186.50 | Preliminary aggregation signal | 5/5 |
| Edgecliff | 2//DP604123 / DP604123 | 1460.44 | 181.97-2124.71 | 55.09-309.70 | 1.61-14.28 | 11.89-117.25 x 16.68-80.53 | Mixed / validation needed | 5/5 |
| Five Dock | 1//DP970514 / DP970514 | 3081.38 | 441.76-4481.32 | 106.77-280.96 | 14.05-141.52 | 22.21-64.93 x 15.99-90.48 | Preliminary aggregation signal | 5/5 |
| Gladesville | 37//DP13080 / DP13080 | - | 798.40-1216.92 | 115.74-166.18 | 14.59-25.23 | 33.33-70.55 x 32.51-53.24 | Preliminary single-lot viability signal | 5/5 |
| Westmead | 1//DP1077852 / DP1077852 | 1859.18-5694.26 | 1023.82-8268.15 | 146.97-357.85 | 18.59-357.85 | 24.07-115.17 x 20.73-144.72 | Mixed / validation needed | 5/5 |

## Assembly Interpretation

- **Gladesville**: Preliminary single-lot viability signal. Sample parcels are large enough relative to the current controls that a single-lot screening pass may still be meaningful. This remains a screening judgement, not a parcel-level feasibility conclusion.
- **Edgecliff**: Mixed / validation needed. The sampled parcels and control envelope do not yet support a clean single-lot or aggregation-only conclusion. This remains a screening judgement, not a parcel-level feasibility conclusion.
- **Five Dock**: Preliminary aggregation signal. Property context suggests a fragmented structure with lot-count or dissolve-parcel signals up to 88. This remains a screening judgement, not a parcel-level feasibility conclusion.
- **Westmead**: Mixed / validation needed. The sampled parcels and control envelope do not yet support a clean single-lot or aggregation-only conclusion. This remains a screening judgement, not a parcel-level feasibility conclusion.
- **Bankstown**: Preliminary aggregation signal. Property context suggests a fragmented structure with lot-count or dissolve-parcel signals up to 21. This remains a screening judgement, not a parcel-level feasibility conclusion.

## Current Property / Ownership Proxy Layer

Primary source: [NSW Land Parcel and Property Theme - Property](https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/12)

| Precinct | Example Property | Property Type | ValNet Status | ValNet Type | Lot Count | Fragmentation Signal | Matched Sample Points |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bankstown | 4564762 / 11/32 KITCHENER PARADE BANKSTOWN | Property | CURRENT | NORMAL | 1-21 | 1 | 5/5 |
| Edgecliff | 2086111 / 239 EDGECLIFF ROAD WOOLLAHRA | Property | CURRENT | NORMAL | 1 | 1 | 5/5 |
| Five Dock | 1903630 / 4 HENRY STREET FIVE DOCK | Property | CURRENT | NORMAL | 1-88 | 1 | 5/5 |
| Gladesville | 890080 / 6 SPENCER STREET GLADESVILLE | Property | CURRENT | NORMAL | 1 | 1 | 5/5 |
| Westmead | 3186102 / 15 DARCY ROAD WESTMEAD | Property | CURRENT | NORMAL | 1 | 1 | 5/5 |

## Ownership Title Context

Not activated. No verified public title-owner dataset is currently integrated.

## Market Comps

Not activated. A public NSW property sales map exists, but a reliable, decision-grade and automation-safe comparable sales dataset is not yet integrated.

Research path: [NSW land value and property sales web map](https://portal.spatial.nsw.gov.au/portal/apps/webappviewer/index.html?id=2536c8e4882140eb957e90090cb0ef97)

## Residual Pricing

Not activated. Residual pricing is blocked until comps and stronger cost assumptions are integrated.

## Hard Information Layer Still To Add

- title-level ownership context
- comps
- residual pricing logic

## Bottom Line

This fixed hotspot universe gives the second report a stable weekly scope. That is what makes it demo-able, sellable, and suitable for a higher-priced development-oriented layer.
