import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const RECENT_FROM = '2025-01-01'

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

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    precinct: null,
    dashboardPath: 'dashboard/latest-report.html',
    radarPath: 'reports/weekly-radar-latest.md'
  }
  for (const arg of args) {
    if (arg.startsWith('--precinct=')) {
      options.precinct = arg.split('=')[1].trim()
    }
    if (arg.startsWith('--dashboard-path=')) {
      options.dashboardPath = arg.split('=')[1].trim()
    }
    if (arg.startsWith('--radar-path=')) {
      options.radarPath = arg.split('=')[1].trim()
    }
  }
  return options
}

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU').format(Number(value))
}

function stageLabel(stage) {
  const labels = {
    under_assessment: 'Under Assessment',
    pre_exhibition: 'Pre-Exhibition',
    on_exhibition: 'On Exhibition',
    finalisation: 'Finalisation',
    made: 'Made',
    withdrawn: 'Withdrawn'
  }
  return labels[stage] || stage
}

function markdownTable(headers, rows) {
  const headerLine = `| ${headers.join(' | ')} |`
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.map((cell) => clean(cell).replace(/\|/g, '\\|')).join(' | ')} |`).join('\n')
  return [headerLine, separatorLine, body].filter(Boolean).join('\n')
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function dedupeRows(rows, keyFn) {
  const seen = new Set()
  const output = []
  for (const row of rows) {
    const key = keyFn(row)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(row)
  }
  return output
}

function buildThesis(row) {
  const positives = []
  if (Number(row.active_pipeline_count || 0) > 0) positives.push(`${row.active_pipeline_count} active planning proposal items`)
  if (Number(row.recent_application_count || 0) > 0) positives.push(`${row.recent_application_count} recent applications`)
  if (Number(row.state_significant_count || 0) > 0) positives.push(`${row.state_significant_count} state significant projects`)
  const risk = Number(row.friction_score || 0)

  if (row.opportunity_rating === 'A') {
    return `${row.precinct_name} currently screens as one of the strongest precinct-level candidates because ${positives.join(', ')} are already visible while friction remains ${risk <= 2 ? 'contained' : 'manageable'}.`
  }
  if (risk >= 4) {
    return `${row.precinct_name} is worth tracking because activity and policy signals are real, but it should be treated as a risk-adjusted watchlist item rather than a clean priority precinct.`
  }
  return `${row.precinct_name} is best viewed as a medium-conviction precinct where policy and activity are present, but the case still needs more targeted diligence before it can move into top-tier priority.`
}

function buildWhyNow(row) {
  const parts = []
  if (Number(row.policy_score || 0) >= 4) parts.push('policy momentum is already visible in the current pipeline')
  if (Number(row.timing_score || 0) >= 4) parts.push('recent development activity is sufficiently strong to justify immediate attention')
  if (Number(row.made_count || 0) >= 3) parts.push('there is already a meaningful stock of made-stage planning history in this precinct')
  if (!parts.length) parts.push('the precinct sits inside the current radar universe and still warrants structured monitoring')
  return parts
}

function buildRiskInterpretation(row) {
  const risk = Number(row.friction_score || 0)
  if (risk >= 5) return 'Friction is very high. Treat this as a constrained or contested precinct until more specific site-level evidence proves otherwise.'
  if (risk >= 3) return 'Friction is material. The precinct may still matter, but risk needs to be explicitly included in any acquisition or buyer-agent workflow.'
  if (risk >= 1) return 'Friction is present but not yet disqualifying. The main task is to keep risk visible rather than let strong activity numbers dominate the narrative.'
  return 'No derived friction signal is currently dominant in the first-pass model. This does not mean risk is absent, only that it is not yet surfacing through the current layers.'
}

async function resolvePrecinctName(client, requestedPrecinct) {
  if (requestedPrecinct) return requestedPrecinct
  const { rows } = await client.query(
    `select precinct_name
     from public.v_precinct_shortlist
     order by case opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
              friction_score asc nulls last,
              recent_application_count desc nulls last,
              active_pipeline_count desc nulls last
     limit 1`
  )
  if (!rows.length) throw new Error('No precincts found in v_precinct_shortlist')
  return rows[0].precinct_name
}

async function fetchDeepDiveData(client, precinctName) {
  const shortlist = await client.query(
    `select *
     from public.v_precinct_shortlist
     where precinct_name = $1
     limit 1`,
    [precinctName]
  )
  if (!shortlist.rows.length) throw new Error(`Precinct not found in shortlist: ${precinctName}`)
  const row = shortlist.rows[0]

  const proposals = await client.query(
    `select pp.title, pp.stage, pp.stage_rank, pp.location_text, pp.summary, pp.source_url, pp.last_seen_at
     from public.planning_proposals pp
     left join public.precincts p on p.id = pp.precinct_id
     where p.name = $1
        or pp.location_text ilike '%' || $1 || '%'
     order by pp.stage_rank nulls last, pp.last_seen_at desc, pp.title`,
    [precinctName]
  )

  const apps = await client.query(
    `select
       application_type,
       status,
       location_text,
       lodgement_date,
       source_name,
       tracker_scope
     from public.application_signals a
     join public.precincts p on p.id = a.precinct_id
     where p.name = $1
       and a.tracker_scope = 'applications'
       and coalesce(a.lodgement_date, a.observed_at) >= $2::date
     order by a.lodgement_date desc nulls last, a.observed_at desc
     limit 25`,
    [precinctName, RECENT_FROM]
  )

  const appStatus = await client.query(
    `select status, count(*)::int as total
     from public.application_signals a
     join public.precincts p on p.id = a.precinct_id
     where p.name = $1
       and a.tracker_scope = 'applications'
       and coalesce(a.lodgement_date, a.observed_at) >= $2::date
     group by status
     order by total desc, status`,
    [precinctName, RECENT_FROM]
  )

  const constraints = await client.query(
    `select c.constraint_type, c.severity, c.notes, c.source_name, c.source_url
     from public.constraints c
     join public.precincts p on p.id = c.precinct_id
     where p.name = $1
     order by case c.severity when 'high' then 1 when 'medium' then 2 else 3 end, c.constraint_type`,
    [precinctName]
  )

  const council = await client.query(
    `select council_name, target_value, application_recent_count, active_pipeline_count, urban_tree_canopy_pct, high_heat_vulnerability_pct
     from public.v_council_scoreboard
     where council_name = $1
     limit 1`,
    [row.council_name]
  )

  const mapPoint = await client.query(
    `select centroid_latitude, centroid_longitude, point_count
     from public.v_precinct_map_points
     where precinct_name = $1
     limit 1`,
    [precinctName]
  )

  return {
    row,
    proposals: dedupeRows(proposals.rows, (item) => `${item.stage}|${item.title}|${item.location_text}`),
    apps: dedupeRows(apps.rows, (item) => `${item.lodgement_date}|${item.location_text}|${item.status}`).slice(0, 12),
    appStatus: appStatus.rows,
    constraints: constraints.rows,
    council: council.rows[0] || null,
    mapPoint: mapPoint.rows[0] || null
  }
}

async function main() {
  const options = parseArgs()
  const client = await connectWithFallback()
  try {
    const precinctName = await resolvePrecinctName(client, options.precinct)
    const data = await fetchDeepDiveData(client, precinctName)
    const { row, proposals, apps, appStatus, constraints, council, mapPoint } = data
    const today = new Date().toISOString().slice(0, 10)

    const markdown = [
      `# Deep Dive: ${row.precinct_name}`,
      '',
      `## Date`,
      '',
      today,
      '',
      '## Executive Summary',
      '',
      buildThesis(row),
      '',
      '## Quick Scorecard',
      '',
      `- Council: \`${row.council_name}\``,
      `- Current rating: \`${row.opportunity_rating}\``,
      `- Policy score: \`${row.policy_score ?? '-'}\``,
      `- Timing score: \`${row.timing_score ?? '-'}\``,
      `- Friction score: \`${row.friction_score ?? '-'}\``,
      `- Recent applications: \`${formatNumber(row.recent_application_count)}\``,
      `- Active planning proposals: \`${formatNumber(row.active_pipeline_count)}\``,
      `- State significant projects: \`${formatNumber(row.state_significant_count)}\``,
      `- Recommended action: \`${row.recommended_action}\``,
      mapPoint?.centroid_latitude && mapPoint?.centroid_longitude
        ? `- Map centroid: \`${Number(mapPoint.centroid_latitude).toFixed(6)}, ${Number(mapPoint.centroid_longitude).toFixed(6)}\``
        : '- Map centroid: `-`',
      '',
      '## Why This Precinct Surfaced',
      '',
      `- Trigger summary: ${row.trigger_summary}`,
      ...buildWhyNow(row).map((item) => `- ${item}.`),
      '',
      '## Policy And Planning Context',
      '',
      proposals.length
        ? markdownTable(
            ['Stage', 'Title', 'Location'],
            proposals.slice(0, 12).map((item) => [
              stageLabel(item.stage),
              item.title,
              item.location_text || '-'
            ])
          )
        : 'No mapped proposal records currently surfaced for this precinct.',
      '',
      '## Development Activity Context',
      '',
      appStatus.length
        ? markdownTable(
            ['Status', 'Count'],
            appStatus.map((item) => [item.status || '-', formatNumber(item.total)])
          )
        : 'No recent mapped application records currently surfaced for this precinct.',
      '',
      apps.length
        ? markdownTable(
            ['Lodgement', 'Status', 'Type', 'Location'],
            apps.map((item) => [
              item.lodgement_date ? item.lodgement_date.toISOString?.().slice(0, 10) || clean(item.lodgement_date) : '-',
              item.status || '-',
              item.application_type || '-',
              item.location_text || '-'
            ])
          )
        : '',
      '',
      '## Risk And Friction',
      '',
      buildRiskInterpretation(row),
      '',
      constraints.length
        ? markdownTable(
            ['Constraint Type', 'Severity', 'Notes'],
            constraints.map((item) => [
              item.constraint_type,
              item.severity,
              item.notes || '-'
            ])
          )
        : 'No derived constraint rows currently attached to this precinct.',
      '',
      '## Council Context',
      '',
      council
        ? markdownTable(
            ['Council', '5-year Target', 'Recent Apps', 'Active Pipeline', 'Tree Canopy %', 'High Heat Vulnerability %'],
            [[
              council.council_name,
              formatNumber(council.target_value),
              formatNumber(council.application_recent_count),
              formatNumber(council.active_pipeline_count),
              formatNumber(council.urban_tree_canopy_pct),
              formatNumber(council.high_heat_vulnerability_pct)
            ]]
          )
        : 'No council context row found.',
      '',
      '## What To Do Next',
      '',
      `1. Keep \`${row.precinct_name}\` in the \`${row.opportunity_rating}\`-rated watchlist and treat \`${row.recommended_action}\` as the current workflow state.`,
      `2. Use \`${options.dashboardPath}\` to inspect the surrounding precinct cluster before doing any street-level or owner-contact work.`,
      constraints.length
        ? `3. Explicitly validate the current risk stack (${constraints.map((item) => item.constraint_type).join(', ')}) before promoting this precinct into a transaction-facing shortlist.`
        : '3. The next uplift in confidence will come from more detailed site-level and constraint work rather than more high-level policy scanning.',
      '',
      '## References',
      '',
      `- \`${options.dashboardPath}\``,
      `- \`${options.radarPath}\``,
      ''
    ].join('\n')

    const reportsDir = path.join(root, 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })
    const outPath = path.join(reportsDir, `deep-dive-${slugify(row.precinct_name)}.md`)
    fs.writeFileSync(outPath, markdown, 'utf8')
    console.log(`Wrote ${outPath}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
