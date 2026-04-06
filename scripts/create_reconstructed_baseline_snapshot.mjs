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
    snapshotDate: null,
    regionGroup: 'Greater Sydney',
    label: 'Sydney',
    overwrite: false
  }

  for (const arg of args) {
    if (arg.startsWith('--snapshot-date=')) options.snapshotDate = arg.split('=')[1].trim()
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--label=')) options.label = arg.split('=')[1].trim()
    if (arg === '--overwrite') options.overwrite = true
  }

  if (!options.snapshotDate) throw new Error('Missing required --snapshot-date argument')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.snapshotDate)) {
    throw new Error(`Invalid --snapshot-date value: ${options.snapshotDate}`)
  }
  return options
}

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
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

async function querySourceRanges(client, regionGroup, snapshotDate) {
  const planning = await client.query(
    `select min(pp.first_seen_at) as min_date, max(pp.last_seen_at) as max_date
     from public.planning_proposals pp
     join public.councils c on c.id = pp.council_id
     where c.region_group = $1
       and pp.last_seen_at <= $2::date`,
    [regionGroup, snapshotDate]
  )
  const activity = await client.query(
    `select min(coalesce(a.lodgement_date, a.observed_at)) as min_date,
            max(coalesce(a.lodgement_date, a.observed_at)) as max_date
     from public.application_signals a
     join public.councils c on c.id = a.council_id
     where c.region_group = $1
       and coalesce(a.lodgement_date, a.observed_at) <= $2::date`,
    [regionGroup, snapshotDate]
  )

  return {
    planning_proposals: planning.rows[0],
    application_signals: activity.rows[0],
    site_screening_layers: { min_date: null, max_date: null }
  }
}

async function queryPrecinctSnapshot(client, regionGroup, snapshotDate) {
  const result = await client.query(
    `with proposal_counts as (
       select
         pp.precinct_id,
         count(*) filter (where pp.stage = any($3::text[]))::int as active_pipeline_count
       from public.planning_proposals pp
       join public.councils c on c.id = pp.council_id
       where c.region_group = $1
         and pp.last_seen_at <= $2::date
       group by pp.precinct_id
     ), application_counts as (
       select
         a.precinct_id,
         count(*) filter (where a.tracker_scope = 'applications' and coalesce(a.lodgement_date, a.observed_at) >= $4::date)::int as recent_application_count,
         count(*) filter (
           where a.tracker_scope = 'applications'
             and coalesce(a.lodgement_date, a.observed_at) >= $4::date
             and lower(coalesce(a.application_type, '')) like '%development application%'
             and lower(coalesce(a.application_type, '')) not like '%complying development certificate%'
             and lower(coalesce(a.application_type, '')) not like '%state significant%'
         )::int as recent_da_count,
         count(*) filter (
           where a.tracker_scope = 'applications'
             and coalesce(a.lodgement_date, a.observed_at) >= $4::date
             and (lower(coalesce(a.application_type, '')) like '%complying development certificate%' or lower(coalesce(a.application_type, '')) like '%cdc%')
         )::int as recent_cdc_count,
         count(*) filter (
           where coalesce(a.lodgement_date, a.observed_at) >= $4::date
             and (a.tracker_scope = 'state_significant' or lower(coalesce(a.application_type, '')) like '%state significant%' or lower(coalesce(a.application_type, '')) like '%ssd%')
         )::int as recent_ssd_count,
         count(*) filter (
           where a.tracker_scope = 'applications'
             and coalesce(a.lodgement_date, a.observed_at) >= $4::date
             and lower(coalesce(a.application_type, '')) like '%modification%'
         )::int as recent_modification_count,
         max(coalesce(a.lodgement_date, a.observed_at)) as source_observed_at
       from public.application_signals a
       join public.councils c on c.id = a.council_id
       where c.region_group = $1
         and a.precinct_id is not null
         and coalesce(a.lodgement_date, a.observed_at) <= $2::date
       group by a.precinct_id
     )
     select
       p.name as precinct_name,
       c.canonical_name as council_name,
       p.precinct_type,
       ac.recent_application_count,
       ac.recent_da_count,
       ac.recent_cdc_count,
       ac.recent_ssd_count,
       ac.recent_modification_count,
       coalesce(pc.active_pipeline_count, 0) as active_pipeline_count,
       ac.source_observed_at
     from application_counts ac
     join public.precincts p on p.id = ac.precinct_id
     left join public.councils c on c.id = p.primary_council_id
     left join proposal_counts pc on pc.precinct_id = ac.precinct_id
      order by ac.recent_da_count desc, ac.recent_application_count desc, p.name`,
    [regionGroup, snapshotDate, ACTIVE_PROPOSAL_STAGES, RECENT_APPLICATION_WINDOW_START]
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
      opportunity_rating: null,
      recommended_action: null,
      policy_score: null,
      timing_score: null,
      friction_score: null,
      recent_application_count: toNumber(row.recent_application_count),
      active_pipeline_count: toNumber(row.active_pipeline_count),
      state_significant_count: toNumber(row.recent_ssd_count),
      constraint_count: 0,
      constraint_summary: null,
      trigger_summary: `${toNumber(row.recent_application_count) || 0} recent applications reconstructed from retained source history on or before ${snapshotDate}`,
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
       and pp.last_seen_at <= $2::date
       and pp.stage = any($3::text[])
     order by pp.stage_rank nulls last, pp.last_seen_at desc, pp.title`,
    [regionGroup, snapshotDate, ACTIVE_PROPOSAL_STAGES]
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
    `select
       count(*) filter (where a.tracker_scope = 'applications')::int as mapped_application_count,
       count(*) filter (where a.tracker_scope = 'applications' and coalesce(a.lodgement_date, a.observed_at) >= $3::date)::int as recent_application_count,
       count(*) filter (
         where a.tracker_scope = 'applications'
           and coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and lower(coalesce(a.application_type, '')) like '%development application%'
           and lower(coalesce(a.application_type, '')) not like '%complying development certificate%'
           and lower(coalesce(a.application_type, '')) not like '%state significant%'
       )::int as recent_da_count,
       count(*) filter (
         where a.tracker_scope = 'applications'
           and coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and (lower(coalesce(a.application_type, '')) like '%complying development certificate%' or lower(coalesce(a.application_type, '')) like '%cdc%')
       )::int as recent_cdc_count,
       count(*) filter (
         where coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and (a.tracker_scope = 'state_significant' or lower(coalesce(a.application_type, '')) like '%state significant%' or lower(coalesce(a.application_type, '')) like '%ssd%')
       )::int as recent_ssd_count,
       count(*) filter (
         where a.tracker_scope = 'applications'
           and coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and lower(coalesce(a.application_type, '')) like '%modification%'
       )::int as recent_modification_count,
       count(*) filter (
         where a.tracker_scope = 'applications'
           and coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and lower(coalesce(a.application_type, '')) not like '%development application%'
           and lower(coalesce(a.application_type, '')) not like '%complying development certificate%'
           and lower(coalesce(a.application_type, '')) not like '%cdc%'
           and lower(coalesce(a.application_type, '')) not like '%modification%'
           and lower(coalesce(a.application_type, '')) not like '%state significant%'
           and lower(coalesce(a.application_type, '')) not like '%ssd%'
       )::int as recent_other_count
     from public.application_signals a
     join public.councils c on c.id = a.council_id
     where c.region_group = $1
       and coalesce(a.lodgement_date, a.observed_at) <= $2::date`,
    [regionGroup, snapshotDate, RECENT_APPLICATION_WINDOW_START]
  )

  const councilRows = await client.query(
    `with proposal_counts as (
       select c.canonical_name as council_name, count(*) filter (where pp.stage = any($3::text[]))::int as active_pipeline_count
       from public.planning_proposals pp
       join public.councils c on c.id = pp.council_id
       where c.region_group = $1
         and pp.last_seen_at <= $2::date
       group by c.canonical_name
     ), activity_counts as (
       select c.canonical_name as council_name, count(*) filter (where a.tracker_scope = 'applications' and coalesce(a.lodgement_date, a.observed_at) >= $4::date)::int as recent_application_count
       from public.application_signals a
       join public.councils c on c.id = a.council_id
       where c.region_group = $1
         and coalesce(a.lodgement_date, a.observed_at) <= $2::date
       group by c.canonical_name
     )
     select ac.council_name, ac.recent_application_count, coalesce(pc.active_pipeline_count, 0) as active_pipeline_count, null::int as target_value
     from activity_counts ac
     left join proposal_counts pc on pc.council_name = ac.council_name
     order by ac.recent_application_count desc, ac.council_name`,
    [regionGroup, snapshotDate, ACTIVE_PROPOSAL_STAGES, RECENT_APPLICATION_WINDOW_START]
  )

  const precinctRows = await client.query(
    `select
       p.name as precinct_name,
       c.canonical_name as council_name,
       count(*) filter (where a.tracker_scope = 'applications' and coalesce(a.lodgement_date, a.observed_at) >= $3::date)::int as recent_application_count,
       count(*) filter (
         where a.tracker_scope = 'applications'
           and coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and lower(coalesce(a.application_type, '')) like '%development application%'
           and lower(coalesce(a.application_type, '')) not like '%complying development certificate%'
           and lower(coalesce(a.application_type, '')) not like '%state significant%'
       )::int as recent_da_count,
       count(*) filter (
         where a.tracker_scope = 'applications'
           and coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and (lower(coalesce(a.application_type, '')) like '%complying development certificate%' or lower(coalesce(a.application_type, '')) like '%cdc%')
       )::int as recent_cdc_count,
       count(*) filter (
         where coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and (a.tracker_scope = 'state_significant' or lower(coalesce(a.application_type, '')) like '%state significant%' or lower(coalesce(a.application_type, '')) like '%ssd%')
       )::int as recent_ssd_count,
       count(*) filter (
         where a.tracker_scope = 'applications'
           and coalesce(a.lodgement_date, a.observed_at) >= $3::date
           and lower(coalesce(a.application_type, '')) like '%modification%'
       )::int as recent_modification_count
     from public.application_signals a
     join public.precincts p on p.id = a.precinct_id
     left join public.councils c on c.id = p.primary_council_id
     join public.councils sc on sc.id = a.council_id
     where sc.region_group = $1
       and a.precinct_id is not null
       and coalesce(a.lodgement_date, a.observed_at) <= $2::date
     group by p.name, c.canonical_name
      order by recent_da_count desc, recent_application_count desc, p.name`,
    [regionGroup, snapshotDate, RECENT_APPLICATION_WINDOW_START]
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
         and coalesce(a.lodgement_date, a.observed_at) >= $3::date
         and coalesce(a.lodgement_date, a.observed_at) <= $2::date
       group by 1
     )
     select application_bucket, count
     from grouped
     order by case application_bucket when 'DA' then 1 when 'CDC' then 2 when 'SSD' then 3 when 'Modification' then 4 else 5 end,
              count desc,
              application_bucket`,
    [regionGroup, snapshotDate, RECENT_APPLICATION_WINDOW_START]
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
  return {
    snapshot_date: options.snapshotDate,
    captured_at: new Date().toISOString(),
    region_group: options.regionGroup,
    label: options.label,
    baseline_type: 'reconstructed',
    reconstruction_method: 'Built from retained application history up to the requested cutoff date, with limited policy reconstruction and no pre-April site-screening history.',
    known_gaps: [
      'No true historical precinct shortlist snapshot was retained for this date.',
      'No true site-screening layer was retained before 2026-04-03.',
      'Policy coverage before 2026-04-01 is not retained in the current database state.'
    ],
    files: [
      'precinct-shortlist.json',
      'site-screening.json',
      'proposals.json',
      'activity.json'
    ],
    source_ranges: sourceRanges
  }
}

async function main() {
  const options = parseArgs()
  const client = await connectWithFallback()
  try {
    const outputDir = snapshotDir(options.snapshotDate)
    prepareSnapshotDirectory(outputDir, options.overwrite)

    const sourceRanges = await querySourceRanges(client, options.regionGroup, options.snapshotDate)
    const precinctSnapshot = await queryPrecinctSnapshot(client, options.regionGroup, options.snapshotDate)
    const proposalSnapshot = await queryProposalSnapshot(client, options.regionGroup, options.snapshotDate)
    const activitySnapshot = await queryActivitySnapshot(client, options.regionGroup, options.snapshotDate)
    const siteSnapshot = {
      snapshot_date: options.snapshotDate,
      region_group: options.regionGroup,
      rows: []
    }

    const manifest = buildManifest(options, sourceRanges)

    writeJson(path.join(outputDir, 'manifest.json'), manifest)
    writeJson(path.join(outputDir, 'precinct-shortlist.json'), precinctSnapshot)
    writeJson(path.join(outputDir, 'site-screening.json'), siteSnapshot)
    writeJson(path.join(outputDir, 'proposals.json'), proposalSnapshot)
    writeJson(path.join(outputDir, 'activity.json'), activitySnapshot)

    console.log(`Wrote reconstructed baseline snapshot to ${outputDir}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
