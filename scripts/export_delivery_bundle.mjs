import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const bundleRoot = path.join(root, 'delivery-bundles')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    snapshotDate: new Date().toISOString().slice(0, 10),
    previousSnapshotDate: null
  }
  for (const arg of args) {
    if (arg.startsWith('--date=')) options.date = arg.split('=')[1].trim()
    if (arg.startsWith('--snapshot-date=')) options.snapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--previous-snapshot-date=')) options.previousSnapshotDate = arg.split('=')[1].trim()
  }
  return options
}

function removeDirIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}

function clearDir(dirPath) {
  if (!fs.existsSync(dirPath)) return
  for (const entry of fs.readdirSync(dirPath)) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true })
  }
}

function copyDir(sourceDir, targetDir) {
  ensureDir(path.dirname(targetDir))
  fs.cpSync(sourceDir, targetDir, { recursive: true })
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf8')
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(readFile(filePath))
}

function listFilesRecursive(dirPath, prefix = '') {
  if (!fs.existsSync(dirPath)) return []
  const entries = []
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      entries.push(...listFilesRecursive(path.join(dirPath, entry.name), relativePath))
    } else {
      entries.push(relativePath)
    }
  }
  return entries
}

function extractPathsFromPack(reportPath) {
  if (!fs.existsSync(reportPath)) return []
  const markdown = readFile(reportPath)
  const matches = [...markdown.matchAll(/(?:reports|dashboard)\/[A-Za-z0-9._\/-]+\.(?:md|html)/g)]
  return [...new Set(matches.map((match) => match[0].replace(/\\/g, '/')))]
}

function markdownReportToClientHtml(relativePath) {
  if (!relativePath.startsWith('reports/') || !relativePath.endsWith('.md')) return null
  return `client-output/${path.basename(relativePath).replace(/\.md$/i, '.html')}`
}

function extractMarkdownTitle(relativePath, fallback = null) {
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) return fallback || path.basename(relativePath)
  const markdown = readFile(absolutePath)
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback || path.basename(relativePath)
}

function customerFacingTitle(relativePath, fallback = null) {
  return extractMarkdownTitle(relativePath, fallback)
    .replace(/^Site Card:\s*/i, '')
    .replace(/^Deep Dive:\s*/i, '')
    .trim()
}

function htmlNameFromReport(relativePath) {
  return path.basename(relativePath).replace(/\.md$/i, '.html')
}

function snapshotPriorityMap(snapshotDate, fileName, fieldName) {
  const filePath = path.join(root, 'snapshots', 'weekly', snapshotDate, fileName)
  if (!fs.existsSync(filePath)) return new Map()
  const data = readJson(filePath)
  return new Map((data.rows || []).map((row, index) => [String(row[fieldName] || '').trim(), Number(row.rank || index + 1)]))
}

function rankValue(map, key) {
  return map.get(String(key || '').trim()) || Number.MAX_SAFE_INTEGER
}

function moveDevelopmentHtmlIntoSourceLayer(baseDir) {
  const clientOutputDir = path.join(baseDir, 'client-output')
  const sourceDir = path.join(clientOutputDir, '_source-html')
  ensureDir(sourceDir)
  const moved = []

  for (const entry of fs.readdirSync(clientOutputDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html') || entry.name === 'index.html') continue
    const sourcePath = path.join(clientOutputDir, entry.name)
    const targetPath = path.join(sourceDir, entry.name)
    const content = readFile(sourcePath)
      .replace(/href="\.\.\/dashboard\//g, 'href="../../dashboard/')
      .replace(/src="\.\.\/dashboard\//g, 'src="../../dashboard/')
    writeFile(targetPath, content)
    removeFileIfExists(sourcePath)
    moved.push(entry.name)
  }

  return moved
}

function groupDirForSourceFile(fileName) {
  if (/^full-report-.*\.html$/i.test(fileName) || /^delta-report-.*\.html$/i.test(fileName) || /^client-pack-.*\.html$/i.test(fileName)) return '01-core'
  if (/^top-10-insights-.*\.html$/i.test(fileName) || /^top-site-screening-.*\.html$/i.test(fileName)) return '02-this-weeks-actions'
  if (/^site-card-.*\.html$/i.test(fileName)) return '03-site-cards'
  if (/^deep-dive-.*\.html$/i.test(fileName)) return '04-precinct-deep-dives'
  return '05-visual-summary'
}

function developmentSourceSidebarHtml(groups, fileName) {
  const currentDir = groupDirForSourceFile(fileName)
  const navLinks = groups.map((group) => {
    const active = group.dirName === currentDir ? 'nav-link active' : 'nav-link'
    return `<a class="${active}" href="../${group.dirName}/index.html"><span class="nav-title">${group.title.replace(/^\d+\s+/, '')}</span><span class="nav-meta">${group.summary}</span></a>`
  }).join('')

  return `<div class="actions">
        <a class="action-link" href="../index.html">Back to Development Client Portal</a>
        <a class="action-link" href="../02-this-weeks-actions/index.html">Open This Week's Actions</a>
        <a class="action-link" href="../05-visual-summary/index.html">Open Visual Summary</a>
      </div>
      <nav class="nav"><section class="nav-group"><div class="nav-heading">Grouped Navigation</div><div class="nav-group-links">${navLinks}</div></section></nav>`
}

function rewriteDevelopmentSourceHtml(content, snapshotDate, fileName, groups) {
  let output = content

  output = output.replace(
    /<div class="actions">[\s\S]*?<\/nav>/,
    developmentSourceSidebarHtml(groups, fileName)
  )

  output = output.replace(
    '<p>Styled HTML delivery layer for weekly radar, deep dives and client pack notes.</p>',
    '<p>Customer detail page inside the grouped DevelopmentReport bundle.</p>'
  )

  output = output
    .replace(/href="reports\/([^"]+)\.md"/g, 'href="$1.html"')
    .replace(/href="\.\.\/\.\.\/dashboard\/latest-report\.html"/g, `href="../../dashboard/${snapshotDate}-report.html"`)
    .replace(/href="\.\.\/dashboard\/latest-report\.html"/g, `href="../../dashboard/${snapshotDate}-report.html"`)
    .replace(/href="dashboard\/hero-visual-pack\.html"/g, 'href="hero-visual-pack.html"')
    .replace(/<h2>5 First-Look Site Targets This Week<\/h2>/g, '<h2 id="first-look-site-targets">5 First-Look Site Targets This Week</h2>')
    .replace(/<h2>3 Pre-Assembly Clusters To Validate<\/h2>/g, '<h2 id="pre-assembly-clusters-to-validate">3 Pre-Assembly Clusters To Validate</h2>')
    .replace(/<h2>Week Of \d{4}-\d{2}-\d{2}<\/h2>/g, `<h2>Week Of ${snapshotDate}</h2>`)
    .replace(/Companion visual dashboard:\s*<a href="([^"]+)"><code>dashboard\/[\s\S]*?<\/code><\/a>/g, 'Companion opportunity map: <a href="$1">Open Opportunity Map</a>')
    .replace(/Use <a href="([^"]+)"><code>dashboard\/[\s\S]*?<\/code><\/a> to visually inspect clusters before writing the next deep-dive memo\./g, 'Use the <a href="$1">Opportunity Map</a> to visually inspect clusters before writing the next precinct note.')
    .replace(/Use <a href="([^"]+)"><code>dashboard\/[\s\S]*?<\/code><\/a> to inspect the surrounding precinct cluster before doing any street-level or owner-contact work\./g, 'Use the <a href="$1">Opportunity Map</a> to inspect the surrounding precinct cluster before doing any street-level or owner-contact work.')
    .replace(/<li><a href="([^"]+)"><code>dashboard\/[\s\S]*?<\/code><\/a><\/li>/g, '<li><a href="$1">Opportunity Map</a></li>')
    .replace(/<li><a href="([^"]+)"><code>reports\/weekly-radar-[\s\S]*?<\/code><\/a><\/li>/g, '<li><a href="$1">Market Context Radar</a></li>')

  return output
}

function developmentBundleGroups(snapshotDate, previousSnapshotDate, refs) {
  const siteRanks = snapshotPriorityMap(snapshotDate, 'site-screening.json', 'site_label')
  const precinctRanks = snapshotPriorityMap(snapshotDate, 'precinct-shortlist.json', 'precinct_name')
  const fullReport = refs.find((value) => value === `reports/full-report-${snapshotDate}.md`) || null
  const deltaReport = previousSnapshotDate
    ? refs.find((value) => value === `reports/delta-report-${snapshotDate}-vs-${previousSnapshotDate}.md`) || null
    : null
  const insights = refs.find((value) => /reports\/top-10-insights-.*\.md$/i.test(value)) || null
  const siteScreening = refs.find((value) => /reports\/top-site-screening-.*\.md$/i.test(value)) || null
  const methodology = refs.find((value) => value === 'reports/methodology-appendix.md') || null
  const weeklyRadar = refs.find((value) => /reports\/weekly-radar-.*\.md$/i.test(value)) || null
  const siteCards = refs
    .filter((value) => /^reports\/site-card-.*\.md$/i.test(value))
    .sort((a, b) => {
      const aRank = rankValue(siteRanks, customerFacingTitle(a, path.basename(a)))
      const bRank = rankValue(siteRanks, customerFacingTitle(b, path.basename(b)))
      if (aRank !== bRank) return aRank - bRank
      return customerFacingTitle(a, path.basename(a)).localeCompare(customerFacingTitle(b, path.basename(b)))
    })
  const deepDives = refs
    .filter((value) => /^reports\/deep-dive-.*\.md$/i.test(value))
    .sort((a, b) => {
      const aRank = rankValue(precinctRanks, customerFacingTitle(a, path.basename(a)))
      const bRank = rankValue(precinctRanks, customerFacingTitle(b, path.basename(b)))
      if (aRank !== bRank) return aRank - bRank
      return customerFacingTitle(a, path.basename(a)).localeCompare(customerFacingTitle(b, path.basename(b)))
    })

  return [
    {
      dirName: '01-core',
      title: '01 Core',
      summary: 'Start here. These are the two files that should be read first in every weekly cycle.',
      items: [
        fullReport ? {
          title: 'Weekly Full Report',
          href: `../_source-html/${htmlNameFromReport(fullReport)}`,
          description: 'Current-week conclusion and complete point-in-time view.'
        } : null,
        deltaReport ? {
          title: 'Weekly Delta Report',
          href: `../_source-html/${htmlNameFromReport(deltaReport)}`,
          description: 'What changed since the prior comparison point.'
        } : null
      ].filter(Boolean)
    },
    {
      dirName: '02-this-weeks-actions',
      title: "02 This Week's Actions",
      summary: 'Use this folder to move from conclusions into immediate follow-up work.',
      items: [
        fullReport ? {
          title: 'First-Look Site Targets',
          href: `../_source-html/${htmlNameFromReport(fullReport)}#first-look-site-targets`,
          description: 'Open the full report and go to the 5 First-Look Site Targets section.'
        } : null,
        fullReport ? {
          title: 'Pre-Assembly Clusters To Validate',
          href: `../_source-html/${htmlNameFromReport(fullReport)}#pre-assembly-clusters-to-validate`,
          description: 'Open the full report and go to the 3 Pre-Assembly Clusters To Validate section.'
        } : null,
        insights ? {
          title: 'Weekly Priority Brief',
          href: `../_source-html/${htmlNameFromReport(insights)}`,
          description: 'Short narrative summary of this week\'s main implications.'
        } : null,
        siteScreening ? {
          title: 'Priority Site Screening',
          href: `../_source-html/${htmlNameFromReport(siteScreening)}`,
          description: 'Current lot-level shortlist for follow-up review.'
        } : null
      ].filter(Boolean)
    },
    {
      dirName: '03-site-cards',
      title: '03 Site Cards',
      summary: 'Detailed lot-level follow-up material for the shortlisted sites.',
      items: siteCards.map((value) => ({
        title: customerFacingTitle(value, path.basename(value)),
        href: `../_source-html/${htmlNameFromReport(value)}`,
        description: 'Detailed site card.'
      }))
    },
    {
      dirName: '04-precinct-deep-dives',
      title: '04 Precinct Deep Dives',
      summary: 'Supporting precinct evidence once a location is already in active review.',
      items: deepDives.map((value) => ({
        title: customerFacingTitle(value, path.basename(value)),
        href: `../_source-html/${htmlNameFromReport(value)}`,
        description: 'Precinct-level supporting evidence.'
      }))
    },
    {
      dirName: '05-visual-summary',
      title: '05 Visual Summary And Methodology',
      summary: 'Visual context and methodology for customers who want maps, broader pattern recognition, or scoring boundaries.',
      items: [
        {
          title: 'Visual Summary',
          href: '../_source-html/hero-visual-pack.html',
          description: 'Fast visual read of opportunity versus risk.'
        },
        {
          title: 'Opportunity Map',
          href: `../../dashboard/${snapshotDate}-report.html`,
          description: 'Broader visual map and chart view for the current cycle.'
        },
        weeklyRadar ? {
          title: 'Market Context Radar',
          href: `../_source-html/${htmlNameFromReport(weeklyRadar)}`,
          description: 'Broader precinct and market interpretation.'
        } : null,
        methodology ? {
          title: 'Methodology And Boundaries',
          href: `../_source-html/${htmlNameFromReport(methodology)}`,
          description: 'Scoring logic, comparability notes, and data boundaries.'
        } : null
      ].filter(Boolean)
    }
  ]
}

function developmentGroupIndexHtml(group, generatedAt) {
  const itemsHtml = group.items.map((item) => `
      <a class="item" href="${item.href}">
        <span class="item-title">${item.title}</span>
        <span class="item-meta">${item.description}</span>
      </a>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${group.title}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 28px; background: #0b1020; color: #e9eefc; }
    .card { max-width: 920px; margin: 0 auto; background: #121932; border: 1px solid #273154; border-radius: 20px; padding: 24px; }
    a { color: #7dd3fc; text-decoration: none; }
    h1 { margin-top: 0; }
    p { color: #92a0c4; line-height: 1.7; }
    .back { display: inline-block; margin-bottom: 16px; color: #7dd3fc; }
    .items { display: grid; gap: 14px; }
    .item { display: block; background: #171f3d; border: 1px solid #273154; border-radius: 14px; padding: 16px; }
    .item-title { display: block; color: #e9eefc; font-weight: 700; margin-bottom: 6px; }
    .item-meta { display: block; color: #92a0c4; line-height: 1.6; }
    .small { margin-top: 18px; font-size: 13px; color: #92a0c4; }
  </style>
</head>
<body>
  <div class="card">
    <a class="back" href="../index.html">Back to Development Client Portal</a>
    <h1>${group.title}</h1>
    <p>${group.summary}</p>
    <div class="items">${itemsHtml}</div>
    <div class="small">Generated: ${generatedAt}</div>
  </div>
</body>
</html>`
}

function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
}

function pruneDirectoryToKeepSet(baseDir, relativeDir, keepSet) {
  const targetDir = path.join(baseDir, relativeDir)
  if (!fs.existsSync(targetDir)) return
  for (const relativePath of listFilesRecursive(targetDir, relativeDir)) {
    if (!keepSet.has(relativePath.replace(/\\/g, '/'))) {
      removeFileIfExists(path.join(baseDir, relativePath))
    }
  }
}

function removeEmptyDirectories(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(path.join(dirPath, entry.name))
  }
  if (!fs.readdirSync(dirPath).length) fs.rmdirSync(dirPath)
}

function developmentPortalHtml(generatedAt, groups) {
  const stepsHtml = groups.map((group) => `
      <section class="panel">
        <div class="eyebrow">${group.title.split(' ')[0]}</div>
        <h2>${group.title.replace(/^\d+\s+/, '')}</h2>
        <p>${group.summary}</p>
        <a class="jump" href="${group.dirName}/index.html">Open ${group.title.replace(/^\d+\s+/, '')}</a>
      </section>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Development Client Portal</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 28px; background: #0b1020; color: #e9eefc; }
    .card { max-width: 900px; margin: 0 auto; background: #121932; border: 1px solid #273154; border-radius: 20px; padding: 24px; }
    h1,h2 { margin-top: 0; }
    p, li { color: #92a0c4; line-height: 1.7; }
    a { color: #7dd3fc; }
    .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .panel { background: #171f3d; border: 1px solid #273154; border-radius: 16px; padding: 18px; }
    .eyebrow { color: #33d1ff; text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; margin-bottom: 10px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">RadarEstate</div>
    <h1>Development Client Portal</h1>
    <p>Use this folder in order. The client path is now grouped around the decisions a development customer is trying to make, rather than around internal file types.</p>
    <div class="grid">${stepsHtml}</div>
    <p>Generated: ${generatedAt}</p>
  </div>
</body>
</html>`
}

function trimDevelopmentBundle(baseDir, snapshotDate, previousSnapshotDate) {
  const packPath = path.join(root, 'reports', 'client-pack-latest.md')
  const packRefs = extractPathsFromPack(packPath)
  const groups = developmentBundleGroups(snapshotDate, previousSnapshotDate, packRefs)
  const movedHtmlFiles = moveDevelopmentHtmlIntoSourceLayer(baseDir)
  const allowedSourceHtmlFiles = new Set([
    'client-pack-latest.html',
    'hero-visual-pack.html',
    ...packRefs.map((relativePath) => relativePath.startsWith('reports/') ? htmlNameFromReport(relativePath) : null).filter(Boolean)
  ])
  const keepSet = new Set([
    'client-output/index.html',
    ...groups.map((group) => `client-output/${group.dirName}/index.html`),
    ...movedHtmlFiles.filter((fileName) => allowedSourceHtmlFiles.has(fileName)).map((fileName) => `client-output/_source-html/${fileName}`),
    'reports/client-pack-latest.md',
    ...packRefs,
    ...packRefs.filter((relativePath) => relativePath.startsWith('dashboard/'))
  ])

  const generatedAt = new Date().toISOString()
  for (const fileName of movedHtmlFiles.filter((fileName) => allowedSourceHtmlFiles.has(fileName))) {
    const htmlPath = path.join(baseDir, 'client-output', '_source-html', fileName)
    const content = readFile(htmlPath)
    writeFile(htmlPath, rewriteDevelopmentSourceHtml(content, snapshotDate, fileName, groups))
  }
  writeFile(path.join(baseDir, 'client-output', 'index.html'), developmentPortalHtml(generatedAt, groups))
  for (const group of groups) {
    writeFile(path.join(baseDir, 'client-output', group.dirName, 'index.html'), developmentGroupIndexHtml(group, generatedAt))
  }
  pruneDirectoryToKeepSet(baseDir, 'reports', keepSet)
  pruneDirectoryToKeepSet(baseDir, 'dashboard', keepSet)
  pruneDirectoryToKeepSet(baseDir, 'client-output', keepSet)
  for (const dirName of ['reports', 'dashboard', 'client-output']) {
    const dirPath = path.join(baseDir, dirName)
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isDirectory()) removeEmptyDirectories(path.join(dirPath, entry.name))
    }
  }
}

function rootIndexHtml(title, generatedAt) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      --bg: #0b1020;
      --bg-accent: #132048;
      --panel: #121932;
      --text: #e9eefc;
      --muted: #92a0c4;
      --line: #273154;
      --cyan: #33d1ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      background: radial-gradient(circle at top left, var(--bg-accent) 0, var(--bg) 45%);
      color: var(--text);
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(760px, 100%);
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 28px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.18);
    }
    .eyebrow { color: var(--cyan); text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; margin-bottom: 10px; }
    h1 { margin: 0 0 12px; font-size: 34px; line-height: 1.08; }
    p { color: var(--muted); line-height: 1.7; font-size: 15px; margin: 0 0 20px; }
    .actions { display: grid; gap: 12px; }
    .action { display: inline-block; text-decoration: none; color: var(--text); background: #171f3d; border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; font-weight: 700; }
    .small { margin-top: 16px; font-size: 13px; color: var(--muted); }
  </style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">RadarEstate</div>
    <h1>${title}</h1>
    <p>This folder is structured as a formal client delivery package. Both report folders now share the same top-level structure and navigation model.</p>
    <div class="actions">
      <a class="action" href="RadarReport/index.html">Open RadarReport</a>
      <a class="action" href="DevelopmentReport/index.html">Open DevelopmentReport</a>
    </div>
    <div class="small">Generated: ${generatedAt}</div>
  </div>
</body>
</html>`
}

function radarIndexHtml(generatedAt) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RadarReport</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 28px; background: #0b1020; color: #e9eefc; }
    .card { max-width: 760px; margin: 0 auto; background: #121932; border: 1px solid #273154; border-radius: 20px; padding: 24px; }
    h1 { margin-top: 0; }
    p, li { color: #92a0c4; line-height: 1.7; }
    a { color: #7dd3fc; }
  </style>
</head>
<body>
  <div class="card">
    <h1>RadarReport</h1>
    <p>This is the weekly radar and watchlist package. It includes the client portal, dashboards, reports, insights and active deep dives.</p>
    <ul>
      <li><a href="client-output/index.html">Open Client Portal</a></li>
      <li><a href="dashboard/latest-report.html">Open Main Dashboard</a></li>
      <li><a href="dashboard/hero-visual-pack.html">Open Hero Visual Pack</a></li>
    </ul>
    <p>Generated: ${generatedAt}</p>
  </div>
</body>
</html>`
}

function developmentIndexHtml(generatedAt, snapshotDate, previousSnapshotDate) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DevelopmentReport</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 28px; background: #0b1020; color: #e9eefc; }
    .card { max-width: 760px; margin: 0 auto; background: #121932; border: 1px solid #273154; border-radius: 20px; padding: 24px; }
    h1 { margin-top: 0; }
    p, li { color: #92a0c4; line-height: 1.7; }
    a { color: #7dd3fc; }
  </style>
</head>
<body>
  <div class="card">
    <h1>DevelopmentReport</h1>
    <p>This is the development-oriented layer. Start from the customer portal below. It now follows a 5-step decision path: core conclusions, weekly actions, site cards, precinct deep dives, then visual summary and methodology.</p>
    <ul>
      <li><a href="client-output/index.html">Open Development Client Portal</a></li>
      <li><a href="client-output/01-core/index.html">Open 01 Core</a></li>
      <li><a href="client-output/02-this-weeks-actions/index.html">Open 02 This Week's Actions</a></li>
      <li><a href="client-output/03-site-cards/index.html">Open 03 Site Cards</a></li>
      <li><a href="client-output/04-precinct-deep-dives/index.html">Open 04 Precinct Deep Dives</a></li>
      <li><a href="client-output/05-visual-summary/index.html">Open 05 Visual Summary</a></li>
    </ul>
    <p>Generated: ${generatedAt}</p>
  </div>
</body>
</html>`
}

function rootReadme(generatedAt, dateSlug) {
  return [
    'RadarEstate Delivery Bundle',
    '',
    `Generated: ${generatedAt}`,
    `Week folder: ${dateSlug}`,
    '',
    'Structure:',
    '- RadarReport/: current weekly radar, watchlist, dashboards and client portal',
    '- DevelopmentReport/: same structure as RadarReport, with added development-oriented hard-information content',
    '',
    'Open index.html from this folder to start.'
  ].join('\n')
}

function bundleManifest(generatedAt, dateSlug) {
  return {
    generated_at: generatedAt,
    bundle_date: dateSlug,
    contents: {
      RadarReport: [
        'index.html',
        'client-output/',
        'dashboard/',
        'reports/',
        'manifest.json'
      ],
      DevelopmentReport: [
        'index.html',
        'client-output/',
        'dashboard/',
        'reports/',
        'manifest.json'
      ]
    }
  }
}

function reportManifest(reportType, generatedAt, notes) {
  return {
    generated_at: generatedAt,
    report_type: reportType,
    notes,
    contents: [
      'client-output/',
      'dashboard/',
      'reports/'
    ]
  }
}

function buildPaths(baseDir) {
  return {
    root: baseDir,
    radar: path.join(baseDir, 'RadarReport'),
    development: path.join(baseDir, 'DevelopmentReport')
  }
}

function populateBundle(baseDir, generatedAt, dateSlug, snapshotDate, previousSnapshotDate) {
  const paths = buildPaths(baseDir)
  ensureDir(paths.root)
  ensureDir(paths.radar)
  ensureDir(paths.development)
  clearDir(paths.radar)
  clearDir(paths.development)

  copyDir(path.join(root, 'client-output'), path.join(paths.radar, 'client-output'))
  copyDir(path.join(root, 'dashboard'), path.join(paths.radar, 'dashboard'))
  copyDir(path.join(root, 'reports'), path.join(paths.radar, 'reports'))

  copyDir(path.join(root, 'client-output'), path.join(paths.development, 'client-output'))
  copyDir(path.join(root, 'dashboard'), path.join(paths.development, 'dashboard'))
  copyDir(path.join(root, 'reports'), path.join(paths.development, 'reports'))
  trimDevelopmentBundle(paths.development, snapshotDate, previousSnapshotDate)

  writeFile(path.join(paths.root, 'index.html'), rootIndexHtml('RadarEstate Delivery Bundle', generatedAt))
  writeFile(path.join(paths.root, 'README.txt'), rootReadme(generatedAt, dateSlug))
  writeFile(path.join(paths.root, 'bundle-manifest.json'), JSON.stringify(bundleManifest(generatedAt, dateSlug), null, 2))

  writeFile(path.join(paths.radar, 'index.html'), radarIndexHtml(generatedAt))
  writeFile(path.join(paths.radar, 'manifest.json'), JSON.stringify(reportManifest('RadarReport', generatedAt, 'Weekly radar, watchlist and supporting visual/report outputs.'), null, 2))

  writeFile(path.join(paths.development, 'index.html'), developmentIndexHtml(generatedAt, snapshotDate, previousSnapshotDate))
  writeFile(path.join(paths.development, 'manifest.json'), JSON.stringify(reportManifest('DevelopmentReport', generatedAt, 'Same structure as RadarReport, with added development-oriented hard-information content.'), null, 2))
}

async function main() {
  const options = parseArgs()
  const generatedAt = new Date().toISOString()
  const latestDir = path.join(bundleRoot, 'latest')
  const weeklyDir = path.join(bundleRoot, 'weekly', options.date)

  ensureDir(bundleRoot)
  populateBundle(latestDir, generatedAt, options.date, options.snapshotDate, options.previousSnapshotDate)
  populateBundle(weeklyDir, generatedAt, options.date, options.snapshotDate, options.previousSnapshotDate)

  console.log(`Wrote delivery bundles:`)
  console.log(`- ${latestDir}`)
  console.log(`- ${weeklyDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
