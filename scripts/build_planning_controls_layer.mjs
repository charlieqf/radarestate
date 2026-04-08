import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const SAMPLE_SIZE = 5
const ZONING_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/2/query'
const FSR_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/1/query'
const HEIGHT_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/5/query'

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
  const options = {
    configPath: null
  }
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

async function safeQueryLayer(url, latitude, longitude) {
  const params = new URLSearchParams({
    f: 'pjson',
    returnGeometry: 'false',
    outFields: '*',
    geometry: JSON.stringify({
      x: Number(longitude),
      y: Number(latitude),
      spatialReference: { wkid: 4326 }
    }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects'
  })
  try {
    return await fetchJsonWithRetry(`${url}?${params.toString()}`)
  } catch (error) {
    console.warn(`Planning control query skipped: ${error.message}`)
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

function mode(values, keyFn) {
  const counts = new Map()
  let best = null
  let bestCount = -1
  for (const value of values) {
    const key = keyFn(value)
    const next = (counts.get(key) || 0) + 1
    counts.set(key, next)
    if (next > bestCount) {
      bestCount = next
      best = value
    }
  }
  return best
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
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

  if (codes.length || names.length) {
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

  const { rows } = await client.query(
    `select p.id as precinct_id, p.precinct_code, p.name as precinct_name, p.primary_council_id as council_id, c.canonical_name as council_name
     from public.precincts p
     left join public.councils c on c.id = p.primary_council_id
     order by p.name`
  )
  return rows
}

async function fetchSamplePoints(client, precinctIds) {
  const { rows } = await client.query(
    `select precinct_id, latitude, longitude, location_text, lodgement_date
     from (
       select
         a.precinct_id,
         a.latitude,
         a.longitude,
         a.location_text,
         a.lodgement_date,
         row_number() over (
           partition by a.precinct_id
           order by a.lodgement_date desc nulls last, a.observed_at desc, a.id desc
         ) as rn
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

async function buildPrecinctControlRow(precinct, points, cache, observedAt) {
  if (!points?.length) return null

  const zoningHits = []
  const fsrHits = []
  const heightHits = []

  for (const point of points) {
    const pointKey = `${point.latitude},${point.longitude}`
    let bundle = cache.get(pointKey)
    if (!bundle) {
      const [zoning, fsr, height] = await Promise.all([
        safeQueryLayer(ZONING_URL, point.latitude, point.longitude),
        safeQueryLayer(FSR_URL, point.latitude, point.longitude),
        safeQueryLayer(HEIGHT_URL, point.latitude, point.longitude)
      ])
      bundle = { zoning, fsr, height }
      cache.set(pointKey, bundle)
    }

    for (const feature of bundle.zoning.features || []) zoningHits.push(feature.attributes)
    for (const feature of bundle.fsr.features || []) fsrHits.push(feature.attributes)
    for (const feature of bundle.height.features || []) heightHits.push(feature.attributes)
  }

  const dominantZoning = zoningHits.length
    ? mode(zoningHits, (item) => `${item.SYM_CODE}|${item.LAY_CLASS}|${item.EPI_NAME}`)
    : null

  const fsrValues = fsrHits.map((item) => toNumber(item.FSR)).filter((value) => value !== null)
  const dominantFsr = fsrHits.length
    ? mode(fsrHits, (item) => `${item.FSR}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`)
    : null

  const heightValues = heightHits.map((item) => toNumber(item.MAX_B_H_M ?? item.MAX_B_H)).filter((value) => value !== null)
  const dominantHeight = heightHits.length
    ? mode(heightHits, (item) => `${item.MAX_B_H_M ?? item.MAX_B_H}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`)
    : null

  const matchedPointCount = points.filter((point) => {
    const pointKey = `${point.latitude},${point.longitude}`
    const bundle = cache.get(pointKey)
    return (bundle?.zoning?.features?.length || 0) + (bundle?.fsr?.features?.length || 0) + (bundle?.height?.features?.length || 0) > 0
  }).length

  return {
    control_key: `${precinct.precinct_code}:planning_controls`,
    precinct_id: precinct.precinct_id,
    council_id: precinct.council_id,
    source_name: 'NSW EPI Primary Planning Layers',
    zoning_source_url: ZONING_URL.replace('/query', ''),
    fsr_source_url: FSR_URL.replace('/query', ''),
    height_source_url: HEIGHT_URL.replace('/query', ''),
    observed_at: observedAt,
    sample_point_count: points.length,
    matched_point_count: matchedPointCount,
    sample_location_example: points[0]?.location_text || null,
    dominant_zoning_code: dominantZoning?.SYM_CODE || null,
    dominant_zoning_label: dominantZoning?.LAY_CLASS || null,
    zoning_layer_name: dominantZoning?.LAY_NAME || null,
    zoning_epi_name: dominantZoning?.EPI_NAME || null,
    fsr_min: fsrValues.length ? Math.min(...fsrValues) : null,
    fsr_max: fsrValues.length ? Math.max(...fsrValues) : null,
    fsr_clause: dominantFsr?.LEGIS_REF_CLAUSE || null,
    fsr_epi_name: dominantFsr?.EPI_NAME || null,
    height_min_m: heightValues.length ? Math.min(...heightValues) : null,
    height_max_m: heightValues.length ? Math.max(...heightValues) : null,
    height_clause: dominantHeight?.LEGIS_REF_CLAUSE || null,
    height_epi_name: dominantHeight?.EPI_NAME || null,
    notes: `Sampled from ${points.length} recent mapped application points for ${precinct.precinct_name}`,
    raw_payload: {
      precinct,
      sample_points: points,
      zoning: uniqueBy(zoningHits, (item) => `${item.SYM_CODE}|${item.LAY_CLASS}|${item.EPI_NAME}`),
      fsr: uniqueBy(fsrHits, (item) => `${item.FSR}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`),
      height: uniqueBy(heightHits, (item) => `${item.MAX_B_H_M ?? item.MAX_B_H}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`)
    }
  }
}

async function upsertPlanningControl(client, row) {
  await client.query(
    `insert into public.planning_controls (
       control_key, precinct_id, council_id, source_name,
       zoning_source_url, fsr_source_url, height_source_url, observed_at,
       sample_point_count, matched_point_count, sample_location_example,
       dominant_zoning_code, dominant_zoning_label, zoning_layer_name, zoning_epi_name,
       fsr_min, fsr_max, fsr_clause, fsr_epi_name,
       height_min_m, height_max_m, height_clause, height_epi_name,
       notes, raw_payload
     ) values (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11,
       $12, $13, $14, $15,
       $16, $17, $18, $19,
       $20, $21, $22, $23,
       $24, $25::jsonb
     )
     on conflict (control_key) do update set
       precinct_id = excluded.precinct_id,
       council_id = excluded.council_id,
       source_name = excluded.source_name,
       zoning_source_url = excluded.zoning_source_url,
       fsr_source_url = excluded.fsr_source_url,
       height_source_url = excluded.height_source_url,
       observed_at = excluded.observed_at,
       sample_point_count = excluded.sample_point_count,
       matched_point_count = excluded.matched_point_count,
       sample_location_example = excluded.sample_location_example,
       dominant_zoning_code = excluded.dominant_zoning_code,
       dominant_zoning_label = excluded.dominant_zoning_label,
       zoning_layer_name = excluded.zoning_layer_name,
       zoning_epi_name = excluded.zoning_epi_name,
       fsr_min = excluded.fsr_min,
       fsr_max = excluded.fsr_max,
       fsr_clause = excluded.fsr_clause,
       fsr_epi_name = excluded.fsr_epi_name,
       height_min_m = excluded.height_min_m,
       height_max_m = excluded.height_max_m,
       height_clause = excluded.height_clause,
       height_epi_name = excluded.height_epi_name,
       notes = excluded.notes,
       raw_payload = excluded.raw_payload`,
    [
      row.control_key,
      row.precinct_id,
      row.council_id,
      row.source_name,
      row.zoning_source_url,
      row.fsr_source_url,
      row.height_source_url,
      row.observed_at,
      row.sample_point_count,
      row.matched_point_count,
      row.sample_location_example,
      row.dominant_zoning_code,
      row.dominant_zoning_label,
      row.zoning_layer_name,
      row.zoning_epi_name,
      row.fsr_min,
      row.fsr_max,
      row.fsr_clause,
      row.fsr_epi_name,
      row.height_min_m,
      row.height_max_m,
      row.height_clause,
      row.height_epi_name,
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
    const cache = new Map()
    const observedAt = new Date().toISOString().slice(0, 10)

    let updated = 0
    for (const precinct of precincts) {
      const row = await buildPrecinctControlRow(precinct, samplePoints.get(precinct.precinct_id) || [], cache, observedAt)
      if (!row) continue
      await upsertPlanningControl(client, row)
      updated += 1
    }

    console.log(`Updated planning controls for ${updated} precincts`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
