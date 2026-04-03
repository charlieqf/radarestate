import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { Client } from 'pg'

const root = process.cwd()

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function readJson(relativeOrAbsolutePath) {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(root, relativeOrAbsolutePath)
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
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
      try { await client.end() } catch {}
    }
  }
  throw lastError || new Error('Unable to connect to Supabase')
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    configPath: 'mvp/config/development-report-standard-universe.json'
  }
  for (const arg of args) {
    if (arg.startsWith('--config=')) options.configPath = arg.split('=')[1].trim()
  }
  return options
}

function runNodeScript(relativeScript, args = []) {
  execFileSync(process.execPath, [path.join(root, relativeScript), ...args], {
    cwd: root,
    stdio: 'inherit'
  })
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  return new Intl.NumberFormat('en-AU').format(Number(value))
}

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function markdownLink(label, url) {
  if (!url) return label
  return `[${label}](${url})`
}

function markdownTable(headers, rows) {
  const headerLine = `| ${headers.join(' | ')} |`
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.map((cell) => clean(cell).replace(/\|/g, '\\|')).join(' | ')} |`).join('\n')
  return [headerLine, separatorLine, body].filter(Boolean).join('\n')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function uniqueBy(values, keyFn) {
  const seen = new Set()
  const output = []
  for (const value of values) {
    const key = keyFn(value)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(value)
  }
  return output
}

function ratio(matched, sample) {
  if (!sample) return 0
  return matched / sample
}

function moduleGate(name, matched, sample, settings) {
  const minMatched = settings?.minMatchedPoints ?? 0
  const minRatio = settings?.minMatchRatio ?? 0
  const pass = matched >= minMatched && ratio(matched, sample) >= minRatio
  return {
    module: name,
    status: pass ? 'Active' : 'Not activated',
    reason: pass
      ? `Matched ${matched}/${sample} sample points.`
      : `Matched ${matched}/${sample} sample points, below threshold ${minMatched}/${sample} and ratio ${minRatio}.`
  }
}

function fixedGate(name, enabled, reason) {
  return {
    module: name,
    status: enabled ? 'Active' : 'Not activated',
    reason
  }
}

function aggregateGate(name, precinctModules) {
  const active = precinctModules.filter((item) => item.status === 'Active').length
  const total = precinctModules.length
  const status = active === total ? 'Active' : active === 0 ? 'Not activated' : 'Partial'
  const exampleReason = precinctModules.find((item) => item.status !== 'Active')?.reason || precinctModules[0]?.reason || '-'
  return {
    module: name,
    status,
    reason: `${active}/${total} precincts passed. ${exampleReason}`
  }
}

function assessAssembly(controlRow, parcelRow) {
  const fsrMax = Number(controlRow?.fsr_max ?? 0)
  const heightMax = Number(controlRow?.height_max_m ?? 0)
  const planAreaMax = Number(parcelRow?.plan_area_max_sqm ?? 0)
  const frontageMax = Number(parcelRow?.frontage_candidate_max_m ?? 0)
  const fragmentationMax = Math.max(
    Number(parcelRow?.property_dissolve_parcel_count_max ?? 0),
    Number(parcelRow?.property_valnet_lot_count_max ?? 0)
  )

  if (!planAreaMax && !frontageMax) {
    return {
      heuristic: 'Not activated',
      reason: 'Parcel metrics are not yet strong enough to infer assembly pressure.'
    }
  }

  if (fragmentationMax >= 3) {
    return {
      heuristic: 'Preliminary aggregation signal',
      reason: `Property context suggests a fragmented structure with lot-count or dissolve-parcel signals up to ${fragmentationMax}.`
    }
  }

  if ((fsrMax >= 2 || heightMax >= 18) && (planAreaMax > 0 && planAreaMax < 900) && (frontageMax > 0 && frontageMax < 18)) {
    return {
      heuristic: 'Preliminary aggregation signal',
      reason: 'Higher intensity controls sit on relatively small sample parcels with limited frontage, which points to likely multi-lot aggregation.'
    }
  }

  if ((fsrMax >= 1.5 || heightMax >= 14) && (planAreaMax > 0 && planAreaMax < 1400)) {
    return {
      heuristic: 'Possible aggregation requirement',
      reason: 'Control intensity is rising faster than sampled parcel size, which suggests some level of lot aggregation may be needed.'
    }
  }

  if ((planAreaMax >= 1500 || frontageMax >= 20) && (fsrMax <= 1.2 || heightMax <= 12)) {
    return {
      heuristic: 'Preliminary single-lot viability signal',
      reason: 'Sample parcels are large enough relative to the current controls that a single-lot screening pass may still be meaningful.'
    }
  }

  return {
    heuristic: 'Mixed / validation needed',
    reason: 'The sampled parcels and control envelope do not yet support a clean single-lot or aggregation-only conclusion.'
  }
}

async function main() {
  const options = parseArgs()
  const config = readJson(options.configPath)
  const quality = readJson('mvp/config/development-report-quality-gates.json')
  runNodeScript('scripts/build_planning_controls_layer.mjs', [`--config=${options.configPath}`])
  runNodeScript('scripts/build_parcel_metrics_layer.mjs', [`--config=${options.configPath}`])
  runNodeScript('scripts/build_property_context_layer.mjs', [`--config=${options.configPath}`])
  const client = await connectWithFallback()
  try {
    const precincts = config.precincts || []

    const shortlist = await client.query(
      `select precinct_name, council_name, opportunity_rating, policy_score, friction_score, timing_score,
              recent_application_count, active_pipeline_count, constraint_summary, recommended_action, trigger_summary
       from public.v_precinct_shortlist
       where precinct_name = any($1::text[])
       order by case opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
                friction_score asc nulls last,
                recent_application_count desc nulls last`,
      [precincts]
    )

    const strongest = shortlist.rows[0] || null
    const highestRisk = [...shortlist.rows].sort((a, b) => Number(b.friction_score || 0) - Number(a.friction_score || 0))[0] || null

    const policy = await client.query(
      `select p.name as precinct_name, pp.title, pp.stage, pp.location_text, pp.source_url
       from public.planning_proposals pp
       join public.precincts p on p.id = pp.precinct_id
       where p.name = any($1::text[])
       order by p.name, pp.stage_rank, pp.last_seen_at desc, pp.title`,
      [precincts]
    )

    const risk = await client.query(
      `select p.name as precinct_name, c.constraint_type, c.severity, c.source_name, c.source_url
       from public.constraints c
       join public.precincts p on p.id = c.precinct_id
       where p.name = any($1::text[])
       order by p.name,
                case c.severity when 'high' then 1 when 'medium' then 2 else 3 end,
                c.constraint_type`,
      [precincts]
    )

    const controls = await client.query(
      `select precinct_name, dominant_zoning_code, dominant_zoning_label, zoning_epi_name,
              fsr_min, fsr_max, fsr_clause, height_min_m, height_max_m, height_clause,
              sample_point_count, matched_point_count,
              zoning_source_url, fsr_source_url, height_source_url
       from public.v_precinct_planning_controls
       where precinct_name = any($1::text[])
       order by precinct_name`,
      [precincts]
    )

    const parcel = await client.query(
      `select precinct_name, lot_count, example_lot_id, example_plan_label,
              plan_area_min_sqm, plan_area_max_sqm,
              geometry_area_min_sqm, geometry_area_max_sqm,
              perimeter_min_m, perimeter_max_m,
              bbox_width_min_m, bbox_width_max_m,
              bbox_height_min_m, bbox_height_max_m,
              frontage_candidate_min_m, frontage_candidate_max_m,
              matched_parcel_count, sample_point_count, source_url
       from public.v_precinct_parcel_metrics
       where precinct_name = any($1::text[])
       order by precinct_name`,
      [precincts]
    )

    const property = await client.query(
      `select precinct_name, example_propid, example_address,
              dominant_property_type, dominant_valnet_status, dominant_valnet_type,
              dissolve_parcel_count_min, dissolve_parcel_count_max,
              valnet_lot_count_min, valnet_lot_count_max,
              matched_property_count, sample_point_count, source_url
       from public.v_precinct_property_contexts
       where precinct_name = any($1::text[])
       order by precinct_name`,
      [precincts]
    )

    const controlByPrecinct = new Map(controls.rows.map((row) => [row.precinct_name, row]))
    const propertyByPrecinct = new Map(property.rows.map((row) => [row.precinct_name, row]))
    const parcelByPrecinct = new Map(parcel.rows.map((row) => {
      const propertyRow = propertyByPrecinct.get(row.precinct_name)
      return [row.precinct_name, {
        ...row,
        property_dissolve_parcel_count_max: propertyRow?.dissolve_parcel_count_max ?? null,
        property_valnet_lot_count_max: propertyRow?.valnet_lot_count_max ?? null
      }]
    }))

    const moduleRows = precincts.map((precinct) => {
      const controlRow = controlByPrecinct.get(precinct)
      const parcelRow = parcelByPrecinct.get(precinct)
      const propertyRow = propertyByPrecinct.get(precinct)
      const planningGate = moduleGate('Planning controls', Number(controlRow?.matched_point_count ?? 0), Number(controlRow?.sample_point_count ?? 0), quality.planningControls)
      const parcelGate = moduleGate('Parcel metrics', Number(parcelRow?.matched_parcel_count ?? 0), Number(parcelRow?.sample_point_count ?? 0), quality.parcelMetrics)
      const propertyGate = moduleGate('Property / ownership proxy', Number(propertyRow?.matched_property_count ?? 0), Number(propertyRow?.sample_point_count ?? 0), quality.propertyContext)
      const assemblyActive = [planningGate, parcelGate, propertyGate].every((item) => item.status === 'Active')
      const assemblyGate = fixedGate(
        'Assembly screening',
        assemblyActive,
        assemblyActive ? 'Underlying controls, parcel metrics and property proxy all passed minimum quality thresholds.' : 'Blocked because one or more upstream hard-information modules did not meet quality thresholds.'
      )
      const ownershipGate = fixedGate('Ownership title context', quality.ownershipTitleContext.enabled, quality.ownershipTitleContext.reason)
      const compsGate = fixedGate('Market comps', quality.marketComps.enabled, quality.marketComps.reason)
      const residualGate = fixedGate('Residual pricing', quality.residualPricing.enabled, quality.residualPricing.reason)
      return { precinct, planningGate, parcelGate, propertyGate, assemblyGate, ownershipGate, compsGate, residualGate }
    })
    const referenceModule = moduleRows[0]
    const moduleSummaryRows = [
      aggregateGate('Planning controls', moduleRows.map((row) => row.planningGate)),
      aggregateGate('Parcel metrics', moduleRows.map((row) => row.parcelGate)),
      aggregateGate('Property / ownership proxy', moduleRows.map((row) => row.propertyGate)),
      aggregateGate('Assembly screening', moduleRows.map((row) => row.assemblyGate)),
      referenceModule?.ownershipGate,
      referenceModule?.compsGate,
      referenceModule?.residualGate
    ].filter(Boolean)

    const policyByPrecinct = new Map()
    for (const row of policy.rows) {
      const list = policyByPrecinct.get(row.precinct_name) || []
      list.push(row)
      policyByPrecinct.set(row.precinct_name, list)
    }

    const riskByPrecinct = new Map()
    for (const row of risk.rows) {
      const list = riskByPrecinct.get(row.precinct_name) || []
      list.push(row)
      riskByPrecinct.set(row.precinct_name, list)
    }

    const policySummaryRows = precincts.map((precinct) => {
      const rows = uniqueBy(policyByPrecinct.get(precinct) || [], (row) => `${row.stage}|${row.title}|${row.location_text}`)
      const active = rows.filter((row) => ['under_assessment', 'pre_exhibition', 'on_exhibition', 'finalisation'].includes(row.stage)).slice(0, 2)
      const made = rows.filter((row) => row.stage === 'made').slice(0, 2)
      return [
        precinct,
        active.length ? active.map((row) => `${row.title} [${row.stage}]`).join(' ; ') : 'No currently mapped active proposal item',
        made.length ? made.map((row) => row.title).join(' ; ') : 'No mapped made-stage context surfaced'
      ]
    })

    const riskSummaryRows = precincts.map((precinct) => {
      const rows = uniqueBy(riskByPrecinct.get(precinct) || [], (row) => `${row.constraint_type}|${row.severity}|${row.source_name}`)
      if (!rows.length) {
        return [precinct, 'No currently surfaced derived risk row', '-', '-']
      }
      const summary = rows.map((row) => `${row.constraint_type} (${row.severity})`).join(' ; ')
      const highest = rows.find((row) => row.severity === 'high')?.severity || rows.find((row) => row.severity === 'medium')?.severity || rows[0].severity
      const sources = unique(rows.map((row) => row.source_name)).join(' ; ')
      return [precinct, summary, highest, sources]
    })

    const today = new Date().toISOString().slice(0, 10)
    const policySource = policy.rows.find((row) => row.source_url)?.source_url || 'https://www.planningportal.nsw.gov.au/ppr'
    const riskSources = unique(risk.rows.map((row) => row.source_url)).filter(Boolean)
    const controlsSource = controls.rows[0]
    const parcelSource = parcel.rows[0]?.source_url || 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/8'
    const propertySource = property.rows[0]?.source_url || 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/12'

    const markdown = [
      `# ${config.label}`,
      '',
      `## Date`,
      '',
      today,
      '',
      '## Purpose',
      '',
      `${config.description} This report is the fixed-universe version of the second product layer: a weekly development-oriented report built around a stable hotspot range rather than the full market.`,
      '',
      '## Radar Carry-Over',
      '',
      strongest ? `- Strongest current opportunity in this fixed universe: **${strongest.precinct_name}** (${strongest.council_name}), rated **${strongest.opportunity_rating}** with risk score **${strongest.friction_score}**.` : '- No current strongest opportunity row available.',
      highestRisk ? `- Highest current friction in this fixed universe: **${highestRisk.precinct_name}** (${highestRisk.council_name}), rated **${highestRisk.opportunity_rating}** with risk score **${highestRisk.friction_score}**.` : '- No current high-friction row available.',
      '- Companion radar artifacts:',
      '  - `dashboard/hero-visual-pack.html`',
      '  - `reports/top-10-insights-latest.md`',
      '  - `reports/weekly-radar-latest.md`',
      '',
      '## Data Sources',
      '',
      markdownTable(
        ['Module', 'Source', 'Link'],
        [
          ['Policy layer', 'Planning Proposals Online', markdownLink('Open source', policySource)],
          ['Risk layer', 'Flood Data Portal / Housing Targets / Derived Planning Friction', riskSources.length ? riskSources.map((url, index) => markdownLink(`Source ${index + 1}`, url)).join(' ; ') : '-'],
          ['Planning controls', 'NSW EPI Primary Planning Layers', [markdownLink('Zoning', controlsSource?.zoning_source_url), markdownLink('FSR', controlsSource?.fsr_source_url), markdownLink('Height', controlsSource?.height_source_url)].filter(Boolean).join(' ; ')],
          ['Parcel metrics', 'NSW Land Parcel and Property Theme - Lot', markdownLink('Open source', parcelSource)],
          ['Property / ownership proxy', 'NSW Land Parcel and Property Theme - Property', markdownLink('Open source', propertySource)],
          ['Market comps research', 'NSW land value and property sales web map', markdownLink('Open source', 'https://portal.spatial.nsw.gov.au/portal/apps/webappviewer/index.html?id=2536c8e4882140eb957e90090cb0ef97')]
        ]
      ),
      '',
      '## Fixed Target Universe',
      '',
      ...precincts.map((item) => `- ${item}`),
      '',
      '## Module Activation Status',
      '',
      markdownTable(
        ['Module', 'Status', 'Reason'],
        moduleSummaryRows.map((row) => [row.module, row.status, row.reason])
      ),
      '',
      '## Precinct Data Coverage',
      '',
      markdownTable(
        ['Precinct', 'Planning controls', 'Parcel metrics', 'Property proxy', 'Assembly screening'],
        moduleRows.map((row) => [
          row.precinct,
          row.planningGate.status,
          row.parcelGate.status,
          row.propertyGate.status,
          row.assemblyGate.status
        ])
      ),
      '',
      '## Weekly Priority Table',
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
      '## Why This Universe Works As A DevelopmentReport Demo',
      '',
      '- It is narrow enough to support consistent weekly follow-up.',
      '- It is broad enough to show different site conditions and risk profiles.',
      '- It can carry both “good opportunity” and “high-friction caution” cases in the same weekly package.',
      '- It creates a stable target universe into which zoning, FSR, height, assembly, ownership, comps and residual logic can be added over time.',
      '',
      '## Current Policy Layer',
      '',
      `Primary source: ${markdownLink('Planning Proposals Online', policySource)}`,
      '',
      markdownTable(
        ['Precinct', 'Current Active Policy Context', 'Recent Made / Historical Context'],
        policySummaryRows
      ),
      '',
      '## Current Risk Layer',
      '',
      `Primary sources: ${riskSources.length ? riskSources.map((url, index) => markdownLink(`Source ${index + 1}`, url)).join(' ; ') : '-'}`,
      '',
      markdownTable(
        ['Precinct', 'Current Derived Risk Summary', 'Highest Severity', 'Source Mix'],
        riskSummaryRows
      ),
      '',
      '## Current Planning Controls Layer',
      '',
      `Primary sources: ${[markdownLink('Zoning', controlsSource?.zoning_source_url), markdownLink('FSR', controlsSource?.fsr_source_url), markdownLink('Height', controlsSource?.height_source_url)].filter(Boolean).join(' ; ')}`,
      '',
      markdownTable(
        ['Precinct', 'Zoning', 'FSR', 'Height (m)', 'Clause', 'Sample Points'],
        controls.rows.map((row) => [
          row.precinct_name,
          [row.dominant_zoning_code, row.dominant_zoning_label].filter(Boolean).join(' - ') || '-',
          row.fsr_min === null ? '-' : row.fsr_min === row.fsr_max ? String(row.fsr_min) : `${row.fsr_min}-${row.fsr_max}`,
          row.height_min_m === null ? '-' : row.height_min_m === row.height_max_m ? String(row.height_min_m) : `${row.height_min_m}-${row.height_max_m}`,
          [row.fsr_clause, row.height_clause].filter(Boolean).join(' / ') || '-',
          `${row.matched_point_count ?? 0}/${row.sample_point_count ?? 0}`
        ])
      ),
      '',
      '## Current Parcel Metrics Layer',
      '',
      'All parcel metrics below are sample-based precinct summaries derived from recent mapped application points. They are intended for screening, not as parcel-specific control sheets.',
      '',
      `Primary source: ${markdownLink('NSW Land Parcel and Property Theme - Lot', parcelSource)}`,
      '',
      markdownTable(
        ['Precinct', 'Example Lot', 'Sample Plan Area Range (sqm)', 'Sample Geometry Area Range (sqm)', 'Sample Perimeter Range (m)', 'Sample Frontage Candidate Range (m)', 'Sample Width x Depth Range (m)', 'Screening Output', 'Matched Sample Points'],
        parcel.rows.map((row) => [
          row.precinct_name,
          [row.example_lot_id, row.example_plan_label].filter(Boolean).join(' / ') || '-',
          row.plan_area_min_sqm === null ? '-' : row.plan_area_min_sqm === row.plan_area_max_sqm ? String(row.plan_area_min_sqm) : `${row.plan_area_min_sqm}-${row.plan_area_max_sqm}`,
          row.geometry_area_min_sqm === null ? '-' : row.geometry_area_min_sqm === row.geometry_area_max_sqm ? String(row.geometry_area_min_sqm) : `${row.geometry_area_min_sqm}-${row.geometry_area_max_sqm}`,
          row.perimeter_min_m === null ? '-' : row.perimeter_min_m === row.perimeter_max_m ? String(row.perimeter_min_m) : `${row.perimeter_min_m}-${row.perimeter_max_m}`,
          row.frontage_candidate_min_m === null ? '-' : row.frontage_candidate_min_m === row.frontage_candidate_max_m ? String(row.frontage_candidate_min_m) : `${row.frontage_candidate_min_m}-${row.frontage_candidate_max_m}`,
          row.bbox_width_min_m === null ? '-' : `${row.bbox_width_min_m === row.bbox_width_max_m ? row.bbox_width_min_m : `${row.bbox_width_min_m}-${row.bbox_width_max_m}`} x ${row.bbox_height_min_m === row.bbox_height_max_m ? row.bbox_height_min_m : `${row.bbox_height_min_m}-${row.bbox_height_max_m}`}`,
          moduleRows.find((item) => item.precinct === row.precinct_name)?.assemblyGate.status === 'Active'
            ? assessAssembly(controlByPrecinct.get(row.precinct_name), parcelByPrecinct.get(row.precinct_name)).heuristic
            : 'Not activated',
          `${row.matched_parcel_count ?? 0}/${row.sample_point_count ?? 0}`
        ])
      ),
      '',
      '## Assembly Interpretation',
      '',
      ...precincts.map((precinct) => {
        const moduleRow = moduleRows.find((item) => item.precinct === precinct)
        if (moduleRow?.assemblyGate.status !== 'Active') {
          return `- **${precinct}**: Not activated. ${moduleRow?.assemblyGate.reason || 'Quality gate not met.'}`
        }
        const assessment = assessAssembly(controlByPrecinct.get(precinct), parcelByPrecinct.get(precinct))
        return `- **${precinct}**: ${assessment.heuristic}. ${assessment.reason} This remains a screening judgement, not a parcel-level feasibility conclusion.`
      }),
      '',
      '## Current Property / Ownership Proxy Layer',
      '',
      `Primary source: ${markdownLink('NSW Land Parcel and Property Theme - Property', propertySource)}`,
      '',
      markdownTable(
        ['Precinct', 'Example Property', 'Property Type', 'ValNet Status', 'ValNet Type', 'Lot Count', 'Fragmentation Signal', 'Matched Sample Points'],
        property.rows.map((row) => [
          row.precinct_name,
          [row.example_propid, row.example_address].filter(Boolean).join(' / ') || '-',
          row.dominant_property_type || '-',
          row.dominant_valnet_status || '-',
          row.dominant_valnet_type || '-',
          row.valnet_lot_count_min === null ? '-' : row.valnet_lot_count_min === row.valnet_lot_count_max ? String(row.valnet_lot_count_min) : `${row.valnet_lot_count_min}-${row.valnet_lot_count_max}`,
          row.dissolve_parcel_count_min === null ? '-' : row.dissolve_parcel_count_min === row.dissolve_parcel_count_max ? String(row.dissolve_parcel_count_min) : `${row.dissolve_parcel_count_min}-${row.dissolve_parcel_count_max}`,
          `${row.matched_property_count ?? 0}/${row.sample_point_count ?? 0}`
        ])
      ),
      '',
      '## Ownership Title Context',
      '',
      referenceModule?.ownershipGate.status === 'Active'
        ? 'Active.'
        : `Not activated. ${referenceModule?.ownershipGate.reason}`,
      '',
      '## Market Comps',
      '',
      referenceModule?.compsGate.status === 'Active'
        ? 'Active.'
        : `Not activated. ${referenceModule?.compsGate.reason}`,
      '',
      `Research path: ${markdownLink('NSW land value and property sales web map', 'https://portal.spatial.nsw.gov.au/portal/apps/webappviewer/index.html?id=2536c8e4882140eb957e90090cb0ef97')}`,
      '',
      '## Residual Pricing',
      '',
      referenceModule?.residualGate.status === 'Active'
        ? 'Active.'
        : `Not activated. ${referenceModule?.residualGate.reason}`,
      '',
      '## Hard Information Layer Still To Add',
      '',
      '- title-level ownership context',
      '- comps',
      '- residual pricing logic',
      '',
      '## Bottom Line',
      '',
      'This fixed hotspot universe gives the second report a stable weekly scope. That is what makes it demo-able, sellable, and suitable for a higher-priced development-oriented layer.',
      ''
    ].join('\n')

    const reportsDir = path.join(root, 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })
    const outPath = path.join(reportsDir, 'development-report-standard-universe.md')
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
