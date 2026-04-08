import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { parse } from 'csv-parse/sync'

const root = process.cwd()

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    only: 'all'
  }
  for (const arg of args) {
    if (arg.startsWith('--only=')) options.only = arg.split('=')[1].trim()
  }
  return options
}

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

function clean(value) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

function toInt(value) {
  const cleaned = clean(value)
  if (!cleaned) return null
  const match = cleaned.match(/-?[0-9][0-9,]*/)
  if (!match) return null
  return Number.parseInt(match[0].replace(/,/g, ''), 10)
}

function toNumeric(value) {
  const cleaned = clean(value)
  if (!cleaned) return null
  const match = cleaned.match(/-?[0-9]+(?:\.[0-9]+)?/)
  return match ? Number.parseFloat(match[0]) : null
}

function parseCsv(relativePath) {
  return parse(readFile(relativePath), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  })
}

const councilMap = new Map([
  ['Parramatta', 'Parramatta'],
  ['City of Parramatta Council', 'Parramatta'],
  ['Canterbury-Bankstown', 'Canterbury-Bankstown'],
  ['Canterbury-Bankstown Council', 'Canterbury-Bankstown'],
  ['Inner West', 'Inner West'],
  ['Inner West Council', 'Inner West'],
  ['Liverpool', 'Liverpool'],
  ['Liverpool City Council', 'Liverpool'],
  ['Ryde', 'Ryde'],
  ['Ryde City Council', 'Ryde'],
  ['North Sydney', 'North Sydney'],
  ['North Sydney Council', 'North Sydney'],
  ['Willoughby', 'Willoughby'],
  ['Willoughby City Council', 'Willoughby'],
  ['Ku-ring-gai', 'Ku-ring-gai'],
  ['Ku-ring-gai Council', 'Ku-ring-gai'],
  ['Campbelltown', 'Campbelltown'],
  ['Campbelltown City Council', 'Campbelltown'],
  ['Strathfield', 'Strathfield'],
  ['Strathfield Municipal Council', 'Strathfield'],
  ['Canada Bay', 'Canada Bay'],
  ['City of Canada Bay Council', 'Canada Bay'],
  ['Sutherland Shire', 'Sutherland Shire'],
  ['Sutherland Shire Council', 'Sutherland Shire'],
  ['Hunters Hill', 'Hunters Hill'],
  ['The Council of the Municipality of Hunters Hill', 'Hunters Hill'],
  ['Woollahra', 'Woollahra'],
  ['Woollahra Municipal Council', 'Woollahra'],
  ['Fairfield', 'Fairfield'],
  ['Fairfield City Council', 'Fairfield'],
  ['The Hills Shire', 'The Hills Shire'],
  ['The Hills Shire Council', 'The Hills Shire'],
  ['Penrith', 'Penrith'],
  ['Penrith City Council', 'Penrith'],
  ['Georges River', 'Georges River'],
  ['Georges River Council', 'Georges River'],
  ['Bayside', 'Bayside'],
  ['Bayside Council', 'Bayside'],
  ['Blacktown', 'Blacktown'],
  ['Blacktown City Council', 'Blacktown'],
  ['Cumberland', 'Cumberland'],
  ['Cumberland Council', 'Cumberland'],
])

function canonicalCouncil(raw) {
  const cleaned = clean(raw)
  return cleaned ? councilMap.get(cleaned) || cleaned : null
}

function extractMatch(text, regex, parser = clean) {
  if (!text) return null
  const match = text.match(regex)
  return match ? parser(match[1]) : null
}

function parseHousingNotes(notes) {
  const moderateMatch = notes ? notes.match(/approx ([0-9.]+)% moderate|moderate heat vulnerability approx ([0-9.]+)%/i) : null
  return {
    resident_population: extractMatch(notes, /Resident population ([0-9,]+)/i, toInt),
    number_of_homes: extractMatch(notes, /number of homes ([0-9,]+)/i, toInt),
    average_household_size: extractMatch(notes, /average household size ([0-9.]+)/i, toNumeric),
    urban_tree_canopy_pct: extractMatch(notes, /urban tree canopy ([0-9.]+)%/i, toNumeric),
    high_heat_vulnerability_pct: extractMatch(notes, /high heat vulnerability (?:approx |less than )?([0-9.]+)%/i, toNumeric),
    moderate_heat_vulnerability_pct: moderateMatch ? toNumeric(moderateMatch[1] || moderateMatch[2]) : null,
    source_updated_date: extractMatch(notes, /updated ([0-9]{4}-[0-9]{2}-[0-9]{2})/i),
  }
}

async function ensureCouncil(client, rawName) {
  const canonical = canonicalCouncil(rawName)
  if (!canonical) return null
  await client.query(
    `insert into public.councils (canonical_name, display_name, region_group, is_focus)
     values ($1, $1, 'Greater Sydney', true)
     on conflict (canonical_name) do update set
       display_name = excluded.display_name,
       region_group = excluded.region_group`,
    [canonical],
  )

  const { rows } = await client.query(
    'select id from public.councils where canonical_name = $1',
    [canonical],
  )
  return rows[0]?.id ?? null
}

async function applySqlFiles(client) {
  for (const file of ['supabase/schema.sql', 'supabase/views.sql']) {
    const sql = readFile(file)
    await client.query(sql)
    console.log(`Applied ${file}`)
  }
}

async function loadHousingTargets(client) {
  const rows = parseCsv('mvp/data/interim/housing_target_context.csv')
  for (const row of rows) {
    const councilId = await ensureCouncil(client, row.lga)
    const parsed = parseHousingNotes(row.notes)
    await client.query(
      `insert into public.housing_targets (
         record_key, council_id, source_name, target_period, target_value_raw, target_value,
         completion_or_progress_raw, resident_population, number_of_homes, average_household_size,
         urban_tree_canopy_pct, high_heat_vulnerability_pct, moderate_heat_vulnerability_pct,
         source_url, source_updated_date, observed_at, notes, raw_payload
       ) values (
         $1, $2, 'Housing Targets', $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12,
         $13, $14, $15, $16, $17::jsonb
       )
       on conflict (record_key) do update set
         council_id = excluded.council_id,
         target_period = excluded.target_period,
         target_value_raw = excluded.target_value_raw,
         target_value = excluded.target_value,
         completion_or_progress_raw = excluded.completion_or_progress_raw,
         resident_population = excluded.resident_population,
         number_of_homes = excluded.number_of_homes,
         average_household_size = excluded.average_household_size,
         urban_tree_canopy_pct = excluded.urban_tree_canopy_pct,
         high_heat_vulnerability_pct = excluded.high_heat_vulnerability_pct,
         moderate_heat_vulnerability_pct = excluded.moderate_heat_vulnerability_pct,
         source_url = excluded.source_url,
         source_updated_date = excluded.source_updated_date,
         observed_at = excluded.observed_at,
         notes = excluded.notes,
         raw_payload = excluded.raw_payload`,
      [
        row.context_id,
        councilId,
        clean(row.target_period),
        clean(row.target_value_raw),
        toInt(row.target_value_raw),
        clean(row.completion_or_progress_raw),
        parsed.resident_population,
        parsed.number_of_homes,
        parsed.average_household_size,
        parsed.urban_tree_canopy_pct,
        parsed.high_heat_vulnerability_pct,
        parsed.moderate_heat_vulnerability_pct,
        clean(row.source_url),
        parsed.source_updated_date,
        clean(row.last_reviewed_at),
        clean(row.notes),
        JSON.stringify(row),
      ],
    )
  }
  console.log(`Loaded housing_targets: ${rows.length}`)
}

async function loadPlanningProposals(client) {
  const rows = parseCsv('mvp/data/interim/planning_proposals_latest.csv')
  for (const row of rows) {
    const councilId = await ensureCouncil(client, row.lga)
    const stage = clean(row.stage)
    const observedAt = clean(row.updated_date)
    const isActive = !['made', 'withdrawn'].includes(stage)
    const proposalNumber = extractMatch(row.title, /(PP-[0-9]{4}-[0-9]+)/i)

    const upsert = await client.query(
      `insert into public.planning_proposals (
         proposal_key, source_name, proposal_number, title, stage, stage_rank,
         council_id, location_text, source_url, summary, analyst_note,
         first_seen_at, last_seen_at, is_active, raw_payload
       ) values (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15::jsonb
       )
       on conflict (proposal_key) do update set
         source_name = excluded.source_name,
         proposal_number = excluded.proposal_number,
         title = excluded.title,
         stage = excluded.stage,
         stage_rank = excluded.stage_rank,
         council_id = excluded.council_id,
         location_text = excluded.location_text,
         source_url = excluded.source_url,
         summary = excluded.summary,
         analyst_note = excluded.analyst_note,
         last_seen_at = excluded.last_seen_at,
         is_active = excluded.is_active,
         raw_payload = excluded.raw_payload
       returning id`,
      [
        row.signal_id,
        clean(row.source_name),
        proposalNumber,
        clean(row.title),
        stage,
        toInt(row.stage_rank),
        councilId,
        clean(row.location_text),
        clean(row.source_url),
        clean(row.summary),
        clean(row.analyst_note),
        observedAt,
        observedAt,
        isActive,
        JSON.stringify(row),
      ],
    )

    const proposalId = upsert.rows[0].id
    await client.query(
      `insert into public.planning_proposal_stage_history (
         proposal_id, stage, stage_rank, observed_at, source_url, notes
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (proposal_id, stage, observed_at) do nothing`,
      [
        proposalId,
        stage,
        toInt(row.stage_rank),
        observedAt,
        clean(row.source_url),
        clean(row.analyst_note),
      ],
    )
  }
  console.log(`Loaded planning_proposals: ${rows.length}`)
}

async function loadApplicationSignals(client) {
  const rows = parseCsv('mvp/data/interim/application_tracker_latest.csv')
  for (const row of rows) {
    const councilId = await ensureCouncil(client, row.council)
    await client.query(
      `insert into public.application_signals (
         app_key, source_name, tracker_scope, portal_app_number, council_id,
         application_type, status, lodgement_date, location_text, source_url,
         observed_at, signal_weight, raw_payload
       ) values (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, 1, $12::jsonb
       )
       on conflict (app_key) do update set
         source_name = excluded.source_name,
         tracker_scope = excluded.tracker_scope,
         portal_app_number = excluded.portal_app_number,
         council_id = excluded.council_id,
         application_type = excluded.application_type,
         status = excluded.status,
         lodgement_date = excluded.lodgement_date,
         location_text = excluded.location_text,
         source_url = excluded.source_url,
         observed_at = excluded.observed_at,
         raw_payload = excluded.raw_payload`,
      [
        row.app_id,
        clean(row.source_name),
        clean(row.tracker_scope),
        row.app_id,
        councilId,
        clean(row.application_type),
        clean(row.status),
        clean(row.lodgement_date),
        clean(row.location_text),
        clean(row.source_url),
        clean(row.observed_at),
        JSON.stringify(row),
      ],
    )
  }
  console.log(`Loaded application_signals: ${rows.length}`)
}

async function loadCouncilActivityCounts(client) {
  const rows = parseCsv('mvp/data/interim/application_activity_counts.csv')
  for (const row of rows) {
    const councilId = await ensureCouncil(client, row.council)
    await client.query(
      `insert into public.council_activity_counts (
         source_name, council_id, status_scope, total_count, recent_count,
         recent_window_start, observed_at, notes, raw_payload
       ) values (
         'DAApplicationTracker API', $1, 'ALL', $2, $3,
         $4, $5, $6, $7::jsonb
       )
       on conflict (council_id, status_scope, recent_window_start, observed_at) do update set
         total_count = excluded.total_count,
         recent_count = excluded.recent_count,
         notes = excluded.notes,
         raw_payload = excluded.raw_payload`,
      [
        councilId,
        toInt(row.total_count),
        toInt(row.recent_count_2025_01_01_onward),
        '2025-01-01',
        clean(row.last_reviewed_at),
        clean(row.notes),
        JSON.stringify(row),
      ],
    )
  }
  console.log(`Loaded council_activity_counts: ${rows.length}`)
}

async function verify(client) {
  const tableCheck = await client.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name in (
         'councils',
         'housing_targets',
         'planning_proposals',
         'planning_proposal_stage_history',
         'application_signals',
         'council_activity_counts',
         'opportunity_items'
       )
     order by table_name`,
  )

  const viewCheck = await client.query(
    `select table_name
     from information_schema.views
     where table_schema = 'public'
       and table_name in (
         'v_council_scoreboard',
         'v_policy_pipeline',
         'v_target_pressure_vs_activity',
         'v_sydney_proposal_watchlist',
         'v_recent_application_ranking'
       )
     order by table_name`,
  )

  const summary = await client.query(
    `select council_name, target_value, application_recent_count, active_pipeline_count
     from public.v_council_scoreboard
     order by target_value desc nulls last
     limit 5`,
  )

  console.log('Tables:', tableCheck.rows.map((row) => row.table_name).join(', '))
  console.log('Views:', viewCheck.rows.map((row) => row.table_name).join(', '))
  console.log('Top scoreboard rows:')
  for (const row of summary.rows) {
    console.log(JSON.stringify(row))
  }
}

async function main() {
  const options = parseArgs()
  const connectionStrings = getConnectionStrings()
  let lastError = null

  for (const connectionString of connectionStrings) {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })

    try {
      await client.connect()
      console.log(`Connected using ${connectionString.includes('pooler.supabase.com') ? 'pooler' : 'direct'} endpoint`)
      await applySqlFiles(client)
      if (options.only === 'all' || options.only === 'housing-targets') await loadHousingTargets(client)
      if (options.only === 'all' || options.only === 'planning-proposals') await loadPlanningProposals(client)
      if (options.only === 'all' || options.only === 'application-signals') await loadApplicationSignals(client)
      if (options.only === 'all' || options.only === 'council-activity') await loadCouncilActivityCounts(client)
      await verify(client)
      await client.end()
      return
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

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
