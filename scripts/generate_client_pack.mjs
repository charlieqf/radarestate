import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()

function runNodeScript(relativeScript, args = []) {
  execFileSync(process.execPath, [path.join(root, relativeScript), ...args], {
    cwd: root,
    stdio: 'inherit'
  })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    regionGroup: 'Greater Sydney',
    label: 'Sydney',
    slug: 'latest',
    snapshotDate: new Date().toISOString().slice(0, 10),
    previousSnapshotDate: null,
    dashboardPath: null,
    radarPath: null
  }

  for (const arg of args) {
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--slug=')) options.slug = arg.split('=')[1].trim()
    if (arg.startsWith('--snapshot-date=')) options.snapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--previous-snapshot-date=')) options.previousSnapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--dashboard-path=')) options.dashboardPath = arg.split('=')[1].trim()
    if (arg.startsWith('--radar-path=')) options.radarPath = arg.split('=')[1].trim()
  }

  return options
}

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function listFiles(dirPath, matcher) {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath)
    .filter((name) => matcher(name))
    .sort()
    .map((name) => path.join(dirPath, name))
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function firstExisting(relativePaths) {
  for (const filePath of relativePaths) {
    if (exists(filePath)) return filePath
  }
  return null
}

function coverageReadinessPath(options) {
  if (options.regionGroup === 'Greater Sydney') {
    return firstExisting([
      'reports/coverage-readiness-greater-sydney-expanded.md',
      'reports/coverage-readiness-sydney-core-plus.md'
    ])
  }
  if (options.regionGroup === 'Hunter') {
    return firstExisting(['reports/coverage-readiness-newcastle-hunter-pilot.md'])
  }
  return null
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function extractBulletValue(markdown, prefix) {
  const line = markdown.split(/\r?\n/).find((entry) => entry.startsWith(prefix))
  return line ? line.slice(prefix.length).trim() : null
}

function collectDeepDives(slug, snapshotDate) {
  const reportsDir = path.join(root, 'reports')
  if (snapshotDate) {
    const dated = listFiles(reportsDir, (name) => /^deep-dive-.*\.md$/i.test(name) && name.endsWith(`-${snapshotDate}.md`))
    if (dated.length) return dated.map(rel)
  }
  if (slug === 'latest') {
    return listFiles(reportsDir, (name) => name.startsWith('deep-dive-') && name.endsWith('.md')).map(rel)
  }
  return listFiles(reportsDir, (name) => name.startsWith(`deep-dive-${slugify(slug)}-`) && name.endsWith('.md')).map(rel)
}

function collectSiteCards(slug, snapshotDate) {
  const reportsDir = path.join(root, 'reports')
  if (snapshotDate) {
    const dated = listFiles(reportsDir, (name) => name.startsWith(`site-card-${slugify(snapshotDate)}-`) && name.endsWith('.md')).map(rel)
    if (dated.length) return dated
  }
  if (slug === 'latest') {
    return listFiles(reportsDir, (name) => name.startsWith('site-card-latest-') && name.endsWith('.md')).map(rel)
  }
  return listFiles(reportsDir, (name) => name.startsWith(`site-card-${slugify(slug)}-`) && name.endsWith('.md')).map(rel)
}

function buildHighlights(fullReportPath, deltaReportPath) {
  const highlights = []
  if (fullReportPath && exists(fullReportPath)) {
    const fullReport = readFile(fullReportPath)
    const takeaway1 = extractBulletValue(fullReport, '- ')
    if (takeaway1) highlights.push(`- Full report lead takeaway: ${takeaway1}`)
  }
  if (deltaReportPath && exists(deltaReportPath)) {
    const deltaReport = readFile(deltaReportPath)
    const line = deltaReport.split(/\r?\n/).find((entry) => entry.startsWith('Comparison window:'))
    if (line) highlights.push(`- Delta report summary: ${line.replace('Comparison window:', '').trim()}`)
  }
  return highlights
}

function bullet(label, filePath) {
  return filePath ? `- ${label}: \`${filePath}\`` : null
}

async function main() {
  const options = parseArgs()
  const dashboardPath = options.dashboardPath || firstExisting([
    `dashboard/${options.snapshotDate}-report.html`,
    options.slug === 'latest' ? 'dashboard/latest-report.html' : `dashboard/${options.slug}-report.html`
  ])
  const radarPath = options.radarPath || firstExisting([
    `reports/weekly-radar-${options.snapshotDate}.md`,
    options.slug === 'latest' ? 'reports/weekly-radar-latest.md' : `reports/weekly-radar-${options.slug}.md`
  ])
  const heroPath = firstExisting(['dashboard/hero-visual-pack.html'])
  const insightsPath = firstExisting(['reports/top-10-insights-latest.md'])
  const siteReportPath = firstExisting([
    `reports/top-site-screening-${options.snapshotDate}.md`,
    options.slug === 'latest' ? 'reports/top-site-screening-latest.md' : `reports/top-site-screening-${options.slug}.md`
  ])
  const methodologyPath = options.regionGroup === 'Greater Sydney'
    ? firstExisting(['reports/methodology-appendix.md'])
    : null
  const readinessPath = coverageReadinessPath(options)
  const fullReportPath = firstExisting([
    `reports/full-report-${options.snapshotDate}.md`,
    `reports/reconstructed-baseline-${options.snapshotDate}.md`
  ])
  const deltaReportPath = options.previousSnapshotDate
    ? firstExisting([`reports/delta-report-${options.snapshotDate}-vs-${options.previousSnapshotDate}.md`])
    : null
  const siteCardFiles = collectSiteCards(options.slug, options.snapshotDate)
  const deepDiveFiles = collectDeepDives(options.slug, options.snapshotDate)

  const coreDeliverables = [
    bullet('Weekly Full Report', fullReportPath),
    bullet('Weekly Delta Report', deltaReportPath)
  ].filter(Boolean)
  const actionDeliverables = [
    bullet('Weekly Priority Brief', insightsPath),
    bullet('Priority Site Screening', siteReportPath)
  ].filter(Boolean)
  const visualDeliverables = [
    bullet('Visual Summary', heroPath),
    bullet('Opportunity Map', dashboardPath),
    bullet('Market Context Radar', radarPath),
    bullet('Coverage Readiness', readinessPath),
    bullet('Methodology And Boundaries', methodologyPath)
  ].filter(Boolean)

  const fiveStepPath = [
    fullReportPath ? `1. Read \`${fullReportPath}\` first for the current-week conclusion and the complete dated point-in-time view.` : null,
    deltaReportPath ? `2. Read \`${deltaReportPath}\` second for what changed since the prior comparison point.` : null,
    (insightsPath || siteReportPath)
      ? `3. Use ${[insightsPath ? `\`${insightsPath}\`` : null, siteReportPath ? `\`${siteReportPath}\`` : null].filter(Boolean).join(' and ')} for this week's actions, follow-up targets, and screening priorities.`
      : null,
    (siteCardFiles.length || deepDiveFiles.length)
      ? `4. Use ${siteCardFiles.length ? 'the site cards' : ''}${siteCardFiles.length && deepDiveFiles.length ? ' and ' : ''}${deepDiveFiles.length ? 'the precinct deep dives' : ''} only as supporting evidence once a target has already made the shortlist.`
      : null,
    [heroPath, dashboardPath, radarPath, methodologyPath].some(Boolean)
      ? `5. Leave the visual summary and methodology layer until last: ${[heroPath ? `\`${heroPath}\`` : null, dashboardPath ? `\`${dashboardPath}\`` : null, radarPath ? `\`${radarPath}\`` : null, methodologyPath ? `\`${methodologyPath}\`` : null].filter(Boolean).join(', ')}.`
      : null
  ].filter(Boolean)

  const highlights = buildHighlights(fullReportPath, deltaReportPath)
  const markdown = [
    `# ${options.label} Client Pack`,
    '',
    '## Date',
    '',
    options.snapshotDate,
    '',
    '## 5-Step Reading Path',
    '',
    ...fiveStepPath,
    '',
    '## Deliverables By Use',
    '',
    '### 01 Core',
    '',
    ...coreDeliverables,
    '',
    '### 02 This Week\'s Actions',
    '',
    ...actionDeliverables,
    '',
    '### 03 Site Cards',
    '',
    ...(siteCardFiles.length ? siteCardFiles.map((file) => `- \`${file}\``) : ['- No dated site cards included in this pack.']),
    '',
    '### 04 Precinct Deep Dives',
    '',
    ...(deepDiveFiles.length ? deepDiveFiles.map((file) => `- \`${file}\``) : ['- No dated precinct deep dives included in this pack.']),
    '',
    '### 05 Visual Summary And Method',
    '',
    ...visualDeliverables,
    '',
    '## This Pack Highlights',
    '',
    ...(fullReportPath ? [`- Dated full report: \`${fullReportPath}\``] : []),
    ...(deltaReportPath ? [`- Dated delta report: \`${deltaReportPath}\``] : []),
    ...(readinessPath ? [`- Coverage readiness memo: \`${readinessPath}\``] : []),
    ...(methodologyPath ? [`- Methodology appendix: \`${methodologyPath}\``] : []),
    ...highlights,
    '',
    '## Notes',
    '',
    '- This client pack is now a lightweight assembly layer. It does not regenerate reports; it aggregates already-produced dated outputs.',
    '- The dated full report is the primary entry point. The dated delta report should be read second.',
    '- `reports/` remains the source text layer, but the customer-facing bundle should be navigated from the HTML portal first.',
    '- Files that still contain `latest` in their internal file name are current-cycle supporting memos aligned to the dated snapshot above; they are not a separate competing reporting cycle.',
    ''
  ].join('\n')

  const reportsDir = path.join(root, 'reports')
  fs.mkdirSync(reportsDir, { recursive: true })
  const fileName = options.slug === 'latest' ? 'client-pack-latest.md' : `client-pack-${options.slug}.md`
  const outPath = path.join(reportsDir, fileName)
  fs.writeFileSync(outPath, `${markdown}\n`, 'utf8')
  console.log(`Wrote ${outPath}`)

  runNodeScript('scripts/render_client_reports.mjs')
  const exportArgs = [`--date=${options.snapshotDate.replace(/-/g, '')}`, `--snapshot-date=${options.snapshotDate}`]
  if (options.previousSnapshotDate) exportArgs.push(`--previous-snapshot-date=${options.previousSnapshotDate}`)
  runNodeScript('scripts/export_delivery_bundle.mjs', exportArgs)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
