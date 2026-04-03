import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'

const root = process.cwd()
const reportsDir = path.join(root, 'reports')
const outputDir = path.join(root, 'client-output')
const retiredDeepDiveReportsDir = path.join(root, 'archive', 'deep-dives', 'retired', 'reports')
const retiredDeepDiveHtmlDir = path.join(root, 'archive', 'deep-dives', 'retired', 'client-output')

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
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
  if (targetPath === 'dashboard/hero-visual-pack.html') {
    return 'hero-visual-pack.html'
  }
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

function extractDeepDiveFilesFromPack(filePath) {
  if (!fs.existsSync(filePath)) return []
  const markdown = readFile(filePath)
  const matches = [...markdown.matchAll(/reports\/(deep-dive-[a-z0-9-]+\.md)/gi)]
  return [...new Set(matches.map((match) => match[1]))]
}

function moveFileIfPresent(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) return false
  ensureDir(path.dirname(targetPath))
  if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true })
  fs.renameSync(sourcePath, targetPath)
  return true
}

function archiveRetiredDeepDives() {
  const activeDeepDiveNames = unique([
    ...extractDeepDiveFilesFromPack(path.join(reportsDir, 'client-pack-latest.md')),
    ...extractDeepDiveFilesFromPack(path.join(reportsDir, 'client-pack-newcastle-hunter.md'))
  ])

  const reportFiles = fs.existsSync(reportsDir)
    ? fs.readdirSync(reportsDir).filter((name) => /^deep-dive-.*\.md$/i.test(name))
    : []

  const retired = []
  for (const fileName of reportFiles) {
    if (activeDeepDiveNames.includes(fileName)) continue

    const reportSource = path.join(reportsDir, fileName)
    const reportTarget = path.join(retiredDeepDiveReportsDir, fileName)
    const htmlFileName = fileName.replace(/\.md$/i, '.html')
    const htmlSource = path.join(outputDir, htmlFileName)
    const htmlTarget = path.join(retiredDeepDiveHtmlDir, htmlFileName)

    const movedReport = moveFileIfPresent(reportSource, reportTarget)
    const movedHtml = moveFileIfPresent(htmlSource, htmlTarget)
    if (movedReport || movedHtml) {
      retired.push(fileName)
    }
  }

  return retired
}

function navGroups(files) {
  const items = files.map((filePath) => {
    const fileName = path.basename(filePath)
    return {
      fileName,
      href: fileName.replace(/\.md$/i, '.html'),
      label: slugToLabel(fileName),
      title: titleFromMarkdown(readFile(filePath), slugToLabel(fileName))
    }
  })

  const byName = new Map(items.map((item) => [item.fileName, item]))
  const ordered = (names) => names.map((name) => byName.get(name)).filter(Boolean)
  const remaining = new Set(items.map((item) => item.fileName))
  const consume = (groupItems) => {
    for (const item of groupItems) remaining.delete(item.fileName)
    return groupItems
  }

  const activeDeepDiveNames = unique([
    ...extractDeepDiveFilesFromPack(path.join(reportsDir, 'client-pack-latest.md')),
    ...extractDeepDiveFilesFromPack(path.join(reportsDir, 'client-pack-newcastle-hunter.md'))
  ])

  const mainDeliverables = consume([
    {
      fileName: '__hero__',
      href: 'hero-visual-pack.html',
      label: 'Hero Visual Pack',
      title: 'Hero Visual Pack'
    },
    ...ordered([
      'client-pack-latest.md',
      'top-10-insights-latest.md',
      'weekly-radar-latest.md',
      'client-pack-newcastle-hunter.md',
      'weekly-radar-newcastle-hunter.md'
    ])
  ])

  const deepDives = consume(ordered(activeDeepDiveNames))

  const internal = consume(ordered([
    'coverage-readiness-greater-sydney-expanded.md',
    'coverage-readiness-newcastle-hunter-pilot.md'
  ]))

  const leftovers = [...remaining]
    .map((name) => byName.get(name))
    .filter(Boolean)
    .sort((a, b) => a.fileName.localeCompare(b.fileName))

  return [
    { heading: 'Main Deliverables', items: mainDeliverables },
    { heading: 'Deep Dives', items: deepDives },
    { heading: 'Internal', items: internal },
    ...(leftovers.length ? [{ heading: 'Other', items: leftovers }] : [])
  ].filter((group) => group.items.length)
}

function pageTemplate({ title, bodyHtml, nav, currentHref, articleClass = 'article' }) {
  const navHtml = nav.map((group) => {
    const links = group.items.map((item) => {
      const active = item.href === currentHref ? 'nav-link active' : 'nav-link'
      return `<a class="${active}" href="${item.href}"><span class="nav-title">${item.title}</span><span class="nav-meta">${item.label}</span></a>`
    }).join('')
    return `<section class="nav-group"><div class="nav-heading">${group.heading}</div><div class="nav-group-links">${links}</div></section>`
  }).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script>
    (() => {
      const storageKey = 'radarestate-theme';
      const sidebarKey = 'radarestate-sidebar';
      let stored = null;
      let storedSidebar = null;
      try {
        stored = window.localStorage.getItem(storageKey);
        storedSidebar = window.localStorage.getItem(sidebarKey);
      } catch {
      }
      const preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.dataset.theme = stored || preferred;
      document.documentElement.dataset.sidebar = storedSidebar || 'expanded';
    })();
  </script>
  <style>
    :root {
      --bg: #0b1020;
      --bg-accent: #132048;
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
      --panel-top: rgba(255,255,255,0.03);
      --panel-bottom: rgba(255,255,255,0.015);
      --shadow: rgba(0,0,0,0.18);
      --button-bg: rgba(255,255,255,0.06);
      --button-text: var(--text);
      --article-code-bg: rgba(255,255,255,0.06);
      --article-code-border: rgba(255,255,255,0.08);
      --pre-bg: #0f1731;
      --blockquote-bg: rgba(51,209,255,0.06);
    }

    html[data-theme="light"] {
      --bg: #eef4ff;
      --bg-accent: #d9e8ff;
      --panel: #ffffff;
      --panel-2: #f4f8ff;
      --text: #11203f;
      --muted: #597094;
      --line: #d3def0;
      --cyan: #0f84c9;
      --lime: #6eab12;
      --amber: #d6861b;
      --red: #c94242;
      --link: #0f84c9;
      --panel-top: rgba(255,255,255,0.94);
      --panel-bottom: rgba(240,246,255,0.94);
      --shadow: rgba(45,72,117,0.12);
      --button-bg: #ffffff;
      --button-text: #11203f;
      --article-code-bg: rgba(17,32,63,0.06);
      --article-code-border: rgba(17,32,63,0.08);
      --pre-bg: #eef4ff;
      --blockquote-bg: rgba(15,132,201,0.08);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at top left, var(--bg-accent) 0, var(--bg) 45%);
      color: var(--text);
      font-family: Inter, Arial, sans-serif;
    }
    .sidebar-toggle {
      position: fixed;
      top: 18px;
      left: 18px;
      z-index: 1200;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      box-shadow: 0 12px 30px var(--shadow);
      color: var(--button-text);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      backdrop-filter: blur(10px);
    }
    .theme-switcher {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 1200;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      box-shadow: 0 12px 30px var(--shadow);
      backdrop-filter: blur(10px);
    }
    .theme-switcher-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .theme-switcher-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: var(--panel-2);
      border: 1px solid var(--line);
    }
    .theme-switcher-button {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--muted);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      min-width: 68px;
    }
    .theme-switcher-button[aria-pressed="true"] {
      background: var(--button-bg);
      color: var(--button-text);
      box-shadow: inset 0 0 0 1px var(--line);
    }
    .shell {
      display: grid;
      grid-template-columns: 300px 1fr;
      min-height: 100vh;
      transition: grid-template-columns 180ms ease;
    }
    html[data-sidebar="collapsed"] .shell {
      grid-template-columns: 0 1fr;
    }
    .sidebar {
      padding: 24px 18px;
      border-right: 1px solid var(--line);
      background: var(--panel);
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      min-width: 0;
      transition: opacity 150ms ease, transform 180ms ease;
    }
    html[data-sidebar="collapsed"] .sidebar {
      display: none;
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
      gap: 16px;
    }
    .nav-group {
      display: grid;
      gap: 8px;
    }
    .nav-heading {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 0 4px;
    }
    .nav-group-links {
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
    .main { padding: 88px 28px 28px; }
    .article {
      max-width: 920px;
      margin: 0 auto;
      background: linear-gradient(180deg, var(--panel-top), var(--panel-bottom));
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 28px 32px;
      box-shadow: 0 16px 40px var(--shadow);
    }
    .article.article-wide {
      max-width: 1320px;
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
      background: var(--article-code-bg);
      border: 1px solid var(--article-code-border);
      border-radius: 8px;
      padding: 2px 6px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.92em;
    }
    .article pre {
      background: var(--pre-bg);
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
      background: var(--blockquote-bg);
      border-radius: 12px;
      color: var(--text);
    }
    .embed-frame {
      width: 100%;
      height: calc(100vh - 170px);
      min-height: 980px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #ffffff;
    }
    .embed-note {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 14px;
    }
    @media (max-width: 980px) {
      .sidebar-toggle {
        left: 18px;
      }
      .theme-switcher {
        left: 18px;
        right: 18px;
        justify-content: space-between;
        top: 64px;
      }
      .shell { grid-template-columns: 1fr; }
      .sidebar {
        position: static;
        height: auto;
        border-right: none;
        border-bottom: 1px solid var(--line);
      }
      .main { padding: 92px 18px 18px; }
      .article { padding: 22px 20px; }
      .embed-frame { min-height: 760px; height: calc(100vh - 220px); }
    }
  </style>
</head>
<body>
  <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-expanded="true">Hide Navigation</button>
  <div class="theme-switcher" role="group" aria-label="Theme switcher">
    <span class="theme-switcher-label">Theme</span>
    <div class="theme-switcher-group">
      <button class="theme-switcher-button" type="button" data-theme-option="dark">Dark</button>
      <button class="theme-switcher-button" type="button" data-theme-option="light">Light</button>
    </div>
  </div>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="eyebrow">RadarEstate</div>
        <h1>Client Reports</h1>
        <p>Styled HTML delivery layer for weekly radar, deep dives and client pack notes.</p>
      </div>
      <div class="actions">
        <a class="action-link" href="../dashboard/latest-report.html">Open Visual Dashboard</a>
        <a class="action-link" href="hero-visual-pack.html">Open Hero Visual Pack</a>
        <a class="action-link" href="index.html">Open Client Pack</a>
      </div>
      <nav class="nav">${navHtml}</nav>
    </aside>
    <main class="main">
      <article class="${articleClass}">${bodyHtml}</article>
    </main>
  </div>
  <script>
    (() => {
      const navScrollKey = 'radarestate-nav-scroll';
      const storageKey = 'radarestate-theme';
      const sidebarKey = 'radarestate-sidebar';
      const currentTheme = document.documentElement.dataset.theme || 'dark';
      const currentSidebarState = document.documentElement.dataset.sidebar || 'expanded';
      const sidebar = document.querySelector('.sidebar');
      const sidebarToggle = document.getElementById('sidebarToggle');
      const buttons = [...document.querySelectorAll('[data-theme-option]')];

      const updateSidebarToggle = (state) => {
        if (!sidebarToggle) return;
        const expanded = state !== 'collapsed';
        sidebarToggle.textContent = expanded ? 'Hide Navigation' : 'Show Navigation';
        sidebarToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      };

      updateSidebarToggle(currentSidebarState);

      if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
          const nextState = document.documentElement.dataset.sidebar === 'collapsed' ? 'expanded' : 'collapsed';
          document.documentElement.dataset.sidebar = nextState;
          updateSidebarToggle(nextState);
          try {
            window.localStorage.setItem(sidebarKey, nextState);
          } catch {
          }
        });
      }

      if (sidebar) {
        try {
          const storedScroll = window.localStorage.getItem(navScrollKey);
          if (storedScroll !== null) {
            requestAnimationFrame(() => {
              sidebar.scrollTop = Number(storedScroll) || 0;
            });
          }
        } catch {
        }

        sidebar.addEventListener('scroll', () => {
          try {
            window.localStorage.setItem(navScrollKey, String(sidebar.scrollTop));
          } catch {
          }
        }, { passive: true });
      }

      if (!buttons.length) return;
      buttons.forEach((button) => {
        const theme = button.dataset.themeOption;
        button.setAttribute('aria-pressed', theme === currentTheme ? 'true' : 'false');
        button.addEventListener('click', () => {
          if (theme === currentTheme) return;
          try {
            window.localStorage.setItem(storageKey, theme);
          } catch {
          }
          document.documentElement.dataset.theme = theme;
          window.location.reload();
        });
      });
    })();
  </script>
</body>
</html>`
}

async function main() {
  ensureDir(outputDir)
  const retired = archiveRetiredDeepDives()
  for (const fileName of retired) {
    console.log(`Archived retired deep dive ${fileName}`)
  }
  const files = fs.readdirSync(reportsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(reportsDir, name))

  const nav = navGroups(files)
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

  const heroBody = [
    '<h1>Hero Visual Pack</h1>',
    '<p class="embed-note">This is the same hero visual pack, embedded inside the client portal so it behaves like the other right-panel pages. You can still open the standalone dashboard file if needed.</p>',
    '<iframe class="embed-frame" src="../dashboard/hero-visual-pack.html?embedded=1" title="Hero Visual Pack"></iframe>'
  ].join('')
  const heroHtml = pageTemplate({
    title: 'Hero Visual Pack',
    bodyHtml: heroBody,
    nav,
    currentHref: 'hero-visual-pack.html',
    articleClass: 'article article-wide'
  })
  fs.writeFileSync(path.join(outputDir, 'hero-visual-pack.html'), heroHtml, 'utf8')
  console.log('Rendered hero-visual-pack.html')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
