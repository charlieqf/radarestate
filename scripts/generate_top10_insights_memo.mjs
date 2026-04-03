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

function toList(items, formatter = (value) => `\`${value}\``) {
  return items.filter(Boolean).map(formatter).join('、')
}

function insightBlock(index, title, finding, evidence, whyItMatters, action) {
  return [
    `## ${index}. ${title}`,
    '',
    `- Finding: ${finding}`,
    `- Evidence: ${evidence}`,
    `- Why it matters: ${whyItMatters}`,
    `- Action: ${action}`,
    ''
  ].join('\n')
}

async function main() {
  const client = await connectWithFallback()
  try {
    const regionSummary = await client.query(`
      with shortlist as (
        select c.region_group,
               count(*)::int as shortlist_items,
               count(*) filter (where v.opportunity_rating='A')::int as a_count,
               count(*) filter (where v.opportunity_rating='B')::int as b_count,
               count(*) filter (where v.opportunity_rating='C')::int as c_count,
               avg(v.friction_score)::numeric(10,2) as avg_friction,
               avg(v.recent_application_count)::numeric(10,2) as avg_recent_apps
        from public.v_precinct_shortlist v
        join public.councils c on c.canonical_name = v.council_name
        group by c.region_group
      ), councils as (
        select region_group,
               count(*)::int as councils,
               coalesce(sum(application_recent_count),0)::int as recent_apps,
               coalesce(sum(active_pipeline_count),0)::int as active_pipeline,
               count(*) filter (where target_value is not null)::int as councils_with_targets
        from public.v_council_scoreboard
        group by region_group
      )
      select c.region_group, c.councils, c.recent_apps, c.active_pipeline, c.councils_with_targets,
             s.shortlist_items, s.a_count, s.b_count, s.c_count, s.avg_friction, s.avg_recent_apps
      from councils c join shortlist s using(region_group)
      order by region_group
    `)

    const topShortlist = await client.query(`
      select v.precinct_name, v.council_name, c.region_group, v.opportunity_rating, v.policy_score, v.friction_score,
             v.recent_application_count, v.active_pipeline_count
      from public.v_precinct_shortlist v
      join public.councils c on c.canonical_name = v.council_name
      order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
               v.friction_score asc nulls last,
               v.recent_application_count desc nulls last
      limit 12
    `)

    const highestFriction = await client.query(`
      select v.precinct_name, v.council_name, c.region_group, v.friction_score, v.recent_application_count,
             v.active_pipeline_count, v.constraint_summary
      from public.v_precinct_shortlist v
      join public.councils c on c.canonical_name = v.council_name
      where v.constraint_count > 0
      order by v.friction_score desc, v.recent_application_count desc
      limit 10
    `)

    const councilCluster = await client.query(`
      select council_name, region_group, target_value, application_recent_count, active_pipeline_count
      from public.v_council_scoreboard
      order by application_recent_count desc nulls last, active_pipeline_count desc nulls last
      limit 8
    `)

    const activityLed = await client.query(`
      select v.precinct_name, v.council_name, c.region_group, v.recent_application_count, v.active_pipeline_count,
             v.policy_score, v.opportunity_rating, v.friction_score
      from public.v_precinct_shortlist v
      join public.councils c on c.canonical_name = v.council_name
      where v.recent_application_count >= 150 and coalesce(v.active_pipeline_count,0)=0
      order by v.recent_application_count desc
      limit 8
    `)

    const policyLed = await client.query(`
      select v.precinct_name, v.council_name, c.region_group, v.recent_application_count, v.active_pipeline_count,
             v.policy_score, v.opportunity_rating, v.friction_score
      from public.v_precinct_shortlist v
      join public.councils c on c.canonical_name = v.council_name
      where coalesce(v.active_pipeline_count,0) >= 2 and coalesce(v.recent_application_count,0) < 100
      order by v.active_pipeline_count desc, v.recent_application_count desc
      limit 8
    `)

    const riskMix = await client.query(`
      select constraint_type, severity, count(*)::int as total
      from public.constraints
      group by constraint_type, severity
      order by total desc, constraint_type, severity
    `)

    const woollahraSignals = await client.query(`
      select pp.title, pp.stage, pp.location_text
      from public.planning_proposals pp
      join public.councils c on c.id = pp.council_id
      where c.canonical_name = 'Woollahra'
        and pp.stage in ('under_assessment','pre_exhibition','on_exhibition','finalisation')
      order by pp.stage_rank, pp.last_seen_at desc
      limit 8
    `)

    const today = new Date().toISOString().slice(0, 10)
    const summaryByRegion = Object.fromEntries(regionSummary.rows.map((row) => [row.region_group, row]))
    const sydney = summaryByRegion['Greater Sydney']
    const hunter = summaryByRegion['Hunter']
    const aLeaders = topShortlist.rows.filter((row) => row.opportunity_rating === 'A').slice(0, 4)
    const hunterLeaders = topShortlist.rows.filter((row) => row.region_group === 'Hunter').slice(0, 4)
    const highRisk = highestFriction.rows.slice(0, 4)
    const topCouncils = councilCluster.rows.slice(0, 4)
    const floodRow = riskMix.rows.find((row) => row.constraint_type === 'flood_metadata_signal' && row.severity === 'high')
    const bushfireRow = riskMix.rows.find((row) => row.constraint_type === 'bushfire_spatial_sample' && row.severity === 'high')
    const targetCoverageSydney = `${sydney.councils_with_targets}/${sydney.councils}`
    const targetCoverageHunter = `${hunter.councils_with_targets}/${hunter.councils}`

    const markdown = [
      '# Top 10 Insights',
      '',
      `## Date`,
      '',
      today,
      '',
      '## Companion Outputs',
      '',
      '- `dashboard/hero-visual-pack.html`',
      '- `dashboard/latest-report.html`',
      '- `reports/weekly-radar-latest.md`',
      '- `reports/weekly-radar-newcastle-hunter.md`',
      '',
      insightBlock(
        1,
        'Risk-adjusted leaders are not the loudest precincts',
        `${toList(aLeaders.map((row) => row.precinct_name))} currently lead the shortlist because policy and activity are both visible while friction remains low.`,
        aLeaders.map((row) => `${row.precinct_name}: recent apps ${formatNumber(row.recent_application_count)}, active pipeline ${formatNumber(row.active_pipeline_count)}, risk ${row.friction_score}`).join('; '),
        'This is the clearest evidence that the system is not just surfacing noisy, high-volume markets. It is already separating cleaner opportunity precincts from merely busy ones.',
        'Use these names as the first layer for committee discussion and street-level follow-up.'
      ),
      insightBlock(
        2,
        'The biggest opportunity trap is “high activity but structurally dirty”',
        `${toList(highRisk.map((row) => row.precinct_name))} are active enough to look attractive, but current risk stacking pushes them into caution territory.`,
        highRisk.map((row) => `${row.precinct_name}: risk ${row.friction_score}, recent apps ${formatNumber(row.recent_application_count)}, constraints ${row.constraint_summary}`).join('; '),
        'These are exactly the precincts where a simplistic heat-map or activity-only product would be misleading.',
        'Keep them in a separate risk-adjusted watchlist rather than promoting them into the main acquisition shortlist.'
      ),
      insightBlock(
        3,
        'Sydney activity is clustering hardest in the west and north-west',
        `${toList(topCouncils.map((row) => row.council_name))} currently dominate the council-level activity scoreboard.`,
        topCouncils.map((row) => `${row.council_name}: recent apps ${formatNumber(row.application_recent_count)}, active pipeline ${formatNumber(row.active_pipeline_count)}`).join('; '),
        'This suggests the strongest near-term search universe is not the CBD or the prestige east, but the western, south-western and north-western growth and middle-ring corridors.',
        'Use council-level strength as the top-down filter, then move to precinct-level selection.'
      ),
      insightBlock(
        4,
        'The inner east is showing more policy motion than intuition would suggest',
        'Woollahra is no longer just a prestige residential story. It is now a visible planning watchlist cluster.',
        woollahraSignals.rows.map((row) => `${row.title} [${row.stage}]`).join('; '),
        'This is a useful reminder that policy-led opportunity can emerge in places that traditional “developer hotspot” lists often underweight.',
        'Keep Edgecliff / Double Bay in the “serious but selective” category rather than dismissing them as premium residential only.'
      ),
      insightBlock(
        5,
        'There is a real class of activity-led precincts with weak policy visibility',
        `${toList(activityLed.rows.slice(0, 5).map((row) => row.precinct_name))} are all moving on activity before strong active-pipeline evidence appears.`,
        activityLed.rows.slice(0, 5).map((row) => `${row.precinct_name}: recent apps ${formatNumber(row.recent_application_count)}, policy ${row.policy_score}, active pipeline ${formatNumber(row.active_pipeline_count)}`).join('; '),
        'These are the places where the market or development behaviour may already be changing faster than the public policy narrative suggests.',
        'Treat them as market-led search pools that need more site-level diligence before conviction increases.'
      ),
      insightBlock(
        6,
        'There is a smaller but more valuable class of policy-led early precincts',
        `${toList(policyLed.rows.map((row) => row.precinct_name))} stand out because policy intensity is visible before recent mapped activity becomes broad.`,
        policyLed.rows.map((row) => `${row.precinct_name}: policy ${row.policy_score}, active pipeline ${formatNumber(row.active_pipeline_count)}, recent apps ${formatNumber(row.recent_application_count)}`).join('; '),
        'This is where planning intelligence is most likely to add timing edge, because the story is still earlier in the translation from policy into visible market behaviour.',
        'Use these as front-running candidates rather than waiting for activity counts to catch up.'
      ),
      insightBlock(
        7,
        'Flood and bushfire dominate the current risk stack',
        'The most common risk signals in the current system are flood metadata hits and bushfire spatial hits, not biodiversity or heritage-style constraints.',
        `Flood high hits: ${formatNumber(floodRow?.total)}; bushfire high hits: ${formatNumber(bushfireRow?.total)}.`,
        'That tells us the current shortlist is being shaped much more by environmental and implementation exposure than by abstract planning complexity alone.',
        'Keep prioritising better flood and bushfire data quality, because that is where ranking changes are happening most often.'
      ),
      insightBlock(
        8,
        'Hunter is viable, but it is not a Sydney clone',
        'Hunter now clearly supports a real radar product, but the output profile is lower-conviction and more risk-adjusted than Sydney.',
        `Sydney: A=${sydney.a_count}, B=${sydney.b_count}, C=${sydney.c_count}, avg friction=${sydney.avg_friction}. Hunter: A=${hunter.a_count}, B=${hunter.b_count}, C=${hunter.c_count}, avg friction=${hunter.avg_friction}.`,
        'The Hunter pack is real and usable, but it should be sold and interpreted as a regional watchlist rather than a high-certainty acquisition engine.',
        'Frame Hunter outputs as “where to investigate next” instead of “where to move first with highest conviction”.'
      ),
      insightBlock(
        9,
        'Newcastle core looks stronger than the broader Hunter fringe',
        `${toList(hunterLeaders.map((row) => row.precinct_name))} currently form the most compelling part of the Hunter shortlist.`,
        hunterLeaders.map((row) => `${row.precinct_name}: rating ${row.opportunity_rating}, recent apps ${formatNumber(row.recent_application_count)}, risk ${row.friction_score}`).join('; '),
        'This suggests the Hunter story is not evenly distributed. Newcastle core and selected Lake Macquarie / Maitland / Port Stephens nodes are more investable than the region-wide average.',
        'Focus deep-dive effort on Newcastle core and the strongest submarkets before widening the regional watchlist.'
      ),
      insightBlock(
        10,
        'Data asymmetry is shaping the quality and tone of the output',
        'Sydney can support target-pressure narratives; Hunter currently cannot, because housing-target coverage is absent there.',
        `Target coverage: Greater Sydney ${targetCoverageSydney}; Hunter ${targetCoverageHunter}.`,
        'That means the system should not pretend both regions support the same style of argument. Sydney can be framed around target pressure plus policy plus activity; Hunter is currently better framed around activity plus proposal plus risk.',
        'Keep report language region-specific rather than forcing one national narrative onto very different data environments.'
      ),
      '## Bottom Line',
      '',
      'The most meaningful discovery is that the system now consistently separates `clean opportunity`, `busy but risky`, and `regionally viable but lower-conviction` precincts. That is much more useful than a generic hotspot list.',
      ''
    ].join('\n')

    const reportsDir = path.join(root, 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })
    const outPath = path.join(reportsDir, 'top-10-insights-latest.md')
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
