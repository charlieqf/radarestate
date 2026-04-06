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
    outputName: 'latest',
    limit: 12,
    dashboardPath: 'dashboard/latest-report.html',
    radarPath: 'reports/weekly-radar-latest.md',
    screeningPath: 'reports/top-site-screening-latest.md'
  }
  for (const arg of args) {
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--output-name=')) options.outputName = arg.split('=')[1].trim()
    if (arg.startsWith('--limit=')) options.limit = Number(arg.split('=')[1].trim())
    if (arg.startsWith('--dashboard-path=')) options.dashboardPath = arg.split('=')[1].trim()
    if (arg.startsWith('--radar-path=')) options.radarPath = arg.split('=')[1].trim()
    if (arg.startsWith('--screening-path=')) options.screeningPath = arg.split('=')[1].trim()
  }
  return options
}

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function siteCardFileName(outputName, siteKey) {
  return `site-card-${slugify(outputName)}-${slugify(siteKey)}.md`
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value))
}

function formatMeasure(value, suffix, digits = 0) {
  if (value === null || value === undefined || value === '') return '-'
  return `${formatNumber(value, digits)}${suffix}`
}

function formatLotSize(value, units) {
  if (value === null || value === undefined || value === '') return '-'
  return `${formatNumber(value)} ${units || 'sqm'}`
}

function formatDate(value) {
  if (!value) return '-'
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function markdownTable(headers, rows) {
  const escape = (value) => clean(value).replace(/\|/g, '\\|') || '-'
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`)
  ].join('\n')
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

function apparentJurisdiction(epiName) {
  const value = clean(epiName)
  if (!value) return '-'
  const local = value.match(/^(.*?)\s+Local Environmental Plan/i)
  if (local) return local[1]
  const regional = value.match(/^(.*?)\s+Regional Environmental Plan/i)
  if (regional) return regional[1]
  return value
}

async function applyArtifacts(client) {
  await client.query(readFile('supabase/development_views.sql'))
}

function goLines(row, constraints) {
  const lines = []
  if ((row.screening_band || '') === 'Advance') {
    lines.push('- Current score is in the `Advance` band, so precinct backdrop, controls and site geometry are aligned strongly enough for immediate review.')
  } else {
    lines.push('- The site still screens positively on size, control envelope or precinct context, even though it is not in the top `Advance` band.')
  }

  if ((row.geometry_area_sqm || row.plan_area_sqm || 0) >= 1500 || (row.frontage_candidate_m || 0) >= 20) {
    lines.push('- Site scale and frontage both look meaningful enough to justify the next automated diligence pass.')
  } else {
    lines.push('- The lot still looks usable for screening, but it should be treated as a tighter geometry case until parcel dimensions are checked more closely.')
  }

  if (!(constraints || []).some((item) => item.severity === 'high')) {
    lines.push('- No current high-severity open-data constraint is attached to this site.')
  }
  return lines
}

function cautionLines(row, constraints) {
  const lines = []
  if (constraints.length) {
    for (const item of constraints.slice(0, 3)) {
      lines.push(`- ${formatConstraintName(item.constraint_type)} is currently flagged at **${item.severity}**: ${item.notes || 'open-data overlay hit'}.`)
    }
  } else {
    lines.push('- No current site-level derived constraint hit is surfaced in the present open-data layer, but that is not a clean-risk finding and should not be read as parcel clearance.')
  }

  if ((row.title_complexity_penalty || 0) > 0) {
    lines.push(`- Title / strata complexity is already penalising this site by **${formatNumber(row.title_complexity_penalty)}** points in the current screening model.`)
  }

  if ((row.constraint_penalty || 0) > 0) {
    lines.push(`- Current scoring already applies a constraint penalty of **${formatNumber(row.constraint_penalty)}**.`)
  }
  return lines
}

function verifyLines(row) {
  const lines = [
    '- Verify the current zoning / FSR / height envelope directly against the source EPI before treating this as transaction-facing output.',
    '- Verify lot geometry, frontage and assembly implications against current cadastre and current site circumstances.',
    '- Verify flood, heritage, bushfire, biodiversity, airport and other overlay signals before promotion into any acquisition-facing shortlist.'
  ]

  if ((row.valnet_type || row.valnet_status || '').includes('STRATA') || clean(row.lot_id).includes('SP')) {
    lines.push('- This site also needs a specific strata/title structure check because the current parcel reference suggests strata-style treatment.')
  }

  lines.push('- No owner/title certainty, comps or residual pricing is included in this automated card.')
  return lines
}

async function main() {
  const options = parseArgs()
  const client = await connectWithFallback()
  try {
    await applyArtifacts(client)
    const sites = await client.query(
      `select
         s.site_candidate_id,
         s.site_key,
         s.site_label,
         s.precinct_name,
         s.council_name,
          s.watchlist_bucket_name,
          s.apparent_site_jurisdiction,
          s.region_group,
         s.address,
         s.sample_location_example,
         s.lot_id,
         s.plan_label,
         s.propid,
         s.latest_lodgement_date,
         s.matched_signal_count,
         s.plan_area_sqm,
         s.geometry_area_sqm,
         s.perimeter_m,
         s.bbox_width_m,
         s.bbox_height_m,
         s.frontage_candidate_m,
         s.property_type,
         s.valnet_status,
         s.valnet_type,
         s.dissolve_parcel_count,
         s.valnet_lot_count,
         s.zoning_code,
         s.zoning_label,
         s.zoning_epi_name,
         s.fsr,
         s.fsr_clause,
         s.fsr_epi_name,
         s.height_m,
         s.height_clause,
         s.height_epi_name,
         s.minimum_lot_size_sqm,
         s.minimum_lot_size_units,
         s.minimum_lot_size_clause,
         s.minimum_lot_size_epi_name,
         s.constraint_count,
         s.high_constraint_count,
         s.medium_constraint_count,
         s.constraint_summary,
         s.precinct_opportunity_rating,
         s.precinct_policy_score,
         s.precinct_timing_score,
         s.precinct_friction_score,
         s.precinct_score,
         s.area_score,
         s.frontage_score,
         s.fsr_score,
         s.height_score,
          s.signal_score,
          s.constraint_penalty,
          s.title_complexity_penalty,
          s.screening_score,
         s.screening_band,
         s.recommended_site_action,
         cand.source_url as candidate_source_url,
         ctl.zoning_source_url,
         ctl.fsr_source_url,
         ctl.height_source_url,
         ctl.minimum_lot_size_source_url
       from public.v_site_screening_latest s
       left join public.v_site_candidates_latest cand on cand.site_candidate_id = s.site_candidate_id
       left join public.v_site_controls_latest ctl on ctl.site_candidate_id = s.site_candidate_id
       where ($1::text is null or s.region_group = $1)
       order by s.screening_score desc,
                s.matched_signal_count desc,
                coalesce(s.geometry_area_sqm, s.plan_area_sqm) desc nulls last,
                s.site_label
       limit $2`,
      [options.regionGroup || null, options.limit]
    )

    if (!sites.rows.length) throw new Error(`No site candidates found for ${options.regionGroup || 'all regions'}`)

    const constraints = await client.query(
      `select site_key, constraint_type, severity, source_name, source_url, notes
       from public.v_site_constraints_latest
       where site_key = any($1::text[])
       order by site_key,
                case severity when 'high' then 1 when 'medium' then 2 else 3 end,
                constraint_type`,
      [sites.rows.map((row) => row.site_key)]
    )

    const constraintsBySite = new Map()
    for (const row of constraints.rows) {
      const list = constraintsBySite.get(row.site_key) || []
      list.push(row)
      constraintsBySite.set(row.site_key, list)
    }

    const reportsDir = path.join(root, 'reports')
    const clientOutputDir = path.join(root, 'client-output')
    fs.mkdirSync(reportsDir, { recursive: true })
    const prefix = `site-card-${slugify(options.outputName)}-`
    for (const fileName of fs.readdirSync(reportsDir)) {
      if (fileName.startsWith(prefix) && fileName.endsWith('.md')) {
        fs.rmSync(path.join(reportsDir, fileName), { force: true })
      }
    }
    if (fs.existsSync(clientOutputDir)) {
      for (const fileName of fs.readdirSync(clientOutputDir)) {
        if (fileName.startsWith(prefix) && fileName.endsWith('.html')) {
          fs.rmSync(path.join(clientOutputDir, fileName), { force: true })
        }
      }
    }

    for (let index = 0; index < sites.rows.length; index += 1) {
      const row = sites.rows[index]
      const siteConstraints = constraintsBySite.get(row.site_key) || []
      const markdown = [
        `# Site Card: ${row.site_label}`,
        '',
        `## Rank`,
        '',
        `${index + 1} in the current ${options.label} automated site-screening cut.`,
        '',
        '## Snapshot',
        '',
        `- Watchlist bucket: **${row.watchlist_bucket_name || row.precinct_name}**`,
        `- Watchlist precinct: **${row.precinct_name}**`,
        `- Current precinct grouping: **${row.council_name || '-'}**`,
        `- Apparent site jurisdiction from governing EPI: **${row.apparent_site_jurisdiction || apparentJurisdiction(row.zoning_epi_name)}**`,
        `- Screening band: **${row.screening_band}**`,
        `- Screening score: **${formatNumber(row.screening_score)}**`,
        `- Recommended action: **${row.recommended_site_action}**`,
        `- Address signal: ${row.address || row.sample_location_example || '-'}`,
        `- Lot reference: ${row.lot_id || '-'}${row.plan_label ? ` / ${row.plan_label}` : ''}`,
        `- Latest mapped signal date: ${formatDate(row.latest_lodgement_date)}`,
        `- Matched recent signals: ${formatNumber(row.matched_signal_count)}`,
        '',
        '## Control Envelope',
        '',
        markdownTable(
          ['Field', 'Value', 'Source'],
          [
            ['Zoning', `${row.zoning_code || '-'} ${row.zoning_label ? `(${row.zoning_label})` : ''}`.trim(), markdownLink('Open source', row.zoning_source_url)],
            ['FSR', formatNumber(row.fsr, 2), markdownLink('Open source', row.fsr_source_url)],
            ['Height', formatMeasure(row.height_m, 'm', 1), markdownLink('Open source', row.height_source_url)],
            ['Minimum lot size', formatLotSize(row.minimum_lot_size_sqm, row.minimum_lot_size_units), markdownLink('Open source', row.minimum_lot_size_source_url)],
            ['Apparent site jurisdiction', row.apparent_site_jurisdiction || apparentJurisdiction(row.zoning_epi_name), '-'],
            ['Zoning EPI', row.zoning_epi_name || '-', '-'],
            ['FSR clause', row.fsr_clause || '-', '-'],
            ['Height clause', row.height_clause || '-', '-'],
            ['Minimum lot size clause', row.minimum_lot_size_clause || '-', '-']
          ]
        ),
        '',
        '## Site Metrics',
        '',
        markdownTable(
          ['Metric', 'Value'],
          [
            ['Plan area', formatMeasure(row.plan_area_sqm, ' sqm')],
            ['Geometry area', formatMeasure(row.geometry_area_sqm, ' sqm')],
            ['Perimeter', formatMeasure(row.perimeter_m, ' m', 1)],
            ['BBox width', formatMeasure(row.bbox_width_m, ' m', 1)],
            ['BBox height', formatMeasure(row.bbox_height_m, ' m', 1)],
            ['Frontage candidate', formatMeasure(row.frontage_candidate_m, ' m', 1)],
            ['Property type', row.property_type || '-'],
            ['ValNet status', row.valnet_status || '-'],
            ['ValNet type', row.valnet_type || '-'],
            ['Dissolve parcel count', formatNumber(row.dissolve_parcel_count)],
            ['ValNet lot count', formatNumber(row.valnet_lot_count)]
          ]
        ),
        '',
        '## Score Breakdown',
        '',
        markdownTable(
          ['Component', 'Value'],
          [
            ['Precinct score', formatNumber(row.precinct_score)],
            ['Area score', formatNumber(row.area_score)],
            ['Frontage score', formatNumber(row.frontage_score)],
            ['FSR score', formatNumber(row.fsr_score)],
            ['Height score', formatNumber(row.height_score)],
            ['Signal score', formatNumber(row.signal_score)],
            ['Constraint penalty', formatNumber(row.constraint_penalty)],
            ['Title complexity penalty', formatNumber(row.title_complexity_penalty)],
            ['Total screening score', formatNumber(row.screening_score)]
          ]
        ),
        '',
        '## Constraint Stack',
        '',
        siteConstraints.length
          ? markdownTable(
            ['Constraint', 'Severity', 'Notes', 'Source'],
            siteConstraints.map((item) => [
                formatConstraintName(item.constraint_type),
                item.severity,
                item.notes || '-',
                markdownLink(item.source_name || 'Open source', item.source_url)
              ])
            )
          : 'No current site-level derived constraint hit is surfaced in the present open-data layer. This is not a parcel-safe finding.',
        '',
        '## Go',
        '',
        ...goLines(row, siteConstraints),
        '',
        '## Caution',
        '',
        ...cautionLines(row, siteConstraints),
        '',
        '## Verify',
        '',
        '- Treat the watchlist precinct label as a search bucket, not as proof of the site\'s governing planning jurisdiction.',
        ...verifyLines(row),
        '',
        '## Companion Files',
        '',
        `- \`${options.screeningPath}\``,
        `- \`${options.dashboardPath}\``,
        `- \`${options.radarPath}\``,
        '',
        '## Boundaries',
        '',
        '- This card is generated only from free, public and automatable NSW open data.',
        '- No owner/title data is used here.',
        '- No proprietary comps or residual pricing is used here.',
        '- Flood-related rows should be read as current planning/open-data signals, not final parcel-clearance certification.',
        ''
      ].join('\n')

      const fileName = siteCardFileName(options.outputName, row.site_key)
      fs.writeFileSync(path.join(reportsDir, fileName), markdown, 'utf8')
      console.log(`Wrote ${path.join('reports', fileName)}`)
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
