import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const SAMPLE_SIZE = 5
const PROPERTY_URL = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/12/query'

const PROPERTY_TYPE = {
  1: 'Property',
  2: 'Crown',
  3: 'NationalPark',
  4: 'StateForest',
  5: 'Other',
  6: 'Incomplete'
}

const VALNET_STATUS = {
  1: 'CANCELLD',
  2: 'CURRENT',
  3: 'PROFORMA',
  4: 'SKELETON'
}

const VALNET_TYPE = {
  1: 'NONVAL',
  2: 'NORMAL',
  3: 'STRATA',
  4: 'UNDERSP'
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function readJson(relativeOrAbsolutePath) {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(root, relativeOrAbsolutePath)
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
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
    precincts: [...(base.precincts || []), ...(config.precincts || [])]
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
  const options = { configPath: null }
  for (const arg of args) {
    if (arg.startsWith('--config=')) options.configPath = arg.split('=')[1].trim()
  }
  return options
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJsonWithRetry(url, maxAttempts = 4) {
  let lastError = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; radarestate-bot/1.0)' }
      })
      if (!response.ok) {
        if (response.status >= 500 && attempt < maxAttempts) {
          await sleep(500 * attempt)
          continue
        }
        throw new Error(`Request failed: ${response.status} for ${url}`)
      }
      return response.json()
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts) throw error
      await sleep(500 * attempt)
    }
  }
  throw lastError || new Error(`Request failed for ${url}`)
}

async function safePropertyQuery(latitude, longitude) {
  const params = new URLSearchParams({
    f: 'pjson',
    outFields: 'propid,address,propertytype,valnetpropertystatus,valnetpropertytype,dissolveparcelcount,valnetlotcount',
    returnGeometry: 'false',
    geometry: JSON.stringify({ x: Number(longitude), y: Number(latitude), spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '3857',
    spatialRel: 'esriSpatialRelIntersects'
  })
  try {
    return await fetchJsonWithRetry(`${PROPERTY_URL}?${params.toString()}`)
  } catch (error) {
    console.warn(`Property query skipped: ${error.message}`)
    return { features: [] }
  }
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

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function mode(values, keyFn) {
  const counts = new Map()
  let best = null
  let bestCount = -1
  for (const value of values) {
    const key = keyFn(value)
    const next = (counts.get(key) || 0) + 1
    counts.set(key, next)
    if (next > bestCount) {
      best = value
      bestCount = next
    }
  }
  return best
}

async function applyArtifacts(client) {
  await client.query(readFile('supabase/schema.sql'))
  await client.query(readFile('supabase/development_views.sql'))
}

async function fetchTargetPrecincts(client, config) {
  const codes = Array.isArray(config?.precincts)
    ? config.precincts.map((item) => typeof item === 'string' ? null : item?.code).filter(Boolean)
    : []
  const names = Array.isArray(config?.precincts)
    ? config.precincts.map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean)
    : []
  const { rows } = await client.query(
    `select p.id as precinct_id, p.precinct_code, p.name as precinct_name, p.primary_council_id as council_id, c.canonical_name as council_name
     from public.precincts p
     left join public.councils c on c.id = p.primary_council_id
     where (cardinality($1::text[]) > 0 and p.precinct_code = any($1::text[]))
        or (cardinality($2::text[]) > 0 and p.name = any($2::text[]))
     order by p.name, p.precinct_code`,
    [codes, names]
  )
  return rows
}

async function fetchSamplePoints(client, precinctIds) {
  const { rows } = await client.query(
    `select precinct_id, latitude, longitude, location_text, lodgement_date
     from (
       select a.precinct_id, a.latitude, a.longitude, a.location_text, a.lodgement_date,
              row_number() over (partition by a.precinct_id order by a.lodgement_date desc nulls last, a.observed_at desc, a.id desc) as rn
       from public.application_signals a
       where a.precinct_id = any($1::uuid[])
         and a.tracker_scope = 'applications'
         and a.latitude is not null
         and a.longitude is not null
     ) ranked
     where rn <= $2
     order by precinct_id, lodgement_date desc nulls last`,
    [precinctIds, SAMPLE_SIZE]
  )
  const grouped = new Map()
  for (const row of rows) {
    const list = grouped.get(row.precinct_id) || []
    list.push(row)
    grouped.set(row.precinct_id, list)
  }
  return grouped
}

function buildPropertyContextRow(precinct, points, features, observedAt) {
  if (!features.length) return null
  const uniqueFeatures = uniqueBy(features, (feature) => feature.attributes?.propid || JSON.stringify(feature.attributes))
  const dissolveCounts = uniqueFeatures.map((feature) => toNumber(feature.attributes?.dissolveparcelcount)).filter((v) => v !== null)
  const lotCounts = uniqueFeatures.map((feature) => toNumber(feature.attributes?.valnetlotcount)).filter((v) => v !== null)
  const dominantProperty = mode(uniqueFeatures, (feature) => feature.attributes?.propertytype)
  const dominantStatus = mode(uniqueFeatures, (feature) => feature.attributes?.valnetpropertystatus)
  const dominantValnet = mode(uniqueFeatures, (feature) => feature.attributes?.valnetpropertytype)
  const first = uniqueFeatures[0].attributes || {}

  return {
    context_key: `${precinct.precinct_code}:property_context`,
    precinct_id: precinct.precinct_id,
    council_id: precinct.council_id,
    source_name: 'NSW Land Parcel and Property Theme - Property',
    source_url: PROPERTY_URL.replace('/query', ''),
    observed_at: observedAt,
    sample_point_count: points.length,
    matched_property_count: points.filter((point) => point._matched).length,
    sample_location_example: points[0]?.location_text || null,
    example_propid: first.propid || null,
    example_address: first.address || null,
    dominant_property_type: PROPERTY_TYPE[dominantProperty?.attributes?.propertytype] || null,
    dominant_valnet_status: VALNET_STATUS[dominantStatus?.attributes?.valnetpropertystatus] || null,
    dominant_valnet_type: VALNET_TYPE[dominantValnet?.attributes?.valnetpropertytype] || null,
    dissolve_parcel_count_min: dissolveCounts.length ? Math.min(...dissolveCounts) : null,
    dissolve_parcel_count_max: dissolveCounts.length ? Math.max(...dissolveCounts) : null,
    valnet_lot_count_min: lotCounts.length ? Math.min(...lotCounts) : null,
    valnet_lot_count_max: lotCounts.length ? Math.max(...lotCounts) : null,
    notes: `Sample-based property context from ${uniqueFeatures.length} property polygons across ${points.length} recent application points for ${precinct.precinct_name}`,
    raw_payload: {
      precinct,
      sample_points: points,
      property_features: uniqueFeatures.map((feature) => feature.attributes)
    }
  }
}

async function upsertContext(client, row) {
  await client.query(
    `insert into public.property_contexts (
       context_key, precinct_id, council_id, source_name, source_url, observed_at,
       sample_point_count, matched_property_count, sample_location_example,
       example_propid, example_address, dominant_property_type, dominant_valnet_status,
       dominant_valnet_type, dissolve_parcel_count_min, dissolve_parcel_count_max,
       valnet_lot_count_min, valnet_lot_count_max, notes, raw_payload
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9,
       $10, $11, $12, $13,
       $14, $15, $16,
       $17, $18, $19, $20::jsonb
     )
     on conflict (context_key) do update set
       precinct_id = excluded.precinct_id,
       council_id = excluded.council_id,
       source_name = excluded.source_name,
       source_url = excluded.source_url,
       observed_at = excluded.observed_at,
       sample_point_count = excluded.sample_point_count,
       matched_property_count = excluded.matched_property_count,
       sample_location_example = excluded.sample_location_example,
       example_propid = excluded.example_propid,
       example_address = excluded.example_address,
       dominant_property_type = excluded.dominant_property_type,
       dominant_valnet_status = excluded.dominant_valnet_status,
       dominant_valnet_type = excluded.dominant_valnet_type,
       dissolve_parcel_count_min = excluded.dissolve_parcel_count_min,
       dissolve_parcel_count_max = excluded.dissolve_parcel_count_max,
       valnet_lot_count_min = excluded.valnet_lot_count_min,
       valnet_lot_count_max = excluded.valnet_lot_count_max,
       notes = excluded.notes,
       raw_payload = excluded.raw_payload`,
    [
      row.context_key,
      row.precinct_id,
      row.council_id,
      row.source_name,
      row.source_url,
      row.observed_at,
      row.sample_point_count,
      row.matched_property_count,
      row.sample_location_example,
      row.example_propid,
      row.example_address,
      row.dominant_property_type,
      row.dominant_valnet_status,
      row.dominant_valnet_type,
      row.dissolve_parcel_count_min,
      row.dissolve_parcel_count_max,
      row.valnet_lot_count_min,
      row.valnet_lot_count_max,
      row.notes,
      JSON.stringify(row.raw_payload)
    ]
  )
}

async function main() {
  const options = parseArgs()
  const config = options.configPath ? loadConfig(options.configPath) : null
  const client = await connectWithFallback()
  try {
    await applyArtifacts(client)
    const precincts = await fetchTargetPrecincts(client, config)
    const samplePoints = await fetchSamplePoints(client, precincts.map((row) => row.precinct_id))
    const observedAt = new Date().toISOString().slice(0, 10)
    const cache = new Map()
    let updated = 0

    for (const precinct of precincts) {
      const points = (samplePoints.get(precinct.precinct_id) || []).map((point) => ({ ...point, _matched: false }))
      const collected = []

      for (const point of points) {
        const pointKey = `${point.latitude},${point.longitude}`
        let result = cache.get(pointKey)
        if (!result) {
          result = await safePropertyQuery(point.latitude, point.longitude)
          cache.set(pointKey, result)
        }
        const features = result.features || []
        if (features.length) point._matched = true
        for (const feature of features) collected.push(feature)
      }

      const row = buildPropertyContextRow(precinct, points, collected, observedAt)
      if (!row) continue
      await upsertContext(client, row)
      updated += 1
    }

    console.log(`Updated property contexts for ${updated} precincts`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
