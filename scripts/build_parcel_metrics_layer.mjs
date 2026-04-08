import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const SAMPLE_SIZE = 5
const LOT_URL = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/8/query'
const ROAD_CORRIDOR_URL = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/5/query'

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

async function safeLotQuery(latitude, longitude) {
  const params = new URLSearchParams({
    f: 'pjson',
    outFields: 'lotidstring,lotnumber,plannumber,planlabel,planlotarea,planlotareaunits,Shape__Area,Shape__Length',
    returnGeometry: 'true',
    geometry: JSON.stringify({ x: Number(longitude), y: Number(latitude), spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '3857',
    spatialRel: 'esriSpatialRelIntersects'
  })
  try {
    return await fetchJsonWithRetry(`${LOT_URL}?${params.toString()}`)
  } catch (error) {
    console.warn(`Lot query skipped: ${error.message}`)
    return { features: [] }
  }
}

async function safeRoadCorridorQuery(geometry) {
  const params = new URLSearchParams({
    f: 'pjson',
    outFields: 'roadnamelabel',
    returnGeometry: 'true',
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryPolygon',
    inSR: '3857',
    outSR: '3857',
    spatialRel: 'esriSpatialRelIntersects'
  })
  try {
    let lastError = null
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const response = await fetch(ROAD_CORRIDOR_URL, {
          method: 'POST',
          headers: {
            'user-agent': 'Mozilla/5.0 (compatible; radarestate-bot/1.0)',
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body: params.toString()
        })
        if (!response.ok) {
          if (response.status >= 500 && attempt < 4) {
            await sleep(500 * attempt)
            continue
          }
          throw new Error(`Request failed: ${response.status} for ${ROAD_CORRIDOR_URL}`)
        }
        return await response.json()
      } catch (error) {
        lastError = error
        if (attempt === 4) throw error
        await sleep(500 * attempt)
      }
    }
    throw lastError || new Error('Road corridor query failed')
  } catch (error) {
    console.warn(`Road corridor query skipped: ${error.message}`)
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

function ringBounds(geometry) {
  const rings = geometry?.rings || []
  let xmin = Infinity
  let ymin = Infinity
  let xmax = -Infinity
  let ymax = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      xmin = Math.min(xmin, x)
      ymin = Math.min(ymin, y)
      xmax = Math.max(xmax, x)
      ymax = Math.max(ymax, y)
    }
  }
  if (!Number.isFinite(xmin)) return null
  return { xmin, ymin, xmax, ymax }
}

function pointInRing(point, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0])
    const yi = Number(ring[i][1])
    const xj = Number(ring[j][0])
    const yj = Number(ring[j][1])
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-12) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function pointInPolygon(point, geometry) {
  const rings = geometry?.rings || []
  if (!rings.length) return false
  return pointInRing(point, rings[0])
}

function distancePointToSegment(point, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - a[0], point.y - a[1])
  }
  const t = Math.max(0, Math.min(1, ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / (dx * dx + dy * dy)))
  const projX = a[0] + t * dx
  const projY = a[1] + t * dy
  return Math.hypot(point.x - projX, point.y - projY)
}

function minDistancePointToPolygon(point, geometry) {
  if (pointInPolygon(point, geometry)) return 0
  const rings = geometry?.rings || []
  let min = Infinity
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      min = Math.min(min, distancePointToSegment(point, ring[i], ring[i + 1]))
    }
  }
  return min
}

function estimateFrontage(parcelGeometry, roadFeatures, tolerance = 1.5) {
  const exterior = parcelGeometry?.rings?.[0]
  if (!Array.isArray(exterior) || exterior.length < 2 || !roadFeatures.length) return null
  let frontage = 0
  for (let i = 0; i < exterior.length - 1; i += 1) {
    const a = exterior[i]
    const b = exterior[i + 1]
    const midpoint = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }
    const adjacent = roadFeatures.some((feature) => minDistancePointToPolygon(midpoint, feature.geometry) <= tolerance)
    if (!adjacent) continue
    frontage += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return frontage > 0 ? frontage : null
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

function buildParcelMetricRow(precinct, points, features, observedAt) {
  if (!features.length) return null
  const uniqueFeatures = uniqueBy(features, (feature) => feature.attributes?.lotidstring || feature.attributes?.cadid || JSON.stringify(feature.attributes))
  const planAreas = uniqueFeatures.map((feature) => toNumber(feature.attributes?.planlotarea)).filter((v) => v !== null)
  const shapeAreas = uniqueFeatures.map((feature) => toNumber(feature.attributes?.Shape__Area)).filter((v) => v !== null)
  const perimeters = uniqueFeatures.map((feature) => toNumber(feature.attributes?.Shape__Length)).filter((v) => v !== null)
  const frontageCandidates = uniqueFeatures.map((feature) => toNumber(feature._frontageCandidate)).filter((v) => v !== null)
  const widths = []
  const heights = []
  for (const feature of uniqueFeatures) {
    const bounds = ringBounds(feature.geometry)
    if (!bounds) continue
    widths.push(bounds.xmax - bounds.xmin)
    heights.push(bounds.ymax - bounds.ymin)
  }

  const first = uniqueFeatures[0].attributes || {}
  return {
    metric_key: `${precinct.precinct_code}:parcel_metrics`,
    precinct_id: precinct.precinct_id,
    council_id: precinct.council_id,
    source_name: 'NSW Land Parcel and Property Theme - Lot',
    source_url: LOT_URL.replace('/query', ''),
    observed_at: observedAt,
    sample_point_count: points.length,
    matched_parcel_count: points.filter((point) => point._matched).length,
    sample_location_example: points[0]?.location_text || null,
    lot_count: uniqueFeatures.length,
    example_lot_id: first.lotidstring || null,
    example_plan_label: first.planlabel || null,
    plan_area_min_sqm: planAreas.length ? Math.min(...planAreas) : null,
    plan_area_max_sqm: planAreas.length ? Math.max(...planAreas) : null,
    geometry_area_min_sqm: shapeAreas.length ? Math.min(...shapeAreas) : null,
    geometry_area_max_sqm: shapeAreas.length ? Math.max(...shapeAreas) : null,
    perimeter_min_m: perimeters.length ? Math.min(...perimeters) : null,
    perimeter_max_m: perimeters.length ? Math.max(...perimeters) : null,
    bbox_width_min_m: widths.length ? Math.min(...widths) : null,
    bbox_width_max_m: widths.length ? Math.max(...widths) : null,
    bbox_height_min_m: heights.length ? Math.min(...heights) : null,
    bbox_height_max_m: heights.length ? Math.max(...heights) : null,
    frontage_candidate_min_m: frontageCandidates.length ? Math.min(...frontageCandidates) : null,
    frontage_candidate_max_m: frontageCandidates.length ? Math.max(...frontageCandidates) : null,
    frontage_method: frontageCandidates.length ? 'Sampled parcel boundary segments adjacent to RoadCorridor polygons' : null,
    notes: `Sample-based parcel metrics from ${uniqueFeatures.length} lot polygons across ${points.length} recent application points for ${precinct.precinct_name}`,
    raw_payload: {
      precinct,
      sample_points: points,
      lot_features: uniqueFeatures.map((feature) => ({ attributes: feature.attributes, frontage_candidate_m: feature._frontageCandidate ?? null }))
    }
  }
}

async function upsertMetric(client, row) {
  await client.query(
    `insert into public.parcel_metrics (
       metric_key, precinct_id, council_id, source_name, source_url, observed_at,
       sample_point_count, matched_parcel_count, sample_location_example, lot_count,
       example_lot_id, example_plan_label, plan_area_min_sqm, plan_area_max_sqm,
       geometry_area_min_sqm, geometry_area_max_sqm, perimeter_min_m, perimeter_max_m,
        bbox_width_min_m, bbox_width_max_m, bbox_height_min_m, bbox_height_max_m,
        frontage_candidate_min_m, frontage_candidate_max_m, frontage_method,
        notes, raw_payload
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25,
        $26, $27::jsonb
     )
     on conflict (metric_key) do update set
       precinct_id = excluded.precinct_id,
       council_id = excluded.council_id,
       source_name = excluded.source_name,
       source_url = excluded.source_url,
       observed_at = excluded.observed_at,
       sample_point_count = excluded.sample_point_count,
       matched_parcel_count = excluded.matched_parcel_count,
       sample_location_example = excluded.sample_location_example,
       lot_count = excluded.lot_count,
       example_lot_id = excluded.example_lot_id,
       example_plan_label = excluded.example_plan_label,
       plan_area_min_sqm = excluded.plan_area_min_sqm,
       plan_area_max_sqm = excluded.plan_area_max_sqm,
       geometry_area_min_sqm = excluded.geometry_area_min_sqm,
       geometry_area_max_sqm = excluded.geometry_area_max_sqm,
       perimeter_min_m = excluded.perimeter_min_m,
       perimeter_max_m = excluded.perimeter_max_m,
        bbox_width_min_m = excluded.bbox_width_min_m,
        bbox_width_max_m = excluded.bbox_width_max_m,
        bbox_height_min_m = excluded.bbox_height_min_m,
        bbox_height_max_m = excluded.bbox_height_max_m,
        frontage_candidate_min_m = excluded.frontage_candidate_min_m,
        frontage_candidate_max_m = excluded.frontage_candidate_max_m,
        frontage_method = excluded.frontage_method,
        notes = excluded.notes,
        raw_payload = excluded.raw_payload`,
    [
      row.metric_key,
      row.precinct_id,
      row.council_id,
      row.source_name,
      row.source_url,
      row.observed_at,
      row.sample_point_count,
      row.matched_parcel_count,
      row.sample_location_example,
      row.lot_count,
      row.example_lot_id,
      row.example_plan_label,
      row.plan_area_min_sqm,
      row.plan_area_max_sqm,
      row.geometry_area_min_sqm,
      row.geometry_area_max_sqm,
      row.perimeter_min_m,
      row.perimeter_max_m,
      row.bbox_width_min_m,
      row.bbox_width_max_m,
      row.bbox_height_min_m,
      row.bbox_height_max_m,
      row.frontage_candidate_min_m,
      row.frontage_candidate_max_m,
      row.frontage_method,
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
    const lotCache = new Map()
    const roadCache = new Map()
    let updated = 0

    for (const precinct of precincts) {
      const points = (samplePoints.get(precinct.precinct_id) || []).map((point) => ({ ...point, _matched: false }))
      const collected = []

      for (const point of points) {
        const pointKey = `${point.latitude},${point.longitude}`
        let result = lotCache.get(pointKey)
        if (!result) {
          result = await safeLotQuery(point.latitude, point.longitude)
          lotCache.set(pointKey, result)
        }
        const features = result.features || []
        if (features.length) point._matched = true
        for (const feature of features) collected.push(feature)
      }

      const uniqueCollected = uniqueBy(collected, (feature) => feature.attributes?.lotidstring || feature.attributes?.cadid || JSON.stringify(feature.attributes))
      for (const feature of uniqueCollected) {
        const lotKey = feature.attributes?.lotidstring || feature.attributes?.cadid || JSON.stringify(feature.attributes)
        let roadResult = roadCache.get(lotKey)
        if (!roadResult) {
          roadResult = await safeRoadCorridorQuery(feature.geometry)
          roadCache.set(lotKey, roadResult)
        }
        feature._frontageCandidate = estimateFrontage(feature.geometry, roadResult.features || [])
      }

      const row = buildParcelMetricRow(precinct, points, uniqueCollected, observedAt)
      if (!row) continue
      await upsertMetric(client, row)
      updated += 1
    }

    console.log(`Updated parcel metrics for ${updated} precincts`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
