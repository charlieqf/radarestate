import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function getConnectionStrings() {
  const text = readFile('supabase.txt')
  const matches = [...text.matchAll(/postgresql:\/\/[^\s`]+/g)].map((match) => match[0])
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
    regionGroup: 'Greater Sydney',
    label: 'Sydney',
    outputName: 'latest'
  }
  for (const arg of args) {
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--output-name=')) options.outputName = arg.split('=')[1].trim()
  }
  return options
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value))
}

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function siteCardPath(outputName, siteKey) {
  return `reports/site-card-${slugify(outputName)}-${slugify(siteKey)}.md`
}

function markdownLink(label, href) {
  if (!href) return label
  return `[${label}](${href})`
}

function formatConstraintName(value) {
  const labels = {
    heritage_item: 'Heritage item',
    state_heritage_curtilage: 'State heritage curtilage',
    land_reservation: 'Land reservation',
    flood_planning: 'Flood planning overlay',
    biodiversity_values: 'Biodiversity values',
    bushfire_prone_land: 'Bushfire prone land',
    airport_noise: 'Airport noise',
    obstacle_limitation_surface: 'Obstacle limitation surface'
  }
  return labels[value] || clean(value).replace(/_/g, ' ')
}

function formatConstraintLabel(row) {
  return `${formatConstraintName(row.constraint_type)} [${row.severity}]`
}

function apparentJurisdiction(epiName) {
  const value = clean(epiName)
  if (!value) return '-'
  const local = value.match(/^(.*?)\s+Local Environmental Plan/i)
  if (local) return local[1]
  const regional = value.match(/^(.*?)\s+Regional Environmental Plan/i)
  if (regional) return regional[1]
  return value
}

function siteJurisdiction(row) {
  return row.apparent_site_jurisdiction || apparentJurisdiction(row.zoning_epi_name)
}

function jurisdictionAlignment(row) {
  const parcelJurisdiction = clean(siteJurisdiction(row))
  const precinctCouncil = clean(row.council_name)
  if (!parcelJurisdiction || parcelJurisdiction === '-' || !precinctCouncil || precinctCouncil === '-') return null
  return parcelJurisdiction === precinctCouncil
    ? 'Aligned'
    : `Split - use ${parcelJurisdiction} for DCP / approval reading`
}

async function applyArtifacts(client) {
  await client.query(readFile('supabase/development_views.sql'))
}

function formatMeasure(value, suffix, digits = 0) {
  if (value === null || value === undefined || value === '') return '-'
  return `${formatNumber(value, digits)}${suffix}`
}

function formatLotSize(value, units) {
  if (value === null || value === undefined || value === '') return '-'
  return `${formatNumber(value)} ${units || 'sqm'}`
}

function markdownTable(headers, rows) {
  const escape = (value) => clean(value).replace(/\|/g, '\\|') || '-'
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`)
  ].join('\n')
}

function detailBlock(outputName, row, constraints) {
  const parcelJurisdiction = siteJurisdiction(row)
  const alignment = jurisdictionAlignment(row)
  return [
    `### ${row.site_label}`,
    '',
    `- Search area: **${row.watchlist_bucket_name || row.precinct_name}**`,
    `- Precinct: **${row.precinct_name}**`,
    `- Precinct-level council context: **${row.council_name}**`,
    `- Parcel governing jurisdiction from EPI: **${parcelJurisdiction}**`,
    alignment ? `- Jurisdiction alignment: **${alignment}**` : null,
    `- Screening band: **${row.screening_band}** with score **${formatNumber(row.screening_score)}**`,
    `- Recommended action: ${row.recommended_site_action}`,
    `- Precinct backdrop: rating \`${row.precinct_opportunity_rating || '-'}\`, policy \`${formatNumber(row.precinct_policy_score)}\`, timing \`${formatNumber(row.precinct_timing_score)}\`, approval risk \`${formatNumber(row.precinct_friction_score)}\``,
    `- Control envelope: zoning \`${row.zoning_code || '-'}\` (${row.zoning_label || '-'}), FSR \`${formatNumber(row.fsr, 2)}\`, height \`${formatMeasure(row.height_m, 'm', 1)}\`, minimum lot size \`${formatLotSize(row.minimum_lot_size_sqm, row.minimum_lot_size_units)}\``,
    `- Site metrics: lot \`${row.lot_id || '-'}\`, plan area \`${formatMeasure(row.plan_area_sqm, ' sqm')}\`, geometry area \`${formatMeasure(row.geometry_area_sqm, ' sqm')}\`, frontage candidate \`${formatMeasure(row.frontage_candidate_m, ' m', 1)}\`, matched recent signals \`${formatNumber(row.matched_signal_count)}\``,
    (row.title_complexity_penalty || 0) > 0 ? `- Title complexity penalty: \`${formatNumber(row.title_complexity_penalty)}\`` : null,
    constraints.length
      ? `- Current constraint stack: ${constraints.map((item) => `${formatConstraintName(item.constraint_type)} [${item.severity}]`).join('; ')}`
      : '- Current red-flag stack: no current open-data red flag is surfaced in this pass. This is not a parcel-safe finding.',
    row.address ? `- Address signal: ${row.address}` : null,
    `- Site card: \`${siteCardPath(outputName, row.site_key)}\``,
    ''
  ].filter(Boolean).join('\n')
}

async function main() {
  const options = parseArgs()
  const client = await connectWithFallback()
  try {
    await applyArtifacts(client)
    const candidates = await client.query(
      `select
         site_key,
         site_label,
         precinct_name,
         council_name,
         watchlist_bucket_name,
         apparent_site_jurisdiction,
         screening_band,
         screening_score,
         recommended_site_action,
         precinct_opportunity_rating,
         precinct_policy_score,
         precinct_timing_score,
         precinct_friction_score,
         matched_signal_count,
         latest_lodgement_date,
         zoning_code,
         zoning_label,
         zoning_epi_name,
         fsr,
         height_m,
         minimum_lot_size_sqm,
         minimum_lot_size_units,
         lot_id,
         plan_area_sqm,
         geometry_area_sqm,
         frontage_candidate_m,
         address,
         title_complexity_penalty,
         constraint_count,
         high_constraint_count,
         medium_constraint_count,
         constraint_summary
        from public.v_site_screening_latest
        where ($1::text is null or region_group = $1)
        order by screening_score desc,
                 title_complexity_penalty asc nulls last,
                 high_constraint_count asc nulls last,
                 abs(coalesce(geometry_area_sqm, plan_area_sqm, 0) - 1200) asc nulls last,
                 matched_signal_count desc,
                 site_label
        limit 12`,
      [options.regionGroup || null]
    )

    if (!candidates.rows.length) throw new Error(`No site screening rows found for ${options.regionGroup || 'all regions'}`)

    const siteKeys = candidates.rows.map((row) => row.site_key)
    const constraintRows = await client.query(
      `select site_key, constraint_type, severity, notes
       from public.v_site_constraints_latest
       where site_key = any($1::text[])
       order by site_key,
                case severity when 'high' then 1 when 'medium' then 2 else 3 end,
                constraint_type`,
      [siteKeys]
    )

    const groupedConstraints = new Map()
    for (const row of constraintRows.rows) {
      const list = groupedConstraints.get(row.site_key) || []
      list.push(row)
      groupedConstraints.set(row.site_key, list)
    }

    const summaryCounts = await client.query(
      `select screening_band, count(*)::int as total
       from public.v_site_screening_latest
       where ($1::text is null or region_group = $1)
       group by screening_band
       order by case screening_band when 'Advance' then 1 when 'Review' then 2 else 3 end`,
      [options.regionGroup || null]
    )
    const constraintMix = await client.query(
      `select constraint_type, severity, count(*)::int as total
       from public.v_site_constraints_latest
       where ($1::text is null or region_group = $1)
       group by constraint_type, severity
       order by total desc,
                case severity when 'high' then 1 when 'medium' then 2 else 3 end,
                constraint_type
       limit 8`,
      [options.regionGroup || null]
    )
    const summaryByBand = Object.fromEntries(summaryCounts.rows.map((row) => [row.screening_band, row.total]))
    const top = candidates.rows[0]
    const constraintLead = constraintMix.rows.slice(0, 3)

    const markdown = [
      `# ${options.label} Top Site Screening`,
      '',
      '## Summary',
      '',
      `- Current automated site-screening top cut shown below: **${formatNumber(candidates.rows.length)}** sites for ${options.label}.`,
      '- Default ranking lens: calibrated for small-mid developers, with a slight preference toward townhouse / small subdivision fit over larger-format high-rise or assembly-style parcels.',
      `- Band mix across the current region-level site layer: **${formatNumber(summaryByBand.Advance || 0)} Advance**, **${formatNumber(summaryByBand.Review || 0)} Review**, **${formatNumber(summaryByBand.Caution || 0)} Caution**.`,
      `- Highest current site candidate: **${top.site_label}** in **${top.watchlist_bucket_name || top.precinct_name}** with score **${formatNumber(top.screening_score)}** and action **${top.recommended_site_action}**.`,
      constraintLead.length
        ? `- Most common current site-level flags: ${constraintLead.map((row) => `**${formatConstraintLabel(row)} = ${formatNumber(row.total)}**`).join(', ')}.`
        : '- No current site-level constraint rows are attached in this region cut.',
      '',
      '## Method',
      '',
      '- This report is fully automated from free, public NSW open data and current mapped application signals.',
      '- The default buy box is now a small-mid developer lens. Moderate lot sizes, workable frontage, lower title complexity, and townhouse-to-boutique-apartment control envelopes are preferred ahead of supersites.',
      '- It screens lots/sites, not just precincts, but it is still a triage tool rather than a title/comps/residual decision engine.',
      '- Controls shown here are the current point-intersected planning envelope. Constraint rows show current open-data red flags such as heritage, state heritage curtilage, land reservation, flood planning, biodiversity, bushfire, airport noise and OLS.',
      '- A row that says no current open-data red flag was surfaced means no current mapped red flag appeared in this pass. It does not mean the site is parcel-safe or cleared for acquisition.',
      '- The search-area label is only a working geography. Governing EPI and parcel jurisdiction should control how the planning envelope is interpreted for a given lot.',
      '',
      '## Top Ranked Sites',
      '',
      markdownTable(
        ['Rank', 'Site', 'Search Area', 'Parcel Jurisdiction', 'Band', 'Score', 'Zoning', 'FSR', 'Height', 'Lot Area', 'Frontage', 'Signals', 'Red-Flag Stack', 'Card'],
        candidates.rows.map((row, index) => [
           index + 1,
           row.site_label,
           row.watchlist_bucket_name || row.precinct_name,
           row.apparent_site_jurisdiction || apparentJurisdiction(row.zoning_epi_name),
           row.screening_band,
           formatNumber(row.screening_score),
          row.zoning_code || '-',
          formatNumber(row.fsr, 2),
          formatMeasure(row.height_m, 'm', 1),
          formatMeasure(row.geometry_area_sqm || row.plan_area_sqm, ' sqm'),
          formatMeasure(row.frontage_candidate_m, ' m', 1),
          formatNumber(row.matched_signal_count),
            row.constraint_summary === 'No current site-level derived constraint hit'
              ? 'No current open-data red flag surfaced in this pass. Not parcel-safe.'
              : row.constraint_summary,
           markdownLink('Open card', siteCardPath(options.outputName, row.site_key))
         ])
       ),
      '',
      '## Current Site-Level Red Flags',
      '',
      constraintMix.rows.length
        ? markdownTable(
            ['Constraint', 'Severity', 'Hit Count'],
            constraintMix.rows.map((row) => [formatConstraintName(row.constraint_type), row.severity, formatNumber(row.total)])
          )
        : 'No current site-level constraint rows surfaced in this region cut.',
      '',
      '## Top 12 Detail',
      '',
      ...candidates.rows.map((row) => detailBlock(options.outputName, row, groupedConstraints.get(row.site_key) || [])),
      'Precinct-level search-area labels and site-level control envelopes should be read separately. A precinct summary describes the broader search area; the site rows above describe the current point-intersected planning envelope for the candidate lot itself.',
      '',
      '## Boundaries',
      '',
      '- No owner/title data is used here.',
      '- No proprietary comps or residual pricing model is used here.',
      '- Flood is treated as current planning/open-data signal, not as parcel-clearance certification.',
      ''
    ].join('\n')

    const reportsDir = path.join(root, 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })
    const fileName = options.outputName === 'latest' ? 'top-site-screening-latest.md' : `top-site-screening-${options.outputName}.md`
    const outputPath = path.join(reportsDir, fileName)
    fs.writeFileSync(outputPath, markdown, 'utf8')
    console.log(`Wrote ${outputPath}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
