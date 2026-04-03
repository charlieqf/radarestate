import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function loadConfig(configPath) {
  const absolutePath = path.isAbsolute(configPath) ? configPath : path.join(root, configPath)
  const config = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  if (!config.extends) return config
  const parentPath = path.isAbsolute(config.extends)
    ? config.extends
    : path.join(path.dirname(absolutePath), config.extends)
  const base = loadConfig(parentPath)
  return {
    ...base,
    ...config,
    precincts: [...(base.precincts || []), ...(config.precincts || [])]
  }
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
    precinctConfig: 'mvp/config/precinct-focus-map.json',
    name: 'coverage-pack'
  }
  for (const arg of args) {
    if (arg.startsWith('--precinct-config=')) options.precinctConfig = arg.split('=')[1].trim()
    if (arg.startsWith('--name=')) options.name = arg.split('=')[1].trim()
  }
  return options
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU').format(Number(value))
}

function markdownTable(headers, rows) {
  const headerLine = `| ${headers.join(' | ')} |`
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? '-').replace(/\|/g, '\\|')).join(' | ')} |`).join('\n')
  return [headerLine, separatorLine, body].filter(Boolean).join('\n')
}

function pct(part, whole) {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

function ratingMix(rows) {
  const out = { A: 0, B: 0, C: 0 }
  for (const row of rows) {
    if (row.opportunity_rating in out) out[row.opportunity_rating] += 1
  }
  return out
}

function readiness(summary, riskSummary, shortlistRows) {
  const mappingReady = summary.precincts_with_any_signal >= Math.ceil(summary.precinct_count * 0.35)
    && summary.mapped_applications >= 1000
    && summary.mapped_proposals >= 50

  const distinctConstraintTypes = new Set(riskSummary.map((row) => row.constraint_type)).size
  const riskReady = summary.precincts_with_constraints >= Math.ceil(summary.precinct_count * 0.2)
    && distinctConstraintTypes >= 3

  const mix = ratingMix(shortlistRows)
  const reportReady = shortlistRows.length >= 12 && (mix.A + mix.B) >= 5

  return {
    mappingReady,
    riskReady,
    reportReady,
    overallReady: mappingReady && riskReady && reportReady,
    mix
  }
}

async function main() {
  const options = parseArgs()
  const config = loadConfig(options.precinctConfig)
  const client = await connectWithFallback()
  try {
    const precinctCodes = config.precincts.map((item) => item.code)
    const configuredCouncils = [...new Set(config.precincts.map((item) => item.primaryCouncil))]

    const overview = await client.query(
      `with pack as (
         select id, precinct_code
         from public.precincts
         where precinct_code = any($1::text[])
       ), proposal_counts as (
         select precinct_id, count(*)::int as total
         from public.planning_proposals
         where precinct_id in (select id from pack)
         group by precinct_id
       ), app_counts as (
         select precinct_id, count(*)::int as total
         from public.application_signals
         where precinct_id in (select id from pack)
         group by precinct_id
       ), constraint_counts as (
         select precinct_id, count(*)::int as total
         from public.constraints
         where precinct_id in (select id from pack)
         group by precinct_id
       )
       select
         count(*)::int as precinct_count,
         count(*) filter (where coalesce(pc.total, 0) > 0)::int as precincts_with_proposals,
         count(*) filter (where coalesce(ac.total, 0) > 0)::int as precincts_with_applications,
         count(*) filter (where coalesce(pc.total, 0) > 0 or coalesce(ac.total, 0) > 0)::int as precincts_with_any_signal,
         count(*) filter (where coalesce(cc.total, 0) > 0)::int as precincts_with_constraints,
         coalesce(sum(pc.total), 0)::int as mapped_proposals,
         coalesce(sum(ac.total), 0)::int as mapped_applications
       from pack p
       left join proposal_counts pc on pc.precinct_id = p.id
       left join app_counts ac on ac.precinct_id = p.id
       left join constraint_counts cc on cc.precinct_id = p.id`,
      [precinctCodes]
    )

    const byCouncil = await client.query(
      `select council_name, count(*)::int as precinct_count,
              coalesce(sum(active_pipeline_count), 0)::int as active_pipeline_count,
              coalesce(sum(recent_application_count), 0)::int as recent_application_count,
              count(*) filter (where active_pipeline_count > 0 or recent_application_count > 0)::int as precincts_with_signals,
              count(*) filter (where constraint_count > 0)::int as precincts_with_constraints
       from public.v_precinct_signal_summary
       where precinct_code = any($1::text[])
       group by council_name
       order by recent_application_count desc, active_pipeline_count desc, council_name`,
      [precinctCodes]
    )

    const riskSummary = await client.query(
      `select constraint_type, severity, count(*)::int as total
       from public.constraints c
       join public.precincts p on p.id = c.precinct_id
       where p.precinct_code = any($1::text[])
       group by constraint_type, severity
       order by constraint_type, severity`,
      [precinctCodes]
    )

    const shortlist = await client.query(
      `select precinct_name, council_name, opportunity_rating, policy_score, friction_score, timing_score, recent_application_count, active_pipeline_count, constraint_summary
       from public.v_precinct_shortlist
       where precinct_code = any($1::text[])
       order by case opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
                friction_score asc nulls last,
                recent_application_count desc nulls last,
                active_pipeline_count desc nulls last`,
      [precinctCodes]
    )

    const summary = overview.rows[0]
    const gates = readiness(summary, riskSummary.rows, shortlist.rows)
    const today = new Date().toISOString().slice(0, 10)
    const outPath = path.join(root, 'reports', `coverage-readiness-${options.name}.md`)

    const markdown = [
      `# Coverage Readiness: ${options.name}`,
      '',
      `## Date`,
      '',
      today,
      '',
      '## Scope',
      '',
      `- Precinct config: \`${options.precinctConfig}\``,
      `- Configured councils: \`${configuredCouncils.length}\``,
      `- Configured precincts: \`${config.precincts.length}\``,
      '',
      '## Gate Verdict',
      '',
      `- Precinct mapping: \`${gates.mappingReady ? 'PASS' : 'REVIEW'}\``,
      `- Risk layer availability: \`${gates.riskReady ? 'PASS' : 'REVIEW'}\``,
      `- Stable shortlist and report output: \`${gates.reportReady ? 'PASS' : 'REVIEW'}\``,
      `- Overall: \`${gates.overallReady ? 'READY TO EXPAND' : 'NOT YET FULLY READY'}\``,
      '',
      '## Mapping Coverage',
      '',
      `- Precincts with any signal: \`${formatNumber(summary.precincts_with_any_signal)} / ${formatNumber(summary.precinct_count)}\` (${pct(summary.precincts_with_any_signal, summary.precinct_count)}%)`,
      `- Precincts with mapped proposals: \`${formatNumber(summary.precincts_with_proposals)}\``,
      `- Precincts with mapped applications: \`${formatNumber(summary.precincts_with_applications)}\``,
      `- Total mapped proposals: \`${formatNumber(summary.mapped_proposals)}\``,
      `- Total mapped applications: \`${formatNumber(summary.mapped_applications)}\``,
      '',
      markdownTable(
        ['Council', 'Precincts', 'With Signals', 'Recent Apps', 'Active Pipeline', 'With Constraints'],
        byCouncil.rows.map((row) => [
          row.council_name,
          formatNumber(row.precinct_count),
          formatNumber(row.precincts_with_signals),
          formatNumber(row.recent_application_count),
          formatNumber(row.active_pipeline_count),
          formatNumber(row.precincts_with_constraints)
        ])
      ),
      '',
      '## Risk Layer Availability',
      '',
      `- Precincts with at least one constraint: \`${formatNumber(summary.precincts_with_constraints)} / ${formatNumber(summary.precinct_count)}\` (${pct(summary.precincts_with_constraints, summary.precinct_count)}%)`,
      '',
      markdownTable(
        ['Constraint Type', 'Severity', 'Count'],
        riskSummary.rows.map((row) => [row.constraint_type, row.severity, formatNumber(row.total)])
      ),
      '',
      '## Shortlist And Report Stability',
      '',
      `- Shortlist items in pack: \`${formatNumber(shortlist.rows.length)}\``,
      `- Rating mix: \`A=${gates.mix.A}\`, \`B=${gates.mix.B}\`, \`C=${gates.mix.C}\``,
      '',
      markdownTable(
        ['Rank', 'Precinct', 'Council', 'Rating', 'Risk', 'Recent Apps', 'Pipeline'],
        shortlist.rows.slice(0, 15).map((row, index) => [
          String(index + 1),
          row.precinct_name,
          row.council_name,
          row.opportunity_rating,
          String(row.friction_score ?? '-'),
          formatNumber(row.recent_application_count),
          formatNumber(row.active_pipeline_count)
        ])
      ),
      '',
      '## Interpretation',
      '',
      gates.mappingReady
        ? '- Mapping has moved beyond council-level heat and is now usable at precinct level.'
        : '- Mapping still needs denser precinct coverage or better keyword quality, otherwise too many precincts will remain thin or empty.',
      gates.riskReady
        ? '- The risk layer is already changing shortlist order, which means the expanded pack is doing more than just surfacing hotter places.'
        : '- The risk layer is still too thin, so the expanded shortlist may overreact to activity alone.',
      gates.reportReady
        ? '- The current expanded pack can already produce a stable enough shortlist and report set.'
        : '- The current expanded pack is not yet strong enough for stable client-facing reporting and still needs better mapping or risk coverage.',
      ''
    ].join('\n')

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
