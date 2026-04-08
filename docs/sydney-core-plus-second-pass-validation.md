# Sydney Core Plus Second-Pass Validation

## What Changed In This Pass

This pass fixed three concrete issues from the first validation round:

1. Sydney planning proposal filter value corrected from `CITY OF SYDNEY` to `SYDNEY`
2. Hornsby planning proposal filter value corrected from `HORNSBY SHIRE` to `HORNSBY`
3. Mosman precinct design broadened from `Spit Junction` only to `Mosman / Spit Junction` with wider matching keywords

## Current Outcome

The `sydney-core-plus` expansion is no longer just technically ingesting. It is now producing commercially meaningful shortlisted precincts inside the newly added councils.

## Current Readiness Snapshot

Source: `reports/coverage-readiness-sydney-core-plus.md`

- Configured councils: `28`
- Configured precincts: `72`
- Precincts with any signal: `69 / 72` (`96%`)
- Precincts with mapped proposals: `56`
- Precincts with mapped applications: `69`
- Total mapped proposals: `732`
- Total mapped applications: `13,102`
- Mapping gate: `PASS`
- Risk gate: `PASS`
- Stable shortlist gate: `PASS`
- Overall: `SELECTIVE EXPANSION ONLY`

## Strongest New Council Outcomes

### Mosman

Now functioning as a real shortlisted addition.

- `Mosman / Spit Junction` is currently rated `A`
- Policy score: `4`
- Timing score: `5`
- Friction score: `0`
- Recent applications: `491`
- Active pipeline: `2`

This is a major improvement over the first pass, where Mosman produced no usable shortlisted signal.

### Lane Cove

Now functioning strongly and consistently.

- `Lane Cove` is currently rated `A`
- Policy score: `4`
- Timing score: `5`
- Active pipeline: `2`

Lane Cove is one of the clearest examples that the new Tier 1 councils are now entering the product as genuine opportunity locations, not just as council names in a config file.

### Waverley

Now commercially visible through `Bondi Junction`.

- `Bondi Junction` is currently rated `B`
- Policy score: `3`
- Timing score: `5`
- Friction score: `0`

### Randwick

Now commercially visible through `Randwick`.

- `Randwick` is currently rated `B`
- Policy score: `3`
- Timing score: `5`
- Active pipeline: `1`

## Sydney Council Outcome

Sydney is no longer a pure council-level blind spot.

The active proposal layer now maps into at least some real Sydney precincts:

- `Darlinghurst`: `2` active pipeline items
- `Waterloo`: `1` active pipeline item

At the same time, some Sydney precincts remain more activity-led than policy-led in the current pass:

- `Redfern`: `B`, timing strong, active pipeline currently `0`
- `Darlinghurst`: policy now visible
- `Waterloo`: policy now visible

This should be read as a meaningful product improvement, but not yet as full Sydney precinct maturity.

## Hornsby Council Outcome

Hornsby is now technically connected on both core source layers:

- DA tracker sync works
- Active planning proposal mapping exists

Current result:

- `Hornsby`: `C` because risk is high
- `Pennant Hills`: `B`
- `Waitara`: `C`
- `Asquith`: `C`

This means Hornsby is no longer blocked by source ingestion. The remaining issue is not “missing data”; it is that the current precinct set is still producing a risk-heavy picture.

## What Still Needs Work

1. Sydney precinct design should be widened further beyond the first five precincts
2. Hornsby may need better first-precinct choices if the goal is stronger small-mid developer relevance
3. Mosman should be watched for over-broad matching now that `Mosman` itself is included as a keyword
4. The pack is still best described as a `working expansion branch`, not yet the new default production Sydney scope

## Practical Decision

The second pass is strong enough to justify continued expansion work on this branch.

It is not yet the right moment to replace the current production Sydney scope with `sydney-core-plus` by default.

The right next step is:

1. Add a few more Sydney precincts where policy is already visible
2. Revisit Hornsby precinct selection for stronger buy-box fit
3. Run one more readiness pass before merging into the main customer workflow
