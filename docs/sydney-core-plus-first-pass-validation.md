# Sydney Core Plus First-Pass Validation

## Scope

Validated config set:

- `mvp/config/application-sync-sydney-core-plus.json`
- `mvp/config/planning-proposal-sync-sydney-core-plus.json`
- `mvp/config/precinct-focus-map-sydney-core-plus.json`

Tier 1 councils added in this pass:

- Sydney
- Randwick
- Waverley
- Lane Cove
- Mosman
- Hornsby

## What Was Actually Tested

1. Real DA tracker sync against the public NSW application tracker
2. Real planning proposal sync against the NSW Planning Portal PPR pages
3. Rebuild of precinct shortlist using the new precinct map
4. Rebuild of derived constraints
5. Coverage readiness evaluation for the expanded precinct pack

## What Worked Well

### Application Tracker

The new councils are technically ingesting.

- Sydney: `4,366` recent applications
- Randwick: `1,641`
- Waverley: `1,219`
- Lane Cove: `459`
- Mosman: `498`
- Hornsby: `1,392`

This means the DA tracker side is not the main blocker for Tier 1 expansion.

### Precinct Mapping

The new precinct pack is already producing commercially meaningful rows.

Examples from the first-pass shortlist:

- `Lane Cove` rated `A`
- `Bondi Junction` rated `B`
- `Redfern` rated `B`
- `Randwick` rated `B`
- `Darlinghurst` rated `B`

This is enough to say the expansion is moving beyond theory and into usable selective screening.

### Coverage Readiness

`reports/coverage-readiness-sydney-core-plus.md` produced:

- Configured councils: `28`
- Configured precincts: `72`
- Precincts with any signal: `68 / 72` (`94%`)
- Precinct mapping gate: `PASS`
- Risk layer gate: `PASS`
- Stable shortlist gate: `PASS`
- Overall: `SELECTIVE EXPANSION ONLY`

So the pack is technically viable, but still early-stage as a commercial expansion layer.

## Main Gaps Found

### 1. Sydney Proposal Layer Is Still Weak

Application activity is clearly present in Sydney, but the current proposal sync did not surface equivalent active policy strength for the newly added Sydney precincts.

Practical result:

- `Redfern` and `Darlinghurst` surface on activity
- but policy evidence for Sydney is still weaker than expected in this first pass

This likely means the planning proposal council filter for Sydney needs more work, rather than the precincts being intrinsically empty.

### 2. Hornsby Proposal Layer Is Still Weak

`Hornsby` now syncs correctly on the DA tracker side, but planning proposal rows are still not appearing strongly in the current pass.

This suggests the tracker display name issue is fixed, but the PPR council filter still needs refinement.

### 3. Mosman Precinct Design Is Too Thin

`Mosman` currently has:

- `0` precincts with signal
- `0` recent apps mapped in the current precinct pack

This is not because the council has no applications; the council-level tracker sync works.
It means the first precinct choice (`Spit Junction`) is too thin or the keyword / matching setup is not yet capturing the most useful Mosman activity.

## Commercial Reading Of The Result

This first pass is already good enough to prove that Tier 1 Sydney expansion is realistic.

It is not yet good enough to declare that all six added councils are fully productised.

Current strongest additions:

- Lane Cove
- Randwick
- Waverley
- Sydney activity-led precincts

Current weakest additions:

- Mosman
- Hornsby policy layer
- Sydney proposal layer

## Recommended Next Fixes

1. Rework Sydney PPR filter assumptions and test alternate council filter values / detail hydration paths
2. Rework Hornsby PPR filter assumptions in the same way
3. Replace or broaden the first Mosman precinct set beyond `Spit Junction` only
4. Add more Sydney precincts that are directly present in current policy and low-mid-rise maps, not just obvious centre names

## Recommended Decision

Do not merge `sydney-core-plus` into the main customer workflow yet.

Do use it as the working expansion branch for the next iteration, because the first-pass validation already shows:

- the data sources are accessible
- the sync configs are largely correct
- the precinct map is directionally working
- the remaining blockers are fixable productisation issues, not source-availability blockers
