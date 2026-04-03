import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'

const root = process.cwd()
const reportsDir = path.join(root, 'reports')
const outputDir = path.join(root, 'client-output')

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function titleFromMarkdown(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

function slugToLabel(fileName) {
  return fileName
    .replace(/\.md$/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function markdownPathToHref(targetPath) {
  if (targetPath.startsWith('dashboard/')) {
    return `../${targetPath}`
  }
  if (targetPath.startsWith('reports/')) {
    return targetPath.replace(/^reports\//, '').replace(/\.md$/i, '.html')
  }
  return targetPath
}

function preprocessMarkdown(markdown) {
  return markdown.replace(/`((?:dashboard|reports)\/[^`]+\.(?:html|md))`/g, (_, targetPath) => {
    return `[\`${targetPath}\`](${markdownPathToHref(targetPath)})`
  })
}

function navItems(files) {
  const priority = new Map([
    ['client-pack-latest.md', 1],
    ['weekly-radar-latest.md', 2]
  ])

  return files
    .slice()
    .sort((a, b) => {
      const pa = priority.get(path.basename(a)) || 10
      const pb = priority.get(path.basename(b)) || 10
      if (pa !== pb) return pa - pb
      return path.basename(a).localeCompare(path.basename(b))
    })
    .map((filePath) => {
      const fileName = path.basename(filePath)
      return {
        fileName,
        href: fileName.replace(/\.md$/i, '.html'),
        label: slugToLabel(fileName),
        title: titleFromMarkdown(readFile(filePath), slugToLabel(fileName))
      }
    })
}

function pageTemplate({ title, bodyHtml, nav, currentHref }) {
  const navHtml = nav.map((item) => {
    const active = item.href === currentHref ? 'nav-link active' : 'nav-link'
    return `<a class="${active}" href="${item.href}"><span class="nav-title">${item.title}</span><span class="nav-meta">${item.label}</span></a>`
  }).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      --bg: #0b1020;
      --panel: #121932;
      --panel-2: #171f3d;
      --text: #e9eefc;
      --muted: #92a0c4;
      --line: #273154;
      --cyan: #33d1ff;
      --lime: #b7ff3c;
      --amber: #ffb547;
      --red: #ff6b6b;
      --link: #7dd3fc;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at top left, #132048 0, var(--bg) 45%);
      color: var(--text);
      font-family: Inter, Arial, sans-serif;
    }
    .shell {
      display: grid;
      grid-template-columns: 300px 1fr;
      min-height: 100vh;
    }
    .sidebar {
      padding: 24px 18px;
      border-right: 1px solid var(--line);
      background: rgba(12,18,36,0.92);
      position: sticky;
      top: 0;
      height: 100vh;
    }
    .brand {
      margin-bottom: 22px;
    }
    .eyebrow {
      color: var(--cyan);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .brand h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
    }
    .brand p {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
      margin: 10px 0 0;
    }
    .actions {
      display: grid;
      gap: 10px;
      margin-bottom: 22px;
    }
    .action-link {
      display: inline-block;
      text-decoration: none;
      color: var(--text);
      border: 1px solid var(--line);
      background: var(--panel-2);
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 13px;
    }
    .nav {
      display: grid;
      gap: 10px;
    }
    .nav-link {
      display: block;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.02);
      text-decoration: none;
      color: var(--text);
    }
    .nav-link.active {
      border-color: rgba(51,209,255,0.45);
      box-shadow: inset 0 0 0 1px rgba(51,209,255,0.25);
      background: rgba(51,209,255,0.08);
    }
    .nav-title {
      display: block;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .nav-meta {
      display: block;
      color: var(--muted);
      font-size: 12px;
    }
    .main {
      padding: 28px;
    }
    .article {
      max-width: 920px;
      margin: 0 auto;
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 28px 32px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.18);
    }
    .article h1, .article h2, .article h3 {
      margin-top: 0;
    }
    .article h1 {
      font-size: 32px;
      line-height: 1.15;
      margin-bottom: 20px;
    }
    .article h2 {
      font-size: 20px;
      margin-top: 28px;
      margin-bottom: 14px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
    }
    .article h3 {
      font-size: 16px;
      margin-top: 22px;
      margin-bottom: 10px;
      color: var(--cyan);
    }
    .article p, .article li {
      color: var(--text);
      line-height: 1.7;
      font-size: 15px;
    }
    .article ul, .article ol {
      padding-left: 22px;
    }
    .article a {
      color: var(--link);
    }
    .article code {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 2px 6px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.92em;
    }
    .article pre {
      background: #0f1731;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      overflow: auto;
    }
    .article table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 20px;
      font-size: 14px;
    }
    .article th, .article td {
      border-bottom: 1px solid var(--line);
      padding: 11px 10px;
      text-align: left;
      vertical-align: top;
    }
    .article th {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 12px;
    }
    .article blockquote {
      margin: 18px 0;
      padding: 14px 18px;
      border-left: 3px solid var(--cyan);
      background: rgba(51,209,255,0.06);
      border-radius: 12px;
      color: var(--text);
    }
    @media (max-width: 980px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar {
        position: static;
        height: auto;
        border-right: none;
        border-bottom: 1px solid var(--line);
      }
      .main { padding: 18px; }
      .article { padding: 22px 20px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="eyebrow">RadarEstate</div>
        <h1>Client Reports</h1>
        <p>Styled HTML delivery layer for weekly radar, deep dives and client pack notes.</p>
      </div>
      <div class="actions">
        <a class="action-link" href="../dashboard/latest-report.html">Open Visual Dashboard</a>
        <a class="action-link" href="index.html">Open Client Pack</a>
      </div>
      <nav class="nav">${navHtml}</nav>
    </aside>
    <main class="main">
      <article class="article">${bodyHtml}</article>
    </main>
  </div>
</body>
</html>`
}

async function main() {
  ensureDir(outputDir)
  const files = fs.readdirSync(reportsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(reportsDir, name))

  const nav = navItems(files)
  marked.setOptions({ gfm: true, breaks: false })

  for (const filePath of files) {
    const fileName = path.basename(filePath)
    const markdown = preprocessMarkdown(readFile(filePath))
    const title = titleFromMarkdown(markdown, slugToLabel(fileName))
    const bodyHtml = marked.parse(markdown)
    const outputFileName = fileName.replace(/\.md$/i, '.html')
    const html = pageTemplate({
      title,
      bodyHtml,
      nav,
      currentHref: outputFileName
    })
    fs.writeFileSync(path.join(outputDir, outputFileName), html, 'utf8')
    if (fileName === 'client-pack-latest.md') {
      fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8')
    }
    console.log(`Rendered ${outputFileName}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
