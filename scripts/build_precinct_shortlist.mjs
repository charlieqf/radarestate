import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(readFile(relativePath))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function clean(value) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

const councilMap = new Map([
  ['Parramatta', 'Parramatta'],
  ['City of Parramatta Council', 'Parramatta'],
  ['City Of Parramatta', 'Parramatta'],
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
  ['Woollahra', 'Woollahra'],
  ['Fairfield', 'Fairfield'],
  ['The Hills Shire', 'The Hills Shire'],
  ['Penrith', 'Penrith'],
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
  const options = { configPath: null }
  for (const arg of args) {
    if (arg.startsWith('--config=')) options.configPath = arg.split('=')[1].trim()
  }
  return options
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function keywordRegex(keyword) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(keyword.toLowerCase())}([^a-z0-9]|$)`, 'i')
}

function buildSearchText(row) {
  return [row.title, row.location_text, row.summary, row.analyst_note, row.project_name]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase()
}

function normaliseText(value) {
  return clean(value)?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || ''
}

function proposalKeywordIsExplicit(row, keyword) {
  const title = clean(row.title)?.toLowerCase() || ''
  const location = clean(row.location_text)?.toLowerCase() || ''
  const keywordPattern = keywordRegex(keyword)
  if (keywordPattern.test(title)) return true
  if (!location || !keywordPattern.test(location)) return false

  const normalisedLocation = normaliseText(location)
  const normalisedKeyword = normaliseText(keyword)
  if (normalisedLocation === normalisedKeyword) return true
  return /\d/.test(location)
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

async function applyPrecinctViews(client) {
  const sqlFiles = ['supabase/schema.sql', 'supabase/precinct_views.sql']
  for (const file of sqlFiles) {
    let lastError = null
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await client.query(readFile(file))
        lastError = null
        break
      } catch (error) {
        lastError = error
        if (!['40P01', '40001'].includes(error.code) || attempt === 4) {
          throw error
        }
        await sleep(500 * attempt)
      }
    }
    if (lastError) throw lastError
  }
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

async function ensurePrecincts(client, config) {
  const precinctMap = new Map()
  for (const precinct of config.precincts) {
    const councilId = await ensureCouncil(client, precinct.primaryCouncil, config.regionGroup || 'Greater Sydney')
    const { rows } = await client.query(
      `insert into public.precincts (
         precinct_code, name, precinct_type, primary_council_id, policy_theme, source_url, watch_priority, notes
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (precinct_code) do update set
         name = excluded.name,
         precinct_type = excluded.precinct_type,
         primary_council_id = excluded.primary_council_id,
         policy_theme = excluded.policy_theme,
         source_url = excluded.source_url,
         watch_priority = excluded.watch_priority,
         notes = excluded.notes
       returning id`,
      [
        precinct.code,
        precinct.name,
        precinct.type,
        councilId,
        precinct.policyTheme,
        config._sourcePath || 'mvp/config/precinct-focus-map.json',
        precinct.watchPriority,
        `keywords=${precinct.keywords.join('|')}`
      ]
    )
    precinctMap.set(precinct.code, { ...precinct, id: rows[0].id, primaryCouncilId: councilId })
  }
  return precinctMap
}

function matchPrecinct(row, precinctsByCouncil) {
  const canonical = canonicalCouncil(row.council_name)
  if (!canonical) return null
  const searchText = buildSearchText(row)
  const candidates = precinctsByCouncil.get(canonical) || []
  let bestMatch = null
  let bestLength = -1

  for (const precinct of candidates) {
    for (const keyword of precinct.keywords) {
      if (keywordRegex(keyword).test(searchText)) {
        if (keyword.length > bestLength) {
          bestMatch = precinct
          bestLength = keyword.length
        }
      }
    }
  }

  return bestMatch
}

function matchProposalPrecinct(row, precinctsByCouncil) {
  const canonical = canonicalCouncil(row.council_name)
  if (!canonical) return null
  const candidates = precinctsByCouncil.get(canonical) || []
  let bestMatch = null
  let bestLength = -1

  for (const precinct of candidates) {
    for (const keyword of precinct.keywords) {
      if (proposalKeywordIsExplicit(row, keyword)) {
        if (keyword.length > bestLength) {
          bestMatch = precinct
          bestLength = keyword.length
        }
      }
    }
  }

  return bestMatch
}

async function resetMappings(client, councilIds) {
  await client.query(
    `update public.planning_proposals
     set precinct_id = null
     where council_id = any($1::uuid[])`,
    [councilIds]
  )
  await client.query(
    `update public.application_signals
     set precinct_id = null
     where council_id = any($1::uuid[])`,
    [councilIds]
  )
}

async function fetchRowsForMapping(client, councilIds) {
  const proposals = await client.query(
    `select pp.id, pp.title, pp.location_text, pp.summary, pp.analyst_note, c.canonical_name as council_name
     from public.planning_proposals pp
     left join public.councils c on c.id = pp.council_id
     where pp.council_id = any($1::uuid[])`,
    [councilIds]
  )
  const applications = await client.query(
    `select a.id, a.project_name, a.location_text, a.source_name, a.tracker_scope, c.canonical_name as council_name
     from public.application_signals a
     left join public.councils c on c.id = a.council_id
     where a.council_id = any($1::uuid[])`,
    [councilIds]
  )
  return { proposals: proposals.rows, applications: applications.rows }
}

async function applyMappings(client, tableName, rows, idColumn = 'id') {
  if (!rows.length) return 0
  const chunkSize = 500
  let updated = 0
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    const values = []
    const placeholders = chunk.map((row, index) => {
      const offset = index * 2
      values.push(row.id, row.precinctId)
      return `($${offset + 1}::uuid, $${offset + 2}::uuid)`
    }).join(',')
    const result = await client.query(
      `update public.${tableName} as target
       set precinct_id = source.precinct_id
       from (values ${placeholders}) as source(${idColumn}, precinct_id)
       where target.${idColumn} = source.${idColumn}`,
      values
    )
    updated += result.rowCount || 0
  }
  return updated
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function scorePrecinct(row) {
  const active = Number(row.active_pipeline_count || 0)
  const made = Number(row.made_count || 0)
  const withdrawn = Number(row.withdrawn_count || 0)
  const recentApps = Number(row.recent_application_count || 0)
  const stateSig = Number(row.state_significant_count || 0)
  const hasLiveSignal = active > 0 || recentApps > 0 || stateSig > 0
  const target = Number(row.council_target_value || 0)
  const policyTheme = clean(row.policy_theme) || ''
  const highConstraints = Number(row.high_constraint_count || 0)
  const mediumConstraints = Number(row.medium_constraint_count || 0)
  const lowConstraints = Number(row.low_constraint_count || 0)
  const constraintSummary = clean(row.constraint_summary)

  let policyScore = 0
  if (active >= 1) policyScore += 2
  if (active >= 2) policyScore += 1
  if (made >= 5) policyScore += 1
  if (withdrawn >= 3) policyScore -= 1
  policyScore = clamp(policyScore, 0, 5)

  let capacityScore = 1
  if (target >= 15000) capacityScore += 2
  else if (target >= 8000) capacityScore += 1
  if (policyTheme.includes('TOD')) capacityScore += 1
  if (policyTheme.includes('LMR')) capacityScore += 1
  capacityScore = clamp(capacityScore, 1, 5)

  let timingScore = 1
  if (recentApps >= 100) timingScore = 5
  else if (recentApps >= 50) timingScore = 4
  else if (recentApps >= 20) timingScore = 3
  else if (recentApps >= 5) timingScore = 2
  if (stateSig > 0) timingScore = clamp(timingScore + 1, 1, 5)
  if (active > 0 && timingScore < 2) timingScore = 2

  let frictionScore = 0
  frictionScore += highConstraints * 2
  frictionScore += mediumConstraints
  frictionScore += lowConstraints > 0 ? 1 : 0
  frictionScore = clamp(frictionScore, 0, 5)

  let rating = 'C'
  if (policyScore >= 4 && timingScore >= 4) rating = 'A'
  else if (policyScore >= 3 || timingScore >= 3) rating = 'B'

  if (frictionScore >= 4 && rating === 'A') rating = 'B'
  else if (frictionScore >= 4 && rating === 'B') rating = 'C'
  else if (frictionScore >= 3 && rating === 'A') rating = 'B'
  if (!hasLiveSignal) rating = 'C'

  let confidence = 'low'
  if (active >= 2 && recentApps >= 20) confidence = 'high'
  else if (active >= 1 || recentApps >= 10 || stateSig > 0) confidence = 'medium'
  if (frictionScore >= 4) confidence = 'medium'
  if (frictionScore >= 5) confidence = 'low'
  if (!hasLiveSignal) confidence = 'low'

  let action = rating === 'A' ? 'Prioritise' : rating === 'B' ? 'Investigate' : 'Watch'
  if (frictionScore >= 4 && action === 'Prioritise') action = 'Investigate'
  if (!hasLiveSignal) action = 'Watch'
  const triggerSummary = constraintSummary
    ? `${active} active proposals, ${recentApps} recent applications, ${stateSig} state significant projects. Risks: ${constraintSummary}`
    : `${active} active proposals, ${recentApps} recent applications, ${stateSig} state significant projects`
  const sourceBundle = ['ppr', recentApps > 0 ? 'applications' : null, stateSig > 0 ? 'state-significant' : null].filter(Boolean).join('|')

  return {
    policyScore,
    capacityScore,
    frictionScore,
    timingScore,
    rating,
    confidence,
    action,
    triggerSummary,
    sourceBundle
  }
}

async function rebuildOpportunityItems(client, rows, observedAt) {
  await client.query(
    `update public.opportunity_items
     set workflow_status = 'on_hold', updated_at = now()
     where geography_level = 'precinct'`
  )

  let upserted = 0
  for (const row of rows) {
    const active = Number(row.active_pipeline_count || 0)
    const recentApps = Number(row.recent_application_count || 0)
    const stateSig = Number(row.state_significant_count || 0)
    if (active === 0 && recentApps < 5 && stateSig === 0) continue

    const score = scorePrecinct(row)
    await client.query(
      `insert into public.opportunity_items (
         item_key, item_name, geography_level, council_id, precinct_id, trigger_summary,
         policy_score, capacity_score, friction_score, timing_score, opportunity_rating,
         analyst_confidence, recommended_action, workflow_status, source_bundle, last_reviewed_at
       ) values (
         $1, $2, 'precinct', $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, 'active', $13, $14
       )
       on conflict (item_key) do update set
         item_name = excluded.item_name,
         council_id = excluded.council_id,
         precinct_id = excluded.precinct_id,
         trigger_summary = excluded.trigger_summary,
         policy_score = excluded.policy_score,
         capacity_score = excluded.capacity_score,
         friction_score = excluded.friction_score,
         timing_score = excluded.timing_score,
         opportunity_rating = excluded.opportunity_rating,
         analyst_confidence = excluded.analyst_confidence,
         recommended_action = excluded.recommended_action,
         workflow_status = excluded.workflow_status,
         source_bundle = excluded.source_bundle,
         last_reviewed_at = excluded.last_reviewed_at`,
      [
        `PRECINCT_ITEM_${row.precinct_code}`,
        row.precinct_name,
        row.council_id,
        row.precinct_id,
        score.triggerSummary,
        score.policyScore,
        score.capacityScore,
        score.frictionScore,
        score.timingScore,
        score.rating,
        score.confidence,
        score.action,
        score.sourceBundle,
        observedAt
      ]
    )
    upserted += 1
  }
  return upserted
}

async function main() {
  const cli = parseArgs()
  const config = loadConfig(cli.configPath || 'mvp/config/precinct-focus-map.json')
  config._sourcePath = cli.configPath || 'mvp/config/precinct-focus-map.json'
  const observedAt = new Date().toISOString().slice(0, 10)
  const client = await connectWithFallback()

  try {
    await applyPrecinctViews(client)
    const precinctMap = await ensurePrecincts(client, config)
    const councilIds = [...new Set([...precinctMap.values()].map((item) => item.primaryCouncilId).filter(Boolean))]

    await resetMappings(client, councilIds)

    const precinctsByCouncil = new Map()
    for (const precinct of precinctMap.values()) {
      for (const council of precinct.allowedCouncils) {
        const canonical = canonicalCouncil(council)
        const existing = precinctsByCouncil.get(canonical) || []
        existing.push(precinct)
        precinctsByCouncil.set(canonical, existing)
      }
    }

    const { proposals, applications } = await fetchRowsForMapping(client, councilIds)
    const mappedProposals = []
    for (const row of proposals) {
      const match = matchProposalPrecinct(row, precinctsByCouncil)
      if (match) mappedProposals.push({ id: row.id, precinctId: match.id })
    }

    const mappedApplications = []
    for (const row of applications) {
      const match = matchPrecinct(row, precinctsByCouncil)
      if (match) mappedApplications.push({ id: row.id, precinctId: match.id })
    }

    const proposalUpdated = await applyMappings(client, 'planning_proposals', mappedProposals)
    const appUpdated = await applyMappings(client, 'application_signals', mappedApplications)

    const summary = await client.query(
      `select p.id as precinct_id, p.precinct_code, p.name as precinct_name, p.primary_council_id as council_id,
              vpss.council_name, vpss.policy_theme, vpss.active_pipeline_count, vpss.made_count,
              vpss.withdrawn_count, vpss.recent_application_count, vpss.state_significant_count,
              vpss.council_target_value, vpss.high_constraint_count, vpss.medium_constraint_count,
              vpss.low_constraint_count, vpss.constraint_summary
       from public.v_precinct_signal_summary vpss
       join public.precincts p on p.id = vpss.precinct_id`
    )

    const opportunities = await rebuildOpportunityItems(client, summary.rows, observedAt)

    const top = await client.query(
      `select precinct_name, council_name, opportunity_rating, policy_score, friction_score, timing_score, recent_application_count, active_pipeline_count, constraint_summary
        from public.v_precinct_shortlist
        limit 10`
    )

    console.log(`Mapped planning proposals: ${proposalUpdated}`)
    console.log(`Mapped application signals: ${appUpdated}`)
    console.log(`Active precinct shortlist items: ${opportunities}`)
    console.log('Top precinct shortlist rows:')
    for (const row of top.rows) {
      console.log(JSON.stringify(row))
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
