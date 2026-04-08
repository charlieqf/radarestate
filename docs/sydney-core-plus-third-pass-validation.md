# Sydney Core Plus Third-Pass Validation

## What Changed In This Pass

This pass focused on commercial relevance rather than raw council count.

### Sydney precinct densification

Added or improved:

- `Surry Hills`
- `Ultimo / Broadway`
- `Potts Point / Kings Cross`

### Hornsby precinct refinement

- added `Thornleigh`
- removed weaker low-signal Hornsby precincts from the focused expansion pack

## Current Result

The expansion branch is now materially stronger for the councils that matter most to a Sydney small-mid developer lens.

It is no longer just “extra councils added”. It is now producing a more recognisable and commercially defensible shortlist across Sydney, Waverley, Randwick, Lane Cove and Mosman, while Hornsby is improving but still mixed.

## Readiness Snapshot

Source: `reports/coverage-readiness-sydney-core-plus.md`

- Configured councils: `28`
- Configured precincts: `75`
- Precincts with any signal: `73 / 75` (`97%`)
- Precincts with mapped proposals: `65`
- Precincts with mapped applications: `73`
- Total mapped proposals: `792`
- Total mapped applications: `13,774`
- Mapping gate: `PASS`
- Risk gate: `PASS`
- Stable shortlist gate: `PASS`
- Overall: `SELECTIVE EXPANSION ONLY`

## Strongest Tier 1 Outcomes

### Mosman

`Mosman / Spit Junction` now ranks as:

- Rating: `A`
- Policy score: `4`
- Timing score: `5`
- Friction score: `0`
- Recent applications: `491`
- Active pipeline: `2`

This is now a strong commercial inclusion rather than a scope placeholder.

### Lane Cove

`Lane Cove` remains one of the clearest successful additions:

- Rating: `A`
- Policy score: `4`
- Timing score: `5`
- Active pipeline: `2`

### Waverley

`Bondi Junction` remains solid and readable:

- Rating: `B`
- Policy score: `3`
- Timing score: `5`
- Friction score: `0`

### Randwick

`Randwick` remains commercially credible:

- Rating: `B`
- Policy score: `3`
- Timing score: `5`
- Active pipeline: `1`

## Sydney Council Result

Sydney is now meaningfully denser as a precinct pack.

Notable current precincts:

- `Surry Hills` — `B`
- `Redfern` — `B`
- `Ultimo / Broadway` — `B`
- `Potts Point / Kings Cross` — `B`
- `Darlinghurst` — `B`
- `Waterloo` — `B`

Most important improvement:

- `Darlinghurst` now carries policy support (`policy_score = 3`, `active_pipeline_count = 2`)
- `Waterloo` now carries policy support (`policy_score = 3`, `active_pipeline_count = 1`)
- `Ultimo / Broadway` now carries `active_pipeline_count = 3`

This means the Sydney council addition is no longer mainly activity-led. It is now starting to hold together as a policy-plus-activity precinct pack.

## Hornsby Result

Hornsby is still the least mature of the Tier 1 additions.

Current useful rows:

- `Pennant Hills` — `B`
- `Thornleigh` — `B`

Current weaker row:

- `Hornsby` — `C` because friction remains high despite activity and one active policy item

Interpretation:

Hornsby is no longer blocked by missing source data. It is now a true product-shaping question about which precincts best fit the small-mid developer lens.

## Practical Commercial Interpretation

If the goal is to improve customer confidence that the product covers the Sydney councils they naturally expect, this branch is now doing meaningful work.

The councils added in this branch are no longer mostly empty:

- Sydney: now commercially relevant
- Randwick: commercially relevant
- Waverley: commercially relevant
- Lane Cove: commercially strong
- Mosman: commercially strong
- Hornsby: improving, but still less mature than the others

## Merge Assessment

### Councils That Look Close To Production-Ready

- Sydney
- Randwick
- Waverley
- Lane Cove
- Mosman

### Council That Still Needs One More Round

- Hornsby

## Recommended Next Move

If the objective is to improve the main Sydney product quickly, a pragmatic approach is:

1. Merge the stronger Tier 1 additions into the main Sydney scope behind a controlled release step
2. Keep Hornsby on the expansion branch for one more refinement cycle

That would increase real Sydney credibility without forcing the weakest of the new additions to become a blocker for the rest.
