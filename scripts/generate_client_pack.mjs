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

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU').format(Number(value))
}

async function main() {
  const client = await connectWithFallback()
  try {
    const topOpportunity = await client.query(
      `select precinct_name, council_name, opportunity_rating, friction_score, recent_application_count, active_pipeline_count
       from public.v_precinct_shortlist
       order by case opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
                friction_score asc nulls last,
                recent_application_count desc nulls last,
                active_pipeline_count desc nulls last
       limit 1`
    )

    const topRisk = await client.query(
      `select precinct_name, council_name, opportunity_rating, friction_score, recent_application_count, active_pipeline_count
       from public.v_precinct_shortlist
       where constraint_count > 0
       order by friction_score desc nulls last,
                recent_application_count desc nulls last,
                active_pipeline_count desc nulls last
       limit 1`
    )

    if (!topOpportunity.rows.length) throw new Error('No top opportunity precinct found')
    if (!topRisk.rows.length) throw new Error('No constrained precinct found')

    const best = topOpportunity.rows[0]
    const risk = topRisk.rows[0]

    runNodeScript('scripts/generate_dashboard_report.mjs')
    runNodeScript('scripts/generate_weekly_radar.mjs')
    runNodeScript('scripts/generate_deep_dive_memo.mjs', [`--precinct=${best.precinct_name}`])
    runNodeScript('scripts/generate_deep_dive_memo.mjs', [`--precinct=${risk.precinct_name}`])

    const today = new Date().toISOString().slice(0, 10)
    const markdown = [
      '# Client Pack',
      '',
      `## Date`,
      '',
      today,
      '',
      '## Included Deliverables',
      '',
      '- `dashboard/latest-report.html`',
      '- `reports/weekly-radar-latest.md`',
      `- \`reports/deep-dive-${slugify(best.precinct_name)}.md\``,
      `- \`reports/deep-dive-${slugify(risk.precinct_name)}.md\``,
      '',
      '## Reading Order',
      '',
      '1. Open `dashboard/latest-report.html` for the visual scan.',
      '2. Read `reports/weekly-radar-latest.md` for the current market-level interpretation.',
      `3. Read \`reports/deep-dive-${slugify(best.precinct_name)}.md\` for the current strongest opportunity precinct.`,
      `4. Read \`reports/deep-dive-${slugify(risk.precinct_name)}.md\` for the strongest cautionary or risk-adjusted precinct.`,
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
    const outPath = path.join(reportsDir, 'client-pack-latest.md')
    fs.writeFileSync(outPath, markdown, 'utf8')
    console.log(`Wrote ${outPath}`)

    runNodeScript('scripts/render_client_reports.mjs')
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
