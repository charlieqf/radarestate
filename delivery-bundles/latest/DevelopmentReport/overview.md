# Sydney Hotspot Development Report

## Date

2026-04-03

## Purpose

Fixed hotspot universe for demonstrating and selling the weekly DevelopmentReport layer. This report is the fixed-universe version of the second product layer: a weekly development-oriented report built around a stable hotspot range rather than the full market.

## Fixed Target Universe

- Gladesville
- Edgecliff
- Five Dock
- Westmead
- Bankstown

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

| Precinct | Stage | Title | Location |
| --- | --- | --- | --- |
| Bankstown | pre_exhibition | Club Punchbowl Planning Proposal | Canterbury-Bankstown |
| Bankstown | made | 74 Rickard Road and 375 Chapel Road (part) Bankstown - Amendment to Bankstown LEP 2015 floor space ratio and building height | 74 Rickard Road And 375 Chapel Road (Part) Bankstown 2200 |
| Bankstown | made | 81-105 Wattle Street Punchbowl - Draft Bankstown LEP 2001 Amendment 44 | 81-105 Wattle Street Sydney Punchbowl 2196 |
| Bankstown | made | Bankstown LEP 2015 - 83-99 North Terrace and 62 The Mall, Bankstown (50 dwellings and 200 jobs) | 83 North Terrace Sydney Bankstown 2200 & more |
| Bankstown | made | Bankstown LEP 2015 - Additional permitted use at 479 Henry Lawson Drive Milperra (0 dwellings) | 479 Henry Lawson Drive Milperra Milperra 2214 |
| Bankstown | made | Bankstown LEP 2015 - Amendments to residential uses in R2 zone | Land Where Dual Occupancy Development Are Permissible In Canterbury And Bankstown Leps & more |
| Bankstown | made | Bankstown LEP 2015 - Housekeeping Amendments 2017 (0 dwellings) | Canterbury-Bankstown |
| Bankstown | made | Bankstown LEP 2015 - Increase the height and FSR for land at 30 - 46 Auburn Road, Regents Park (514 dwellings) | 30 To 46 Auburn Road Sydney Regents Park 2143 |
| Bankstown | made | Bankstown LEP 2015 (Amendment No 5) - Amendment to Clause 4.4A (0 dwellings) | Canterbury-Bankstown |
| Bankstown | made | Bankstown Local Environmental Plan 2001 (Amendment No 46) - Bankstown CBD | Canterbury-Bankstown |
| Bankstown | made | Bankstown Local Environmental Plan 2001 (Amendment No 47) - Bankstown Golf Course - Milperra | Bullecourt Avenue Milperra |
| Bankstown | made | Bankstown Local Environmental Plan 2015 (Amendment No. 8) - 10 Simmat Avenue, Condell Park | 10 Simmat Avenue Condell Park 2200 |
| Bankstown | made | Canterbury Bankstown LEP 2023 ‘Deferred Matters’ Amendment Planning Proposal (Council Matters) | Canterbury-Bankstown |
| Bankstown | made | Canterbury LEP 2012 - implementing the Residential Development Strategy | Canterbury-Bankstown |
| Bankstown | made | Canterbury Local Environmental Plan 2012 (Amendment No 1) | Canterbury-Bankstown |
| Bankstown | made | Canterbury Local Environmental Plan 2012 (Amendment No 16) - Site area controls for boarding houses | Canterbury-Bankstown |
| Bankstown | made | Canterbury Local Environmental Plan 2012 (Amendment No 2) - Planning Proposal to amend Canterbury LEP 2012 to include a provision to permit the subdivision of a dual occupancy | Canterbury-Bankstown |
| Bankstown | made | Consolidated Canterbury Bankstown LEP | Canterbury-Bankstown |
| Bankstown | made | New Employment Zones | Canterbury-Bankstown |
| Bankstown | made | North West Local Area | Canterbury-Bankstown |

## Current Risk Layer

| Precinct | Constraint | Severity | Source |
| --- | --- | --- | --- |
| Bankstown | flood_metadata_signal | high | Flood Data Portal Metadata Signal |
| Bankstown | heat_vulnerability_proxy | high | Housing Targets Council Snapshot |
| Bankstown | low_tree_canopy_proxy | high | Housing Targets Council Snapshot |
| Bankstown | policy_withdrawal_friction | medium | Derived Planning Friction |
| Edgecliff | flood_metadata_signal | medium | Flood Data Portal Metadata Signal |
| Westmead | flood_metadata_signal | high | Flood Data Portal Metadata Signal |

## Current Planning Controls Layer

| Precinct | Zoning | FSR | Height (m) | Clause | Sample Points |
| --- | --- | --- | --- | --- | --- |
| Bankstown | R2 - Low Density Residential | 0.5000-4.0000 | 9.0000-54.0000 | Clause 4.4 / Clause 4.3 | 5/5 |
| Edgecliff | R3 - Medium Density Residential | 0.6500-0.9000 | 9.5000-10.5000 | Clause 4.4 / Clause 4.3 | 5/5 |
| Five Dock | R2 - Low Density Residential | 0.5000-1.0000 | 8.5000-12.0000 | Clause 4.4 / Clause 4.3 | 5/5 |
| Gladesville | R2 - Low Density Residential | 0.5000 | 8.5000-9.5000 | Clause 4.4 / Clause 4.3 | 5/5 |
| Westmead | R2 - Low Density Residential | 0.8000-3.0000 | 9.0000-31.0000 | Clause 4.4 / Clause 4.3 | 5/5 |

## Current Parcel Metrics Layer

| Precinct | Example Lot | Plan Area (sqm) | Geometry Area (sqm) | Perimeter (m) | Frontage Candidate (m) | Approx Width x Depth (m) | Assembly Heuristic | Matched Sample Points |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bankstown | //SP100164 / SP100164 | 10833.71 | 822.15-15771.29 | 122.43-1266.02 | 14.68-252.61 | 45.49-139.62 x 32.31-186.50 | Mixed / further validation needed | 5/5 |
| Edgecliff | 2//DP604123 / DP604123 | 1460.44 | 181.97-2124.71 | 55.09-309.70 | 1.61-14.28 | 11.89-117.25 x 16.68-80.53 | Mixed / further validation needed | 5/5 |
| Five Dock | 1//DP970514 / DP970514 | 3081.38 | 441.76-4481.32 | 106.77-280.96 | 14.05-141.52 | 22.21-64.93 x 15.99-90.48 | Single-lot screening possible | 5/5 |
| Gladesville | 37//DP13080 / DP13080 | - | 798.40-1216.92 | 115.74-166.18 | 14.59-25.23 | 33.33-70.55 x 32.51-53.24 | Single-lot screening possible | 5/5 |
| Westmead | 1//DP1077852 / DP1077852 | 1859.18-5694.26 | 1023.82-8268.15 | 146.97-357.85 | 18.59-357.85 | 24.07-115.17 x 20.73-144.72 | Mixed / further validation needed | 5/5 |

## Assembly Interpretation

- **Bankstown**: Mixed / further validation needed. The sampled parcels and control envelope do not yet support a clean single-lot or assembly-only conclusion.
- **Edgecliff**: Mixed / further validation needed. The sampled parcels and control envelope do not yet support a clean single-lot or assembly-only conclusion.
- **Five Dock**: Single-lot screening possible. Sample parcels are large enough relative to the current controls that a single-lot screening pass may still be meaningful.
- **Gladesville**: Single-lot screening possible. Sample parcels are large enough relative to the current controls that a single-lot screening pass may still be meaningful.
- **Westmead**: Mixed / further validation needed. The sampled parcels and control envelope do not yet support a clean single-lot or assembly-only conclusion.

## Current Property / Ownership Proxy Layer

| Precinct | Example Property | Property Type | ValNet Status | ValNet Type | Lot Count | Fragmentation Signal | Matched Sample Points |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bankstown | 4564762 / 11/32 KITCHENER PARADE BANKSTOWN | Property | CURRENT | NORMAL | 1-21 | 1 | 5/5 |
| Edgecliff | 2086111 / 239 EDGECLIFF ROAD WOOLLAHRA | Property | CURRENT | NORMAL | 1 | 1 | 5/5 |
| Five Dock | 1903630 / 4 HENRY STREET FIVE DOCK | Property | CURRENT | NORMAL | 1-88 | 1 | 5/5 |
| Gladesville | 890080 / 6 SPENCER STREET GLADESVILLE | Property | CURRENT | NORMAL | 1 | 1 | 5/5 |
| Westmead | 3186102 / 15 DARCY ROAD WESTMEAD | Property | CURRENT | NORMAL | 1 | 1 | 5/5 |

## Hard Information Layer Still To Add

- assembly feasibility
- ownership name / title-level ownership context
- comps
- residual pricing logic

## Bottom Line

This fixed hotspot universe gives the second report a stable weekly scope. That is what makes it demo-able, sellable, and suitable for a higher-priced development-oriented layer.
