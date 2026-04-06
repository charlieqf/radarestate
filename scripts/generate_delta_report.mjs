import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    currentDate: new Date().toISOString().slice(0, 10),
    previousDate: null,
    regionGroup: 'Greater Sydney',
    label: 'Sydney',
    outputPath: null
  }

  for (const arg of args) {
    if (arg.startsWith('--current-date=')) options.currentDate = arg.split('=')[1].trim()
    if (arg.startsWith('--previous-date=')) options.previousDate = arg.split('=')[1].trim()
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--output-path=')) options.outputPath = arg.split('=')[1].trim()
  }

  if (!options.previousDate) throw new Error('Missing required --previous-date argument')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.currentDate)) throw new Error(`Invalid --current-date value: ${options.currentDate}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.previousDate)) throw new Error(`Invalid --previous-date value: ${options.previousDate}`)
  return options
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function formatNumber(value, digits = 0, showPlus = false) {
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  const prefix = showPlus && numeric > 0 ? '+' : ''
  return `${prefix}${new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(numeric)}`
}

function markdownTable(headers, rows) {
  const escape = (value) => clean(value).replace(/\|/g, '\\|') || '-'
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`)
  ].join('\n')
}

function stageLabel(value) {
  const labels = {
    under_assessment: 'Under Assessment',
    pre_exhibition: 'Pre-Exhibition',
    on_exhibition: 'On Exhibition',
    finalisation: 'Finalisation',
    made: 'Made',
    withdrawn: 'Withdrawn'
  }
  return labels[value] || clean(value).replace(/_/g, ' ')
}

function activityMetricLabel(key) {
  const labels = {
    mapped_application_count: 'Mapped applications',
    recent_application_count: 'Recent applications',
    recent_da_count: 'Recent DAs',
    recent_cdc_count: 'Recent CDCs',
    recent_ssd_count: 'Recent SSDs',
    recent_modification_count: 'Recent Modifications',
    recent_other_count: 'Recent Other'
  }
  return labels[key] || key
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

function toMap(rows, keyField) {
  return new Map(rows.map((row) => [row[keyField], row]))
}

function compareNumber(before, after) {
  return Number(after || 0) - Number(before || 0)
}

function diffPrecincts(previousRows, currentRows) {
  const prev = toMap(previousRows, 'precinct_key')
  const curr = toMap(currentRows, 'precinct_key')
  const newRows = []
  const removedRows = []
  const ratingChanges = []
  const actionChanges = []
  const newlyScoredRows = []

  for (const [key, row] of curr) {
    if (!prev.has(key)) {
      newRows.push(row)
      continue
    }
    const before = prev.get(key)
    if (!before.opportunity_rating && row.opportunity_rating) {
      newlyScoredRows.push({
        precinct_name: row.precinct_name,
        council_name: row.council_name,
        current_rating: row.opportunity_rating,
        current_action: row.recommended_action,
        previous_rank: before.rank,
        current_rank: row.rank
      })
    } else if (before.opportunity_rating !== row.opportunity_rating) {
      ratingChanges.push({
        precinct_name: row.precinct_name,
        council_name: row.council_name,
        previous_rating: before.opportunity_rating,
        current_rating: row.opportunity_rating,
        previous_rank: before.rank,
        current_rank: row.rank,
        previous_risk: before.friction_score,
        current_risk: row.friction_score
      })
    }
    if (before.recommended_action && row.recommended_action && before.recommended_action !== row.recommended_action) {
      actionChanges.push({
        precinct_name: row.precinct_name,
        council_name: row.council_name,
        previous_action: before.recommended_action,
        current_action: row.recommended_action,
        previous_rank: before.rank,
        current_rank: row.rank
      })
    }
  }

  for (const [key, row] of prev) {
    if (!curr.has(key)) removedRows.push(row)
  }

  return {
    newRows: newRows.sort((a, b) => a.rank - b.rank),
    removedRows: removedRows.sort((a, b) => a.rank - b.rank),
    ratingChanges: ratingChanges.sort((a, b) => a.current_rank - b.current_rank),
    actionChanges: actionChanges.sort((a, b) => a.current_rank - b.current_rank),
    newlyScoredRows: newlyScoredRows.sort((a, b) => a.current_rank - b.current_rank)
  }
}

function diffSites(previousRows, currentRows) {
  const prev = toMap(previousRows, 'site_key')
  const curr = toMap(currentRows, 'site_key')
  const newRows = []
  const removedRows = []
  const bandChanges = []

  for (const [key, row] of curr) {
    if (!prev.has(key)) {
      newRows.push(row)
      continue
    }
    const before = prev.get(key)
    if (before.screening_band !== row.screening_band || Number(before.screening_score) !== Number(row.screening_score)) {
      bandChanges.push({
        site_label: row.site_label,
        search_area: row.watchlist_bucket_name || row.precinct_name,
        previous_band: before.screening_band,
        current_band: row.screening_band,
        previous_score: before.screening_score,
        current_score: row.screening_score,
        previous_rank: before.rank,
        current_rank: row.rank
      })
    }
  }

  for (const [key, row] of prev) {
    if (!curr.has(key)) removedRows.push(row)
  }

  return {
    newRows: newRows.sort((a, b) => a.rank - b.rank),
    removedRows: removedRows.sort((a, b) => a.rank - b.rank),
    bandChanges: bandChanges.sort((a, b) => a.current_rank - b.current_rank)
  }
}

function diffProposals(previousRows, currentRows) {
  const prev = toMap(previousRows, 'proposal_key')
  const curr = toMap(currentRows, 'proposal_key')
  const newRows = []
  const removedRows = []
  const stageChanges = []

  for (const [key, row] of curr) {
    if (!prev.has(key)) {
      newRows.push(row)
      continue
    }
    const before = prev.get(key)
    if (before.stage !== row.stage) {
      stageChanges.push({
        title: row.title,
        council_name: row.council_name,
        precinct_name: row.precinct_name,
        previous_stage: before.stage,
        current_stage: row.stage
      })
    }
  }

  for (const [key, row] of prev) {
    if (!curr.has(key)) removedRows.push(row)
  }

  return { newRows, removedRows, stageChanges }
}

function diffActivity(previousActivity, currentActivity) {
  const totals = [
    {
      metric: 'Application signals',
      previous_value: applicationSignalTotal(previousActivity),
      current_value: applicationSignalTotal(currentActivity),
      change: compareNumber(applicationSignalTotal(previousActivity), applicationSignalTotal(currentActivity))
    },
    {
      metric: 'State-significant signals',
      previous_value: stateSignificantTotal(previousActivity),
      current_value: stateSignificantTotal(currentActivity),
      change: compareNumber(stateSignificantTotal(previousActivity), stateSignificantTotal(currentActivity))
    }
  ]

  const prevBuckets = activityBucketMap(previousActivity)
  const currBuckets = activityBucketMap(currentActivity)
  const typeRows = ['DA', 'CDC', 'Modification', 'Other'].map((bucket) => {
    const before = prevBuckets[bucket] || 0
    const after = currBuckets[bucket] || 0
    return {
      application_bucket: bucket,
      previous_value: before,
      current_value: after,
      change: Number(after) - Number(before)
    }
  })

  return { totals, typeRows }
}

function buildHeadline(options, previousSnapshot, currentSnapshot, diffs) {
  const parts = []
  if (diffs.precinct.ratingChanges.length) parts.push(`${formatNumber(diffs.precinct.ratingChanges.length)} precinct rating changes`)
  if (diffs.precinct.newlyScoredRows.length) parts.push(`${formatNumber(diffs.precinct.newlyScoredRows.length)} precincts now carry formal ratings`) 
  if (diffs.site.newRows.length) parts.push(`${formatNumber(diffs.site.newRows.length)} new shortlisted sites`)
  if (diffs.proposal.stageChanges.length) parts.push(`${formatNumber(diffs.proposal.stageChanges.length)} policy stage changes`)
  const appDelta = compareNumber(applicationSignalTotal(previousSnapshot.activity), applicationSignalTotal(currentSnapshot.activity))
  parts.push(`${formatNumber(appDelta, 0, true)} application signals versus prior snapshot`)
  return `Comparison window: **${options.previousDate} -> ${options.currentDate}**. ${parts.join(', ')}.`
}

function buildActionLines(diffs) {
  const lines = []
  const upgraded = diffs.precinct.ratingChanges.filter((row) => row.previous_rating !== 'A' && row.current_rating === 'A').slice(0, 3)
  const newAdvance = diffs.site.newRows.filter((row) => row.screening_band === 'Advance').slice(0, 3)
  const downgrades = diffs.precinct.ratingChanges.filter((row) => row.previous_rating === 'A' && row.current_rating !== 'A').slice(0, 3)

  if (upgraded.length) lines.push(`Start deeper follow-up on ${upgraded.map((row) => `**${row.precinct_name}**`).join(', ')} because they have newly improved into the highest rating tier.`)
  if (newAdvance.length) lines.push(`Start site-level review on ${newAdvance.map((row) => `**${row.site_label}**`).join(', ')} because they are newly entered shortlist candidates.`)
  if (downgrades.length) lines.push(`Hold promotion on ${downgrades.map((row) => `**${row.precinct_name}**`).join(', ')} until the downgrade drivers are understood.`)
  if (!lines.length) lines.push('No major start/hold/avoid action shift was surfaced between the two snapshots. Keep the prior operating posture and focus on validation rather than list churn.')
  return lines
}

function buildTransitionFlags(previousSnapshot, currentSnapshot, diffs) {
  const flags = []
  if (previousSnapshot.manifest.baseline_type !== 'reconstructed') return flags

  flags.push('This comparison is a transition delta against a reconstructed baseline, not a clean archived week-over-week delta.')

  if (!previousSnapshot.manifest.source_ranges?.site_screening_layers?.max_date && diffs.site.newRows.length) {
    flags.push(`${formatNumber(diffs.site.newRows.length)} new site shortlist rows are being compared against a baseline with no retained historical site-screening layer, so some of these entries may reflect first saved coverage rather than true weekly net-new.`)
  }

  const previousSsd = stateSignificantTotal(previousSnapshot.activity)
  const currentSsd = stateSignificantTotal(currentSnapshot.activity)
  if (previousSsd === 0 && currentSsd >= 100) {
    flags.push(`State-significant signals move from ${formatNumber(previousSsd)} to ${formatNumber(currentSsd)}. Treat that jump as likely baseline completion or source backfill until the next formal archived delta confirms the trend.`)
  }

  return flags
}

function buildNewPriorityTargets(diffs) {
  return diffs.site.newRows
    .filter((row) => row.screening_band === 'Advance' || row.screening_band === 'Review')
    .slice(0, 5)
    .map((row) => {
      const reasons = []
      if (row.screening_band) reasons.push(`${row.screening_band} band`)
      if (row.screening_score !== null && row.screening_score !== undefined) reasons.push(`score ${formatNumber(row.screening_score)}`)
      if (row.matched_signal_count) reasons.push(`${formatNumber(row.matched_signal_count)} mapped signals`)
      if (row.zoning_code) reasons.push(`zone ${row.zoning_code}`)
      return {
        site_label: row.site_label,
        search_area: row.watchlist_bucket_name || row.precinct_name,
        jurisdiction: row.apparent_site_jurisdiction || row.council_name,
        action: row.recommended_site_action,
        reason: reasons.join(', ')
      }
    })
}

function buildMarkdown(options, previousSnapshot, currentSnapshot, diffs) {
  const headline = buildHeadline(options, previousSnapshot, currentSnapshot, diffs)
  const actionLines = buildActionLines(diffs)
  const newPriorityTargets = buildNewPriorityTargets(diffs)
  const transitionFlags = buildTransitionFlags(previousSnapshot, currentSnapshot, diffs)
  const currentIsReconstructed = currentSnapshot.manifest.baseline_type === 'reconstructed'
  const previousIsReconstructed = previousSnapshot.manifest.baseline_type === 'reconstructed'

  return [
    `# ${options.label} Development Delta Report`,
    '',
    '## Comparison Window',
    '',
    `Current snapshot: \`${options.currentDate}\``,
    `Previous snapshot: \`${options.previousDate}\``,
    `Current baseline type: \`${currentSnapshot.manifest.baseline_type}\``,
    `Previous baseline type: \`${previousSnapshot.manifest.baseline_type}\``,
    '',
    headline,
    '',
    ...(transitionFlags.length
      ? [
          '## Delta Reliability This Week',
          '',
          ...transitionFlags.map((line) => `- ${line}`),
          ''
        ]
      : []),
    '',
    '## What Changed This Week',
    '',
    `- Precinct additions: **${formatNumber(diffs.precinct.newRows.length)}**`,
    `- Precinct removals: **${formatNumber(diffs.precinct.removedRows.length)}**`,
    `- Precinct rating changes: **${formatNumber(diffs.precinct.ratingChanges.length)}**`,
    `- Newly scored precincts: **${formatNumber(diffs.precinct.newlyScoredRows.length)}**`,
    `- Site shortlist additions: **${formatNumber(diffs.site.newRows.length)}**`,
    `- Site shortlist removals: **${formatNumber(diffs.site.removedRows.length)}**`,
    `- Site band or score changes: **${formatNumber(diffs.site.bandChanges.length)}**`,
    `- New policy items: **${formatNumber(diffs.proposal.newRows.length)}**`,
    `- Policy removals: **${formatNumber(diffs.proposal.removedRows.length)}**`,
    `- Policy stage changes: **${formatNumber(diffs.proposal.stageChanges.length)}**`,
    '',
    '## Precinct Rating Changes',
    '',
    diffs.precinct.ratingChanges.length
      ? markdownTable(
          ['Precinct', 'Council', 'Previous', 'Current', 'Previous Rank', 'Current Rank', 'Previous Risk', 'Current Risk'],
          diffs.precinct.ratingChanges.map((row) => [
            row.precinct_name,
            row.council_name,
            row.previous_rating,
            row.current_rating,
            row.previous_rank,
            row.current_rank,
            formatNumber(row.previous_risk),
            formatNumber(row.current_risk)
          ])
        )
      : 'No precinct rating changes were surfaced between the two snapshots.',
    '',
    '## Newly Scored Precincts',
    '',
    diffs.precinct.newlyScoredRows.length
      ? markdownTable(
          ['Precinct', 'Council', 'Current Rating', 'Current Action', 'Previous Rank', 'Current Rank'],
          diffs.precinct.newlyScoredRows.map((row) => [
            row.precinct_name,
            row.council_name,
            row.current_rating,
            row.current_action || '-',
            row.previous_rank,
            row.current_rank
          ])
        )
      : 'No precincts moved from unscored to formally scored status between the two snapshots.',
    '',
    '## New Priority Precincts',
    '',
    diffs.precinct.newRows.length
      ? markdownTable(
          ['Rank', 'Precinct', 'Council', 'Rating', 'Action', 'Recent Apps', 'Pipeline'],
          diffs.precinct.newRows.slice(0, 10).map((row) => [
            row.rank,
            row.precinct_name,
            row.council_name,
            row.opportunity_rating,
            row.recommended_action,
            formatNumber(row.recent_application_count),
            formatNumber(row.active_pipeline_count)
          ])
        )
      : 'No new precincts entered the saved shortlist universe.',
    '',
    '## Downgraded Or Removed Precincts',
    '',
    diffs.precinct.removedRows.length || diffs.precinct.actionChanges.length
      ? [
          diffs.precinct.removedRows.length
            ? markdownTable(
                ['Previous Rank', 'Precinct', 'Council', 'Rating', 'Action'],
                diffs.precinct.removedRows.slice(0, 10).map((row) => [row.rank, row.precinct_name, row.council_name, row.opportunity_rating, row.recommended_action])
              )
            : 'No precincts were removed from the saved shortlist universe.',
          '',
          diffs.precinct.actionChanges.length
            ? markdownTable(
                ['Precinct', 'Council', 'Previous Action', 'Current Action', 'Previous Rank', 'Current Rank'],
                diffs.precinct.actionChanges.slice(0, 10).map((row) => [row.precinct_name, row.council_name, row.previous_action, row.current_action, row.previous_rank, row.current_rank])
              )
            : 'No precinct action changes were surfaced.'
        ].join('\n')
      : 'No downgraded or removed precinct changes were surfaced between the two snapshots.',
    '',
    '## New Site Shortlist Entries',
    '',
    diffs.site.newRows.length
      ? markdownTable(
          ['Rank', 'Site', 'Search Area', 'Band', 'Score', 'Jurisdiction', 'Action'],
          diffs.site.newRows.slice(0, 10).map((row) => [
            row.rank,
            row.site_label,
            row.watchlist_bucket_name || row.precinct_name,
            row.screening_band,
            formatNumber(row.screening_score),
            row.apparent_site_jurisdiction || row.council_name,
            row.recommended_site_action
          ])
        )
      : 'No new site rows entered the saved shortlist.',
    '',
    '## New High-Priority Targets This Week',
    '',
    newPriorityTargets.length
      ? markdownTable(
          ['Site', 'Search Area', 'Jurisdiction', 'Immediate Next Step', 'Why It Matters This Week'],
          newPriorityTargets.map((row) => [
            row.site_label,
            row.search_area,
            row.jurisdiction,
            row.action,
            row.reason
          ])
        )
      : 'No new high-priority site targets entered this week\'s delta layer.',
    '',
    '## Sites Removed Or Rebanded',
    '',
    diffs.site.removedRows.length || diffs.site.bandChanges.length
      ? [
          diffs.site.removedRows.length
            ? markdownTable(
                ['Previous Rank', 'Site', 'Search Area', 'Band', 'Score'],
                diffs.site.removedRows.slice(0, 10).map((row) => [row.rank, row.site_label, row.watchlist_bucket_name || row.precinct_name, row.screening_band, formatNumber(row.screening_score)])
              )
            : 'No site rows were removed from the saved shortlist.',
          '',
          diffs.site.bandChanges.length
            ? markdownTable(
                ['Site', 'Search Area', 'Previous Band', 'Current Band', 'Previous Score', 'Current Score', 'Previous Rank', 'Current Rank'],
                diffs.site.bandChanges.slice(0, 10).map((row) => [
                  row.site_label,
                  row.search_area,
                  row.previous_band,
                  row.current_band,
                  formatNumber(row.previous_score),
                  formatNumber(row.current_score),
                  row.previous_rank,
                  row.current_rank
                ])
              )
            : 'No site band or score changes were surfaced.'
        ].join('\n')
      : 'No removed or rebanded site changes were surfaced between the two snapshots.',
    '',
    '## New Policy Signals',
    '',
    diffs.proposal.newRows.length || diffs.proposal.stageChanges.length || diffs.proposal.removedRows.length
      ? [
          diffs.proposal.newRows.length
            ? markdownTable(
                ['Stage', 'Council', 'Precinct', 'Title'],
                diffs.proposal.newRows.slice(0, 10).map((row) => [stageLabel(row.stage), row.council_name || '-', row.precinct_name || '-', row.title])
              )
            : 'No new policy rows entered the active watchlist.',
          '',
          diffs.proposal.stageChanges.length
            ? markdownTable(
                ['Council', 'Precinct', 'Title', 'Previous Stage', 'Current Stage'],
                diffs.proposal.stageChanges.slice(0, 10).map((row) => [row.council_name || '-', row.precinct_name || '-', row.title, stageLabel(row.previous_stage), stageLabel(row.current_stage)])
              )
            : 'No policy stage changes were surfaced.',
          '',
          diffs.proposal.removedRows.length
            ? markdownTable(
                ['Previous Stage', 'Council', 'Precinct', 'Title'],
                diffs.proposal.removedRows.slice(0, 10).map((row) => [stageLabel(row.stage), row.council_name || '-', row.precinct_name || '-', row.title])
              )
            : 'No policy rows left the active watchlist.'
        ].join('\n')
      : 'No policy additions, removals, or stage changes were surfaced between the two snapshots.',
    '',
    '## Weekly Application Changes',
    '',
    `These tables compare the same retained cumulative application window beginning \`${currentSnapshot.activity.window_start}\` across both saved snapshots. Application signals are reported as mutually exclusive DA / CDC / Modification / Other buckets. State-significant signals are shown separately because they do not sit inside the same application bucket stack. The change column is the movement between the two saved points, not proof of a clean single-week market move when the previous baseline is reconstructed.`,
    '',
    markdownTable(
      ['Metric', 'Previous', 'Current', 'Change'],
      diffs.activity.totals.map((row) => [row.metric, formatNumber(row.previous_value), formatNumber(row.current_value), formatNumber(row.change, 0, true)])
    ),
    '',
    markdownTable(
      ['Application Type', 'Previous', 'Current', 'Change'],
      diffs.activity.typeRows.map((row) => [row.application_bucket, formatNumber(row.previous_value), formatNumber(row.current_value), formatNumber(row.change, 0, true)])
    ),
    '',
    '## Start / Hold / Avoid',
    '',
    ...actionLines.map((line, index) => `${index + 1}. ${line}`),
    '',
    '## Method Notes',
    '',
    `- Current snapshot date: ${currentSnapshot.manifest.snapshot_date}`,
    `- Previous snapshot date: ${previousSnapshot.manifest.snapshot_date}`,
    `- Current baseline type: ${currentSnapshot.manifest.baseline_type}`,
    `- Previous baseline type: ${previousSnapshot.manifest.baseline_type}`,
    `- Activity change tables compare cumulative counts from the shared retained window beginning ${currentSnapshot.activity.window_start}.`,
    '- Precinct changes are diffed by `precinct_key`.',
    '- Site changes are diffed by `site_key`.',
    '- Policy changes are diffed by `proposal_key`.',
    previousIsReconstructed ? '- The previous snapshot is reconstructed, so this comparison should be treated as a transition-period delta rather than a true week-over-week archived comparison.' : null,
    currentIsReconstructed ? '- The current snapshot is reconstructed, so this comparison should be treated as approximate rather than formal.' : null,
    ''
  ].filter((item) => item !== null).join('\n')
}

async function main() {
  const options = parseArgs()
  const previousSnapshot = loadSnapshotSet(options.previousDate)
  const currentSnapshot = loadSnapshotSet(options.currentDate)
  validateSnapshot(previousSnapshot, options.previousDate, options.regionGroup)
  validateSnapshot(currentSnapshot, options.currentDate, options.regionGroup)

  const diffs = {
    precinct: diffPrecincts(previousSnapshot.precinct.rows, currentSnapshot.precinct.rows),
    site: diffSites(previousSnapshot.site.rows, currentSnapshot.site.rows),
    proposal: diffProposals(previousSnapshot.proposals.rows, currentSnapshot.proposals.rows),
    activity: diffActivity(previousSnapshot.activity, currentSnapshot.activity)
  }

  const markdown = buildMarkdown(options, previousSnapshot, currentSnapshot, diffs)
  const reportsDir = path.join(root, 'reports')
  fs.mkdirSync(reportsDir, { recursive: true })
  const outputPath = options.outputPath
    ? path.resolve(root, options.outputPath)
    : path.join(reportsDir, `delta-report-${options.currentDate}-vs-${options.previousDate}.md`)
  fs.writeFileSync(outputPath, `${markdown}\n`, 'utf8')
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
