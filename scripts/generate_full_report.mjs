import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    snapshotDate: new Date().toISOString().slice(0, 10),
    regionGroup: 'Greater Sydney',
    label: 'Sydney',
    outputPath: null
  }

  for (const arg of args) {
    if (arg.startsWith('--snapshot-date=')) options.snapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--output-path=')) options.outputPath = arg.split('=')[1].trim()
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.snapshotDate)) {
    throw new Error(`Invalid --snapshot-date value: ${options.snapshotDate}`)
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

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value))
}

function formatMeasure(value, suffix, digits = 0) {
  if (value === null || value === undefined || value === '') return '-'
  return `${formatNumber(value, digits)}${suffix}`
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

function validateSnapshot(snapshot, options) {
  if (snapshot.manifest.snapshot_date !== options.snapshotDate) {
    throw new Error(`Manifest snapshot_date mismatch: expected ${options.snapshotDate}, received ${snapshot.manifest.snapshot_date}`)
  }
  if (snapshot.manifest.region_group !== options.regionGroup) {
    throw new Error(`Manifest region_group mismatch: expected ${options.regionGroup}, received ${snapshot.manifest.region_group}`)
  }
}

function titleForManifest(label, manifest) {
  return manifest.baseline_type === 'reconstructed'
    ? `${label} Reconstructed Baseline`
    : `${label} Development Full Report`
}

function introForManifest(manifest) {
  return manifest.baseline_type === 'reconstructed'
    ? 'This is a reconstructed baseline built from currently retained source history. It is useful for transition-period comparison, but it should not be read as a formally captured historical weekly package.'
    : 'This is the complete current weekly development view for the report date shown below. It is intended to give a full current picture before the change report is read. Weekly net-new change should be read from the dated delta report rather than inferred from the cumulative activity totals in this full report alone.'
}

function topTakeaways(precinctRows, siteRows, proposalRows, activity) {
  const best = precinctRows[0]
  const topSite = siteRows[0]
  const highRisk = [...precinctRows]
    .filter((row) => Number(row.constraint_count || 0) > 0 || Number(row.friction_score || 0) >= 4)
    .sort((a, b) => Number(b.friction_score || 0) - Number(a.friction_score || 0))[0]
  const byStage = new Map()
  for (const row of proposalRows) byStage.set(row.stage, (byStage.get(row.stage) || 0) + 1)
  const stageLead = [...byStage.entries()].sort((a, b) => b[1] - a[1])[0]

  return [
    best
      ? best.opportunity_rating
        ? `Strongest current precinct signal: **${best.precinct_name}** (${best.council_name}) is rated **${best.opportunity_rating}** with policy **${formatNumber(best.policy_score)}**, timing **${formatNumber(best.timing_score)}** and risk **${formatNumber(best.friction_score)}**.`
        : `Highest reconstructed activity precinct: **${best.precinct_name}** (${best.council_name}) shows **${formatNumber(best.recent_application_count)}** recent mapped applications in the retained history available for this baseline.`
      : 'No current precinct leader is available in this snapshot.',
    topSite
      ? `Top current site candidate: **${topSite.site_label}** in **${topSite.watchlist_bucket_name || topSite.precinct_name}** is currently **${topSite.screening_band}** with score **${formatNumber(topSite.screening_score)}**.`
      : 'No current site shortlist rows are available in this snapshot.',
    stageLead
      ? `Current active policy load is led by **${stageLabel(stageLead[0])}** with **${formatNumber(stageLead[1])}** tracked items, while cumulative application-signal volume across the region sits at **${formatNumber(applicationSignalTotal(activity))}** since **${activity.window_start}**.`
      : `Cumulative application-signal volume across the region sits at **${formatNumber(applicationSignalTotal(activity))}** since **${activity.window_start}**.`,
    highRisk
      ? `Highest current caution signal: **${highRisk.precinct_name}** (${highRisk.council_name}) carries risk **${formatNumber(highRisk.friction_score)}**${highRisk.constraint_summary ? ` with ${highRisk.constraint_summary}` : ''}.`
      : null
  ].filter(Boolean).slice(0, 3)
}

function buildPolicyPipeline(proposalRows) {
  const grouped = new Map()
  for (const row of proposalRows) {
    const current = grouped.get(row.stage) || { stage: row.stage, proposal_count: 0, councils: new Set() }
    current.proposal_count += 1
    if (row.council_name) current.councils.add(row.council_name)
    grouped.set(row.stage, current)
  }

  const order = ['under_assessment', 'pre_exhibition', 'on_exhibition', 'finalisation']
  return [...grouped.values()]
    .map((row) => ({ stage: row.stage, proposal_count: row.proposal_count, council_count: row.councils.size }))
    .sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage))
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

function buildRecommendedActions(precinctRows, siteRows) {
  const actions = []
  const priorityPrecincts = precinctRows.filter((row) => row.opportunity_rating === 'A').slice(0, 3)
  const advanceSites = siteRows.filter((row) => row.screening_band === 'Advance').slice(0, 3)
  const constrainedPrecincts = [...precinctRows]
    .filter((row) => Number(row.constraint_count || 0) > 0 || Number(row.friction_score || 0) >= 4)
    .sort((a, b) => Number(b.friction_score || 0) - Number(a.friction_score || 0))
    .slice(0, 3)

  if (priorityPrecincts.length) {
    actions.push(`Push precinct-level follow-up in ${priorityPrecincts.map((row) => `**${row.precinct_name}**`).join(', ')} before broadening the watchlist further.`)
  }
  if (advanceSites.length) {
    actions.push(`Move the current leading site shortlist into street-level diligence for ${advanceSites.map((row) => `**${row.site_label}**`).join(', ')}.`)
  }
  if (constrainedPrecincts.length) {
    actions.push(`Keep ${constrainedPrecincts.map((row) => `**${row.precinct_name}**`).join(', ')} on a separate caution list until the current risk stack is validated or cleared.`)
  }

  return actions
}

function buildPriorityTargets(siteRows) {
  return siteRows.slice(0, 5).map((row) => {
    const reasons = []
    if (row.screening_band) reasons.push(`${row.screening_band} band`)
    if (row.screening_score !== null && row.screening_score !== undefined) reasons.push(`score ${formatNumber(row.screening_score)}`)
    if (row.matched_signal_count) reasons.push(`${formatNumber(row.matched_signal_count)} mapped signals`)
    if (row.geometry_area_sqm || row.plan_area_sqm) reasons.push(`${formatMeasure(row.geometry_area_sqm || row.plan_area_sqm, ' sqm')} lot area`)
    if (row.frontage_candidate_m) reasons.push(`${formatMeasure(row.frontage_candidate_m, ' m', 1)} frontage`)
    if (row.zoning_code) reasons.push(`zone ${row.zoning_code}`)
    if (Number(row.title_complexity_penalty || 0) > 0) reasons.push(`title penalty ${formatNumber(row.title_complexity_penalty)}`)
    return {
      site_label: row.site_label,
      search_area: row.watchlist_bucket_name || row.precinct_name,
      jurisdiction: row.apparent_site_jurisdiction || row.council_name,
      action: row.recommended_site_action,
      title_complexity_penalty: Number(row.title_complexity_penalty || 0),
      reason: reasons.join(', ')
    }
  })
}

function buildAssemblyPrecincts(siteRows, precinctRows) {
  const precinctByName = new Map(precinctRows.map((row) => [row.precinct_name, row]))
  const grouped = new Map()
  for (const row of siteRows.slice(0, 30)) {
    const key = row.precinct_name || row.watchlist_bucket_name || row.site_label
    const current = grouped.get(key) || {
      precinct_name: row.precinct_name || row.watchlist_bucket_name || '-',
      search_area: row.watchlist_bucket_name || row.precinct_name || '-',
      site_count: 0,
      advance_count: 0,
      best_score: null,
      total_area: 0,
      frontage_total: 0,
      sample_sites: []
    }
    current.site_count += 1
    if (row.screening_band === 'Advance') current.advance_count += 1
    current.best_score = current.best_score === null ? Number(row.screening_score || 0) : Math.max(current.best_score, Number(row.screening_score || 0))
    current.total_area += Number(row.geometry_area_sqm || 0)
    current.frontage_total += Number(row.frontage_candidate_m || 0)
    current.title_complexity_hits = Number(current.title_complexity_hits || 0) + (Number(row.title_complexity_penalty || 0) > 0 ? 1 : 0)
    if (current.sample_sites.length < 3) current.sample_sites.push(row.site_label)
    grouped.set(key, current)
  }

  return [...grouped.values()]
    .map((row) => {
      const precinct = precinctByName.get(row.precinct_name) || {}
      return {
        ...row,
        opportunity_rating: precinct.opportunity_rating || '-',
        recommended_action: precinct.recommended_action || '-',
        approval_risk: precinct.friction_score,
        pipeline: precinct.active_pipeline_count
      }
    })
    .sort((a, b) => {
      if (b.advance_count !== a.advance_count) return b.advance_count - a.advance_count
      if (b.site_count !== a.site_count) return b.site_count - a.site_count
      if (b.best_score !== a.best_score) return b.best_score - a.best_score
      return b.total_area - a.total_area
    })
    .slice(0, 3)
}

function buildMethodNotes(snapshot) {
  const notes = [
    `Snapshot date: ${snapshot.manifest.snapshot_date}`,
    `Baseline type: ${snapshot.manifest.baseline_type}`,
    `Recent application window start: ${snapshot.activity.window_start}`,
    'Default site ranking lens: small-mid developer buy box, with townhouse / small subdivision fit slightly ahead of boutique apartment / mixed-use infill.',
    'Precinct timing score is DA-led and deliberately down-weights CDC-heavy activity so the default shortlist better reflects acquisition relevance.',
    'Precinct rows are read from the saved weekly precinct snapshot, not from a live latest-state query at report render time.',
    'Site rows are read from the saved weekly site-screening snapshot, not from a live latest-state query at report render time.'
  ]

  if (snapshot.manifest.baseline_type === 'reconstructed' && snapshot.manifest.reconstruction_method) {
    notes.push(`Reconstruction method: ${snapshot.manifest.reconstruction_method}`)
  }
  if (snapshot.manifest.baseline_type === 'reconstructed' && Array.isArray(snapshot.manifest.known_gaps)) {
    for (const gap of snapshot.manifest.known_gaps) notes.push(`Known gap: ${gap}`)
  }

  return notes
}

function boundariesForManifest(manifest) {
  const items = [
    'No owner/title contact layer is included.',
    'No proprietary comparable-sales layer is included.',
    'No residual pricing model is included.',
    'Site screening remains a triage layer, not a parcel-clearance or acquisition approval output.',
    'Large-format strategic assembly or high-rise opportunities may be under-ranked in this default lens because the primary target user is a small-mid developer.'
  ]
  if (manifest.baseline_type === 'reconstructed') {
    items.unshift('This baseline is reconstructed from retained source history and is not a formally captured historical weekly package.')
  }
  return items
}

function buildMarkdown(options, snapshot) {
  const precinctRows = snapshot.precinct.rows
  const siteRows = snapshot.site.rows
  const proposalRows = snapshot.proposals.rows
  const activity = snapshot.activity
  const priorityPrecincts = precinctRows.slice(0, 10)
  const topSites = siteRows.slice(0, 10)
  const priorityTargets = buildPriorityTargets(siteRows)
  const assemblyPrecincts = buildAssemblyPrecincts(siteRows, precinctRows)
  const riskWatchlist = [...precinctRows]
    .filter((row) => Number(row.constraint_count || 0) > 0 || Number(row.friction_score || 0) >= 3)
    .sort((a, b) => Number(b.friction_score || 0) - Number(a.friction_score || 0))
    .slice(0, 10)
  const proposalWatchlist = proposalRows.slice(0, 12)
  const policyPipeline = buildPolicyPipeline(proposalRows)
  const actions = buildRecommendedActions(precinctRows, siteRows)
  const methodNotes = buildMethodNotes(snapshot)
  const activityBuckets = activityBucketMap(activity)
  const activityMetrics = [
    [`Application signals since ${activity.window_start}`, formatNumber(applicationSignalTotal(activity))],
    [`DA signals since ${activity.window_start}`, formatNumber(activityBuckets.DA || 0)],
    [`CDC signals since ${activity.window_start}`, formatNumber(activityBuckets.CDC || 0)],
    [`Modification signals since ${activity.window_start}`, formatNumber(activityBuckets.Modification || 0)],
    [`Other application signals since ${activity.window_start}`, formatNumber(activityBuckets.Other || 0)],
    [`State-significant signals since ${activity.window_start}`, formatNumber(stateSignificantTotal(activity))]
  ]

  return [
    `# ${titleForManifest(options.label, snapshot.manifest)}`,
    '',
    '## As Of',
    '',
    snapshot.manifest.snapshot_date,
    '',
    introForManifest(snapshot.manifest),
    '',
    '## Top 3 Takeaways',
    '',
    ...topTakeaways(precinctRows, siteRows, proposalRows, activity).map((item) => `- ${item}`),
    '',
    '## Priority Precincts',
    '',
    markdownTable(
      ['Rank', 'Precinct', 'Council', 'Rating', 'Policy', 'Timing', 'Risk', 'Recent Apps', 'Pipeline', 'Action'],
      priorityPrecincts.map((row) => [
        row.rank,
        row.precinct_name,
        row.council_name,
        row.opportunity_rating,
        formatNumber(row.policy_score),
        formatNumber(row.timing_score),
        formatNumber(row.friction_score),
        formatNumber(row.recent_application_count),
        formatNumber(row.active_pipeline_count),
        row.recommended_action
      ])
    ),
    '',
    '## Priority Site Shortlist',
    '',
    markdownTable(
      ['Rank', 'Site', 'Search Area', 'Jurisdiction', 'Band', 'Score', 'Zoning', 'FSR', 'Height', 'Lot Area', 'Frontage', 'Action'],
      topSites.map((row) => [
        row.rank,
        row.site_label,
        row.watchlist_bucket_name || row.precinct_name,
        row.apparent_site_jurisdiction || row.council_name,
        row.screening_band,
        formatNumber(row.screening_score),
        row.zoning_code || '-',
        formatNumber(row.fsr, 2),
        formatMeasure(row.height_m, 'm', 1),
        formatMeasure(row.geometry_area_sqm, ' sqm'),
        formatMeasure(row.frontage_candidate_m, ' m', 1),
        row.recommended_site_action
      ])
    ),
    '',
    '## 5 First-Look Site Targets This Week',
    '',
    priorityTargets.length
      ? markdownTable(
          ['Site', 'Search Area', 'Jurisdiction', 'Immediate Triage Step', 'Title Complexity Signal', 'Why It Is On This Week\'s List'],
          priorityTargets.map((row) => [
            row.site_label,
            row.search_area,
            row.jurisdiction,
            row.action,
            row.title_complexity_penalty > 0 ? `Penalty ${formatNumber(row.title_complexity_penalty)}` : 'No current title complexity penalty',
            row.reason
          ])
        )
      : 'No site targets were surfaced for this week\'s priority list.',
    '',
    '## 3 Pre-Assembly Clusters To Validate',
    '',
    assemblyPrecincts.length
      ? markdownTable(
          ['Precinct', 'Search Area', 'Rating', 'Sites In Top Cut', 'Advance Sites', 'Title Complexity Flags', 'Best Score', 'Approx Lot Area', 'Approx Frontage', 'Current Posture', 'Example Sites'],
          assemblyPrecincts.map((row) => [
            row.precinct_name,
            row.search_area,
            row.opportunity_rating,
            formatNumber(row.site_count),
            formatNumber(row.advance_count),
            formatNumber(row.title_complexity_hits),
            formatNumber(row.best_score),
            formatMeasure(row.total_area, ' sqm'),
            formatMeasure(row.frontage_total, ' m', 1),
            row.recommended_action,
            row.sample_sites.join('; ')
          ])
        )
      : 'No multi-site precinct cluster was surfaced in the current top cut.',
    '',
    'These clusters are prioritisation cues from the current top cut, not adjacency-confirmed or ownership-confirmed assembly schemes.',
    '',
    '## Risk Watchlist',
    '',
    riskWatchlist.length
      ? markdownTable(
          ['Precinct', 'Council', 'Risk', 'Constraint Count', 'Recent Apps', 'Pipeline', 'Current Risk Summary'],
          riskWatchlist.map((row) => [
            row.precinct_name,
            row.council_name,
            formatNumber(row.friction_score),
            formatNumber(row.constraint_count),
            formatNumber(row.recent_application_count),
            formatNumber(row.active_pipeline_count),
            row.constraint_summary || '-'
          ])
        )
      : 'No current risk-watchlist rows were surfaced in this snapshot.',
    '',
    '## Policy Pipeline',
    '',
    markdownTable(
      ['Stage', 'Proposal Count', 'Council Count'],
      policyPipeline.map((row) => [
        stageLabel(row.stage),
        formatNumber(row.proposal_count),
        formatNumber(row.council_count)
      ])
    ),
    '',
    '## Development Activity Snapshot',
    '',
    `These are cumulative activity counts within the retained application window starting on \`${activity.window_start}\`. Application rows below are shown as mutually exclusive DA / CDC / Modification / Other buckets so the customer-facing totals stay internally consistent. State-significant signals are shown separately because they do not sit inside the same application bucket stack. Use the dated delta report for week-over-week net-new change.`,
    '',
    markdownTable(['Metric', 'Value'], activityMetrics),
    '',
    markdownTable(
      ['Application Type', 'Count'],
      activity.type_mix_rows.filter((row) => row.application_bucket !== 'SSD').map((row) => [row.application_bucket, formatNumber(row.count)])
    ),
    '',
    '## Proposal Watchlist',
    '',
    proposalWatchlist.length
      ? markdownTable(
          ['Stage', 'Council', 'Precinct', 'Title', 'Location'],
          proposalWatchlist.map((row) => [
            stageLabel(row.stage),
            row.council_name || '-',
            row.precinct_name || '-',
            row.title,
            row.location_text || '-'
          ])
        )
      : 'No current active proposal-watchlist rows are available in this snapshot.',
    '',
    '## Recommended Actions This Week',
    '',
    ...(actions.length ? actions.map((item, index) => `${index + 1}. ${item}`) : ['No action-tier change is asserted in this baseline because it is reconstructed from partial retained history rather than a formally captured weekly decision snapshot.']),
    '',
    '## Method Notes',
    '',
    ...methodNotes.map((item) => `- ${item}`),
    '',
    '## Boundaries',
    '',
    ...boundariesForManifest(snapshot.manifest).map((item) => `- ${item}`),
    ''
  ].join('\n')
}

async function main() {
  const options = parseArgs()
  const snapshot = loadSnapshotSet(options.snapshotDate)
  validateSnapshot(snapshot, options)

  const markdown = buildMarkdown(options, snapshot)

  const reportsDir = path.join(root, 'reports')
  fs.mkdirSync(reportsDir, { recursive: true })
  const outputPath = options.outputPath
    ? path.resolve(root, options.outputPath)
    : path.join(reportsDir, `full-report-${options.snapshotDate}.md`)
  fs.writeFileSync(outputPath, `${markdown}\n`, 'utf8')
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
