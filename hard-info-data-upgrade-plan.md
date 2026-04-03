# Hard-Info Data Upgrade Plan

## Current Status

The second report layer (`DevelopmentReport`) now has two live automated hard-information modules:

1. `Planning controls`
   - zoning
   - FSR
   - height

2. `Parcel metrics`
   - example lot id / plan label
   - plan lot area range
   - geometry area range
   - perimeter range
   - approximate bounding-box width/depth range

3. `Frontage and assembly proxies`
   - frontage candidate range
   - first-pass assembly heuristic

4. `Property / ownership proxies`
   - property type
   - ValNet property status
   - ValNet property type
   - lot count / dissolve parcel count

These are currently generated from public NSW spatial services and summarised at precinct level using sample application points.

## What Was Added

### Planning controls layer

- Source: `Planning/EPI_Primary_Planning_Layers`
- Automated point lookup against:
  - `Land Zoning`
  - `Floor Space Ratio`
  - `Height of Building`

### Parcel metrics layer

- Source: `NSW Land Parcel and Property Theme`
- Automated point lookup against:
  - `Lot`

## What This Means

The second report is no longer just a “future promise” for hard information.
It already carries:

- real zoning labels
- real FSR ranges
- real height ranges
- real parcel-size and geometry samples

## Current Limitation

These modules are still `sample-based precinct summaries`, not final parcel-level determinations.

That is acceptable for the current standard hotspot-universe development report, but not yet enough for a fully site-specific decision memo.

## Next Modules To Add

### 1. Frontage estimation

Goal:

- estimate road-facing parcel edge length more explicitly

Why next:

- needed for townhouse / small apartment development screening
- complements lot area and bounding-box dimensions

### 2. Assembly feasibility

Goal:

- identify whether a candidate site likely requires multi-lot assembly
- estimate fragmentation and likely neighbour dependence

### 3. Ownership context

Goal:

- determine whether the ownership pattern is simple or fragmented

### 4. Comps layer

Goal:

- introduce nearby sales / project examples suitable for development screening

### 5. Residual logic

Goal:

- move from descriptive hard information to indicative development economics

## Recommended Build Order

1. frontage estimation
2. assembly feasibility
3. ownership context
4. comps
5. residual pricing logic

## Short Version

The data-grabbing module has already been upgraded.

It now supports:

- zoning
- FSR
- height
- parcel size and geometry samples
- frontage candidate estimates
- first-pass assembly heuristics
- ownership / property context proxies

The next meaningful step is to move from “proxy hard information” to “decision-grade hard information”, which now means:

- detailed assembly validation
- stronger ownership evidence
- comps
- residual pricing logic
