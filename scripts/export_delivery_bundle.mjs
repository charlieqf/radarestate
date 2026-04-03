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
    name: 'latest'
  }
  for (const arg of args) {
    if (arg.startsWith('--name=')) options.name = arg.split('=')[1].trim()
  }
  return options
}

function removeDirIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}

function copyDir(sourceDir, targetDir) {
  ensureDir(targetDir)
  fs.cpSync(sourceDir, targetDir, { recursive: true })
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf8')
}

function htmlIndex() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RadarEstate Delivery Bundle</title>
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
    .eyebrow {
      color: var(--cyan);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 34px;
      line-height: 1.08;
    }
    p {
      color: var(--muted);
      line-height: 1.7;
      font-size: 15px;
      margin: 0 0 20px;
    }
    .actions {
      display: grid;
      gap: 12px;
    }
    .action {
      display: inline-block;
      text-decoration: none;
      color: var(--text);
      background: #171f3d;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 700;
    }
    .small {
      margin-top: 16px;
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">RadarEstate</div>
    <h1>Client Delivery Bundle</h1>
    <p>This folder is designed to be shareable as a self-contained delivery bundle. Open the client portal for the primary experience, or jump directly to the dashboard if needed.</p>
    <div class="actions">
      <a class="action" href="client-output/index.html">Open Client Portal</a>
      <a class="action" href="dashboard/latest-report.html">Open Main Dashboard</a>
      <a class="action" href="dashboard/hero-visual-pack.html">Open Hero Visual Pack</a>
    </div>
    <div class="small">All links inside this bundle are scoped to this folder structure. You can send the entire folder as-is.</div>
  </div>
</body>
</html>`
}

function readmeText(generatedAt) {
  return [
    'RadarEstate Delivery Bundle',
    '',
    `Generated: ${generatedAt}`,
    '',
    'How to use:',
    '1. Open index.html from this folder.',
    '2. For the main portal experience, open client-output/index.html.',
    '3. For direct visuals, open dashboard/latest-report.html or dashboard/hero-visual-pack.html.',
    '',
    'This bundle intentionally includes both client-output and dashboard so links work without depending on the original workspace.'
  ].join('\n')
}

async function main() {
  const options = parseArgs()
  const generatedAt = new Date().toISOString()
  const deliveryDir = path.join(bundleRoot, options.name)

  removeDirIfExists(deliveryDir)
  ensureDir(deliveryDir)

  copyDir(path.join(root, 'client-output'), path.join(deliveryDir, 'client-output'))
  copyDir(path.join(root, 'dashboard'), path.join(deliveryDir, 'dashboard'))

  writeFile(path.join(deliveryDir, 'index.html'), htmlIndex())
  writeFile(path.join(deliveryDir, 'README.txt'), readmeText(generatedAt))
  writeFile(
    path.join(deliveryDir, 'bundle-manifest.json'),
    JSON.stringify({
      generated_at: generatedAt,
      contents: [
        'client-output/',
        'dashboard/',
        'index.html',
        'README.txt'
      ]
    }, null, 2)
  )

  console.log(`Wrote delivery bundle: ${deliveryDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
