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

  runNodeScript('scripts/build_site_screening_layer.mjs', [`--region-group=${options.regionGroup}`])

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

  runNodeScript('scripts/generate_top_site_screening_report.mjs', [
    `--region-group=${options.regionGroup}`,
    `--label=${options.label}`,
    `--output-name=${options.slug}`
  ])

  runNodeScript('scripts/generate_site_card_batch.mjs', [
    `--region-group=${options.regionGroup}`,
    `--label=${options.label}`,
    `--output-name=${options.slug}`,
    `--dashboard-path=dashboard/${dashboardName}.html`,
    `--radar-path=reports/weekly-radar-${options.slug}.md`,
    `--screening-path=reports/top-site-screening-${options.slug}.md`
  ])

  runNodeScript('scripts/render_client_reports.mjs')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
