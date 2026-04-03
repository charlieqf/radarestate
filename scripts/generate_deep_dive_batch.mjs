import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    configPath: null,
    renderHtml: true
  }
  for (const arg of args) {
    if (arg.startsWith('--config=')) options.configPath = arg.split('=')[1].trim()
    if (arg === '--skip-html') options.renderHtml = false
  }
  if (!options.configPath) throw new Error('Missing --config=... for deep dive batch')
  return options
}

function readConfig(configPath) {
  const absolutePath = path.isAbsolute(configPath) ? configPath : path.join(root, configPath)
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
}

function runNodeScript(relativeScript, args = []) {
  execFileSync(process.execPath, [path.join(root, relativeScript), ...args], {
    cwd: root,
    stdio: 'inherit'
  })
}

async function main() {
  const options = parseArgs()
  const config = readConfig(options.configPath)

  for (const precinct of config.precincts || []) {
    runNodeScript('scripts/generate_deep_dive_memo.mjs', [
      `--precinct=${precinct}`,
      `--dashboard-path=${config.dashboardPath || 'dashboard/latest-report.html'}`,
      `--radar-path=${config.radarPath || 'reports/weekly-radar-latest.md'}`
    ])
  }

  if (options.renderHtml) {
    runNodeScript('scripts/render_client_reports.mjs')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
