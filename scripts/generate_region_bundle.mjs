import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    regionGroup: 'Hunter',
    label: 'Newcastle-Hunter',
    slug: 'newcastle-hunter'
  }
  for (const arg of args) {
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--slug=')) options.slug = arg.split('=')[1].trim()
  }
  return options
}

function runNodeScript(relativeScript, args = []) {
  execFileSync(process.execPath, [path.join(root, relativeScript), ...args], {
    cwd: root,
    stdio: 'inherit'
  })
}

async function main() {
  const options = parseArgs()
  const dashboardName = `${options.slug}-report`

  runNodeScript('scripts/generate_dashboard_report.mjs', [
    `--region-group=${options.regionGroup}`,
    `--label=${options.label}`,
    `--output-name=${dashboardName}`
  ])

  runNodeScript('scripts/generate_weekly_radar.mjs', [
    `--region-group=${options.regionGroup}`,
    `--label=${options.label}`,
    `--output-name=${options.slug}`,
    `--dashboard-path=dashboard/${dashboardName}.html`
  ])

  runNodeScript('scripts/render_client_reports.mjs')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
