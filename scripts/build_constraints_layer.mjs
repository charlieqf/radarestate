import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const BIODIVERSITY_QUERY_URL = 'https://www.lmbc.nsw.gov.au/arcgis/rest/services/BV/BiodiversityValues/MapServer/0/query'
const BUSHFIRE_QUERY_URL = 'https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_BushFire_Prone_Land/FeatureServer/0/query'
const FLOOD_SEARCH_URL = 'https://flooddata.ses.nsw.gov.au/api/3/action/package_search'
const RECENT_FROM = '2025-01-01'
const SAMPLE_SIZE = 15

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function buildPointGeometry(latitude, longitude) {
  return JSON.stringify({
    x: Number(longitude),
    y: Number(latitude),
    spatialReference: { wkid: 4326 }
  })
}

async function fetchJsonWithRetry(url, init = {}, maxAttempts = 4) {
  let lastError = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, init)
      if (!response.ok) {
        if (response.status >= 500 && attempt < maxAttempts) {
          await sleep(600 * attempt)
          continue
        }
        throw new Error(`Request failed: ${response.status} for ${url}`)
      }
      return response.json()
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts) throw error
      await sleep(600 * attempt)
    }
  }
  throw lastError || new Error(`Request failed for ${url}`)
}

async function fetchArcGisFeatures(url, latitude, longitude, outFields) {
  const params = new URLSearchParams({
    f: 'pjson',
    returnGeometry: 'false',
    outFields,
    geometry: buildPointGeometry(latitude, longitude),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects'
  })
  return fetchJsonWithRetry(`${url}?${params.toString()}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; radarestate-bot/1.0)' }
  })
}

async function safeFetchArcGisFeatures(url, latitude, longitude, outFields) {
  try {
    return await fetchArcGisFeatures(url, latitude, longitude, outFields)
  } catch (error) {
    console.warn(`ArcGIS query skipped after retries: ${error.message}`)
    return { features: [] }
  }
}

async function fetchFloodSearchResults(query, rows = 12) {
  const params = new URLSearchParams({ q: query, rows: String(rows) })
  return fetchJsonWithRetry(`${FLOOD_SEARCH_URL}?${params.toString()}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; radarestate-bot/1.0)' }
  })
}

async function safeFetchFloodSearchResults(query, rows = 12) {
  try {
    return await fetchFloodSearchResults(query, rows)
  } catch (error) {
    console.warn(`Flood metadata search skipped after retries for ${query}: ${error.message}`)
    return { result: { results: [] } }
  }
}

function severityFromHeat(value) {
  const numeric = Number(value || 0)
  if (numeric >= 20) return 'high'
  if (numeric >= 10) return 'medium'
  return null
}

function severityFromCanopy(value) {
  const numeric = Number(value || 0)
  if (numeric <= 18 && numeric > 0) return 'high'
  if (numeric <= 25 && numeric > 0) return 'medium'
  return null
}

function severityFromWithdrawn(value) {
  const numeric = Number(value || 0)
  if (numeric >= 10) return 'high'
  if (numeric >= 5) return 'medium'
  return null
}

async function applyArtifacts(client) {
  await client.query(readFile('supabase/schema.sql'))
  await client.query(readFile('supabase/precinct_views.sql'))
}

async function resetDerivedConstraints(client) {
  await client.query(
    `delete from public.constraints
     where source_name in (
       'Housing Targets Council Snapshot',
       'Derived Planning Friction',
       'Biodiversity Values Map Spatial Sample',
       'BushFire Prone Land Spatial Sample',
       'Flood Data Portal Metadata Signal'
     )`
  )
}

async function fetchPrecinctBase(client) {
  const { rows } = await client.query(
    `with latest_targets as (
       select distinct on (ht.council_id)
         ht.council_id,
         ht.urban_tree_canopy_pct,
         ht.high_heat_vulnerability_pct,
         ht.source_url
       from public.housing_targets ht
       order by ht.council_id, ht.observed_at desc
     ), proposal_counts as (
       select
         pp.precinct_id,
         count(*) filter (where pp.stage = 'withdrawn') as withdrawn_count
       from public.planning_proposals pp
       where pp.precinct_id is not null
       group by pp.precinct_id
     )
     select
       p.id as precinct_id,
       p.precinct_code,
       p.name as precinct_name,
       p.primary_council_id as council_id,
       c.canonical_name as council_name,
       lt.urban_tree_canopy_pct,
       lt.high_heat_vulnerability_pct,
       lt.source_url as target_source_url,
       coalesce(pc.withdrawn_count, 0) as withdrawn_count
     from public.precincts p
     left join public.councils c on c.id = p.primary_council_id
     left join latest_targets lt on lt.council_id = p.primary_council_id
     left join proposal_counts pc on pc.precinct_id = p.id`
  )
  return rows
}

async function fetchPrecinctSamplePoints(client) {
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
       where a.precinct_id is not null
         and a.tracker_scope = 'applications'
         and a.latitude is not null
         and a.longitude is not null
         and coalesce(a.lodgement_date, a.observed_at) >= $1::date
     ) ranked
     where rn <= $2
     order by precinct_id, lodgement_date desc nulls last`,
    [RECENT_FROM, SAMPLE_SIZE]
  )
  const grouped = new Map()
  for (const row of rows) {
    const existing = grouped.get(row.precinct_id) || []
    existing.push(row)
    grouped.set(row.precinct_id, existing)
  }
  return grouped
}

async function insertConstraint(client, row) {
  await client.query(
    `insert into public.constraints (
       constraint_key, precinct_id, council_id, constraint_type, severity,
       source_name, source_url, observed_at, notes, raw_payload
     ) values (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10::jsonb
     )
     on conflict (constraint_key) do update set
       precinct_id = excluded.precinct_id,
       council_id = excluded.council_id,
       constraint_type = excluded.constraint_type,
       severity = excluded.severity,
       source_name = excluded.source_name,
       source_url = excluded.source_url,
       observed_at = excluded.observed_at,
       notes = excluded.notes,
       raw_payload = excluded.raw_payload`,
    [
      row.constraint_key,
      row.precinct_id,
      row.council_id,
      row.constraint_type,
      row.severity,
      row.source_name,
      row.source_url,
      row.observed_at,
      row.notes,
      JSON.stringify(row.raw_payload)
    ]
  )
}

function biodiversitySeverity(hitCount, sampleSize) {
  if (!sampleSize || hitCount <= 0) return null
  const ratio = hitCount / sampleSize
  if (hitCount >= 3 || ratio >= 0.2) return 'high'
  return 'medium'
}

function pointInRing(point, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0])
    const yi = Number(ring[i][1])
    const xj = Number(ring[j][0])
    const yj = Number(ring[j][1])
    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lon < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || 1e-12) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function geometryContainsPoint(spatial, point) {
  if (!spatial?.type || !spatial?.coordinates) return false
  if (spatial.type === 'Polygon') {
    const [outerRing] = spatial.coordinates
    return Array.isArray(outerRing) ? pointInRing(point, outerRing) : false
  }
  if (spatial.type === 'MultiPolygon') {
    for (const polygon of spatial.coordinates) {
      const [outerRing] = polygon
      if (Array.isArray(outerRing) && pointInRing(point, outerRing)) return true
    }
  }
  return false
}

function floodSeverity(hitCount) {
  if (hitCount >= 2) return 'high'
  if (hitCount >= 1) return 'medium'
  return null
}

function bushfireSeverity(hitCount, sampleSize, categories) {
  if (!sampleSize || hitCount <= 0) return null
  const ratio = hitCount / sampleSize
  const hasHighCategory = categories.has('Vegetation Category 1') || categories.has('Vegetation Buffer')
  if (hasHighCategory || hitCount >= 3 || ratio >= 0.2) return 'high'
  return 'medium'
}

async function buildSpatialConstraintRows(precinctRow, samplePoints, biodiversityCache, bushfireCache, observedAt) {
  if (!samplePoints?.length) return []

  let biodiversityHits = 0
  const biodiversityLabels = new Set()
  let bushfireHits = 0
  const bushfireCategories = new Set()

  for (const point of samplePoints) {
    const key = `${point.latitude},${point.longitude}`
    let biodiversity = biodiversityCache.get(key)
    if (!biodiversity) {
      biodiversity = await safeFetchArcGisFeatures(BIODIVERSITY_QUERY_URL, point.latitude, point.longitude, 'BV_Category')
      biodiversityCache.set(key, biodiversity)
    }
    const biodiversityFeatures = biodiversity.features || []
    if (biodiversityFeatures.length) {
      biodiversityHits += 1
      for (const feature of biodiversityFeatures) {
        const label = feature?.attributes?.BV_Category
        if (label) biodiversityLabels.add(label)
      }
    }

    let bushfire = bushfireCache.get(key)
    if (!bushfire) {
      bushfire = await safeFetchArcGisFeatures(BUSHFIRE_QUERY_URL, point.latitude, point.longitude, 'd_category')
      bushfireCache.set(key, bushfire)
    }
    const bushfireFeatures = bushfire.features || []
    if (bushfireFeatures.length) {
      bushfireHits += 1
      for (const feature of bushfireFeatures) {
        const category = feature?.attributes?.d_category
        if (category) bushfireCategories.add(category)
      }
    }
  }

  const rows = []
  const biodiversityLevel = biodiversitySeverity(biodiversityHits, samplePoints.length)
  if (biodiversityLevel) {
    rows.push({
      constraint_key: `${precinctRow.precinct_code}:biodiversity_spatial_sample`,
      precinct_id: precinctRow.precinct_id,
      council_id: precinctRow.council_id,
      constraint_type: 'biodiversity_spatial_sample',
      severity: biodiversityLevel,
      source_name: 'Biodiversity Values Map Spatial Sample',
      source_url: 'https://www.lmbc.nsw.gov.au/arcgis/rest/services/BV/BiodiversityValues/MapServer/0',
      observed_at: observedAt,
      notes: `Sample-based spatial hit rate ${biodiversityHits}/${samplePoints.length} across mapped recent application points`,
      raw_payload: {
        precinct_code: precinctRow.precinct_code,
        sample_size: samplePoints.length,
        hit_count: biodiversityHits,
        categories: [...biodiversityLabels]
      }
    })
  }

  const bushfireLevel = bushfireSeverity(bushfireHits, samplePoints.length, bushfireCategories)
  if (bushfireLevel) {
    rows.push({
      constraint_key: `${precinctRow.precinct_code}:bushfire_spatial_sample`,
      precinct_id: precinctRow.precinct_id,
      council_id: precinctRow.council_id,
      constraint_type: 'bushfire_spatial_sample',
      severity: bushfireLevel,
      source_name: 'BushFire Prone Land Spatial Sample',
      source_url: 'https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_BushFire_Prone_Land/FeatureServer/0',
      observed_at: observedAt,
      notes: `Sample-based spatial hit rate ${bushfireHits}/${samplePoints.length} across mapped recent application points`,
      raw_payload: {
        precinct_code: precinctRow.precinct_code,
        sample_size: samplePoints.length,
        hit_count: bushfireHits,
        categories: [...bushfireCategories]
      }
    })
  }

  return rows
}

async function buildFloodConstraintRows(precinctRow, samplePoints, observedAt) {
  if (!samplePoints?.length) return []
  const response = await safeFetchFloodSearchResults(precinctRow.precinct_name)
  const results = response?.result?.results || []
  const pointObjects = samplePoints.map((point) => ({ lat: Number(point.latitude), lon: Number(point.longitude) }))
  const matched = []

  for (const result of results) {
    let spatial = null
    try {
      spatial = result?.spatial ? JSON.parse(result.spatial) : null
    } catch {
      spatial = null
    }
    if (!spatial) continue
    const intersects = pointObjects.some((point) => geometryContainsPoint(spatial, point))
    if (!intersects) continue

    matched.push({
      title: result.title,
      type: result.type,
      organization: result?.organization?.title || null,
      num_resources: result.num_resources || 0,
      dataset_type: result.dataset_type || null,
      spatial_data: result.spatial_data || null,
      tags: Array.isArray(result.tags) ? result.tags.map((tag) => tag.display_name || tag.name).filter(Boolean) : []
    })
  }

  const severity = floodSeverity(matched.length)
  if (!severity) return []

  const titles = matched.map((item) => item.title).slice(0, 3)
  return [{
    constraint_key: `${precinctRow.precinct_code}:flood_metadata_signal`,
    precinct_id: precinctRow.precinct_id,
    council_id: precinctRow.council_id,
    constraint_type: 'flood_metadata_signal',
    severity,
    source_name: 'Flood Data Portal Metadata Signal',
    source_url: `https://flooddata.ses.nsw.gov.au/api/3/action/package_search?q=${encodeURIComponent(precinctRow.precinct_name)}`,
    observed_at: observedAt,
    notes: `Sample-based flood study/project coverage with ${matched.length} intersecting metadata records: ${titles.join('; ')}`,
    raw_payload: {
      precinct_code: precinctRow.precinct_code,
      sample_size: samplePoints.length,
      matched_count: matched.length,
      titles,
      matched
    }
  }]
}

async function main() {
  const observedAt = new Date().toISOString().slice(0, 10)
  const client = await connectWithFallback()
  try {
    await applyArtifacts(client)
    await resetDerivedConstraints(client)
    const rows = await fetchPrecinctBase(client)
    const samplePointsByPrecinct = await fetchPrecinctSamplePoints(client)
    const biodiversityCache = new Map()
    const bushfireCache = new Map()
    let inserted = 0

    for (const row of rows) {
      const heatSeverity = severityFromHeat(row.high_heat_vulnerability_pct)
      if (heatSeverity) {
        await insertConstraint(client, {
          constraint_key: `${row.precinct_code}:heat_vulnerability`,
          precinct_id: row.precinct_id,
          council_id: row.council_id,
          constraint_type: 'heat_vulnerability_proxy',
          severity: heatSeverity,
          source_name: 'Housing Targets Council Snapshot',
          source_url: row.target_source_url,
          observed_at: observedAt,
          notes: `Council-level proxy based on high heat vulnerability ${row.high_heat_vulnerability_pct}% for ${row.council_name}`,
          raw_payload: row
        })
        inserted += 1
      }

      const canopySeverity = severityFromCanopy(row.urban_tree_canopy_pct)
      if (canopySeverity) {
        await insertConstraint(client, {
          constraint_key: `${row.precinct_code}:low_tree_canopy`,
          precinct_id: row.precinct_id,
          council_id: row.council_id,
          constraint_type: 'low_tree_canopy_proxy',
          severity: canopySeverity,
          source_name: 'Housing Targets Council Snapshot',
          source_url: row.target_source_url,
          observed_at: observedAt,
          notes: `Council-level proxy based on urban tree canopy ${row.urban_tree_canopy_pct}% for ${row.council_name}`,
          raw_payload: row
        })
        inserted += 1
      }

      const withdrawnSeverity = severityFromWithdrawn(row.withdrawn_count)
      if (withdrawnSeverity) {
        await insertConstraint(client, {
          constraint_key: `${row.precinct_code}:policy_withdrawal_friction`,
          precinct_id: row.precinct_id,
          council_id: row.council_id,
          constraint_type: 'policy_withdrawal_friction',
          severity: withdrawnSeverity,
          source_name: 'Derived Planning Friction',
          source_url: 'https://www.planningportal.nsw.gov.au/ppr/withdrawn',
          observed_at: observedAt,
          notes: `Derived from ${row.withdrawn_count} withdrawn / not proceeding proposals mapped to this precinct`,
          raw_payload: row
        })
        inserted += 1
      }

      const spatialRows = await buildSpatialConstraintRows(
        row,
        samplePointsByPrecinct.get(row.precinct_id) || [],
        biodiversityCache,
        bushfireCache,
        observedAt
      )

      for (const spatialRow of spatialRows) {
        await insertConstraint(client, spatialRow)
        inserted += 1
      }

      const floodRows = await buildFloodConstraintRows(
        row,
        samplePointsByPrecinct.get(row.precinct_id) || [],
        observedAt
      )

      for (const floodRow of floodRows) {
        await insertConstraint(client, floodRow)
        inserted += 1
      }
    }

    const summary = await client.query(
      `select constraint_type, severity, count(*)::int as total
       from public.constraints
       group by constraint_type, severity
       order by constraint_type, severity`
    )

    console.log(`Inserted or updated derived constraints: ${inserted}`)
    console.log('Constraint distribution:')
    for (const item of summary.rows) {
      console.log(JSON.stringify(item))
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
