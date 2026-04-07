import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    snapshotDate: null,
    reportsDir: path.join(root, 'reports')
  }

  for (const arg of args) {
    if (arg.startsWith('--snapshot-date=')) options.snapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--reports-dir=')) options.reportsDir = path.resolve(root, arg.split('=')[1].trim())
  }

  if (!options.snapshotDate || !/^\d{4}-\d{2}-\d{2}$/.test(options.snapshotDate)) {
    throw new Error('validate_development_report_consistency requires --snapshot-date=YYYY-MM-DD')
  }

  return options
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(readText(filePath))
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractSection(markdown, heading) {
  const regex = new RegExp(`^## ${escapeRegex(heading)}\\r?\\n([\\s\\S]*?)(?=^## |\\Z)`, 'm')
  const match = markdown.match(regex)
  if (!match) throw new Error(`Section not found: ${heading}`)
  return match[1].trim()
}

function extractFirstTable(sectionText) {
  const lines = sectionText.split(/\r?\n/)
  const tableLines = []
  let inTable = false

  for (const line of lines) {
    if (/^\|/.test(line.trim())) {
      tableLines.push(line.trim())
      inTable = true
      continue
    }
    if (inTable) break
  }

  if (tableLines.length < 2) throw new Error('Expected markdown table was not found')
  return tableLines.join('\n')
}

function tryExtractFirstTable(sectionText) {
  try {
    return extractFirstTable(sectionText)
  } catch {
    return null
  }
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|\s*/, '')
    .replace(/\s*\|$/, '')
    .split(/\s*\|\s*/)
}

function parseMarkdownTable(tableText) {
  const lines = tableText.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('Markdown table is too short to parse')
  const headers = splitMarkdownRow(lines[0])
  const rows = lines.slice(2).map((line) => splitMarkdownRow(line))
  return { headers, rows }
}

function numberFromText(value) {
  const matches = String(value || '').match(/-?\d[\d,]*/g)
  if (!matches || !matches.length) return null
  return Number(matches[matches.length - 1].replace(/,/g, ''))
}

function constraintTypeLabel(value) {
  const labels = {
    flood_metadata_signal: 'flood',
    bushfire_spatial_sample: 'bushfire',
    heat_vulnerability_proxy: 'heat',
    low_tree_canopy_proxy: 'tree canopy',
    biodiversity_spatial_sample: 'biodiversity',
    policy_withdrawal_friction: 'policy withdrawal'
  }
  return labels[value] || value
}

function extractRiskLabelsFromSummary(summary) {
  return String(summary || '')
    .split(',')
    .map((part) => part.trim().replace(/\s*\(.*?\)\s*$/, ''))
    .filter(Boolean)
    .map((value) => constraintTypeLabel(value))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function compareRankedPrecincts(name, expectedRows, actualRows, limit = 10) {
  const expected = expectedRows.slice(0, limit).map((row) => row.precinct_name)
  const actual = actualRows.slice(0, limit).map((row) => row[1])
  assert(actual.length >= Math.min(limit, expected.length), `${name}: not enough ranked rows to validate`)

  for (let index = 0; index < Math.min(expected.length, actual.length, limit); index += 1) {
    assert(
      expected[index] === actual[index],
      `${name}: rank ${index + 1} mismatch. Expected ${expected[index]}, received ${actual[index]}`
    )
  }
}

function metricMapFromTable(rows) {
  return new Map(rows.map((row) => [row[0], row[1]]))
}

function validateRankConsistency(snapshot, fullReport, weeklyRadar, coverageReport) {
  const snapshotRows = snapshot.rows
  const fullRows = parseMarkdownTable(extractFirstTable(extractSection(fullReport, 'Priority Precincts'))).rows
  const radarRows = parseMarkdownTable(extractFirstTable(extractSection(weeklyRadar, 'Top Precinct Hotlist'))).rows
  const coverageRows = parseMarkdownTable(extractFirstTable(extractSection(coverageReport, 'Shortlist And Report Stability'))).rows

  compareRankedPrecincts('Full report priority precincts', snapshotRows, fullRows)
  compareRankedPrecincts('Weekly radar top precinct hotlist', snapshotRows, radarRows)
  compareRankedPrecincts('Coverage readiness shortlist', snapshotRows, coverageRows)
}

function validateTotals(activitySnapshot, fullReport, weeklyRadar) {
  const typeMixTotal = (activitySnapshot.type_mix_rows || []).reduce((sum, row) => sum + Number(row.count || 0), 0)
  const applicationTotal = (activitySnapshot.type_mix_rows || [])
    .filter((row) => row.application_bucket !== 'SSD')
    .reduce((sum, row) => sum + Number(row.count || 0), 0)
  const ssdTotal = Number((activitySnapshot.type_mix_rows || []).find((row) => row.application_bucket === 'SSD')?.count || 0)

  const fullMetrics = metricMapFromTable(parseMarkdownTable(extractFirstTable(extractSection(fullReport, 'Development Activity Snapshot'))).rows)
  const fullApplicationSignals = numberFromText([...fullMetrics.entries()].find(([key]) => key.startsWith('Application signals since '))?.[1])
  const fullStateSignificant = numberFromText([...fullMetrics.entries()].find(([key]) => key.startsWith('State-significant signals since '))?.[1])
  const weeklySnapshotLines = extractSection(weeklyRadar, 'Snapshot').split(/\r?\n/).map((line) => line.trim())
  const weeklyTotalLine = weeklySnapshotLines.find((line) => line.startsWith('- Total signals tracked'))
  const weeklyTotalSignals = numberFromText(weeklyTotalLine)

  assert(fullApplicationSignals === applicationTotal, `Full report application total mismatch. Expected ${applicationTotal}, received ${fullApplicationSignals}`)
  assert(fullStateSignificant === ssdTotal, `Full report SSD total mismatch. Expected ${ssdTotal}, received ${fullStateSignificant}`)
  assert(weeklyTotalSignals === typeMixTotal, `Weekly radar total signals mismatch. Expected ${typeMixTotal}, received ${weeklyTotalSignals}`)
  assert(fullApplicationSignals + fullStateSignificant === weeklyTotalSignals, 'Full report and weekly radar totals do not reconcile')
}

function validateRiskNarrative(weeklyRadar) {
  const headlineSection = extractSection(weeklyRadar, 'Headline')
  const headlineLine = headlineSection.split(/\r?\n/).find((line) => line.trim()) || ''
  const frictionRows = parseMarkdownTable(extractFirstTable(extractSection(weeklyRadar, 'Highest Friction Precincts'))).rows.slice(0, 2)
  const supportedLabels = new Set(frictionRows.flatMap((row) => extractRiskLabelsFromSummary(row[5])))
  const mentionedLabels = [
    ['flood', /\bflood\b/i],
    ['bushfire', /\bbushfire\b/i],
    ['heat', /\bheat\b/i],
    ['tree canopy', /tree[- ]canopy/i],
    ['biodiversity', /\bbiodiversity\b/i],
    ['policy withdrawal', /policy withdrawal/i]
  ].filter(([, regex]) => regex.test(headlineLine)).map(([label]) => label)

  for (const label of mentionedLabels) {
    assert(
      supportedLabels.has(label),
      `Weekly radar headline mentions ${label}, but that risk is not present in the top constrained precinct rows`
    )
  }
}

function parseBulletValue(markdown, label) {
  const regex = new RegExp(`^- ${escapeRegex(label)}: \\*\\*(.+)\\*\\*$`, 'm')
  const match = markdown.match(regex)
  return match ? match[1].trim() : null
}

function validateSiteCards(reportsDir, snapshotDate) {
  const fileNames = fs.readdirSync(reportsDir).filter((name) => name.startsWith(`site-card-${snapshotDate}-`) && name.endsWith('.md'))
  assert(fileNames.length > 0, 'No dated site cards found for validation')

  for (const fileName of fileNames) {
    const markdown = readText(path.join(reportsDir, fileName))
    const precinctContext = parseBulletValue(markdown, 'Precinct-level council context')
    const parcelJurisdiction = parseBulletValue(markdown, 'Parcel governing jurisdiction from EPI')
    const alignment = parseBulletValue(markdown, 'Jurisdiction alignment')
    if (!precinctContext || !parcelJurisdiction) continue
    assert(precinctContext === parcelJurisdiction, `${fileName}: precinct context (${precinctContext}) and parcel jurisdiction (${parcelJurisdiction}) must not diverge in the dated pack`)
    assert(!alignment || !/Split/i.test(alignment), `${fileName}: split-jurisdiction warnings should not appear in the dated pack`)
  }
}

function validateDeepDives(reportsDir, snapshotDate) {
  const fileNames = fs.readdirSync(reportsDir).filter((name) => name.startsWith('deep-dive-') && name.endsWith(`-${snapshotDate}.md`))
  assert(fileNames.length > 0, 'No dated deep dives found for validation')

  for (const fileName of fileNames) {
    const markdown = readText(path.join(reportsDir, fileName))
    const councilMatch = markdown.match(/^- Precinct council context: `(.+)`$/m)
    if (!councilMatch) continue
    const precinctContext = councilMatch[1].trim()
    const parcelSection = extractSection(markdown, 'Parcel-Level Planning Signals')
    const tableText = tryExtractFirstTable(parcelSection)
    if (!tableText) continue
    const table = parseMarkdownTable(tableText)
    const jurisdictionIndex = table.headers.indexOf('Jurisdiction')
    if (jurisdictionIndex === -1) continue

    const mismatchedRows = table.rows.filter((row) => (row[jurisdictionIndex] || '').trim() && (row[jurisdictionIndex] || '').trim() !== precinctContext)
    assert(!mismatchedRows.length, `${fileName}: representative parcel jurisdiction must align with precinct context in the dated pack`)
  }
}

function validateFullReportScopeNotes(fullReport) {
  assert(
    /watchlist-level council groupings/i.test(fullReport),
    'Full report is missing the precinct scope note that distinguishes watchlist grouping from parcel jurisdiction'
  )
  assert(
    /parcel-level governing planning jurisdiction/i.test(fullReport),
    'Full report is missing the site shortlist jurisdiction scope note'
  )
}

function validateBundleCopies(snapshotDate) {
  const datedSlug = snapshotDate.replace(/-/g, '')
  const bundleRoots = [
    path.join(root, 'delivery-bundles', 'latest', 'DevelopmentReport', 'reports'),
    path.join(root, 'delivery-bundles', 'weekly', datedSlug, 'DevelopmentReport', 'reports'),
    path.join(root, 'delivery-bundles', 'latest', 'RadarReport', 'reports'),
    path.join(root, 'delivery-bundles', 'weekly', datedSlug, 'RadarReport', 'reports')
  ].filter((dirPath) => fs.existsSync(dirPath))

  for (const bundleDir of bundleRoots) {
    const criticalFiles = [
      `full-report-${snapshotDate}.md`,
      `weekly-radar-${snapshotDate}.md`,
      `top-site-screening-${snapshotDate}.md`,
      'coverage-readiness-greater-sydney-expanded.md',
      'methodology-appendix.md',
      'top-10-insights-latest.md'
    ]

    for (const fileName of criticalFiles) {
      const sourcePath = path.join(root, 'reports', fileName)
      const bundlePath = path.join(bundleDir, fileName)
      if (!fs.existsSync(sourcePath) || !fs.existsSync(bundlePath)) continue
      assert(
        readText(sourcePath) === readText(bundlePath),
        `Bundle copy is stale for ${path.relative(root, bundlePath).replace(/\\/g, '/')}`
      )
    }
  }
}

function main() {
  const options = parseArgs()
  const snapshotDir = path.join(root, 'snapshots', 'weekly', options.snapshotDate)
  const precinctSnapshot = readJson(path.join(snapshotDir, 'precinct-shortlist.json'))
  const activitySnapshot = readJson(path.join(snapshotDir, 'activity.json'))

  const fullReport = readText(path.join(options.reportsDir, `full-report-${options.snapshotDate}.md`))
  const weeklyRadar = readText(path.join(options.reportsDir, `weekly-radar-${options.snapshotDate}.md`))
  const coverageReport = readText(path.join(options.reportsDir, 'coverage-readiness-greater-sydney-expanded.md'))

  validateRankConsistency(precinctSnapshot, fullReport, weeklyRadar, coverageReport)
  validateTotals(activitySnapshot, fullReport, weeklyRadar)
  validateRiskNarrative(weeklyRadar)
  validateSiteCards(options.reportsDir, options.snapshotDate)
  validateDeepDives(options.reportsDir, options.snapshotDate)
  validateFullReportScopeNotes(fullReport)
  validateBundleCopies(options.snapshotDate)

  console.log(`Development report consistency checks passed for ${options.snapshotDate}`)
}

main()
