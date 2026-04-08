# Sydney Scope Expansion Priority Plan

## Why This Exists

The current Sydney development product is strong inside its configured target-council scope, but that scope still excludes several councils that a serious Sydney developer will naturally expect to see.

This plan reframes the next expansion step around commercial value first, not just around increasing the council count.

## Current Problem

The product currently performs well inside the configured Sydney scope, but it is still missing several high-importance councils for a buyer who thinks in terms of the broader Sydney market, including:

- City of Sydney
- Randwick
- Waverley
- Lane Cove
- Mosman
- Hornsby
- Northern Beaches
- Camden
- Hawkesbury
- Wollondilly
- Blue Mountains

Not all of these councils have the same commercial urgency. Some are important because they directly affect customer trust in the product. Others are technically coverable but lower-value for the default small-mid developer lens.

## Expansion Principle

Do not treat all missing councils as equally urgent.

Expand in this order:

1. High-value inner / middle-ring councils that materially affect product credibility
2. North-shore and coastal councils that improve buyer confidence but require more careful precinct design
3. Fringe councils that increase geographic completeness but do not improve the default product proposition as much

## Tier 1: Highest Priority

These councils matter most for commercial credibility and developer relevance.

### Councils

- Sydney
- Randwick
- Waverley
- Lane Cove
- Mosman
- Hornsby

### Why They Matter

- A Sydney-focused developer expects these councils to exist in the product by default.
- They contain many of the most recognisable inner / middle-ring low-mid-rise and transit-proximate opportunities.
- Their absence makes the product feel more like a selected corridor watchlist than a serious Sydney acquisition intelligence layer.

### Recommended First Precincts

- Sydney: Redfern, Waterloo, Erskineville, Broadway / Glebe, Surry Hills South
- Randwick: Randwick, Kingsford, Kensington, Maroubra Junction
- Waverley: Bondi Junction
- Lane Cove: Lane Cove, St Leonards edge
- Mosman: Spit Junction
- Hornsby: Hornsby, Waitara, Asquith, Pennant Hills

## Tier 2: High But Secondary

### Councils

- Northern Beaches
- Camden

### Why They Matter

- They increase customer confidence that the product reaches beyond the current inner-west / west / north-west concentration.
- They introduce strong small-mid developer patterns, but they are not as essential to first-impression credibility as Tier 1.

### Recommended First Precincts

- Northern Beaches: Dee Why, Frenchs Forest, Mona Vale, Manly Vale, Balgowlah
- Camden: Camden, Narellan

## Tier 3: Geographic Completeness But Lower Immediate Commercial Return

### Councils

- Hawkesbury
- Wollondilly
- Blue Mountains

### Why They Matter

- They improve map completeness.
- They are not the strongest immediate fit for the current small-mid developer default lens.
- They are more likely to expose differences in hazard, evacuation, and fringe-market behaviour that may deserve separate treatment.

## What Is Reusable Versus What Is Not

### Mostly Reusable

- Application sync framework
- Planning proposal sync framework
- Housing target context sync
- Weekly snapshot pipeline
- Report templates and bundle structure

### The Real Bottlenecks

- Council name mapping for public sources
- Precinct design and keyword mapping
- Cross-council edge cases like St Leonards / Lane Cove / North Sydney / Willoughby
- Choosing the right default precincts for a small-mid developer lens rather than just adding everything available

## New Config Pack To Build

Create a new `sydney-core-plus` config set:

1. `application-sync-sydney-core-plus.json`
2. `planning-proposal-sync-sydney-core-plus.json`
3. `precinct-focus-map-sydney-core-plus.json`

This pack should add Tier 1 first, while keeping the existing core councils and report logic intact.

## Validation Gates

Before saying a new council is fully included, confirm all of the following:

1. Application tracker data is syncing with the correct council display name
2. Planning proposal filter values are returning records for the correct council
3. At least one meaningful precinct can be scored and ranked
4. Constraints layer is available and producing usable results
5. Weekly radar and site screening outputs look commercially sensible, not just technically populated

## Recommended Next Execution Order

1. Add Tier 1 councils to application sync config
2. Add Tier 1 councils to planning proposal sync config
3. Add a small, high-conviction Tier 1 precinct map
4. Run coverage-readiness for the new pack before merging it into the main Sydney development workflow

## Practical Goal

The next milestone should not be “all Sydney councils”.

The next milestone should be:

`The product includes the councils that a serious Sydney small-mid developer would immediately expect to see.`
