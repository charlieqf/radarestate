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
    date: new Date().toISOString().slice(0, 10).replace(/-/g, '')
  }
  for (const arg of args) {
    if (arg.startsWith('--date=')) options.date = arg.split('=')[1].trim()
  }
  return options
}

function removeDirIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
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

function developmentIndexHtml(generatedAt) {
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
    <p>This is the development-oriented layer. It uses the same bundle structure as RadarReport, but includes additional hard-information content inside the same portal, dashboard and reports folders.</p>
    <ul>
      <li><a href="client-output/index.html">Open Development Client Portal</a></li>
      <li><a href="client-output/development-report-standard-universe.html">Open Main Development Report</a></li>
      <li><a href="dashboard/latest-report.html">Open Main Dashboard</a></li>
      <li><a href="dashboard/hero-visual-pack.html">Open Hero Visual Pack</a></li>
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

function populateBundle(baseDir, generatedAt, dateSlug) {
  const paths = buildPaths(baseDir)
  removeDirIfExists(baseDir)
  ensureDir(paths.root)
  ensureDir(paths.radar)
  ensureDir(paths.development)

  copyDir(path.join(root, 'client-output'), path.join(paths.radar, 'client-output'))
  copyDir(path.join(root, 'dashboard'), path.join(paths.radar, 'dashboard'))
  copyDir(path.join(root, 'reports'), path.join(paths.radar, 'reports'))

  copyDir(path.join(root, 'client-output'), path.join(paths.development, 'client-output'))
  copyDir(path.join(root, 'dashboard'), path.join(paths.development, 'dashboard'))
  copyDir(path.join(root, 'reports'), path.join(paths.development, 'reports'))

  writeFile(path.join(paths.root, 'index.html'), rootIndexHtml('RadarEstate Delivery Bundle', generatedAt))
  writeFile(path.join(paths.root, 'README.txt'), rootReadme(generatedAt, dateSlug))
  writeFile(path.join(paths.root, 'bundle-manifest.json'), JSON.stringify(bundleManifest(generatedAt, dateSlug), null, 2))

  writeFile(path.join(paths.radar, 'index.html'), radarIndexHtml(generatedAt))
  writeFile(path.join(paths.radar, 'manifest.json'), JSON.stringify(reportManifest('RadarReport', generatedAt, 'Weekly radar, watchlist and supporting visual/report outputs.'), null, 2))

  writeFile(path.join(paths.development, 'index.html'), developmentIndexHtml(generatedAt))
  writeFile(path.join(paths.development, 'manifest.json'), JSON.stringify(reportManifest('DevelopmentReport', generatedAt, 'Same structure as RadarReport, with added development-oriented hard-information content.'), null, 2))
}

async function main() {
  const options = parseArgs()
  const generatedAt = new Date().toISOString()
  const latestDir = path.join(bundleRoot, 'latest')
  const weeklyDir = path.join(bundleRoot, 'weekly', options.date)

  ensureDir(bundleRoot)
  populateBundle(latestDir, generatedAt, options.date)
  populateBundle(weeklyDir, generatedAt, options.date)

  console.log(`Wrote delivery bundles:`)
  console.log(`- ${latestDir}`)
  console.log(`- ${weeklyDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
