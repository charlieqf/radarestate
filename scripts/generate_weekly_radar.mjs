import fs from 'node:fs'
import path from 'node:path'
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

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU').format(Number(value))
}

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
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

function uniqueRows(rows, keyFn) {
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

function pickTopNames(rows, field, count) {
  return rows.slice(0, count).map((row) => `\`${row[field]}\``)
}

function buildHeadline(topA, constrained) {
  const leaders = pickTopNames(topA, 'precinct_name', 3)
  const risked = pickTopNames(constrained, 'precinct_name', 2)

  if (leaders.length && risked.length) {
    return `${leaders.join('、')} 目前仍是最值得优先看的 precinct，而 ${risked.join('、')} 在 flood / bushfire / friction 叠加后应下调为高风险观察。`
  }
  if (leaders.length) {
    return `${leaders.join('、')} 当前领跑本期 shortlist，属于政策与 activity 同时成立的重点 precinct。`
  }
  return '当前最值得看的不是单一 suburb 热度，而是同时具备 policy momentum、recent activity 和较低 friction 的 precinct。'
}

function buildExecutiveSummary(topA, constrained, councilRanking, pipeline, constraintRows) {
  const bullets = []
  if (topA.length) {
    const names = pickTopNames(topA, 'precinct_name', 3).join('、')
    bullets.push(`${names} 目前构成首批高优先级 precinct，特点是 active pipeline 和 recent applications 能同时成立，且 friction 仍可控。`)
  }

  if (councilRanking.length) {
    const names = pickTopNames(councilRanking, 'council_name', 3).join('、')
    bullets.push(`${names} 仍是 council-level activity 最强的一组，适合继续向 precinct 和 street-level 深挖。`)
  }

  const floodHigh = constraintRows.find((row) => row.constraint_type === 'flood_metadata_signal' && row.severity === 'high')
  const bushfireHigh = constraintRows.find((row) => row.constraint_type === 'bushfire_spatial_sample' && row.severity === 'high')
  if (floodHigh || bushfireHigh || constrained.length) {
    const parts = []
    if (floodHigh) parts.push(`flood metadata high hits = ${floodHigh.total}`)
    if (bushfireHigh) parts.push(`bushfire spatial high hits = ${bushfireHigh.total}`)
    const names = pickTopNames(constrained, 'precinct_name', 3).join('、')
    bullets.push(`${names || '若干高活动 precinct'} 已出现明显风险叠加，当前更适合做 risk-adjusted watchlist，而不是直接升级成 acquisition priority。${parts.length ? ` 当前最强的风险来源包括 ${parts.join('，')}。` : ''}`)
  }

  if (pipeline.length) {
    const activeCount = pipeline
      .filter((row) => ['under_assessment', 'pre_exhibition', 'on_exhibition', 'finalisation'].includes(row.stage))
      .reduce((sum, row) => sum + Number(row.proposal_count || 0), 0)
    const madeRow = pipeline.find((row) => row.stage === 'made')
    bullets.push(`当前 proposal pipeline 中仍有 ${formatNumber(activeCount)} 条 active items，另有 ${formatNumber(madeRow?.proposal_count || 0)} 条已进入 made stage，说明政策主线已足够支撑持续型 radar 输出。`)
  }

  return bullets
}

async function main() {
  const client = await connectWithFallback()
  try {
    const metaPlanning = await client.query(`select count(*)::int as total from public.planning_proposals`)
    const metaApps = await client.query(`select count(*)::int as total from public.application_signals`)
    const metaPrecinct = await client.query(`select count(*)::int as total from public.v_precinct_shortlist`)
    const metaConstraints = await client.query(`select count(*)::int as total from public.constraints`)
    const councilRanking = await client.query(`select council_name, target_value, application_recent_count, active_pipeline_count from public.v_council_scoreboard where region_group = 'Greater Sydney' order by application_recent_count desc nulls last, active_pipeline_count desc nulls last limit 10`)
    const pipeline = await client.query(`select stage, stage_rank, proposal_count, council_count from public.v_policy_pipeline order by stage_rank nulls last, stage`)
    const shortlist = await client.query(`select precinct_name, council_name, opportunity_rating, policy_score, friction_score, timing_score, recent_application_count, active_pipeline_count, constraint_summary, recommended_action, trigger_summary from public.v_precinct_shortlist limit 10`)
    const constrained = await client.query(`select precinct_name, council_name, opportunity_rating, friction_score, constraint_summary, recent_application_count, active_pipeline_count from public.v_precinct_shortlist where constraint_count > 0 order by friction_score desc, recent_application_count desc limit 10`)
    const watchlist = await client.query(`select council_name, stage, title, location_text from public.v_sydney_proposal_watchlist where stage in ('under_assessment','pre_exhibition','on_exhibition','finalisation') order by stage_rank nulls last, last_seen_at desc, title limit 20`)
    const constraintRows = await client.query(`select constraint_type, severity, count(*)::int as total from public.constraints group by constraint_type, severity order by constraint_type, severity`)

    const today = new Date().toISOString().slice(0, 10)
    const topA = shortlist.rows.filter((row) => row.opportunity_rating === 'A')
    const headline = buildHeadline(topA, constrained.rows)
    const summaryBullets = buildExecutiveSummary(topA, constrained.rows, councilRanking.rows, pipeline.rows, constraintRows.rows)
    const dedupedWatchlist = uniqueRows(watchlist.rows, (row) => `${row.stage}|${row.council_name}|${row.title}|${row.location_text}`).slice(0, 12)

    const markdown = [
      '# Sydney Planning Opportunity Radar',
      '',
      `## Week Of ${today}`,
      '',
      `Companion visual dashboard: \`dashboard/latest-report.html\``,
      '',
      '## Headline',
      '',
      headline,
      '',
      '## Snapshot',
      '',
      `- Planning proposals tracked: \`${formatNumber(metaPlanning.rows[0].total)}\``,
      `- Application signals tracked: \`${formatNumber(metaApps.rows[0].total)}\``,
      `- Precinct shortlist items: \`${formatNumber(metaPrecinct.rows[0].total)}\``,
      `- Derived constraints: \`${formatNumber(metaConstraints.rows[0].total)}\``,
      '',
      '## Executive Summary',
      '',
      ...summaryBullets.map((item) => `- ${item}`),
      '',
      '## Top Precinct Hotlist',
      '',
      markdownTable(
        ['Rank', 'Precinct', 'Council', 'Rating', 'Policy', 'Timing', 'Risk', 'Recent Apps', 'Pipeline', 'Action'],
        shortlist.rows.map((row, index) => [
          String(index + 1),
          row.precinct_name,
          row.council_name,
          row.opportunity_rating,
          String(row.policy_score ?? '-'),
          String(row.timing_score ?? '-'),
          String(row.friction_score ?? '-'),
          formatNumber(row.recent_application_count),
          formatNumber(row.active_pipeline_count),
          row.recommended_action
        ])
      ),
      '',
      '## Highest Friction Precincts',
      '',
      markdownTable(
        ['Precinct', 'Council', 'Risk', 'Recent Apps', 'Pipeline', 'Constraint Summary'],
        constrained.rows.map((row) => [
          row.precinct_name,
          row.council_name,
          String(row.friction_score ?? '-'),
          formatNumber(row.recent_application_count),
          formatNumber(row.active_pipeline_count),
          row.constraint_summary || '-'
        ])
      ),
      '',
      '## Council Scoreboard',
      '',
      markdownTable(
        ['Council', 'Target', 'Recent Apps', 'Active Pipeline'],
        councilRanking.rows.map((row) => [
          row.council_name,
          formatNumber(row.target_value),
          formatNumber(row.application_recent_count),
          formatNumber(row.active_pipeline_count)
        ])
      ),
      '',
      '## Policy Pipeline',
      '',
      markdownTable(
        ['Stage', 'Proposal Count', 'Council Count'],
        pipeline.rows.map((row) => [
          stageLabel(row.stage),
          formatNumber(row.proposal_count),
          formatNumber(row.council_count)
        ])
      ),
      '',
      '## Proposal Watchlist',
      '',
      markdownTable(
        ['Stage', 'Council', 'Title', 'Location'],
        dedupedWatchlist.map((row) => [
          stageLabel(row.stage),
          row.council_name || '-',
          row.title,
          row.location_text || '-'
        ])
      ),
      '',
      '## Derived Risk Mix',
      '',
      markdownTable(
        ['Constraint Type', 'Severity', 'Count'],
        constraintRows.rows.map((row) => [
          row.constraint_type,
          row.severity,
          formatNumber(row.total)
        ])
      ),
      '',
      '## Suggested Next Actions',
      '',
      '1. Prioritise `A`-rated precincts with low friction for deeper street-level or owner-contact research.',
      '2. Keep high-activity but high-friction precincts in a separate risk-adjusted watchlist rather than the main acquisition shortlist.',
      '3. Use `dashboard/latest-report.html` to visually inspect clusters before writing the next deep-dive memo.',
      ''
    ].join('\n')

    const reportsDir = path.join(root, 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })
    const outPath = path.join(reportsDir, 'weekly-radar-latest.md')
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
