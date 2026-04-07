import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const RECENT_FROM = '2025-01-01'
const ACTIVE_POLICY_STAGES = ['under_assessment', 'pre_exhibition', 'on_exhibition', 'finalisation']

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
    outputName: null,
    snapshotDate: new Date().toISOString().slice(0, 10),
    dashboardPath: 'dashboard/latest-report.html',
    radarPath: 'reports/weekly-radar-latest.md'
  }
  for (const arg of args) {
    if (arg.startsWith('--precinct=')) {
      options.precinct = arg.split('=')[1].trim()
    }
    if (arg.startsWith('--output-name=')) {
      options.outputName = arg.split('=')[1].trim()
    }
    if (arg.startsWith('--snapshot-date=')) {
      options.snapshotDate = arg.split('=')[1].trim()
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
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalisePlace(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function precinctPlaceCandidates(precinctName) {
  const base = clean(precinctName)
  const parts = base
    .split('/')
    .map((part) => clean(part))
    .filter(Boolean)
  return [...new Set([base, ...parts])]
}

function mentionsPlace(text, place) {
  const textValue = normalisePlace(text)
  const placeValue = normalisePlace(place)
  return Boolean(textValue && placeValue && textValue.includes(placeValue))
}

function isPrecinctPurePolicyRow(item, precinctName) {
  const location = clean(item.location_text)
  const candidates = precinctPlaceCandidates(precinctName)
  if (!location) return candidates.some((candidate) => mentionsPlace(item.title, candidate))
  const normalisedLocation = normalisePlace(location)
  if (candidates.some((candidate) => normalisePlace(candidate) === normalisedLocation)) return true
  return candidates.some((candidate) => mentionsPlace(location, candidate) && /\d/.test(location))
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU').format(Number(value))
}

function formatMeasure(value, suffix, digits = 0) {
  if (value === null || value === undefined || value === '') return '-'
  return `${Number(value).toFixed(digits)}${suffix}`
}

function formatLotSize(value, units) {
  if (value === null || value === undefined || value === '') return '-'
  return `${formatNumber(value)} ${units || 'sqm'}`
}

function markdownLink(label, href) {
  if (!href) return label
  return `[${label}](${href})`
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
  if (Number(row.policy_score || 0) >= 4) parts.push('Policy momentum is already visible in the current pipeline')
  if (Number(row.timing_score || 0) >= 4) parts.push('Recent development activity is sufficiently strong to justify immediate attention')
  if (Number(row.made_count || 0) >= 3) parts.push('There is already a meaningful stock of made-stage planning history in this precinct')
  if (!parts.length) parts.push('The precinct sits inside the current radar universe and still warrants structured monitoring')
  return parts
}

function buildRiskInterpretation(row) {
  const risk = Number(row.friction_score || 0)
  if (risk >= 5) return 'Friction is very high. Treat this as a constrained or contested precinct until more specific site-level evidence proves otherwise.'
  if (risk >= 3) return 'Friction is material. The precinct may still matter, but risk needs to be explicitly included in any acquisition or buyer-agent workflow.'
  if (risk >= 1) return 'Friction is present but not yet disqualifying. The main task is to keep risk visible rather than let strong activity numbers dominate the narrative.'
  return 'No derived friction signal is currently dominant in the first-pass model. This does not mean risk is absent, only that it is not yet surfacing through the current layers.'
}

function constraintEvidence(item) {
  if (!item?.raw_payload) return item.notes || '-'
  const payload = item.raw_payload

  if (item.constraint_type === 'flood_metadata_signal') {
    const matched = Array.isArray(payload.matched) ? payload.matched : []
    const titles = matched.map((row) => row.title).filter(Boolean).slice(0, 3)
    return titles.length
      ? `Matched flood records: ${titles.join('; ')}`
      : item.notes || '-'
  }

  if (item.constraint_type === 'bushfire_spatial_sample' || item.constraint_type === 'biodiversity_spatial_sample') {
    const categories = Array.isArray(payload.categories) ? payload.categories.filter(Boolean) : []
    return categories.length
      ? `Matched categories: ${categories.join(', ')}`
      : item.notes || '-'
  }

  return item.notes || '-'
}

function policyEvidenceScopeLabel(item, precinctName) {
  return isPrecinctPurePolicyRow(item, precinctName)
    ? 'Precinct-explicit'
    : 'Mapped to precinct via broader or council reference'
}

function constraintUseLabel(constraintType) {
  const contextProxyTypes = new Set(['heat_vulnerability_proxy', 'low_tree_canopy_proxy'])
  const planningProcessTypes = new Set(['policy_withdrawal_friction'])
  const spatialScreeningTypes = new Set(['flood_metadata_signal', 'bushfire_spatial_sample', 'biodiversity_spatial_sample'])

  if (contextProxyTypes.has(constraintType)) return 'Precinct / council context proxy'
  if (planningProcessTypes.has(constraintType)) return 'Planning process signal'
  if (spatialScreeningTypes.has(constraintType)) return 'Transaction-facing screening signal'
  return 'Current screening signal'
}

function controlSourceLinks(row) {
  return [
    row.zoning_source_url ? markdownLink('Zoning', row.zoning_source_url) : null,
    row.fsr_source_url ? markdownLink('FSR', row.fsr_source_url) : null,
    row.height_source_url ? markdownLink('Height', row.height_source_url) : null,
    row.minimum_lot_size_source_url ? markdownLink('Lot size', row.minimum_lot_size_source_url) : null
  ].filter(Boolean).join(' / ') || '-'
}

function jurisdictionMatchesPrecinct(item, precinctCouncil) {
  return clean(item.apparent_site_jurisdiction || precinctCouncil) === clean(precinctCouncil)
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
      where pp.precinct_id = $1
      order by pp.stage_rank nulls last, pp.last_seen_at desc, pp.title`,
    [row.precinct_id]
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
      where a.precinct_id = $1
        and a.tracker_scope = 'applications'
        and coalesce(a.lodgement_date, a.observed_at) >= $2::date
      order by a.lodgement_date desc nulls last, a.observed_at desc
      limit 25`,
    [row.precinct_id, RECENT_FROM]
  )

  const appStatus = await client.query(
    `select status, count(*)::int as total
      from public.application_signals a
      where a.precinct_id = $1
        and a.tracker_scope = 'applications'
        and coalesce(a.lodgement_date, a.observed_at) >= $2::date
      group by status
      order by total desc, status`,
    [row.precinct_id, RECENT_FROM]
  )

    const appTypeMix = await client.query(
      `with grouped as (
        select
          case
            when a.tracker_scope = 'state_significant' then 'SSD'
           when lower(coalesce(a.application_type, '')) like '%complying development certificate%' or lower(coalesce(a.application_type, '')) like '%cdc%' then 'CDC'
           when lower(coalesce(a.application_type, '')) like '%modification%' then 'Modification'
           when lower(coalesce(a.application_type, '')) like '%state significant%' or lower(coalesce(a.application_type, '')) like '%ssd%' then 'SSD'
           when lower(coalesce(a.application_type, '')) like '%development application%' then 'DA'
           else 'Other'
         end as application_bucket,
         count(*)::int as total
        from public.application_signals a
        where a.precinct_id = $1
          and a.tracker_scope in ('applications', 'state_significant')
          and coalesce(a.lodgement_date, a.observed_at) >= $2::date
        group by 1
      )
     select application_bucket, total
     from grouped
     order by case application_bucket when 'DA' then 1 when 'CDC' then 2 when 'SSD' then 3 when 'Modification' then 4 else 5 end,
              total desc,
              application_bucket`,
    [row.precinct_id, RECENT_FROM]
  )

  const constraints = await client.query(
    `select c.constraint_type, c.severity, c.notes, c.source_name, c.source_url, c.raw_payload
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

    const representativeSites = await client.query(
      `select
        s.site_label,
       s.address,
       s.site_key,
       s.screening_score,
       s.apparent_site_jurisdiction,
       s.zoning_code,
       s.zoning_label,
       s.fsr,
       s.height_m,
       s.minimum_lot_size_sqm,
       s.minimum_lot_size_units,
       ctl.zoning_source_url,
       ctl.fsr_source_url,
       ctl.height_source_url,
       ctl.minimum_lot_size_source_url
      from public.v_site_screening_latest s
      left join public.v_site_controls_latest ctl on ctl.site_candidate_id = s.site_candidate_id
      where s.precinct_name = $1
        and s.council_name = $2
        and coalesce(s.apparent_site_jurisdiction, s.council_name, '') = $2
      order by s.screening_score desc,
               s.title_complexity_penalty asc nulls last,
               s.high_constraint_count asc nulls last,
               abs(coalesce(s.geometry_area_sqm, s.plan_area_sqm, 0) - 1200) asc nulls last,
              s.matched_signal_count desc,
              s.site_label
     limit 3`,
    [precinctName, row.council_name]
  )

  const councilPolicyContext = await client.query(
    `select pp.title, pp.stage, pp.stage_rank, pp.location_text, pp.last_seen_at
     from public.planning_proposals pp
     join public.councils c on c.id = pp.council_id
     where c.canonical_name = $1
       and (pp.precinct_id is null or pp.precinct_id <> $2)
       and (
         lower(coalesce(pp.title, '')) similar to '%(housing|strategy|precinct|lep|height|fsr|townhouse|design|employment|heritage|amendment|housekeeping)%'
         or lower(coalesce(pp.location_text, '')) like '%' || lower($1) || '%'
       )
     order by case pp.stage
                when 'under_assessment' then 1
                when 'pre_exhibition' then 2
                when 'on_exhibition' then 3
                when 'finalisation' then 4
                when 'made' then 5
                when 'withdrawn' then 6
                else 7
              end,
              case
                when lower(coalesce(pp.title, '')) similar to '%(housing|strategy|precinct|lep|height|fsr|townhouse|design|employment)%' then 0
                else 1
              end,
              pp.last_seen_at desc nulls last,
              pp.title
     limit 6`,
    [row.council_name, row.precinct_id]
  )

    const rawActiveProposalCount = proposals.rows.filter((item) => ACTIVE_POLICY_STAGES.includes(item.stage)).length
    const dedupedProposals = dedupeRows(proposals.rows, (item) => `${item.stage}|${item.title}|${item.location_text}`)
    const activeProposals = dedupedProposals.filter((item) => ACTIVE_POLICY_STAGES.includes(item.stage))
    const historicalProposals = dedupedProposals.filter((item) => !ACTIVE_POLICY_STAGES.includes(item.stage) && isPrecinctPurePolicyRow(item, precinctName))
    const dedupedCouncilPolicyContext = dedupeRows(councilPolicyContext.rows, (item) => `${item.stage}|${item.title}|${item.location_text}`)

    return {
      row,
      rawActiveProposalCount,
      activeProposals,
      historicalProposals,
      councilPolicyContext: dedupedCouncilPolicyContext,
      representativeSites: representativeSites.rows,
      apps: dedupeRows(apps.rows, (item) => `${item.lodgement_date}|${item.location_text}|${item.status}`).slice(0, 12),
      appStatus: appStatus.rows,
      appTypeMix: appTypeMix.rows,
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
    const { row, rawActiveProposalCount, activeProposals, historicalProposals, councilPolicyContext, representativeSites, apps, appStatus, appTypeMix, constraints, council, mapPoint } = data
    const applicationTypeRows = appTypeMix.filter((item) => item.application_bucket !== 'SSD')
    const applicationTypeMap = Object.fromEntries(applicationTypeRows.map((item) => [item.application_bucket, Number(item.total || 0)]))
    const cdcCount = Number(applicationTypeMap.CDC || 0)
    const daCount = Number(applicationTypeMap.DA || 0)
    const today = options.snapshotDate
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
      `- Precinct council context: \`${row.council_name}\``,
      `- Current rating: \`${row.opportunity_rating}\``,
      `- Policy score: \`${row.policy_score ?? '-'}\``,
      `- Timing score: \`${row.timing_score ?? '-'}\``,
      `- Friction score: \`${row.friction_score ?? '-'}\``,
      `- Recent applications: \`${formatNumber(row.recent_application_count)}\``,
      `- Recent application window start: \`${RECENT_FROM}\``,
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
      `- Current score uses \`${formatNumber(row.active_pipeline_count)}\` active planning proposal items.`,
      `- Current mapped source rows at active stages: \`${formatNumber(rawActiveProposalCount)}\`. Distinct rows shown below after de-duplication / evidence cleanup: \`${formatNumber(activeProposals.length)}\`.`,
      '- Rows below show the currently mapped active proposals behind that count. When a row is not precinct-explicit in its wording, it is still shown and labeled so the score can be audited rather than hidden.',
      '',
      activeProposals.length
        ? markdownTable(
            ['Stage', 'Title', 'Location', 'Evidence Scope'],
            activeProposals.slice(0, 12).map((item) => [
              stageLabel(item.stage),
              item.title,
              item.location_text || '-',
              policyEvidenceScopeLabel(item, row.precinct_name)
            ])
          )
        : 'No active mapped proposal records currently surfaced for this precinct.',
      '',
      historicalProposals.length
        ? markdownTable(
            ['Historical Stage', 'Title', 'Location'],
            historicalProposals.slice(0, 8).map((item) => [
              stageLabel(item.stage),
              item.title,
              item.location_text || '-'
            ])
          )
        : 'No precinct-explicit made / withdrawn policy rows are currently shown in this deep dive.',
      '',
      councilPolicyContext.length && activeProposals.length === 0
        ? 'Related council policy context is shown below because current precinct-explicit policy rows are thin; these rows are background context, not direct precinct-scoring evidence.'
        : '',
      councilPolicyContext.length && activeProposals.length === 0
        ? markdownTable(
            ['Stage', 'Related Council Policy Context', 'Location'],
            councilPolicyContext.slice(0, 6).map((item) => [
              stageLabel(item.stage),
              item.title,
              item.location_text || '-'
            ])
          )
        : '',
      '',
      '## Parcel-Level Planning Signals',
      '',
      representativeSites.length
        ? 'Current open-data control readings for representative screened sites are shown below so the precinct thesis can be anchored to parcel-level planning settings rather than council-wide policy alone.'
        : 'No representative site-control rows are currently surfaced for this precinct.',
      representativeSites.length
        ? markdownTable(
            ['Representative Site', 'Zoning', 'Height', 'FSR', 'Minimum Lot Size', 'Jurisdiction', 'Sources'],
            representativeSites.map((item) => [
              item.address || item.site_label,
              `${item.zoning_code || '-'}${item.zoning_label ? ` (${item.zoning_label})` : ''}`,
              formatMeasure(item.height_m, 'm', 1),
              item.fsr === null || item.fsr === undefined || item.fsr === '' ? '-' : String(item.fsr),
              formatLotSize(item.minimum_lot_size_sqm, item.minimum_lot_size_units),
              item.apparent_site_jurisdiction || '-',
              controlSourceLinks(item)
            ])
          )
        : '',
      '',
      '## Development Activity Context',
      '',
      `Recent applications below are screening signals with lodgement date on or after \`${RECENT_FROM}\`. The application-type table is shown as mutually exclusive DA / CDC / Modification / Other buckets so it stays consistent with the \`Recent applications\` count above. State-significant signals stay separate in the quick scorecard.`,
      cdcCount > daCount && cdcCount > 0
        ? `Current mix note: this precinct is presently **CDC-led** (${formatNumber(cdcCount)} CDC vs ${formatNumber(daCount)} DA), so raw activity volume should not be read as pure acquisition-quality momentum.`
        : daCount > 0
          ? `Current mix note: this precinct is presently **DA-led or balanced** (${formatNumber(daCount)} DA vs ${formatNumber(cdcCount)} CDC), which is generally more useful for acquisition timing than CDC-heavy volume alone.`
          : 'Current mix note: no DA-led activity is currently visible in the retained window.',
      '',
      appStatus.length
        ? markdownTable(
            ['Status', 'Count'],
            appStatus.map((item) => [item.status || '-', formatNumber(item.total)])
          )
        : 'No recent mapped application records currently surfaced for this precinct.',
      '',
      applicationTypeRows.length
        ? markdownTable(
            ['Application Type', 'Count'],
            applicationTypeRows.map((item) => [item.application_bucket, formatNumber(item.total)])
          )
        : 'No recent application-type mix currently surfaced for this precinct.',
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
      'Context proxies can help explain why a precinct is ranked up or down, but they should not be mistaken for parcel-level blockers on their own.',
      '',
      constraints.length
        ? markdownTable(
            ['Constraint Type', 'Severity', 'Signal Use', 'Source', 'Evidence', 'Source URL'],
            constraints.map((item) => [
              item.constraint_type,
              item.severity,
              constraintUseLabel(item.constraint_type),
              item.source_name || '-',
              constraintEvidence(item),
              item.source_url || '-'
            ])
          )
        : 'No derived constraint rows currently attached to this precinct. Treat this as missing current signal, not proof of zero site risk.',
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
        : '3. Treat the current derived risk gap as incomplete coverage rather than parcel-level clearance, and use more detailed site-level constraint work before promotion.',
      '',
      '## References',
      '',
      `- \`${options.dashboardPath}\``,
      `- \`${options.radarPath}\``,
      ''
    ].join('\n')

    const reportsDir = path.join(root, 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })
    const fileName = options.outputName
      ? `deep-dive-${slugify(row.precinct_name)}-${slugify(options.outputName)}.md`
      : `deep-dive-${slugify(row.precinct_name)}.md`
    const outPath = path.join(reportsDir, fileName)
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
