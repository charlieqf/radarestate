import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    snapshotDate: new Date().toISOString().slice(0, 10),
    previousSnapshotDate: null,
    regionGroup: 'Greater Sydney',
    label: 'Sydney',
    outputPath: null
  }

  for (const arg of args) {
    if (arg.startsWith('--snapshot-date=')) options.snapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--previous-snapshot-date=')) options.previousSnapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--output-path=')) options.outputPath = arg.split('=')[1].trim()
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.snapshotDate)) {
    throw new Error(`Invalid --snapshot-date value: ${options.snapshotDate}`)
  }
  if (options.previousSnapshotDate && !/^\d{4}-\d{2}-\d{2}$/.test(options.previousSnapshotDate)) {
    throw new Error(`Invalid --previous-snapshot-date value: ${options.previousSnapshotDate}`)
  }

  return options
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function formatDate(value) {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value))
}

function markdownTable(headers, rows) {
  const escape = (value) => clean(value).replace(/\|/g, '\\|') || '-'
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`)
  ].join('\n')
}

function activityBucketMap(activity) {
  return Object.fromEntries((activity.type_mix_rows || []).map((row) => [row.application_bucket, Number(row.count || 0)]))
}

function applicationSignalTotal(activity) {
  const buckets = activityBucketMap(activity)
  return ['DA', 'CDC', 'Modification', 'Other'].reduce((sum, bucket) => sum + Number(buckets[bucket] || 0), 0)
}

function stateSignificantTotal(activity) {
  const buckets = activityBucketMap(activity)
  return Number(buckets.SSD || 0)
}

function housingTargetCoverageNote(regionGroup, currentSnapshot) {
  if (regionGroup !== 'Greater Sydney') return null
  const councilRows = Array.isArray(currentSnapshot?.activity?.council_rows) ? currentSnapshot.activity.council_rows : []
  const coveredCouncils = councilRows.filter((row) => row.target_value !== null && row.target_value !== undefined).length
  const totalCouncils = councilRows.length
  if (!totalCouncils) return 'Housing target context is present in the current Sydney pack, but the current saved snapshot does not expose a council-count denominator for this note.'
  return `Housing target context is complete within the current Sydney target-council scope used in this pack (${coveredCouncils}/${totalCouncils} councils in the saved snapshot). This should be read as full coverage of that configured scope, not as a claim that every broader Greater Sydney LGA definition is included in this layer.`
}

function snapshotRoot(snapshotDate) {
  return path.join(root, 'snapshots', 'weekly', snapshotDate)
}

function loadSnapshotSet(snapshotDate) {
  const dir = snapshotRoot(snapshotDate)
  if (!fs.existsSync(dir)) throw new Error(`Snapshot folder not found: ${dir}`)
  return {
    manifest: readJson(path.join(dir, 'manifest.json')),
    precinct: readJson(path.join(dir, 'precinct-shortlist.json')),
    site: readJson(path.join(dir, 'site-screening.json')),
    proposals: readJson(path.join(dir, 'proposals.json')),
    activity: readJson(path.join(dir, 'activity.json'))
  }
}

function validateSnapshot(snapshot, expectedDate, regionGroup) {
  if (snapshot.manifest.snapshot_date !== expectedDate) {
    throw new Error(`Manifest snapshot_date mismatch: expected ${expectedDate}, received ${snapshot.manifest.snapshot_date}`)
  }
  if (snapshot.manifest.region_group !== regionGroup) {
    throw new Error(`Manifest region_group mismatch: expected ${regionGroup}, received ${snapshot.manifest.region_group}`)
  }
}

function buildThresholdRows(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const rating = row.opportunity_rating || 'Unscored'
    const current = grouped.get(rating) || {
      rating,
      count: 0,
      min_policy: null,
      max_policy: null,
      min_timing: null,
      max_timing: null,
      min_risk: null,
      max_risk: null
    }
    current.count += 1
    for (const [field, minKey, maxKey] of [
      ['policy_score', 'min_policy', 'max_policy'],
      ['timing_score', 'min_timing', 'max_timing'],
      ['friction_score', 'min_risk', 'max_risk']
    ]) {
      const value = row[field]
      if (value === null || value === undefined || value === '') continue
      current[minKey] = current[minKey] === null ? Number(value) : Math.min(current[minKey], Number(value))
      current[maxKey] = current[maxKey] === null ? Number(value) : Math.max(current[maxKey], Number(value))
    }
    grouped.set(rating, current)
  }

  return ['A', 'B', 'C', 'Unscored']
    .map((rating) => grouped.get(rating))
    .filter(Boolean)
}

function buildCoverageRows(currentSnapshot, previousSnapshot) {
  const sources = [
    ['Planning proposals', currentSnapshot.manifest.source_ranges.planning_proposals, previousSnapshot?.manifest.source_ranges.planning_proposals || null],
    ['Application signals', currentSnapshot.manifest.source_ranges.application_signals, previousSnapshot?.manifest.source_ranges.application_signals || null],
    ['Site screening layers', currentSnapshot.manifest.source_ranges.site_screening_layers, previousSnapshot?.manifest.source_ranges.site_screening_layers || null]
  ]

  return sources.map(([label, currentRange, previousRange]) => [
    label,
    formatDate(currentRange?.min_date),
    formatDate(currentRange?.max_date),
    previousRange ? formatDate(previousRange.min_date) : '-',
    previousRange ? formatDate(previousRange.max_date) : '-'
  ])
}

function buildKnownGaps(currentSnapshot, previousSnapshot) {
  const gaps = [
    `The full report is a point-in-time picture, but activity totals still use the retained cumulative application window beginning ${currentSnapshot.activity.window_start}. Weekly net-new change should be read from the delta report, not inferred from the full report totals alone.`,
    'No owner-contact list, title outreach pack, residual feasibility model, or comparable-sales layer is included in these weekly outputs.',
    'Site shortlist rows are screening outputs for prioritisation, not acquisition-ready approvals.',
    'No current open-data red flag surfaced is not the same as parcel-safe. Site rows still need title, servicing, deal, and detailed planning diligence before transaction use.'
  ]

  if (previousSnapshot?.manifest.baseline_type === 'reconstructed') {
    gaps.push('The previous comparison point is reconstructed rather than formally archived, so the first transition delta should be treated as approximate at the historical baseline edge.')
  }

  for (const gap of currentSnapshot.manifest.known_gaps || []) gaps.push(gap)
  for (const gap of previousSnapshot?.manifest.known_gaps || []) gaps.push(`Previous baseline gap: ${gap}`)
  return [...new Set(gaps)]
}

function buildMarkdown(options, currentSnapshot, previousSnapshot) {
  const precinctRows = currentSnapshot.precinct.rows
  const siteRows = currentSnapshot.site.rows
  const activity = currentSnapshot.activity
  const thresholdRows = buildThresholdRows(precinctRows)
  const ratingCounts = thresholdRows.map((row) => `**${row.rating}**: ${formatNumber(row.count)}`).join(', ')
  const advanceCount = siteRows.filter((row) => row.screening_band === 'Advance').length
  const reviewCount = siteRows.filter((row) => row.screening_band === 'Review').length
  const cautionCount = siteRows.filter((row) => row.screening_band === 'Caution').length
  const activityBuckets = activityBucketMap(activity)
  const coverageRows = buildCoverageRows(currentSnapshot, previousSnapshot)
  const knownGaps = buildKnownGaps(currentSnapshot, previousSnapshot)
  const targetCoverageNote = housingTargetCoverageNote(options.regionGroup, currentSnapshot)

  return [
    `# ${options.label} Development Report Methodology`,
    '',
    '## Time Windows',
    '',
    `- Current snapshot date: ${currentSnapshot.manifest.snapshot_date}`,
    previousSnapshot ? `- Previous comparison snapshot: ${previousSnapshot.manifest.snapshot_date} (${previousSnapshot.manifest.baseline_type})` : null,
    `- Activity totals in the full report use a retained cumulative window starting ${currentSnapshot.activity.window_start}.`,
    '- The delta report is the weekly change layer. It should answer what is new, removed, upgraded, or downgraded since the prior saved snapshot.',
    '',
    '## Archive Integrity',
    '',
    previousSnapshot
      ? previousSnapshot.manifest.baseline_type === 'formal'
        ? '- The current comparison chain is using formally archived weekly snapshots at both ends.'
        : '- The previous comparison point is reconstructed rather than formally archived. This should be read as a transition delta, not as a clean week-over-week archived comparison.'
      : '- No previous comparison snapshot is attached to this pack.',
    '- Once both current and previous manifests are `formal`, the same full-plus-delta structure becomes a true archived week-over-week comparison path.',
    '',
    '## Precinct Scoring Logic',
    '',
    '- Precinct rows are read from the saved weekly precinct snapshot rather than re-queried live when the report is rendered.',
    '- The rating stack combines policy signal strength, timing signal strength, and approval risk. In the current saved snapshot these appear as `policy_score`, `timing_score`, and `friction_score`.',
    '- `policy_score` is positive evidence from the current proposal pipeline and planning direction. `timing_score` reflects current DA-led development tempo with CDC activity deliberately down-weighted. `friction_score` is a penalty layer for planning and environmental red flags.',
    `- Current rated precinct mix: ${ratingCounts}.`,
    '',
    '## Precinct Rating Formula',
    '',
    '- `policy_score` starts at 0, then adds `+2` when active pipeline count is at least 1, `+1` more when active pipeline count is at least 2, `+1` when made count is at least 5, and `-1` when withdrawn count is at least 3. The final result is clamped between 0 and 5.',
    '- `timing_score` now uses a DA-led weighted activity measure rather than raw application totals alone: `recent_da_count + 0.35 x recent_modification_count + 0.10 x recent_cdc_count + 0.15 x recent_other_count`.',
    '- Timing thresholds are `5` at weighted activity 120+, `4` at 60-119.9, `3` at 25-59.9, `2` at 8-24.9, otherwise `1`. A precinct with 20+ recent DAs is lifted to at least `3` even if CDC-heavy noise would otherwise drag it lower. State-significant count still adds `+1`, capped at 5. If active pipeline is above 0 and timing would otherwise be below 2, it is lifted to 2.',
    '- `friction_score` is `2 x high constraints + 1 x medium constraints + 1 if any low constraint exists`, then clamped between 0 and 5.',
    '- Rating rule: `A` requires policy score at least 4 and timing score at least 4. `B` requires policy score at least 3 or timing score at least 3. Otherwise the row is `C`.',
    '- Risk downgrade rule: friction score 3 downgrades `A` to `B`. Friction score 4 downgrades `A` to `B` and `B` to `C`. If there is no live signal from active pipeline, recent applications, or state-significant projects, the row is forced to `C`.',
    '- `capacity_score` is also calculated and stored, but it is not currently used inside the A/B/C assignment rule.',
    '',
    '## Site Screening Logic',
    '',
    '- Site rows are read from the saved weekly site snapshot rather than from a live latest-state view.',
    '- Site screening now uses a default small-mid developer lens, with a slight preference toward townhouse / small subdivision fit over larger-format high-rise or assembly-style parcels.',
    '- Candidate lots are still ranked by planning fit, local precinct strength, matched signal count, and current red-flag burden, but supersites and large-format high-rise envelopes are intentionally de-emphasised in this default view.',
    `- Current site screening band mix: **Advance** ${formatNumber(advanceCount)}, **Review** ${formatNumber(reviewCount)}, **Caution** ${formatNumber(cautionCount)}.`,
    '- `Advance` means the screening layer currently supports moving into street-level diligence. `Review` means there is enough signal to keep on the working list but not enough to promote immediately. `Caution` means the current signal-to-risk balance is weak or blocked.',
    '',
    '## Site Score Formula',
    '',
    '- `screening_score = precinct_score + area_score + frontage_score + fsr_score + height_score + signal_score - oversize_penalty - large_format_penalty - constraint_penalty - title_complexity_penalty`.',
    '- `precinct_score` is `18` for an A-rated precinct, `12` for B, `6` for C, otherwise `2`.',
    '- `area_score` now peaks in the small-mid range: `12` at 450-1,200 sqm, `10` at 1,200-2,500 sqm, `8` at 250-449 sqm, `7` at 2,500-4,000 sqm, `4` at 4,000-7,000 sqm, and only `1` above 7,000 sqm.',
    '- `frontage_score` peaks at `16-32m` with score `8`, then tapers down. Very wide frontages still retain some value, but no longer dominate the ranking.',
    '- `fsr_score` now peaks at FSR `0.75-1.5`, then tapers through mid-rise ranges. Very high FSR remains useful, but is no longer treated as the default best fit.',
    '- `height_score` now peaks at `9-15m`, then tapers through `15-24m` and `24-35m`. Tall high-rise envelopes still score, but only as a secondary fit in the default lens.',
    '- `signal_score` is `2 x matched_signal_count`, capped at 10. `oversize_penalty` is `4` at 5,000-7,999 sqm, `7` at 8,000-14,999 sqm, and `10` at 15,000+ sqm. `large_format_penalty` is `2` at FSR 5+ or height 45m+, and `4` at FSR 8+ or height 80m+.',
    '- `constraint_penalty` is `10 x high constraints + 5 x medium constraints`. `title_complexity_penalty` is capped at 24 and rises with strata / under strata title complexity plus lot-count and parcel-complexity signals.',
    '',
    '## Site Band Thresholds',
    '',
    '- `Advance`: screening score at least 42, with no high constraint and no title complexity penalty.',
    '- `Review`: screening score at least 24 but not qualifying for `Advance`.',
    '- `Caution`: screening score below 24.',
    '',
    '## A/B/C Thresholds',
    '',
    'These are empirical ranges from the currently saved snapshot, not universal planning-law thresholds.',
    '',
    markdownTable(
      ['Rating', 'Precinct Count', 'Policy Score Range', 'Timing Score Range', 'Risk Range'],
      thresholdRows.map((row) => [
        row.rating,
        formatNumber(row.count),
        `${formatNumber(row.min_policy)} to ${formatNumber(row.max_policy)}`,
        `${formatNumber(row.min_timing)} to ${formatNumber(row.max_timing)}`,
        `${formatNumber(row.min_risk)} to ${formatNumber(row.max_risk)}`
      ])
    ),
    '',
    '## Cross-Council Comparability',
    '',
    '- Ratings are best used for prioritisation inside the saved shortlist universe, not as a literal statement that one council is always directly interchangeable with another.',
    '- Cross-council comparisons are directionally useful because the same scoring fields are applied across the saved region snapshot, but council-specific planning regimes and data depth still matter.',
    '- In practice, the strongest customer-safe use is: compare relative priority, then validate with site-level diligence before acting.',
    '',
    '## Metric Scope Notes',
    '',
    `- Customer-facing application totals are derived from mutually exclusive DA / CDC / Modification / Other buckets. In the current snapshot that sums to ${formatNumber(applicationSignalTotal(activity))} application signals since ${activity.window_start}.`,
    `- State-significant signals are tracked separately. In the current snapshot that count is ${formatNumber(stateSignificantTotal(activity))}.`,
    targetCoverageNote ? `- ${targetCoverageNote}` : null,
    '- The default site ranking is not trying to maximise supersite or high-rise assembly potential. It is trying to surface small-mid developer opportunities first, with townhouse / small subdivision fit slightly ahead of boutique apartment / mixed-use infill.',
    '- Site bands in the current product vocabulary are `Advance`, `Review`, and `Caution`.',
    '',
    '## Data Coverage',
    '',
    markdownTable(
      ['Source Layer', 'Current Min Date', 'Current Max Date', 'Previous Min Date', 'Previous Max Date'],
      coverageRows
    ),
    '',
    '## Known Gaps',
    '',
    ...knownGaps.map((gap) => `- ${gap}`),
    ''
  ].filter((item) => item !== null).join('\n')
}

async function main() {
  const options = parseArgs()
  const currentSnapshot = loadSnapshotSet(options.snapshotDate)
  validateSnapshot(currentSnapshot, options.snapshotDate, options.regionGroup)
  const previousSnapshot = options.previousSnapshotDate ? loadSnapshotSet(options.previousSnapshotDate) : null
  if (previousSnapshot) validateSnapshot(previousSnapshot, options.previousSnapshotDate, options.regionGroup)

  const markdown = buildMarkdown(options, currentSnapshot, previousSnapshot)
  const reportsDir = path.join(root, 'reports')
  fs.mkdirSync(reportsDir, { recursive: true })
  const outputPath = options.outputPath
    ? path.resolve(root, options.outputPath)
    : path.join(reportsDir, 'methodology-appendix.md')
  fs.writeFileSync(outputPath, `${markdown}\n`, 'utf8')
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
