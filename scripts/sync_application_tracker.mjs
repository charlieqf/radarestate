import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const APP_ENDPOINT = 'https://api.apps1.nsw.gov.au/eplanning/data/v0/DAApplicationTracker'
const SSD_ENDPOINT = 'https://www.planningportal.nsw.gov.au/state-significant-projects-spatial-data'
const PORTAL_BASE_URL = 'https://www.planningportal.nsw.gov.au'

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(readFile(relativePath))
}

function loadConfig(configPath) {
  const absolutePath = path.isAbsolute(configPath) ? configPath : path.join(root, configPath)
  const config = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  if (!config.extends) return config
  const parentPath = path.isAbsolute(config.extends)
    ? config.extends
    : path.join(path.dirname(absolutePath), config.extends)
  const base = loadConfig(parentPath)
  return {
    ...base,
    ...config,
    councils: [...(base.councils || []), ...(config.councils || [])]
  }
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

function toDate(value) {
  const cleaned = clean(value)
  return cleaned || null
}

function toNumber(value) {
  const cleaned = clean(value)
  if (!cleaned) return null
  const numeric = Number.parseFloat(cleaned)
  return Number.isNaN(numeric) ? null : numeric
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
  ['Burwood', 'Burwood'],
  ['Burwood Council', 'Burwood'],
  ['Newcastle', 'Newcastle'],
  ['Newcastle City Council', 'Newcastle'],
  ['City of Newcastle', 'Newcastle'],
  ['Lake Macquarie', 'Lake Macquarie'],
  ['Lake Macquarie City Council', 'Lake Macquarie'],
  ['Maitland', 'Maitland'],
  ['Maitland City Council', 'Maitland'],
  ['Port Stephens', 'Port Stephens'],
  ['Port Stephens Council', 'Port Stephens'],
  ['Cessnock', 'Cessnock'],
  ['Cessnock City Council', 'Cessnock']
])

function canonicalCouncil(raw) {
  const cleaned = clean(raw)
  return cleaned ? councilMap.get(cleaned) || cleaned : null
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    recentFrom: null,
    pageSize: null,
    maxPages: null,
    includeStateSignificant: true,
    councils: null,
    configPath: null
  }

  for (const arg of args) {
    if (arg.startsWith('--recent-from=')) options.recentFrom = arg.split('=')[1]
    if (arg.startsWith('--page-size=')) options.pageSize = Number.parseInt(arg.split('=')[1], 10)
    if (arg.startsWith('--max-pages=')) options.maxPages = Number.parseInt(arg.split('=')[1], 10)
    if (arg.startsWith('--councils=')) options.councils = arg.split('=')[1].split(',').map((value) => value.trim()).filter(Boolean)
    if (arg.startsWith('--config=')) options.configPath = arg.split('=')[1].trim()
    if (arg === '--skip-ssa') options.includeStateSignificant = false
  }

  return options
}

async function connectWithFallback() {
  let lastError = null

  for (const connectionString of getConnectionStrings()) {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    })
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

async function ensureCouncil(client, rawName, regionGroup = 'Greater Sydney') {
  const canonical = canonicalCouncil(rawName)
  if (!canonical) return null

  await client.query(
    `insert into public.councils (canonical_name, display_name, region_group, is_focus)
     values ($1, $1, $2, true)
     on conflict (canonical_name) do update set
       display_name = excluded.display_name,
       region_group = excluded.region_group,
       is_focus = true`,
    [canonical, regionGroup]
  )

  const { rows } = await client.query(
    'select id from public.councils where canonical_name = $1',
    [canonical]
  )
  return rows[0]?.id ?? null
}

async function createIngestRun(client, sourceName, sourceScope) {
  const { rows } = await client.query(
    `insert into public.ingest_runs (source_name, source_scope, run_status)
     values ($1, $2, 'started')
     returning id`,
    [sourceName, sourceScope]
  )
  return rows[0].id
}

async function abandonOpenRuns(client, sourceName) {
  await client.query(
    `update public.ingest_runs
     set run_status = 'abandoned',
         completed_at = now(),
         notes = coalesce(notes, 'Marked abandoned before next run')
     where source_name = $1
       and run_status = 'started'`,
    [sourceName]
  )
}

async function completeIngestRun(client, ingestRunId, status, rowsObserved, notes) {
  await client.query(
    `update public.ingest_runs
     set run_status = $2,
         rows_observed = $3,
         notes = $4,
         completed_at = now()
     where id = $1`,
    [ingestRunId, status, rowsObserved, notes]
  )
}

async function fetchDaPage(payload) {
  const response = await fetch(APP_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`DAApplicationTracker request failed: ${response.status}`)
  }

  return response.json()
}

async function fetchStateSignificantData() {
  const response = await fetch(SSD_ENDPOINT)
  if (!response.ok) {
    throw new Error(`State significant endpoint failed: ${response.status}`)
  }
  return response.json()
}

function hrefFromHtml(html) {
  const match = clean(html)?.match(/href="([^"]+)"/i)
  if (!match) return SSD_ENDPOINT
  return match[1].startsWith('http') ? match[1] : `${PORTAL_BASE_URL}${match[1]}`
}

function normaliseGeometryCoordinates(feature) {
  const coords = feature?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return { latitude: null, longitude: null }
  return {
    longitude: toNumber(coords[0]),
    latitude: toNumber(coords[1])
  }
}

function normaliseStateSignificantCoordinates(item) {
  const coordText = Array.isArray(item.coordinates) ? item.coordinates[0] : null
  if (!coordText || !coordText.includes(',')) return { latitude: null, longitude: null }
  const [latText, lonText] = coordText.split(',')
  return {
    latitude: toNumber(latText),
    longitude: toNumber(lonText)
  }
}

function normaliseDaFeature(feature, councilId, observedAt) {
  const props = feature.properties || {}
  const coords = normaliseGeometryCoordinates(feature)
  const appKey = clean(props.PLANNING_PORTAL_APP_NUMBER)
  return {
    app_key: appKey,
    source_name: 'DAApplicationTracker API',
    tracker_scope: 'applications',
    portal_app_number: appKey,
    project_name: clean(props.PROJECT_TITLE),
    council_id: councilId,
    application_type: clean(props.APPLICATION_TYPE),
    development_type: clean(props.TYPE_OF_DEVELOPMENT),
    status: clean(props.STATUS),
    lodgement_date: toDate(props.LODGEMENT_DATE),
    determination_date: toDate(props.DETERMINATION_DATE),
    location_text: clean(props.FULL_ADDRESS),
    latitude: coords.latitude,
    longitude: coords.longitude,
    source_url: APP_ENDPOINT,
    observed_at: observedAt,
    signal_weight: 1,
    raw_payload: JSON.stringify(feature)
  }
}

function normaliseStateSignificantItem(item, councilId, observedAt) {
  const coords = normaliseStateSignificantCoordinates(item)
  return {
    app_key: clean(item.caseId),
    source_name: 'State Significant Spatial Data',
    tracker_scope: 'state_significant',
    portal_app_number: clean(item.caseId),
    project_name: clean(item.title),
    council_id: councilId,
    application_type: clean(item.casetype),
    development_type: clean(item.development),
    status: clean(item.caseStage),
    lodgement_date: null,
    determination_date: null,
    location_text: clean(item.address),
    latitude: coords.latitude,
    longitude: coords.longitude,
    source_url: hrefFromHtml(item.link),
    observed_at: observedAt,
    signal_weight: 2,
    raw_payload: JSON.stringify(item)
  }
}

async function upsertApplicationSignals(client, rows) {
  if (!rows.length) return

  const dedupedMap = new Map()
  for (const row of rows) {
    if (!row?.app_key) continue
    dedupedMap.set(row.app_key, row)
  }

  const dedupedRows = [...dedupedMap.values()]

  const chunkSize = 200
  for (let start = 0; start < dedupedRows.length; start += chunkSize) {
    const chunk = dedupedRows.slice(start, start + chunkSize)
    const values = []
    const placeholders = chunk.map((row, rowIndex) => {
      const offset = rowIndex * 18
      values.push(
        row.app_key,
        row.source_name,
        row.tracker_scope,
        row.portal_app_number,
        row.project_name,
        row.council_id,
        row.application_type,
        row.development_type,
        row.status,
        row.lodgement_date,
        row.determination_date,
        row.location_text,
        row.latitude,
        row.longitude,
        row.source_url,
        row.observed_at,
        row.signal_weight,
        row.raw_payload
      )
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}::jsonb)`
    }).join(',\n')

    await client.query(
      `insert into public.application_signals (
         app_key, source_name, tracker_scope, portal_app_number, project_name, council_id,
         application_type, development_type, status, lodgement_date, determination_date,
         location_text, latitude, longitude, source_url, observed_at, signal_weight, raw_payload
       ) values ${placeholders}
       on conflict (app_key) do update set
         source_name = excluded.source_name,
         tracker_scope = excluded.tracker_scope,
         portal_app_number = excluded.portal_app_number,
         project_name = excluded.project_name,
         council_id = excluded.council_id,
         application_type = excluded.application_type,
         development_type = excluded.development_type,
         status = excluded.status,
         lodgement_date = excluded.lodgement_date,
         determination_date = excluded.determination_date,
         location_text = excluded.location_text,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         source_url = excluded.source_url,
         observed_at = excluded.observed_at,
         signal_weight = excluded.signal_weight,
         raw_payload = excluded.raw_payload`,
      values
    )
  }
}

async function upsertCouncilActivityCount(client, councilId, totalCount, recentCount, recentFrom, observedAt, trackerDisplayName) {
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
      totalCount,
      recentCount,
      recentFrom,
      observedAt,
      `Counts derived from public DAApplicationTracker API for ${trackerDisplayName}`,
      JSON.stringify({ trackerDisplayName, totalCount, recentCount, recentFrom, observedAt })
    ]
  )
}

async function syncCouncilApplications(client, councilConfig, options, observedAt) {
  const councilId = await ensureCouncil(client, councilConfig.canonicalName, councilConfig.regionGroup || 'Greater Sydney')
  const allTimeCountResponse = await fetchDaPage({
    ApplicationStatus: 'ALL',
    CouncilDisplayName: councilConfig.trackerDisplayName,
    PageNumber: 1,
    PageSize: 1
  })

  const firstPagePayload = {
    ApplicationStatus: 'ALL',
    CouncilDisplayName: councilConfig.trackerDisplayName,
    LodgementDateFrom: options.recentFrom,
    PageNumber: 1,
    PageSize: options.pageSize
  }

  const firstPage = await fetchDaPage(firstPagePayload)
  const totalPages = Number(firstPage.TotalPages || 0)
  const pagesToFetch = options.maxPages ? Math.min(totalPages, options.maxPages) : totalPages
  console.log(`Fetching ${councilConfig.canonicalName}: recent=${firstPage.TotalCount}, total pages=${pagesToFetch}, page size=${options.pageSize}`)
  const allRows = (firstPage.features || []).map((feature) => normaliseDaFeature(feature, councilId, observedAt))

  for (let page = 2; page <= pagesToFetch; page += 1) {
    const pageResponse = await fetchDaPage({
      ...firstPagePayload,
      PageNumber: page
    })
    const pageRows = (pageResponse.features || []).map((feature) => normaliseDaFeature(feature, councilId, observedAt))
    allRows.push(...pageRows)
    if (page % 5 === 0 || page === pagesToFetch) {
      console.log(`  ${councilConfig.canonicalName}: fetched page ${page}/${pagesToFetch}`)
    }
  }

  await upsertApplicationSignals(client, allRows)
  await upsertCouncilActivityCount(
    client,
    councilId,
    Number(allTimeCountResponse.TotalCount || 0),
    Number(firstPage.TotalCount || 0),
    options.recentFrom,
    observedAt,
    councilConfig.trackerDisplayName
  )

  return {
    council: councilConfig.canonicalName,
    recentCount: Number(firstPage.TotalCount || 0),
    totalCount: Number(allTimeCountResponse.TotalCount || 0),
    pagesFetched: pagesToFetch,
    rowsUpserted: allRows.length
  }
}

async function syncStateSignificant(client, focusCanonicalSet, observedAt) {
  const items = await fetchStateSignificantData()
  const rows = []

  for (const item of items) {
    const councils = Array.isArray(item.localCouncilArea) ? item.localCouncilArea : []
    const matchedCanonical = councils.map((name) => canonicalCouncil(name)).find((name) => name && focusCanonicalSet.has(name))
    if (!matchedCanonical) continue
    const councilId = await ensureCouncil(client, matchedCanonical)
    rows.push(normaliseStateSignificantItem(item, councilId, observedAt))
  }

  await upsertApplicationSignals(client, rows)
  return rows.length
}

async function verifyRemoteCounts(client, recentFrom) {
  const result = await client.query(
    `select c.canonical_name as council_name, cac.recent_count, cac.total_count
     from public.council_activity_counts cac
     join public.councils c on c.id = cac.council_id
     where cac.recent_window_start = $1
     order by cac.recent_count desc nulls last
     limit 10`,
    [recentFrom]
  )

  const appCount = await client.query(
    `select count(*)::int as total from public.application_signals`
  )

  console.log(`application_signals total rows: ${appCount.rows[0].total}`)
  console.log('Top council activity rows:')
  for (const row of result.rows) {
    console.log(JSON.stringify(row))
  }
}

async function main() {
  const cli = parseArgs()
  const config = loadConfig(cli.configPath || 'mvp/config/application-sync-focus-councils.json')
  const selectedCouncils = cli.councils ? new Set(cli.councils.map((value) => canonicalCouncil(value) || value)) : null
  const options = {
    recentFrom: cli.recentFrom || config.recentFrom,
    pageSize: cli.pageSize || config.pageSize || 200,
    maxPages: cli.maxPages || null,
    includeStateSignificant: cli.includeStateSignificant
  }
  const councilsToSync = selectedCouncils
    ? config.councils.filter((item) => selectedCouncils.has(item.canonicalName))
    : config.councils

  const observedAt = new Date().toISOString().slice(0, 10)
  const client = await connectWithFallback()
  await abandonOpenRuns(client, 'Application Tracker API')
  const ingestRunId = await createIngestRun(client, 'Application Tracker API', `focus councils recent from ${options.recentFrom}`)
  let totalRowsUpserted = 0
  let totalCouncils = 0

  try {
    for (const councilConfig of councilsToSync) {
      const summary = await syncCouncilApplications(client, councilConfig, options, observedAt)
      totalRowsUpserted += summary.rowsUpserted
      totalCouncils += 1
      console.log(`Synced ${summary.council}: recent=${summary.recentCount}, total=${summary.totalCount}, pages=${summary.pagesFetched}, rows=${summary.rowsUpserted}`)
    }

    if (options.includeStateSignificant) {
      const focusCanonicalSet = new Set(councilsToSync.map((item) => item.canonicalName))
      const ssaRows = await syncStateSignificant(client, focusCanonicalSet, observedAt)
      totalRowsUpserted += ssaRows
      console.log(`Synced state significant rows for focus councils: ${ssaRows}`)
    }

    await completeIngestRun(
      client,
      ingestRunId,
      'completed',
      totalRowsUpserted,
      `Synced ${totalCouncils} councils from ${options.recentFrom} with page size ${options.pageSize}`
    )

    await verifyRemoteCounts(client, options.recentFrom)
  } catch (error) {
    await completeIngestRun(client, ingestRunId, 'failed', totalRowsUpserted, String(error.message || error))
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
