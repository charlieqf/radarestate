# Weekly Snapshot Schema

## Purpose

This document defines the weekly snapshot artifacts required to support:

1. dated full reports
2. week-over-week delta reports
3. reproducible historical client bundles

The snapshot layer exists because the current reporting stack mostly reads latest-state views. A dated report should not depend on whatever `latest` means at render time.

## Storage Layout

Initial implementation should use file-based snapshots.

```text
snapshots/
  weekly/
    YYYY-MM-DD/
      manifest.json
      precinct-shortlist.json
      site-screening.json
      proposals.json
      activity.json
```

Example:

```text
snapshots/
  weekly/
    2026-04-05/
      manifest.json
      precinct-shortlist.json
      site-screening.json
      proposals.json
      activity.json
```

## Snapshot Rules

1. One folder per snapshot date.
2. Snapshot date is the reporting cutoff date.
3. A snapshot is immutable once published.
4. Rebuilds for the same date should either:
- fail by default, or
- require an explicit overwrite flag
5. Full and delta reports must read from snapshots, not directly from `latest` views.

## Date Semantics

### `snapshot_date`

- Type: `YYYY-MM-DD`
- Meaning: the date the report is intended to represent

### `captured_at`

- Type: ISO timestamp
- Meaning: when the snapshot file was actually written

### `source_observed_at`

- Type: date or `null`
- Meaning: latest relevant source observation date contained in the row

These three values should not be confused.

## Manifest Schema

File: `manifest.json`

Purpose:

- describe the snapshot
- list included files
- make provenance explicit

Suggested shape:

```json
{
  "snapshot_date": "2026-04-05",
  "captured_at": "2026-04-05T09:15:00.000Z",
  "region_group": "Greater Sydney",
  "label": "Sydney",
  "baseline_type": "formal",
  "notes": [
    "Formal weekly snapshot for full and delta reporting"
  ],
  "files": [
    "precinct-shortlist.json",
    "site-screening.json",
    "proposals.json",
    "activity.json"
  ],
  "source_ranges": {
    "planning_proposals": {
      "min": "2026-04-01",
      "max": "2026-04-05"
    },
    "application_signals": {
      "min": "2022-07-08",
      "max": "2026-04-05"
    },
    "site_screening_layers": {
      "min": "2026-04-05",
      "max": "2026-04-05"
    }
  }
}
```

### `baseline_type`

Allowed values:

- `formal`
- `reconstructed`

Use `reconstructed` only for transition-period baselines such as `2026-03-29`.

## Precinct Shortlist Snapshot

File: `precinct-shortlist.json`

Purpose:

- preserve the exact precinct ranking and inputs used for a full report
- support rating-change diff logic

Suggested file shape:

```json
{
  "snapshot_date": "2026-04-05",
  "region_group": "Greater Sydney",
  "window_start": "2025-01-01",
  "rows": []
}
```

### Required Row Fields

- `rank`
- `precinct_key`
- `precinct_name`
- `council_name`
- `precinct_type`
- `opportunity_rating`
- `recommended_action`
- `policy_score`
- `timing_score`
- `friction_score`
- `recent_application_count`
- `active_pipeline_count`
- `state_significant_count`
- `constraint_count`
- `constraint_summary`
- `trigger_summary`
- `source_observed_at`

### Recommended Row Example

```json
{
  "rank": 1,
  "precinct_key": "precinct:gladesville",
  "precinct_name": "Gladesville",
  "council_name": "Hunters Hill",
  "precinct_type": "centre",
  "opportunity_rating": "A",
  "recommended_action": "Prioritise",
  "policy_score": 4,
  "timing_score": 5,
  "friction_score": 0,
  "recent_application_count": 217,
  "active_pipeline_count": 2,
  "state_significant_count": 0,
  "constraint_count": 0,
  "constraint_summary": null,
  "trigger_summary": "2 active proposals, 217 recent applications, 0 state significant projects",
  "source_observed_at": "2026-04-05"
}
```

### Diff Identity Rule

Use `precinct_key` as the primary identity field.

If no canonical field exists yet, derive:

- `precinct:` + slugified precinct name

Do not diff precinct rows by rank alone.

## Site Screening Snapshot

File: `site-screening.json`

Purpose:

- preserve the surfaced site shortlist for the week
- support new / dropped site comparisons

Suggested file shape:

```json
{
  "snapshot_date": "2026-04-05",
  "region_group": "Greater Sydney",
  "rows": []
}
```

### Required Row Fields

- `rank`
- `site_key`
- `site_label`
- `precinct_name`
- `watchlist_bucket_name`
- `council_name`
- `screening_band`
- `screening_score`
- `recommended_site_action`
- `precinct_opportunity_rating`
- `precinct_policy_score`
- `precinct_timing_score`
- `precinct_friction_score`
- `matched_signal_count`
- `latest_lodgement_date`
- `zoning_code`
- `fsr`
- `height_m`
- `geometry_area_sqm`
- `frontage_candidate_m`
- `constraint_count`
- `high_constraint_count`
- `constraint_summary`
- `title_complexity_penalty`
- `apparent_site_jurisdiction`
- `source_observed_at`

### Recommended Row Example

```json
{
  "rank": 1,
  "site_key": "latest-precinct-westmead-2-dp1227281",
  "site_label": "160 HAWKESBURY ROAD WESTMEAD",
  "precinct_name": "Westmead",
  "watchlist_bucket_name": "Westmead",
  "council_name": "Parramatta",
  "screening_band": "Advance",
  "screening_score": 57,
  "recommended_site_action": "Advance to site review",
  "precinct_opportunity_rating": "A",
  "precinct_policy_score": 4,
  "precinct_timing_score": 5,
  "precinct_friction_score": 1,
  "matched_signal_count": 1,
  "latest_lodgement_date": "2026-03-03",
  "zoning_code": "MU1",
  "fsr": 3,
  "height_m": 31,
  "geometry_area_sqm": 8268,
  "frontage_candidate_m": 357.9,
  "constraint_count": 0,
  "high_constraint_count": 0,
  "constraint_summary": "No current site-level derived constraint hit",
  "title_complexity_penalty": 0,
  "apparent_site_jurisdiction": "Parramatta",
  "source_observed_at": "2026-04-05"
}
```

### Diff Identity Rule

Use `site_key` as the primary identity field.

Do not diff site rows by address text alone.

## Proposal Snapshot

File: `proposals.json`

Purpose:

- preserve the proposal watchlist state for the week
- support new proposal and stage-change reporting

Suggested file shape:

```json
{
  "snapshot_date": "2026-04-05",
  "region_group": "Greater Sydney",
  "rows": []
}
```

### Required Row Fields

- `proposal_key`
- `title`
- `stage`
- `stage_rank`
- `council_name`
- `precinct_name`
- `location_text`
- `is_active`
- `first_seen_at`
- `last_seen_at`
- `source_url`
- `source_observed_at`

### Recommended Row Example

```json
{
  "proposal_key": "ppo:12345",
  "title": "Planning proposal for 2 College Street and 10 Monash Road, Gladesville",
  "stage": "under_assessment",
  "stage_rank": 1,
  "council_name": "Hunters Hill",
  "precinct_name": "Gladesville",
  "location_text": "2 College Street Sydney Gladesville 2111 & more",
  "is_active": true,
  "first_seen_at": "2026-04-01",
  "last_seen_at": "2026-04-05",
  "source_url": "https://example.com/proposal/12345",
  "source_observed_at": "2026-04-05"
}
```

### Diff Identity Rule

Use `proposal_key` as the primary identity field.

Stage-change logic should compare the current row's `stage` against the previous snapshot's `stage` for the same `proposal_key`.

## Activity Snapshot

File: `activity.json`

Purpose:

- preserve application activity aggregates used for both full and delta reporting
- support clear weekly growth and mix comparisons

Suggested file shape:

```json
{
  "snapshot_date": "2026-04-05",
  "region_group": "Greater Sydney",
  "window_start": "2025-01-01",
  "totals": {},
  "council_rows": [],
  "precinct_rows": [],
  "type_mix_rows": []
}
```

### Required `totals` Fields

- `mapped_application_count`
- `recent_application_count`
- `recent_da_count`
- `recent_cdc_count`
- `recent_ssd_count`
- `recent_modification_count`
- `recent_other_count`

### Required `council_rows` Fields

- `rank`
- `council_name`
- `recent_application_count`
- `active_pipeline_count`
- `target_value`

### Required `precinct_rows` Fields

- `rank`
- `precinct_key`
- `precinct_name`
- `council_name`
- `recent_application_count`
- `recent_da_count`
- `recent_cdc_count`
- `recent_ssd_count`
- `recent_modification_count`

### Required `type_mix_rows` Fields

- `application_bucket`
- `count`

## Reconstructed Baseline Requirements

Transition-period reconstructed baselines must include explicit metadata.

### Additional Manifest Rules

If `baseline_type = reconstructed`, manifest must include:

- `reconstruction_method`
- `known_gaps`

Example:

```json
{
  "snapshot_date": "2026-03-29",
  "captured_at": "2026-04-05T10:05:00.000Z",
  "region_group": "Greater Sydney",
  "label": "Sydney",
  "baseline_type": "reconstructed",
  "reconstruction_method": "Built from currently retained activity history and limited source-level policy history",
  "known_gaps": [
    "No true policy snapshot retained for 2026-03-29",
    "No site-screening layer retained before 2026-04-03",
    "No true historical precinct shortlist retained for 2026-03-29"
  ],
  "files": [
    "precinct-shortlist.json",
    "site-screening.json",
    "proposals.json",
    "activity.json"
  ]
}
```

## File Validation Rules

Every snapshot file should pass these checks:

1. valid JSON
2. `snapshot_date` matches parent folder name
3. `region_group` is present
4. required keys exist
5. rows are arrays where expected
6. diff identity keys are unique
7. ranks are sequential where ranking is included

## Delta Computation Rules

### Precinct Delta

Compare by `precinct_key`.

Report:

- new precincts
- removed precincts
- rating changes
- action changes
- major score changes

### Site Delta

Compare by `site_key`.

Report:

- new shortlist entries
- removed shortlist entries
- band changes
- score changes
- new constraint flags

### Proposal Delta

Compare by `proposal_key`.

Report:

- new proposals
- removed proposals
- stage changes
- items newly entering active watch stages

### Activity Delta

Compare totals and ranked aggregates.

Report:

- total weekly change
- type-mix change
- biggest precinct increases
- biggest council increases

## Minimum Viable Snapshot Producer

The first version of `scripts/create_weekly_snapshot.mjs` should:

1. create snapshot folder if missing
2. write `manifest.json`
3. read current precinct shortlist view
4. read current site screening view
5. read current proposal watchlist rows
6. read current activity summary rows
7. write the four JSON artifacts

It does not need to solve full historical `as-of date` reconstruction in version 1.

## Version 1 Limitations

Version 1 snapshotting starts reliable weekly history from the first formal snapshot date onward.

That means:

- future delta reports can be true week-over-week
- earlier baseline reports may still be reconstructed only

## Implementation Note

If database snapshot tables are added later, preserve the same conceptual schema so report generation code can switch storage backends without changing report logic.
