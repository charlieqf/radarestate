import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const RECENT_APPLICATION_WINDOW_START = '2025-01-01'
const ACTIVE_PROPOSAL_STAGES = ['under_assessment', 'pre_exhibition', 'on_exhibition', 'finalisation']

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
    snapshotDate: new Date().toISOString().slice(0, 10),
    regionGroup: 'Greater Sydney',
    label: 'Sydney',
    baselineType: 'formal',
    reconstructionMethod: null,
    overwrite: false,
    knownGaps: []
  }

  for (const arg of args) {
    if (arg.startsWith('--snapshot-date=')) options.snapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg.startsWith('--baseline-type=')) options.baselineType = arg.split('=')[1].trim()
    if (arg.startsWith('--reconstruction-method=')) options.reconstructionMethod = arg.split('=')[1].trim()
    if (arg.startsWith('--known-gap=')) options.knownGaps.push(arg.split('=')[1].trim())
    if (arg === '--overwrite') options.overwrite = true
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.snapshotDate)) {
    throw new Error(`Invalid --snapshot-date value: ${options.snapshotDate}`)
  }
  if (!['formal', 'reconstructed'].includes(options.baselineType)) {
    throw new Error(`Unsupported --baseline-type value: ${options.baselineType}`)
  }
  if (options.baselineType === 'reconstructed' && !options.reconstructionMethod) {
    throw new Error('Reconstructed baselines require --reconstruction-method')
  }

  return options
}

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function snapshotDir(snapshotDate) {
  return path.join(root, 'snapshots', 'weekly', snapshotDate)
}

function prepareSnapshotDirectory(dirPath, overwrite) {
  if (!fs.existsSync(dirPath)) {
    ensureDir(dirPath)
    return
  }
  const existing = fs.readdirSync(dirPath)
  if (!existing.length) return
  if (!overwrite) {
    throw new Error(`Snapshot directory already exists and is not empty: ${dirPath}. Re-run with --overwrite to replace it.`)
  }
  for (const entry of existing) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true })
  }
}

async function querySourceRanges(client, regionGroup) {
  const planning = await client.query(
    `select min(pp.first_seen_at) as min_date, max(pp.last_seen_at) as max_date
     from public.planning_proposals pp
     join public.councils c on c.id = pp.council_id
     where c.region_group = $1`,
    [regionGroup]
  )
  const activity = await client.query(
    `select min(coalesce(a.lodgement_date, a.observed_at)) as min_date,
            max(coalesce(a.lodgement_date, a.observed_at)) as max_date
     from public.application_signals a
     join public.councils c on c.id = a.council_id
     where c.region_group = $1`,
    [regionGroup]
  )
  const siteLayers = await client.query(
    `with site_dates as (
       select observed_at from public.site_candidates sc join public.councils c on c.id = sc.council_id where c.region_group = $1
       union all
       select ctl.observed_at from public.site_controls ctl join public.site_candidates sc on sc.id = ctl.site_candidate_id join public.councils c on c.id = sc.council_id where c.region_group = $1
       union all
       select sct.observed_at from public.site_constraints sct join public.site_candidates sc on sc.id = sct.site_candidate_id join public.councils c on c.id = sc.council_id where c.region_group = $1
     )
     select min(observed_at) as min_date, max(observed_at) as max_date
     from site_dates`,
    [regionGroup]
  )

  return {
    planning_proposals: planning.rows[0],
    application_signals: activity.rows[0],
    site_screening_layers: siteLayers.rows[0]
  }
}

async function queryPrecinctSnapshot(client, regionGroup, snapshotDate) {
  const result = await client.query(
    `select
       v.precinct_name,
       v.council_name,
       v.precinct_type,
       v.opportunity_rating,
       v.recommended_action,
       v.policy_score,
       v.timing_score,
       v.friction_score,
       v.recent_application_count,
       v.active_pipeline_count,
       v.state_significant_count,
       v.constraint_count,
       v.constraint_summary,
       v.trigger_summary,
       vpss.latest_signal_date as source_observed_at
     from public.v_precinct_shortlist v
     join public.councils c on c.canonical_name = v.council_name
     left join public.v_precinct_signal_summary vpss on vpss.precinct_id = v.precinct_id
      where c.region_group = $1
      order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
               v.friction_score asc nulls last,
               v.timing_score desc nulls last,
               v.recent_da_count desc nulls last,
               v.active_pipeline_count desc nulls last,
               v.precinct_name`,
    [regionGroup]
  )

  return {
    snapshot_date: snapshotDate,
    region_group: regionGroup,
    window_start: RECENT_APPLICATION_WINDOW_START,
    rows: result.rows.map((row, index) => ({
      rank: index + 1,
      precinct_key: `precinct:${slugify(row.precinct_name)}`,
      precinct_name: row.precinct_name,
      council_name: row.council_name,
      precinct_type: row.precinct_type,
      opportunity_rating: row.opportunity_rating,
      recommended_action: row.recommended_action,
      policy_score: toNumber(row.policy_score),
      timing_score: toNumber(row.timing_score),
      friction_score: toNumber(row.friction_score),
      recent_application_count: toNumber(row.recent_application_count),
      active_pipeline_count: toNumber(row.active_pipeline_count),
      state_significant_count: toNumber(row.state_significant_count),
      constraint_count: toNumber(row.constraint_count),
      constraint_summary: row.constraint_summary,
      trigger_summary: row.trigger_summary,
      source_observed_at: row.source_observed_at
    }))
  }
}

async function querySiteSnapshot(client, regionGroup, snapshotDate) {
  const result = await client.query(
    `select
       site_key,
       site_label,
       precinct_name,
       watchlist_bucket_name,
       council_name,
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
       fsr,
       height_m,
       geometry_area_sqm,
       frontage_candidate_m,
       constraint_count,
       high_constraint_count,
       constraint_summary,
       title_complexity_penalty,
       apparent_site_jurisdiction,
       observed_at as source_observed_at
      from public.v_site_screening_latest
      where region_group = $1
      order by screening_score desc,
               title_complexity_penalty asc nulls last,
               high_constraint_count asc nulls last,
               abs(coalesce(geometry_area_sqm, plan_area_sqm, 0) - 1200) asc nulls last,
               matched_signal_count desc,
               site_label`,
    [regionGroup]
  )

  return {
    snapshot_date: snapshotDate,
    region_group: regionGroup,
    rows: result.rows.map((row, index) => ({
      rank: index + 1,
      site_key: row.site_key,
      site_label: row.site_label,
      precinct_name: row.precinct_name,
      watchlist_bucket_name: row.watchlist_bucket_name,
      council_name: row.council_name,
      screening_band: row.screening_band,
      screening_score: toNumber(row.screening_score),
      recommended_site_action: row.recommended_site_action,
      precinct_opportunity_rating: row.precinct_opportunity_rating,
      precinct_policy_score: toNumber(row.precinct_policy_score),
      precinct_timing_score: toNumber(row.precinct_timing_score),
      precinct_friction_score: toNumber(row.precinct_friction_score),
      matched_signal_count: toNumber(row.matched_signal_count),
      latest_lodgement_date: row.latest_lodgement_date,
      zoning_code: row.zoning_code,
      fsr: toNumber(row.fsr),
      height_m: toNumber(row.height_m),
      geometry_area_sqm: toNumber(row.geometry_area_sqm),
      frontage_candidate_m: toNumber(row.frontage_candidate_m),
      constraint_count: toNumber(row.constraint_count),
      high_constraint_count: toNumber(row.high_constraint_count),
      constraint_summary: row.constraint_summary,
      title_complexity_penalty: toNumber(row.title_complexity_penalty),
      apparent_site_jurisdiction: row.apparent_site_jurisdiction,
      source_observed_at: row.source_observed_at
    }))
  }
}

async function queryProposalSnapshot(client, regionGroup, snapshotDate) {
  const result = await client.query(
    `select
       pp.proposal_key,
       pp.title,
       pp.stage,
       pp.stage_rank,
       c.canonical_name as council_name,
       p.name as precinct_name,
       pp.location_text,
       pp.is_active,
       pp.first_seen_at,
       pp.last_seen_at,
       pp.source_url,
       pp.last_seen_at as source_observed_at
     from public.planning_proposals pp
     join public.councils c on c.id = pp.council_id
     left join public.precincts p on p.id = pp.precinct_id
     where c.region_group = $1
       and pp.stage = any($2::text[])
     order by pp.stage_rank nulls last,
              pp.last_seen_at desc,
              pp.title`,
    [regionGroup, ACTIVE_PROPOSAL_STAGES]
  )

  return {
    snapshot_date: snapshotDate,
    region_group: regionGroup,
    rows: result.rows.map((row) => ({
      proposal_key: row.proposal_key,
      title: row.title,
      stage: row.stage,
      stage_rank: row.stage_rank,
      council_name: row.council_name,
      precinct_name: row.precinct_name,
      location_text: row.location_text,
      is_active: row.is_active,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      source_url: row.source_url,
      source_observed_at: row.source_observed_at
    }))
  }
}

async function queryActivitySnapshot(client, regionGroup, snapshotDate) {
  const totals = await client.query(
    `with mapped as (
       select count(*) filter (where a.tracker_scope = 'applications')::int as mapped_application_count
       from public.application_signals a
       join public.councils c on c.id = a.council_id
       where c.region_group = $1
     ), bucketed as (
       select
         case
           when a.tracker_scope = 'state_significant' then 'SSD'
           when lower(coalesce(a.application_type, '')) like '%complying development certificate%' or lower(coalesce(a.application_type, '')) like '%cdc%' then 'CDC'
           when lower(coalesce(a.application_type, '')) like '%modification%' then 'Modification'
           when lower(coalesce(a.application_type, '')) like '%state significant%' or lower(coalesce(a.application_type, '')) like '%ssd%' then 'SSD'
           when lower(coalesce(a.application_type, '')) like '%development application%' then 'DA'
           else 'Other'
         end as application_bucket
       from public.application_signals a
       join public.councils c on c.id = a.council_id
       where c.region_group = $1
         and coalesce(a.lodgement_date, a.observed_at) >= $2::date
     )
     select
       mapped.mapped_application_count,
       count(*) filter (where application_bucket in ('DA', 'CDC', 'Modification', 'Other'))::int as recent_application_count,
       count(*) filter (where application_bucket = 'DA')::int as recent_da_count,
       count(*) filter (where application_bucket = 'CDC')::int as recent_cdc_count,
       count(*) filter (where application_bucket = 'SSD')::int as recent_ssd_count,
       count(*) filter (where application_bucket = 'Modification')::int as recent_modification_count,
       count(*) filter (where application_bucket = 'Other')::int as recent_other_count
     from bucketed
     cross join mapped
     group by mapped.mapped_application_count`,
    [regionGroup, RECENT_APPLICATION_WINDOW_START]
  )

  const councilRows = await client.query(
    `select
       council_name,
       target_value,
       application_recent_count as recent_application_count,
       active_pipeline_count
     from public.v_council_scoreboard
     where region_group = $1
     order by application_recent_count desc nulls last,
              active_pipeline_count desc nulls last,
              council_name`,
    [regionGroup]
  )

  const precinctRows = await client.query(
    `select
       v.precinct_name,
       v.council_name,
       v.recent_application_count,
       v.recent_da_count,
       v.recent_cdc_count,
       v.recent_ssd_count,
       v.recent_modification_count
     from public.v_precinct_shortlist v
     join public.councils c on c.canonical_name = v.council_name
     where c.region_group = $1
     order by v.recent_application_count desc nulls last,
              v.recent_da_count desc nulls last,
              v.precinct_name`,
    [regionGroup]
  )

  const typeMix = await client.query(
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
         count(*)::int as count
       from public.application_signals a
       join public.councils c on c.id = a.council_id
       where c.region_group = $1
         and coalesce(a.lodgement_date, a.observed_at) >= $2::date
       group by 1
     )
     select application_bucket, count
     from grouped
     order by case application_bucket when 'DA' then 1 when 'CDC' then 2 when 'SSD' then 3 when 'Modification' then 4 else 5 end,
              count desc,
              application_bucket`,
    [regionGroup, RECENT_APPLICATION_WINDOW_START]
  )

  return {
    snapshot_date: snapshotDate,
    region_group: regionGroup,
    window_start: RECENT_APPLICATION_WINDOW_START,
    totals: totals.rows[0],
    council_rows: councilRows.rows.map((row, index) => ({
      rank: index + 1,
      council_name: row.council_name,
      recent_application_count: toNumber(row.recent_application_count),
      active_pipeline_count: toNumber(row.active_pipeline_count),
      target_value: toNumber(row.target_value)
    })),
    precinct_rows: precinctRows.rows.map((row, index) => ({
      rank: index + 1,
      precinct_key: `precinct:${slugify(row.precinct_name)}`,
      precinct_name: row.precinct_name,
      council_name: row.council_name,
      recent_application_count: toNumber(row.recent_application_count),
      recent_da_count: toNumber(row.recent_da_count),
      recent_cdc_count: toNumber(row.recent_cdc_count),
      recent_ssd_count: toNumber(row.recent_ssd_count),
      recent_modification_count: toNumber(row.recent_modification_count)
    })),
    type_mix_rows: typeMix.rows.map((row) => ({
      application_bucket: row.application_bucket,
      count: toNumber(row.count)
    }))
  }
}

function buildManifest(options, sourceRanges) {
  const manifest = {
    snapshot_date: options.snapshotDate,
    captured_at: new Date().toISOString(),
    region_group: options.regionGroup,
    label: options.label,
    baseline_type: options.baselineType,
    notes: [
      `${options.baselineType === 'formal' ? 'Formal' : 'Reconstructed'} weekly snapshot for full and delta reporting`
    ],
    files: [
      'precinct-shortlist.json',
      'site-screening.json',
      'proposals.json',
      'activity.json'
    ],
    source_ranges: sourceRanges
  }

  if (options.baselineType === 'reconstructed') {
    manifest.reconstruction_method = options.reconstructionMethod
    manifest.known_gaps = options.knownGaps
  }

  return manifest
}

async function main() {
  const options = parseArgs()
  const client = await connectWithFallback()
  try {
    const outputDir = snapshotDir(options.snapshotDate)
    prepareSnapshotDirectory(outputDir, options.overwrite)

    const sourceRanges = await querySourceRanges(client, options.regionGroup)
    const precinctSnapshot = await queryPrecinctSnapshot(client, options.regionGroup, options.snapshotDate)
    const siteSnapshot = await querySiteSnapshot(client, options.regionGroup, options.snapshotDate)
    const proposalSnapshot = await queryProposalSnapshot(client, options.regionGroup, options.snapshotDate)
    const activitySnapshot = await queryActivitySnapshot(client, options.regionGroup, options.snapshotDate)

    const manifest = buildManifest(options, sourceRanges)

    writeJson(path.join(outputDir, 'manifest.json'), manifest)
    writeJson(path.join(outputDir, 'precinct-shortlist.json'), precinctSnapshot)
    writeJson(path.join(outputDir, 'site-screening.json'), siteSnapshot)
    writeJson(path.join(outputDir, 'proposals.json'), proposalSnapshot)
    writeJson(path.join(outputDir, 'activity.json'), activitySnapshot)

    console.log(`Wrote weekly snapshot to ${outputDir}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
