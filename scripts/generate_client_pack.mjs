import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { Client } from 'pg'

const root = process.cwd()

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function getConnectionStrings() {
  const text = readFile('supabase.txt')
  const matches = [...text.matchAll(/postgresql:\/\/[^\s`]+/g)].map((m) => m[0])
  if (!matches.length) throw new Error('No PostgreSQL connection string found in supabase.txt')
  const direct = matches.find((value) => value.includes('@db.'))
  const pooler = matches.find((value) => value.includes('pooler.supabase.com'))
  return [direct, pooler].filter(Boolean)
}

async function connectWithFallback() {
  let lastError = null
  for (const connectionString of getConnectionStrings()) {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
    try {
      await client.connect()
      console.log(`Connected using ${connectionString.includes('pooler.supabase.com') ? 'pooler' : 'direct'} endpoint`)
      return client
    } catch (error) {
      lastError = error
      try {
        await client.end()
      } catch {
      }
    }
  }
  throw lastError || new Error('Unable to connect to Supabase')
}

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
    dashboardPath: null,
    radarPath: null,
    deepDiveConfig: null
  }
  for (const arg of args) {
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--slug=')) options.slug = arg.split('=')[1].trim()
    if (arg.startsWith('--dashboard-path=')) options.dashboardPath = arg.split('=')[1].trim()
    if (arg.startsWith('--radar-path=')) options.radarPath = arg.split('=')[1].trim()
    if (arg.startsWith('--deep-dive-config=')) options.deepDiveConfig = arg.split('=')[1].trim()
  }
  return options
}

function readJson(relativeOrAbsolutePath) {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(root, relativeOrAbsolutePath)
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
}

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU').format(Number(value))
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

async function selectAutoDeepDivePrecincts(client, regionGroup, bestPrecinct, riskPrecinct) {
  const selected = unique([bestPrecinct])

  if (regionGroup !== 'Greater Sydney') {
    const core = await client.query(
      `select v.precinct_name
       from public.v_precinct_shortlist v
       join public.councils c on c.canonical_name = v.council_name
       where c.region_group = $1
         and v.precinct_type = 'centre'
         and v.precinct_name <> all($2::text[])
       order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
                v.friction_score asc nulls last,
                v.recent_application_count desc nulls last,
                v.active_pipeline_count desc nulls last
       limit 1`,
      [regionGroup, selected]
    )
    if (core.rows.length) selected.push(core.rows[0].precinct_name)
  }

  if (riskPrecinct && !selected.includes(riskPrecinct)) {
    selected.push(riskPrecinct)
  }

  return unique(selected)
}

async function main() {
  const options = parseArgs()
  const client = await connectWithFallback()
  try {
    const topOpportunity = await client.query(
      `select precinct_name, council_name, opportunity_rating, friction_score, recent_application_count, active_pipeline_count
        from public.v_precinct_shortlist
        join public.councils c on c.canonical_name = v_precinct_shortlist.council_name
       where c.region_group = $1
        order by case opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
                 friction_score asc nulls last,
                 recent_application_count desc nulls last,
                 active_pipeline_count desc nulls last
       limit 1`,
      [options.regionGroup]
    )

    const topRisk = await client.query(
      `select precinct_name, council_name, opportunity_rating, friction_score, recent_application_count, active_pipeline_count
        from public.v_precinct_shortlist
        join public.councils c on c.canonical_name = v_precinct_shortlist.council_name
       where constraint_count > 0
         and c.region_group = $1
        order by friction_score desc nulls last,
                 recent_application_count desc nulls last,
                 active_pipeline_count desc nulls last
       limit 1`,
      [options.regionGroup]
    )

    if (!topOpportunity.rows.length) throw new Error('No top opportunity precinct found')
    if (!topRisk.rows.length) throw new Error('No constrained precinct found')

    const best = topOpportunity.rows[0]
    const risk = topRisk.rows[0]

    const dashboardPath = options.dashboardPath || (options.slug === 'latest' ? 'dashboard/latest-report.html' : `dashboard/${options.slug}-report.html`)
    const radarPath = options.radarPath || (options.slug === 'latest' ? 'reports/weekly-radar-latest.md' : `reports/weekly-radar-${options.slug}.md`)
    const heroPath = 'dashboard/hero-visual-pack.html'
    const insightsPath = 'reports/top-10-insights-latest.md'

    runNodeScript('scripts/generate_hero_visual_pack.mjs')
    runNodeScript('scripts/generate_top10_insights_memo.mjs')

    runNodeScript('scripts/generate_dashboard_report.mjs', [
      `--region-group=${options.regionGroup}`,
      `--label=${options.label}`,
      `--output-name=${options.slug === 'latest' ? 'latest-report' : `${options.slug}-report`}`
    ])
    runNodeScript('scripts/generate_weekly_radar.mjs', [
      `--region-group=${options.regionGroup}`,
      `--label=${options.label}`,
      `--output-name=${options.slug}`,
      `--dashboard-path=${dashboardPath}`
    ])

    let deepDivePrecincts = []
    if (options.deepDiveConfig) {
      const config = readJson(options.deepDiveConfig)
      deepDivePrecincts = config.precincts || []
      runNodeScript('scripts/generate_deep_dive_batch.mjs', [`--config=${options.deepDiveConfig}`])
    } else {
      deepDivePrecincts = await selectAutoDeepDivePrecincts(client, options.regionGroup, best.precinct_name, risk.precinct_name)
      for (const precinct of deepDivePrecincts) {
        runNodeScript('scripts/generate_deep_dive_memo.mjs', [
          `--precinct=${precinct}`,
          `--dashboard-path=${dashboardPath}`,
          `--radar-path=${radarPath}`
        ])
      }
      runNodeScript('scripts/render_client_reports.mjs')
    }

    const deepDiveFiles = [...new Set(deepDivePrecincts.map((precinct) => `reports/deep-dive-${slugify(precinct)}.md`))]

    const today = new Date().toISOString().slice(0, 10)
    const markdown = [
      `# ${options.label} Client Pack`,
      '',
      `## Date`,
      '',
      today,
      '',
      '## Included Deliverables',
      '',
      `- \`${heroPath}\``,
      `- \`${insightsPath}\``,
      `- \`${dashboardPath}\``,
      `- \`${radarPath}\``,
      ...deepDiveFiles.map((file) => `- \`${file}\``),
      '',
      '## Reading Order',
      '',
      `1. Open \`${heroPath}\` for the fastest visual read of opportunity vs risk.`,
      `2. Read \`${insightsPath}\` for the investment-committee style summary.`,
      `3. Open \`${dashboardPath}\` for the broader supporting dashboard.`,
      `4. Read \`${radarPath}\` for the current market-level interpretation.`,
      ...deepDiveFiles.map((file, index) => `${index + 5}. Read \`${file}\` for precinct-level detail.`),
      '',
      '## This Pack Highlights',
      '',
      `- Best current opportunity precinct: \`${best.precinct_name}\` (${best.council_name})`,
      `- Opportunity profile: rating \`${best.opportunity_rating}\`, risk \`${best.friction_score}\`, recent apps \`${formatNumber(best.recent_application_count)}\`, active pipeline \`${formatNumber(best.active_pipeline_count)}\``,
      `- Highest-friction tracked precinct: \`${risk.precinct_name}\` (${risk.council_name})`,
      `- Risk profile: rating \`${risk.opportunity_rating}\`, risk \`${risk.friction_score}\`, recent apps \`${formatNumber(risk.recent_application_count)}\`, active pipeline \`${formatNumber(risk.active_pipeline_count)}\``,
      '',
      '## Notes',
      '',
      '- This pack is generated from current Supabase data and is intended as a point-in-time research deliverable.',
      '- The current risk layer is materially useful, but still combines proxy and sample-based spatial signals rather than full parcel-level constraints.',
      ''
    ].join('\n')

    const reportsDir = path.join(root, 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })
    const fileName = options.slug === 'latest' ? 'client-pack-latest.md' : `client-pack-${options.slug}.md`
    const outPath = path.join(reportsDir, fileName)
    fs.writeFileSync(outPath, markdown, 'utf8')
    console.log(`Wrote ${outPath}`)

    runNodeScript('scripts/render_client_reports.mjs')
    runNodeScript('scripts/export_delivery_bundle.mjs')
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
