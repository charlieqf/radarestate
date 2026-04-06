import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const RECENT_FROM = '2025-01-01'
const SAMPLE_SIZE = 10

const LOT_URL = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/8/query'
const ROAD_CORRIDOR_URL = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/5/query'
const PROPERTY_URL = 'https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/FeatureServer/12/query'

const ZONING_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/2/query'
const FSR_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/1/query'
const HEIGHT_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/5/query'
const MINIMUM_LOT_SIZE_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/4/query'
const HERITAGE_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/0/query'
const LAND_RESERVATION_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/3/query'
const FLOOD_PLANNING_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/Hazard/MapServer/1/query'
const AIRPORT_NOISE_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/Protection/MapServer/2/query'
const OLS_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/Protection/MapServer/6/query'
const BIODIVERSITY_URL = 'https://www.lmbc.nsw.gov.au/arcgis/rest/services/BV/BiodiversityValues/MapServer/0/query'
const BUSHFIRE_URL = 'https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_BushFire_Prone_Land/FeatureServer/0/query'
const STATE_HERITAGE_CURTILAGE_URL = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/EDP/SHR_Curtilage/MapServer/0/query'

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
    configPath: null,
    regionGroup: 'Greater Sydney'
  }
  for (const arg of args) {
    if (arg.startsWith('--config=')) options.configPath = arg.split('=')[1].trim()
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
  }
  return options
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
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

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
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

async function fetchJsonWithRetry(url, init = {}, maxAttempts = 4) {
  let lastError = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, init)
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

function pointGeometry(latitude, longitude) {
  return JSON.stringify({
    x: Number(longitude),
    y: Number(latitude),
    spatialReference: { wkid: 4326 }
  })
}

async function safePointQuery(url, latitude, longitude, outFields, { returnGeometry = false, outSR = null } = {}) {
  const params = new URLSearchParams({
    f: 'pjson',
    outFields,
    returnGeometry: String(returnGeometry),
    geometry: pointGeometry(latitude, longitude),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects'
  })
  if (outSR) params.set('outSR', String(outSR))
  try {
    return await fetchJsonWithRetry(`${url}?${params.toString()}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; radarestate-bot/1.0)' }
    })
  } catch (error) {
    console.warn(`Point query skipped: ${error.message}`)
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
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a[0], point.y - a[1])
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
  await client.query(readFile('supabase/precinct_views.sql'))
  await client.query(readFile('supabase/development_views.sql'))
}

async function fetchTargetPrecincts(client, config, regionGroup) {
  const names = Array.isArray(config?.precincts)
    ? config.precincts.map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean)
    : []

  if (names.length) {
    const { rows } = await client.query(
      `select p.id as precinct_id, p.precinct_code, p.name as precinct_name, p.primary_council_id as council_id, c.canonical_name as council_name
       from public.precincts p
       left join public.councils c on c.id = p.primary_council_id
       where p.name = any($1::text[])
       order by p.name`,
      [names]
    )
    return rows
  }

  const { rows } = await client.query(
    `select
       p.id as precinct_id,
       p.precinct_code,
       p.name as precinct_name,
       p.primary_council_id as council_id,
       c.canonical_name as council_name
     from public.v_precinct_shortlist v
     join public.precincts p on p.id = v.precinct_id
     join public.councils c on c.id = p.primary_council_id
     where ($1::text is null or c.region_group = $1)
       and v.opportunity_rating in ('A', 'B')
     order by case v.opportunity_rating when 'A' then 1 when 'B' then 2 else 3 end,
              v.friction_score asc nulls last,
              v.recent_application_count desc nulls last,
              v.active_pipeline_count desc nulls last,
              p.name`,
    [regionGroup || null]
  )
  return rows
}

async function fetchSamplePoints(client, precinctIds) {
  if (!precinctIds.length) return new Map()
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
         and coalesce(a.lodgement_date, a.observed_at) >= $2::date
     ) ranked
     where rn <= $3
     order by precinct_id, lodgement_date desc nulls last`,
    [precinctIds, RECENT_FROM, SAMPLE_SIZE]
  )
  const grouped = new Map()
  for (const row of rows) {
    const list = grouped.get(row.precinct_id) || []
    list.push(row)
    grouped.set(row.precinct_id, list)
  }
  return grouped
}

async function resetSiteData(client, precinctIds) {
  if (!precinctIds.length) return
  await client.query('delete from public.site_candidates where precinct_id = any($1::uuid[])', [precinctIds])
}

function buildSiteKey(precinctCode, lotFeature, propertyFeature, pointKey) {
  const lotId = clean(lotFeature?.attributes?.lotidstring)
  const propId = clean(propertyFeature?.attributes?.propid)
  const suffix = lotId || (propId ? `prop-${propId}` : `pt-${pointKey}`)
  return `${precinctCode || 'site'}:${suffix}`
}

function latestPoint(existingPoint, nextPoint) {
  const existingDate = clean(existingPoint?.lodgement_date)
  const nextDate = clean(nextPoint?.lodgement_date)
  if (!existingPoint) return nextPoint
  if (nextDate && (!existingDate || nextDate > existingDate)) return nextPoint
  return existingPoint
}

async function fetchPointBundle(point, cache) {
  const pointKey = `${point.latitude},${point.longitude}`
  let bundle = cache.get(pointKey)
  if (!bundle) {
    const [
      zoning,
      fsr,
      height,
      minimumLotSize,
      heritage,
      landReservation,
      floodPlanning,
      airportNoise,
      obstacleLimitationSurface,
      biodiversity,
      bushfire,
      stateHeritageCurtilage
    ] = await Promise.all([
      safePointQuery(ZONING_URL, point.latitude, point.longitude, 'SYM_CODE,LAY_CLASS,EPI_NAME'),
      safePointQuery(FSR_URL, point.latitude, point.longitude, 'FSR,LEGIS_REF_CLAUSE,EPI_NAME'),
      safePointQuery(HEIGHT_URL, point.latitude, point.longitude, 'MAX_B_H_M,MAX_B_H,LEGIS_REF_CLAUSE,EPI_NAME'),
      safePointQuery(MINIMUM_LOT_SIZE_URL, point.latitude, point.longitude, 'LOT_SIZE,UNITS,LEGIS_REF_CLAUSE,EPI_NAME'),
      safePointQuery(HERITAGE_URL, point.latitude, point.longitude, 'H_ID,H_NAME,SIG,LEGIS_REF_CLAUSE,EPI_NAME'),
      safePointQuery(LAND_RESERVATION_URL, point.latitude, point.longitude, 'AUTHORITY,LRA_TYPE,LEGIS_REF_AREA,LEGIS_REF_VALUE,EPI_NAME'),
      safePointQuery(FLOOD_PLANNING_URL, point.latitude, point.longitude, 'LAY_CLASS,EPI_NAME,COMMENT'),
      safePointQuery(AIRPORT_NOISE_URL, point.latitude, point.longitude, 'LAY_NAME,ANEF_CODE,EPI_NAME'),
      safePointQuery(OLS_URL, point.latitude, point.longitude, 'MINIMUM_HEIGHT,MAXIMUM_HEIGHT,COMMENTS,EPI_NAME'),
      safePointQuery(BIODIVERSITY_URL, point.latitude, point.longitude, 'BV_Category,BOSET_Class,Date_Added_Display'),
      safePointQuery(BUSHFIRE_URL, point.latitude, point.longitude, 'd_category,d_guidelin,lastupdate'),
      safePointQuery(STATE_HERITAGE_CURTILAGE_URL, point.latitude, point.longitude, 'HOITEMID,ITEMNAME,ADDRESS,LISTINGNO,TYPE')
    ])
    bundle = {
      zoning,
      fsr,
      height,
      minimumLotSize,
      heritage,
      landReservation,
      floodPlanning,
      airportNoise,
      obstacleLimitationSurface,
      biodiversity,
      bushfire,
      stateHeritageCurtilage
    }
    cache.set(pointKey, bundle)
  }
  return bundle
}

function buildCandidateRow(site, observedAt) {
  const lotAttributes = site.lotFeature?.attributes || {}
  const propertyAttributes = site.propertyFeature?.attributes || {}
  const bounds = ringBounds(site.lotFeature?.geometry)
  return {
    site_key: site.siteKey,
    precinct_id: site.precinct.precinct_id,
    council_id: site.precinct.council_id,
    source_name: 'Recent mapped application signals + NSW lot/property layers',
    source_url: LOT_URL.replace('/query', ''),
    observed_at: observedAt,
    matched_signal_count: site.points.length,
    latest_lodgement_date: site.latestPoint?.lodgement_date || null,
    sample_location_example: site.latestPoint?.location_text || site.points[0]?.location_text || null,
    latitude: toNumber(site.latestPoint?.latitude),
    longitude: toNumber(site.latestPoint?.longitude),
    lot_id: lotAttributes.lotidstring || null,
    lot_number: lotAttributes.lotnumber || null,
    plan_number: lotAttributes.plannumber || null,
    plan_label: lotAttributes.planlabel || null,
    propid: toNumber(propertyAttributes.propid),
    address: propertyAttributes.address || null,
    plan_area_sqm: toNumber(lotAttributes.planlotarea),
    geometry_area_sqm: toNumber(lotAttributes.Shape__Area),
    perimeter_m: toNumber(lotAttributes.Shape__Length),
    bbox_width_m: bounds ? toNumber(bounds.xmax - bounds.xmin) : null,
    bbox_height_m: bounds ? toNumber(bounds.ymax - bounds.ymin) : null,
    frontage_candidate_m: toNumber(site.lotFeature?._frontageCandidate),
    property_type: PROPERTY_TYPE[propertyAttributes.propertytype] || null,
    valnet_status: VALNET_STATUS[propertyAttributes.valnetpropertystatus] || null,
    valnet_type: VALNET_TYPE[propertyAttributes.valnetpropertytype] || null,
    dissolve_parcel_count: toNumber(propertyAttributes.dissolveparcelcount),
    valnet_lot_count: toNumber(propertyAttributes.valnetlotcount),
    notes: `Automatic site candidate built from ${site.points.length} recent mapped application signals in ${site.precinct.precinct_name}`,
    raw_payload: {
      precinct: site.precinct,
      latest_point: site.latestPoint,
      matched_points: site.points,
      lot_attributes: lotAttributes,
      property_attributes: propertyAttributes,
      frontage_candidate_m: site.lotFeature?._frontageCandidate ?? null
    }
  }
}

function buildControlRow(siteCandidateId, site, bundle, observedAt) {
  const zoningHits = (bundle.zoning.features || []).map((feature) => feature.attributes)
  const fsrHits = (bundle.fsr.features || []).map((feature) => feature.attributes)
  const heightHits = (bundle.height.features || []).map((feature) => feature.attributes)
  const lotSizeHits = (bundle.minimumLotSize.features || []).map((feature) => feature.attributes)

  if (!zoningHits.length && !fsrHits.length && !heightHits.length && !lotSizeHits.length) return null

  const dominantZoning = zoningHits.length
    ? mode(zoningHits, (item) => `${item.SYM_CODE}|${item.LAY_CLASS}|${item.EPI_NAME}`)
    : null
  const dominantFsr = fsrHits.length
    ? mode(fsrHits, (item) => `${item.FSR}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`)
    : null
  const dominantHeight = heightHits.length
    ? mode(heightHits, (item) => `${item.MAX_B_H_M ?? item.MAX_B_H}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`)
    : null
  const dominantLotSize = lotSizeHits.length
    ? mode(lotSizeHits, (item) => `${item.LOT_SIZE}|${item.UNITS}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`)
    : null

  return {
    control_key: `${site.siteKey}:controls`,
    site_candidate_id: siteCandidateId,
    source_name: 'NSW EPI planning controls',
    zoning_source_url: ZONING_URL.replace('/query', ''),
    fsr_source_url: FSR_URL.replace('/query', ''),
    height_source_url: HEIGHT_URL.replace('/query', ''),
    minimum_lot_size_source_url: MINIMUM_LOT_SIZE_URL.replace('/query', ''),
    observed_at: observedAt,
    zoning_code: dominantZoning?.SYM_CODE || null,
    zoning_label: dominantZoning?.LAY_CLASS || null,
    zoning_epi_name: dominantZoning?.EPI_NAME || null,
    fsr: toNumber(dominantFsr?.FSR),
    fsr_clause: dominantFsr?.LEGIS_REF_CLAUSE || null,
    fsr_epi_name: dominantFsr?.EPI_NAME || null,
    height_m: toNumber(dominantHeight?.MAX_B_H_M ?? dominantHeight?.MAX_B_H),
    height_clause: dominantHeight?.LEGIS_REF_CLAUSE || null,
    height_epi_name: dominantHeight?.EPI_NAME || null,
    minimum_lot_size_sqm: toNumber(dominantLotSize?.LOT_SIZE),
    minimum_lot_size_units: dominantLotSize?.UNITS || null,
    minimum_lot_size_clause: dominantLotSize?.LEGIS_REF_CLAUSE || null,
    minimum_lot_size_epi_name: dominantLotSize?.EPI_NAME || null,
    notes: `Control envelope queried automatically at the latest mapped site point for ${site.precinct.precinct_name}`,
    raw_payload: {
      zoning: uniqueBy(zoningHits, (item) => `${item.SYM_CODE}|${item.LAY_CLASS}|${item.EPI_NAME}`),
      fsr: uniqueBy(fsrHits, (item) => `${item.FSR}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`),
      height: uniqueBy(heightHits, (item) => `${item.MAX_B_H_M ?? item.MAX_B_H}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`),
      minimum_lot_size: uniqueBy(lotSizeHits, (item) => `${item.LOT_SIZE}|${item.UNITS}|${item.LEGIS_REF_CLAUSE}|${item.EPI_NAME}`)
    }
  }
}

function bushfireSeverity(categories) {
  if (!categories.size) return null
  if (categories.has('Vegetation Category 1') || categories.has('Vegetation Buffer')) return 'high'
  return 'medium'
}

function airportNoiseSeverity(codes) {
  if (!codes.length) return null
  const cleaned = codes.map((code) => clean(code).toUpperCase()).filter(Boolean)
  if (cleaned.some((code) => code === 'HIGH NOISE')) return 'high'
  const numericCodes = cleaned.map((code) => Number.parseFloat(code)).filter(Number.isFinite)
  if (numericCodes.some((value) => value >= 30)) return 'high'
  if (numericCodes.some((value) => value >= 25)) return 'medium'
  if (numericCodes.some((value) => value >= 20) || cleaned.some((code) => code === 'LOW NOISE')) return 'low'
  return 'medium'
}

function olsSeverity(maximumHeights) {
  if (!maximumHeights.length) return null
  const values = maximumHeights.map((value) => toNumber(value)).filter((value) => value !== null)
  if (!values.length) return 'medium'
  if (values.some((value) => value <= 45)) return 'high'
  if (values.some((value) => value <= 120)) return 'medium'
  return 'low'
}

function buildConstraintRows(siteCandidateId, site, bundle, observedAt) {
  const rows = []
  const heritageHits = (bundle.heritage.features || []).map((feature) => feature.attributes)
  const stateHeritageCurtilageHits = (bundle.stateHeritageCurtilage.features || []).map((feature) => feature.attributes)
  const landReservationHits = (bundle.landReservation.features || []).map((feature) => feature.attributes)
  const floodPlanningHits = (bundle.floodPlanning.features || []).map((feature) => feature.attributes)
  const airportNoiseHits = (bundle.airportNoise.features || []).map((feature) => feature.attributes)
  const olsHits = (bundle.obstacleLimitationSurface.features || []).map((feature) => feature.attributes)
  const biodiversityHits = (bundle.biodiversity.features || []).map((feature) => feature.attributes)
  const bushfireHits = (bundle.bushfire.features || []).map((feature) => feature.attributes)

  const uniqueHeritageHits = uniqueBy(heritageHits, (item) => `${item.H_ID}|${item.H_NAME}|${item.EPI_NAME}`)
  if (uniqueHeritageHits.length) {
    rows.push({
      constraint_key: `${site.siteKey}:heritage_item`,
      site_candidate_id: siteCandidateId,
      constraint_type: 'heritage_item',
      severity: 'high',
      source_name: 'NSW EPI Heritage layer',
      source_url: HERITAGE_URL.replace('/query', ''),
      observed_at: observedAt,
      notes: `Heritage item hit: ${uniqueHeritageHits.map((item) => clean(item.H_NAME) || clean(item.H_ID)).filter(Boolean).slice(0, 3).join('; ')}`,
      raw_payload: uniqueHeritageHits
    })
  }

  const uniqueShrCurtilageHits = uniqueBy(stateHeritageCurtilageHits, (item) => `${item.HOITEMID}|${item.ITEMNAME}|${item.LISTINGNO}`)
  if (uniqueShrCurtilageHits.length) {
    rows.push({
      constraint_key: `${site.siteKey}:state_heritage_curtilage`,
      site_candidate_id: siteCandidateId,
      constraint_type: 'state_heritage_curtilage',
      severity: 'high',
      source_name: 'State Heritage Register Curtilage',
      source_url: STATE_HERITAGE_CURTILAGE_URL.replace('/query', ''),
      observed_at: observedAt,
      notes: `State heritage curtilage hit: ${uniqueShrCurtilageHits.map((item) => clean(item.ITEMNAME) || clean(item.LISTINGNO)).filter(Boolean).slice(0, 3).join('; ')}`,
      raw_payload: uniqueShrCurtilageHits
    })
  }

  const uniqueReservationHits = uniqueBy(landReservationHits, (item) => `${item.AUTHORITY}|${item.LRA_TYPE}|${item.EPI_NAME}`)
  if (uniqueReservationHits.length) {
    rows.push({
      constraint_key: `${site.siteKey}:land_reservation`,
      site_candidate_id: siteCandidateId,
      constraint_type: 'land_reservation',
      severity: 'high',
      source_name: 'NSW EPI Land Reservation layer',
      source_url: LAND_RESERVATION_URL.replace('/query', ''),
      observed_at: observedAt,
      notes: `Land reservation hit: ${uniqueReservationHits.map((item) => [clean(item.AUTHORITY), clean(item.LRA_TYPE)].filter(Boolean).join(' / ')).filter(Boolean).slice(0, 3).join('; ')}`,
      raw_payload: uniqueReservationHits
    })
  }

  const uniqueFloodHits = uniqueBy(floodPlanningHits, (item) => `${item.LAY_CLASS}|${item.EPI_NAME}|${item.COMMENT}`)
  if (uniqueFloodHits.length) {
    rows.push({
      constraint_key: `${site.siteKey}:flood_planning`,
      site_candidate_id: siteCandidateId,
      constraint_type: 'flood_planning',
      severity: 'medium',
      source_name: 'NSW EPI Flood planning layer',
      source_url: FLOOD_PLANNING_URL.replace('/query', ''),
      observed_at: observedAt,
      notes: `Flood planning overlay hit: ${uniqueFloodHits.map((item) => clean(item.LAY_CLASS) || clean(item.COMMENT)).filter(Boolean).slice(0, 3).join('; ')}`,
      raw_payload: uniqueFloodHits
    })
  }

  const uniqueAirportNoiseHits = uniqueBy(airportNoiseHits, (item) => `${item.ANEF_CODE}|${item.LAY_NAME}|${item.EPI_NAME}`)
  const airportNoiseLevel = airportNoiseSeverity(uniqueAirportNoiseHits.map((item) => item.ANEF_CODE))
  if (airportNoiseLevel) {
    rows.push({
      constraint_key: `${site.siteKey}:airport_noise`,
      site_candidate_id: siteCandidateId,
      constraint_type: 'airport_noise',
      severity: airportNoiseLevel,
      source_name: 'NSW EPI Airport Noise layer',
      source_url: AIRPORT_NOISE_URL.replace('/query', ''),
      observed_at: observedAt,
      notes: `Airport noise overlay: ${uniqueAirportNoiseHits.map((item) => clean(item.ANEF_CODE) || clean(item.LAY_NAME)).filter(Boolean).slice(0, 3).join('; ')}`,
      raw_payload: uniqueAirportNoiseHits
    })
  }

  const uniqueOlsHits = uniqueBy(olsHits, (item) => `${item.MINIMUM_HEIGHT}|${item.MAXIMUM_HEIGHT}|${item.EPI_NAME}|${item.COMMENTS}`)
  const olsLevel = olsSeverity(uniqueOlsHits.map((item) => item.MAXIMUM_HEIGHT))
  if (olsLevel) {
    rows.push({
      constraint_key: `${site.siteKey}:obstacle_limitation_surface`,
      site_candidate_id: siteCandidateId,
      constraint_type: 'obstacle_limitation_surface',
      severity: olsLevel,
      source_name: 'NSW EPI Obstacle Limitation Surface layer',
      source_url: OLS_URL.replace('/query', ''),
      observed_at: observedAt,
      notes: `Obstacle limitation surface overlay: ${uniqueOlsHits.map((item) => `max ${clean(item.MAXIMUM_HEIGHT)}m`).filter(Boolean).slice(0, 3).join('; ')}`,
      raw_payload: uniqueOlsHits
    })
  }

  const uniqueBiodiversityHits = uniqueBy(biodiversityHits, (item) => `${item.BV_Category}|${item.BOSET_Class}`)
  if (uniqueBiodiversityHits.length) {
    rows.push({
      constraint_key: `${site.siteKey}:biodiversity_values`,
      site_candidate_id: siteCandidateId,
      constraint_type: 'biodiversity_values',
      severity: 'high',
      source_name: 'Biodiversity Values Map',
      source_url: BIODIVERSITY_URL.replace('/query', ''),
      observed_at: observedAt,
      notes: `Biodiversity values map hit: ${uniqueBiodiversityHits.map((item) => clean(item.BV_Category) || clean(item.BOSET_Class)).filter(Boolean).slice(0, 3).join('; ')}`,
      raw_payload: uniqueBiodiversityHits
    })
  }

  const uniqueBushfireHits = uniqueBy(bushfireHits, (item) => `${item.d_category}|${item.d_guidelin}`)
  const bushfireCategories = new Set(uniqueBushfireHits.map((item) => clean(item.d_category)).filter(Boolean))
  const bushfireLevel = bushfireSeverity(bushfireCategories)
  if (bushfireLevel) {
    rows.push({
      constraint_key: `${site.siteKey}:bushfire_prone_land`,
      site_candidate_id: siteCandidateId,
      constraint_type: 'bushfire_prone_land',
      severity: bushfireLevel,
      source_name: 'NSW Bush Fire Prone Land',
      source_url: BUSHFIRE_URL.replace('/query', ''),
      observed_at: observedAt,
      notes: `Bush fire prone land categories: ${[...bushfireCategories].join('; ')}`,
      raw_payload: uniqueBushfireHits
    })
  }

  return rows
}

async function insertSiteCandidate(client, row) {
  const { rows } = await client.query(
    `insert into public.site_candidates (
       site_key, precinct_id, council_id, source_name, source_url, observed_at,
       matched_signal_count, latest_lodgement_date, sample_location_example,
       latitude, longitude, lot_id, lot_number, plan_number, plan_label,
       propid, address, plan_area_sqm, geometry_area_sqm, perimeter_m,
       bbox_width_m, bbox_height_m, frontage_candidate_m,
       property_type, valnet_status, valnet_type,
       dissolve_parcel_count, valnet_lot_count, notes, raw_payload
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9,
       $10, $11, $12, $13, $14, $15,
       $16, $17, $18, $19, $20,
       $21, $22, $23,
       $24, $25, $26,
       $27, $28, $29, $30::jsonb
     )
     returning id`,
    [
      row.site_key,
      row.precinct_id,
      row.council_id,
      row.source_name,
      row.source_url,
      row.observed_at,
      row.matched_signal_count,
      row.latest_lodgement_date,
      row.sample_location_example,
      row.latitude,
      row.longitude,
      row.lot_id,
      row.lot_number,
      row.plan_number,
      row.plan_label,
      row.propid,
      row.address,
      row.plan_area_sqm,
      row.geometry_area_sqm,
      row.perimeter_m,
      row.bbox_width_m,
      row.bbox_height_m,
      row.frontage_candidate_m,
      row.property_type,
      row.valnet_status,
      row.valnet_type,
      row.dissolve_parcel_count,
      row.valnet_lot_count,
      row.notes,
      JSON.stringify(row.raw_payload)
    ]
  )
  return rows[0]?.id || null
}

async function insertSiteControl(client, row) {
  await client.query(
    `insert into public.site_controls (
       control_key, site_candidate_id, source_name,
       zoning_source_url, fsr_source_url, height_source_url, minimum_lot_size_source_url,
       observed_at, zoning_code, zoning_label, zoning_epi_name,
       fsr, fsr_clause, fsr_epi_name,
       height_m, height_clause, height_epi_name,
       minimum_lot_size_sqm, minimum_lot_size_units, minimum_lot_size_clause, minimum_lot_size_epi_name,
       notes, raw_payload
     ) values (
       $1, $2, $3,
       $4, $5, $6, $7,
       $8, $9, $10, $11,
       $12, $13, $14,
       $15, $16, $17,
       $18, $19, $20, $21,
       $22, $23::jsonb
     )`,
    [
      row.control_key,
      row.site_candidate_id,
      row.source_name,
      row.zoning_source_url,
      row.fsr_source_url,
      row.height_source_url,
      row.minimum_lot_size_source_url,
      row.observed_at,
      row.zoning_code,
      row.zoning_label,
      row.zoning_epi_name,
      row.fsr,
      row.fsr_clause,
      row.fsr_epi_name,
      row.height_m,
      row.height_clause,
      row.height_epi_name,
      row.minimum_lot_size_sqm,
      row.minimum_lot_size_units,
      row.minimum_lot_size_clause,
      row.minimum_lot_size_epi_name,
      row.notes,
      JSON.stringify(row.raw_payload)
    ]
  )
}

async function insertSiteConstraint(client, row) {
  await client.query(
    `insert into public.site_constraints (
       constraint_key, site_candidate_id, constraint_type, severity,
       source_name, source_url, observed_at, notes, raw_payload
     ) values (
       $1, $2, $3, $4,
       $5, $6, $7, $8, $9::jsonb
     )`,
    [
      row.constraint_key,
      row.site_candidate_id,
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

async function main() {
  const options = parseArgs()
  const config = options.configPath ? readJson(options.configPath) : null
  const client = await connectWithFallback()
  try {
    await applyArtifacts(client)
    const precincts = await fetchTargetPrecincts(client, config, options.regionGroup)
    const precinctIds = precincts.map((row) => row.precinct_id)
    const samplePointsByPrecinct = await fetchSamplePoints(client, precinctIds)
    const observedAt = new Date().toISOString().slice(0, 10)
    const samplePointTotal = [...samplePointsByPrecinct.values()].reduce((sum, rows) => sum + rows.length, 0)

    console.log(`Target precincts: ${precincts.length}`)
    console.log(`Recent mapped sample points: ${samplePointTotal}`)

    const lotCache = new Map()
    const propertyCache = new Map()
    const roadCache = new Map()
    const bundleCache = new Map()
    const sites = new Map()

    for (const precinct of precincts) {
      const points = samplePointsByPrecinct.get(precinct.precinct_id) || []
      for (const point of points) {
        const pointKey = `${point.latitude},${point.longitude}`

        let lotResult = lotCache.get(pointKey)
        if (!lotResult) {
          lotResult = await safePointQuery(
            LOT_URL,
            point.latitude,
            point.longitude,
            'lotidstring,lotnumber,plannumber,planlabel,planlotarea,planlotareaunits,Shape__Area,Shape__Length',
            { returnGeometry: true, outSR: 3857 }
          )
          lotCache.set(pointKey, lotResult)
        }

        let propertyResult = propertyCache.get(pointKey)
        if (!propertyResult) {
          propertyResult = await safePointQuery(
            PROPERTY_URL,
            point.latitude,
            point.longitude,
            'propid,address,propertytype,valnetpropertystatus,valnetpropertytype,dissolveparcelcount,valnetlotcount'
          )
          propertyCache.set(pointKey, propertyResult)
        }

        const lotFeatures = uniqueBy(
          lotResult.features || [],
          (feature) => feature.attributes?.lotidstring || `${feature.attributes?.planlabel || ''}|${feature.attributes?.lotnumber || ''}` || JSON.stringify(feature.attributes)
        )
        const propertyFeature = (propertyResult.features || [])[0] || null

        for (const lotFeature of lotFeatures) {
          const lotKey = clean(lotFeature.attributes?.lotidstring) || `${clean(lotFeature.attributes?.planlabel)}:${clean(lotFeature.attributes?.lotnumber)}`
          if (lotFeature.geometry && !Object.prototype.hasOwnProperty.call(lotFeature, '_frontageCandidate')) {
            let roadResult = roadCache.get(lotKey)
            if (!roadResult) {
              roadResult = await safeRoadCorridorQuery(lotFeature.geometry)
              roadCache.set(lotKey, roadResult)
            }
            lotFeature._frontageCandidate = estimateFrontage(lotFeature.geometry, roadResult.features || [])
          }

          const siteKey = buildSiteKey(precinct.precinct_code, lotFeature, propertyFeature, pointKey)
          const existing = sites.get(siteKey) || {
            siteKey,
            precinct,
            lotFeature,
            propertyFeature,
            latestPoint: null,
            points: []
          }
          existing.points.push(point)
          existing.latestPoint = latestPoint(existing.latestPoint, point)
          if (!existing.lotFeature) existing.lotFeature = lotFeature
          if (!existing.propertyFeature && propertyFeature) existing.propertyFeature = propertyFeature
          sites.set(siteKey, existing)
        }
      }
    }

    console.log(`Collected unique site candidates: ${sites.size}`)

    await resetSiteData(client, precinctIds)

    let siteCount = 0
    let controlCount = 0
    let constraintCount = 0
    for (const site of sites.values()) {
      const candidateRow = buildCandidateRow(site, observedAt)
      const siteCandidateId = await insertSiteCandidate(client, candidateRow)
      if (!siteCandidateId) continue
      siteCount += 1

      const pointBundle = await fetchPointBundle(site.latestPoint, bundleCache)
      const controlRow = buildControlRow(siteCandidateId, site, pointBundle, observedAt)
      if (controlRow) {
        await insertSiteControl(client, controlRow)
        controlCount += 1
      }

      const constraintRows = buildConstraintRows(siteCandidateId, site, pointBundle, observedAt)
      for (const constraintRow of constraintRows) {
        await insertSiteConstraint(client, constraintRow)
        constraintCount += 1
      }
    }

    console.log(`Built site screening layer for ${siteCount} site candidates, ${controlCount} control rows, ${constraintCount} constraint rows`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
