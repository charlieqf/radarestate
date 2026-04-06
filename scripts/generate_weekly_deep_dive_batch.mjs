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
    outputName: null,
    snapshotDate: new Date().toISOString().slice(0, 10),
    dashboardPath: 'dashboard/latest-report.html',
    radarPath: 'reports/weekly-radar-latest.md',
    renderHtml: false
  }
  for (const arg of args) {
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--output-name=')) options.outputName = arg.split('=')[1].trim()
    if (arg.startsWith('--snapshot-date=')) options.snapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--dashboard-path=')) options.dashboardPath = arg.split('=')[1].trim()
    if (arg.startsWith('--radar-path=')) options.radarPath = arg.split('=')[1].trim()
    if (arg === '--skip-html') options.renderHtml = false
  }
  return options
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function removeOutdatedDatedDeepDives(outputName, precincts) {
  if (!outputName) return
  const keepNames = new Set(precincts.map((precinct) => `deep-dive-${slugify(precinct)}-${slugify(outputName)}`))
  const reportsDir = path.join(root, 'reports')
  const htmlDir = path.join(root, 'client-output')
  const suffix = `-${slugify(outputName)}.md`

  if (fs.existsSync(reportsDir)) {
    for (const fileName of fs.readdirSync(reportsDir)) {
      if (!fileName.startsWith('deep-dive-') || !fileName.endsWith(suffix)) continue
      const baseName = fileName.replace(/\.md$/i, '')
      if (keepNames.has(baseName)) continue
      fs.rmSync(path.join(reportsDir, fileName), { force: true })
      const htmlName = `${baseName}.html`
      if (fs.existsSync(path.join(htmlDir, htmlName))) fs.rmSync(path.join(htmlDir, htmlName), { force: true })
    }
  }
}

async function selectPrecincts(client, regionGroup) {
  const selected = []

  const topOpportunity = await client.query(
    `select v.precinct_name
     from public.v_precinct_shortlist v
     join public.councils c on c.canonical_name = v.council_name
     where c.region_group = $1
     order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
              v.friction_score asc nulls last,
              v.recent_application_count desc nulls last,
              v.active_pipeline_count desc nulls last
     limit 1`,
    [regionGroup]
  )
  if (topOpportunity.rows.length) selected.push(topOpportunity.rows[0].precinct_name)

  const topRisk = await client.query(
    `select v.precinct_name
     from public.v_precinct_shortlist v
     join public.councils c on c.canonical_name = v.council_name
     where c.region_group = $1
       and v.constraint_count > 0
     order by v.friction_score desc nulls last,
              v.recent_application_count desc nulls last,
              v.active_pipeline_count desc nulls last
     limit 1`,
    [regionGroup]
  )
  if (topRisk.rows.length) selected.push(topRisk.rows[0].precinct_name)

  const nextPriority = await client.query(
    `select v.precinct_name
     from public.v_precinct_shortlist v
     join public.councils c on c.canonical_name = v.council_name
     where c.region_group = $1
       and ($2::text[] is null or v.precinct_name <> all($2::text[]))
     order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
              v.recent_application_count desc nulls last,
              v.active_pipeline_count desc nulls last,
              v.friction_score asc nulls last
     limit 1`,
    [regionGroup, selected.length ? selected : null]
  )
  if (nextPriority.rows.length) selected.push(nextPriority.rows[0].precinct_name)

  const extraPriority = await client.query(
    `select v.precinct_name
     from public.v_precinct_shortlist v
     join public.councils c on c.canonical_name = v.council_name
     where c.region_group = $1
       and ($2::text[] is null or v.precinct_name <> all($2::text[]))
     order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
              v.recent_application_count desc nulls last,
              v.active_pipeline_count desc nulls last,
              v.friction_score asc nulls last
     limit 1`,
    [regionGroup, selected.length ? selected : null]
  )
  if (extraPriority.rows.length) selected.push(extraPriority.rows[0].precinct_name)

  return unique(selected)
}

async function main() {
  const options = parseArgs()
  const client = await connectWithFallback()
  try {
    const precincts = await selectPrecincts(client, options.regionGroup)
    removeOutdatedDatedDeepDives(options.outputName, precincts)
    for (const precinct of precincts) {
      const args = [
        `--precinct=${precinct}`,
        `--snapshot-date=${options.snapshotDate}`,
        `--dashboard-path=${options.dashboardPath}`,
        `--radar-path=${options.radarPath}`
      ]
      if (options.outputName) args.push(`--output-name=${options.outputName}`)
      runNodeScript('scripts/generate_deep_dive_memo.mjs', args)
    }
  } finally {
    await client.end()
  }

  if (options.renderHtml) {
    runNodeScript('scripts/render_client_reports.mjs')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
