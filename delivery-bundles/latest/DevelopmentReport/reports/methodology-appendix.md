# Sydney Development Report Methodology

## Time Windows

- Current snapshot date: 2026-04-05
- Previous comparison snapshot: 2026-03-29 (reconstructed)
- Activity totals in the full report use a retained cumulative window starting 2025-01-01.
- The delta report is the weekly change layer. It should answer what is new, removed, upgraded, or downgraded since the prior saved snapshot.

## Archive Integrity

- The previous comparison point is reconstructed rather than formally archived. This should be read as a transition delta, not as a clean week-over-week archived comparison.
- Once both current and previous manifests are `formal`, the same full-plus-delta structure becomes a true archived week-over-week comparison path.

## Precinct Scoring Logic

- Precinct rows are read from the saved weekly precinct snapshot rather than re-queried live when the report is rendered.
- The rating stack combines policy signal strength, timing signal strength, and approval risk. In the current saved snapshot these appear as `policy_score`, `timing_score`, and `friction_score`.
- `policy_score` is positive evidence from the current proposal pipeline and planning direction. `timing_score` reflects current activity tempo and near-term development momentum. `friction_score` is a penalty layer for planning and environmental red flags.
- Current rated precinct mix: **A**: 5, **B**: 26, **C**: 12.

## Precinct Rating Formula

- `policy_score` starts at 0, then adds `+2` when active pipeline count is at least 1, `+1` more when active pipeline count is at least 2, `+1` when made count is at least 5, and `-1` when withdrawn count is at least 3. The final result is clamped between 0 and 5.
- `timing_score` is `5` at 100+ recent applications, `4` at 50-99, `3` at 20-49, `2` at 5-19, otherwise `1`. It then gets `+1` when state-significant count is above 0, capped at 5. If active pipeline is above 0 and timing would otherwise be below 2, it is lifted to 2.
- `friction_score` is `2 x high constraints + 1 x medium constraints + 1 if any low constraint exists`, then clamped between 0 and 5.
- Rating rule: `A` requires policy score at least 4 and timing score at least 4. `B` requires policy score at least 3 or timing score at least 3. Otherwise the row is `C`.
- Risk downgrade rule: friction score 3 downgrades `A` to `B`. Friction score 4 downgrades `A` to `B` and `B` to `C`. If there is no live signal from active pipeline, recent applications, or state-significant projects, the row is forced to `C`.
- `capacity_score` is also calculated and stored, but it is not currently used inside the A/B/C assignment rule.

## Site Screening Logic

- Site rows are read from the saved weekly site snapshot rather than from a live latest-state view.
- Site screening ranks candidate lots by current planning fit, local precinct strength, matched signal count, and current red-flag burden.
- Current site screening band mix: **Advance** 31, **Review** 130, **Caution** 146.
- `Advance` means the screening layer currently supports moving into street-level diligence. `Review` means there is enough signal to keep on the working list but not enough to promote immediately. `Caution` means the current signal-to-risk balance is weak or blocked.

## Site Score Formula

- `screening_score = precinct_score + area_score + frontage_score + fsr_score + height_score + signal_score - constraint_penalty - title_complexity_penalty`.
- `precinct_score` is `18` for an A-rated precinct, `12` for B, `6` for C, otherwise `2`.
- `area_score` is `14` at 2,000+ sqm, `11` at 1,200-1,999 sqm, `8` at 800-1,199 sqm, `4` at 450-799 sqm, otherwise `0`.
- `frontage_score` is `8` at 30m+, `6` at 20-29.9m, `3` at 12-19.9m, otherwise `0`.
- `fsr_score` is `12` at FSR 3+, `9` at 2-2.99, `6` at 1.5-1.99, `3` at 1-1.49, otherwise `0`.
- `height_score` is `12` at 45m+, `9` at 28-44.9m, `6` at 18-27.9m, `3` at 12-17.9m, otherwise `0`.
- `signal_score` is `2 x matched_signal_count`, capped at 10. `constraint_penalty` is `10 x high constraints + 5 x medium constraints`. `title_complexity_penalty` is capped at 24 and rises with strata / under strata title complexity plus lot-count and parcel-complexity signals.

## Site Band Thresholds

- `Advance`: screening score at least 45, with no high constraint and no title complexity penalty.
- `Review`: screening score at least 28 but not qualifying for `Advance`.
- `Caution`: screening score below 28.

## A/B/C Thresholds

These are empirical ranges from the currently saved snapshot, not universal planning-law thresholds.

| Rating | Precinct Count | Policy Score Range | Timing Score Range | Risk Range |
| --- | --- | --- | --- | --- |
| A | 5 | 4 to 4 | 4 to 5 | 0 to 0 |
| B | 26 | 0 to 4 | 4 to 5 | 0 to 4 |
| C | 12 | 0 to 3 | 2 to 5 | 0 to 5 |

## Cross-Council Comparability

- Ratings are best used for prioritisation inside the saved shortlist universe, not as a literal statement that one council is always directly interchangeable with another.
- Cross-council comparisons are directionally useful because the same scoring fields are applied across the saved region snapshot, but council-specific planning regimes and data depth still matter.
- In practice, the strongest customer-safe use is: compare relative priority, then validate with site-level diligence before acting.

## Metric Scope Notes

- Customer-facing application totals are derived from mutually exclusive DA / CDC / Modification / Other buckets. In the current snapshot that sums to 43,191 application signals since 2025-01-01.
- State-significant signals are tracked separately. In the current snapshot that count is 1,920.
- Site bands in the current product vocabulary are `Advance`, `Review`, and `Caution`.

## Data Coverage

| Source Layer | Current Min Date | Current Max Date | Previous Min Date | Previous Max Date |
| --- | --- | --- | --- | --- |
| Planning proposals | 2026-04-01 | 2026-04-02 | - | - |
| Application signals | 2022-07-07 | 2026-04-02 | 2022-07-07 | 2026-03-28 |
| Site screening layers | 2026-04-04 | 2026-04-05 | - | - |

## Known Gaps

- The full report is a point-in-time picture, but activity totals still use the retained cumulative application window beginning 2025-01-01. Weekly net-new change should be read from the delta report, not inferred from the full report totals alone.
- No owner-contact list, title outreach pack, residual feasibility model, or comparable-sales layer is included in these weekly outputs.
- Site shortlist rows are screening outputs for prioritisation, not acquisition-ready approvals.
- No current open-data red flag surfaced is not the same as parcel-safe. Site rows still need title, servicing, deal, and detailed planning diligence before transaction use.
- The previous comparison point is reconstructed rather than formally archived, so the first transition delta should be treated as approximate at the historical baseline edge.
- Previous baseline gap: No true historical precinct shortlist snapshot was retained for this date.
- Previous baseline gap: No true site-screening layer was retained before 2026-04-03.
- Previous baseline gap: Policy coverage before 2026-04-01 is not retained in the current database state.

