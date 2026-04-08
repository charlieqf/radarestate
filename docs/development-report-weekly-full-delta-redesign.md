# Development Report Weekly Full + Delta Redesign

## Goal

Move `DevelopmentReport` from a rolling watchlist bundle into a weekly client product with two fixed outputs:

1. `Full Report`
2. `Delta Report`

The weekly client question should become:

- What is the full current picture as of this week?
- What changed since last week?
- What should I do differently now?

## Weekly Output Model

From the formal launch point onward, every week should produce:

1. `Full Report as of YYYY-MM-DD`
- Complete point-in-time market and shortlist view.
- Intended for a first read or a fresh handoff.

2. `Delta Report YYYY-MM-DD vs previous week`
- Week-over-week change report.
- Intended for recurring subscribers.

This replaces the current pattern where the bundle is effectively a single rolling `latest` package.

## Immediate Transition Plan

Because the current system does not yet persist weekly snapshots, the first cycle should be handled in two stages.

### Transition Outputs

1. `Reconstructed Baseline for 2026-03-29`
2. `Full Report as of 2026-04-05`
3. `Delta Report 2026-04-05 vs 2026-03-29 baseline`

### Formal Weekly Outputs After Transition

Starting with the next complete cycle after snapshotting is in place:

1. `Full Report as of 2026-04-12`
2. `Delta Report 2026-04-12 vs 2026-04-05`

Then continue with the same cadence every week.

## Historical Baseline Constraint

`2026-03-29` cannot currently be represented as a true historical full report.

### Evidence

Database date coverage checked during review:

- `planning_proposals.first_seen_at`: earliest `2026-04-01`
- `planning_proposal_stage_history.observed_at`: earliest `2026-04-01`
- `application_signals.observed_at`: earliest `2026-04-01`
- `site_candidates.observed_at`: earliest `2026-04-03`
- `planning_controls.observed_at`: earliest `2026-04-03`
- `parcel_metrics.observed_at`: earliest `2026-04-03`
- `property_contexts.observed_at`: earliest `2026-04-03`
- `site_controls.observed_at`: earliest `2026-04-03`
- `site_constraints.observed_at`: earliest `2026-04-03`

### Consequence

The system currently lacks enough historical state to claim:

- a true `Full Report as of 2026-03-29`
- a true `Delta Report 2026-04-05 vs 2026-03-29`

The correct customer-safe language is:

- `Reconstructed Baseline for Week Ending 2026-03-29`

Not:

- `Full Report as of 2026-03-29`

## What Can Be Reconstructed vs What Cannot

### Can Be Partially Reconstructed

1. Application activity
- `application_signals` includes `lodgement_date`.
- A baseline can be approximated using `lodgement_date <= 2026-03-29`.

2. Some activity mix outputs
- DA / CDC / SSD / Modification splits can be partially rebuilt from `application_type` and `lodgement_date`.

### Cannot Be Reliably Reconstructed As Historical Truth

1. Policy state as of `2026-03-29`
- Current proposal tracking begins in early April.
- A true March 29 policy view is not available in current stored history.

2. Site shortlist as of `2026-03-29`
- Site layers only start on `2026-04-03`.

3. Full precinct ranking as of `2026-03-29`
- Current shortlist view is a latest-state view.
- Build scripts do not yet support `as-of date` recomputation.

## Product Naming Rules

### Customer-Facing Naming

Use dated names, not `latest`.

Examples:

- `full-report-2026-04-05.md`
- `delta-report-2026-04-12-vs-2026-04-05.md`
- `top-site-shortlist-2026-04-05.md`
- `methodology-appendix.md`

### Internal Convenience Naming

`latest` can remain as an internal alias, but it should not be the primary client-facing title or navigation label.

## Customer Bundle Structure

Recommended `DevelopmentReport` structure:

```text
DevelopmentReport/
  index.html
  client-output/
    full-report-2026-04-05.html
    delta-report-2026-04-05-vs-2026-03-29-baseline.html
    methodology-appendix.html
  dashboard/
    full-2026-04-05.html
    delta-2026-04-05-vs-2026-03-29-baseline.html
  reports/
    reconstructed-baseline-2026-03-29.md
    full-report-2026-04-05.md
    delta-report-2026-04-05-vs-2026-03-29-baseline.md
    top-site-shortlist-2026-04-05.md
    methodology-appendix.md
    deep-dive-gladesville-2026-04-05.md
    deep-dive-bankstown-2026-04-05.md
  manifest.json
```

## Report Structure

### Full Report

Recommended section order:

```text
# Sydney Development Full Report
## As Of
## Top 3 Takeaways
## Priority Precincts
## Priority Site Shortlist
## Risk Watchlist
## Policy Pipeline
## Development Activity Snapshot
## Recommended Actions This Week
## Method Notes
## Boundaries
```

### Delta Report

Recommended section order:

```text
# Sydney Development Delta Report
## Comparison Window
## What Changed This Week
## Precinct Rating Changes
## New Priority Precincts
## Downgraded Precincts
## New Site Shortlist Entries
## Sites Removed From Shortlist
## New Policy Signals
## Weekly Application Changes
## Start / Hold / Avoid
## Method Notes
```

### Methodology Appendix

Recommended section order:

```text
# Development Report Methodology
## Time Windows
## Precinct Scoring Logic
## Site Screening Logic
## A/B/C Thresholds
## Cross-Council Comparability
## Data Coverage
## Known Gaps
```

## Weekly Snapshot Requirement

To make full + delta work reliably, weekly snapshots must become first-class artifacts.

### Snapshot Types

At minimum, create and preserve four snapshot types every week:

1. precinct shortlist snapshot
2. site shortlist snapshot
3. proposal watchlist snapshot
4. activity summary snapshot

### Recommended Initial Storage

Use file-based snapshots first for speed.

```text
snapshots/
  weekly/
    2026-04-05/
      precinct-shortlist.json
      site-screening.json
      proposals.json
      activity.json
```

Later, move or duplicate these into database snapshot tables if needed.

## Snapshot Field Requirements

### Precinct Snapshot

Required fields:

- `snapshot_date`
- `region_group`
- `precinct_name`
- `council_name`
- `opportunity_rating`
- `recommended_action`
- `policy_score`
- `timing_score`
- `friction_score`
- `recent_application_count`
- `active_pipeline_count`
- `constraint_summary`
- `rank`

### Site Snapshot

Required fields:

- `snapshot_date`
- `region_group`
- `site_key`
- `site_label`
- `precinct_name`
- `watchlist_bucket_name`
- `screening_band`
- `screening_score`
- `recommended_site_action`
- `constraint_summary`
- `title_complexity_penalty`
- `matched_signal_count`
- `latest_lodgement_date`
- `rank`

### Proposal Snapshot

Required fields:

- `snapshot_date`
- `region_group`
- `proposal_key`
- `stage`
- `council_name`
- `title`
- `location_text`
- `last_seen_at`

### Activity Snapshot

Required fields:

- `snapshot_date`
- `region_group`
- `application_bucket`
- `count`
- `window_start`
- precinct- or council-level ranking aggregates as needed for report output

## Engineering Constraint In Current Architecture

The source tables contain some historical fields, but current views and scripts are hard-wired to latest-state behavior.

### Current Limitations

1. `scripts/build_precinct_shortlist.mjs`
- No `--as-of-date` support.

2. `scripts/build_site_screening_layer.mjs`
- No `--as-of-date` support.

3. `supabase/precinct_views.sql`
- `v_precinct_shortlist` is current-state oriented.
- Activity windows are hard-coded to `2025-01-01`.

4. `supabase/development_views.sql`
- `v_site_screening_latest` is a latest-state view.

5. Reporting scripts consume current-state views directly.

This means historical reporting should be based on persisted snapshots, not by trying to query `latest` views retroactively.

## Required Script Changes

### New Scripts

1. `scripts/create_weekly_snapshot.mjs`
- Reads current source views.
- Saves dated weekly snapshots.

2. `scripts/generate_full_report.mjs`
- Reads one dated snapshot set.
- Produces the dated full report.

3. `scripts/generate_delta_report.mjs`
- Reads two dated snapshot sets.
- Produces week-over-week diff output.

4. `scripts/generate_top_site_shortlist.mjs`
- Produces a customer-facing site shortlist with action framing.

5. `scripts/generate_methodology_appendix.mjs`
- Produces a customer-safe methodology document.

6. `scripts/lib/weekly-diff.mjs`
- Centralizes snapshot diff logic.

### Existing Scripts To Modify

1. `scripts/generate_client_pack.mjs`
- Add `--snapshot-date`.
- Add `--previous-snapshot-date`.
- Make full + delta the main entry points.

2. `scripts/generate_deep_dive_memo.mjs`
- Support dated generation.
- Add change-focused and action-focused sections.

3. `scripts/generate_dashboard_report.mjs`
- Add dated full dashboard mode.
- Add delta dashboard mode.

4. `scripts/run_pipeline.mjs`
- Add snapshot creation to weekly flow.
- Add full + delta generation steps.

5. `scripts/export_delivery_bundle.mjs`
- Point bundle navigation at full + delta + methodology appendix.

6. `scripts/generate_development_report_universe.mjs`
- Reposition as appendix or internal QA artifact.
- Remove from main client path.

## New Weekly Pipeline Flow

Recommended weekly pipeline order:

1. sync source data
2. build current precinct shortlist and current site screening layers
3. create weekly snapshot
4. generate full report from current snapshot
5. load previous weekly snapshot
6. generate delta report
7. generate methodology appendix
8. generate client pack
9. export delivery bundle

## Transition Delivery Logic

### Week Ending 2026-04-05

Produce:

1. `reconstructed-baseline-2026-03-29.md`
2. `full-report-2026-04-05.md`
3. `delta-report-2026-04-05-vs-2026-03-29-baseline.md`

### Customer Wording

Use wording like:

- `This delta report compares the current 2026-04-05 snapshot against a reconstructed 2026-03-29 baseline built from currently retained source history.`

Avoid wording like:

- `This compares two formally captured weekly snapshots.`

because that would be inaccurate for the first transition week.

## Delta Report Content Rules

The delta report should not repeat the whole full report.

It should focus on:

1. precinct rating changes
2. new top-priority precincts
3. downgraded precincts
4. new site shortlist entries
5. removed site shortlist entries
6. new policy items or stage changes
7. weekly application count changes
8. actions to start, hold, and avoid

## Language Rules

Customer-facing main reports should avoid internal product language.

Avoid:

- `fixed hotspot universe`
- `module activation status`
- `structured product validation`
- `watchlist bucket`
- `derived constraints`
- `friction`

Prefer:

- `search area`
- `planning and environmental red flags`
- `approval risk`
- `data coverage note`
- `current missing diligence layers`

## Acceptance Criteria

The redesign is complete when the following are true.

1. Weekly delivery produces two customer-facing outputs:
- one full report
- one delta report

2. Reports are date-specific.
- no primary customer document is titled with `latest`

3. The first transition week uses a clearly labeled reconstructed baseline.

4. Weekly snapshots are saved to a dated location.

5. `generate_client_pack` leads with full + delta, not a raw file list.

6. The methodology appendix is separate from the main full report.

7. `development-report-standard-universe` is no longer the main client entry point.

8. The next full weekly cycle after launch can compare two real snapshots.

## Recommended Build Order

### Phase 1

1. create `docs/weekly-snapshot-schema.md`
2. build `scripts/create_weekly_snapshot.mjs`
3. build `scripts/generate_full_report.mjs`
4. build `scripts/generate_delta_report.mjs`

### Phase 2

1. build `scripts/generate_methodology_appendix.mjs`
2. build `scripts/generate_top_site_shortlist.mjs`
3. modify `scripts/generate_client_pack.mjs`

### Phase 3

1. modify `scripts/run_pipeline.mjs`
2. modify `scripts/export_delivery_bundle.mjs`
3. modify dashboard and deep-dive generation

## Recommended Product Decision

Treat `2026-04-05` as the formal starting point for the new weekly full + delta product.

Treat `2026-03-29` as a transitional reconstructed baseline only.

This is the safest path technically and the cleanest path commercially.
