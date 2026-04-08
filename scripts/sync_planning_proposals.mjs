import fs from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
import { Client } from 'pg'

const root = process.cwd()
const BASE_URL = 'https://www.planningportal.nsw.gov.au'

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
    stages: [...(base.stages || []), ...(config.stages || [])],
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
  const trimmed = String(value).replace(/\s+/g, ' ').trim()
  return trimmed === '' ? null : trimmed
}

const councilMap = new Map([
  ['Parramatta', 'Parramatta'],
  ['City of Parramatta', 'Parramatta'],
  ['City Of Parramatta', 'Parramatta'],
  ['Sydney', 'Sydney'],
  ['City of Sydney', 'Sydney'],
  ['City Of Sydney', 'Sydney'],
  ['Canterbury-Bankstown', 'Canterbury-Bankstown'],
  ['Canterbury-bankstown', 'Canterbury-Bankstown'],
  ['Inner West', 'Inner West'],
  ['Liverpool', 'Liverpool'],
  ['Ryde', 'Ryde'],
  ['North Sydney', 'North Sydney'],
  ['Randwick', 'Randwick'],
  ['Waverley', 'Waverley'],
  ['Lane Cove', 'Lane Cove'],
  ['Mosman', 'Mosman'],
  ['Hornsby', 'Hornsby'],
  ['Hornsby Shire', 'Hornsby'],
  ['Willoughby', 'Willoughby'],
  ['Ku-ring-gai', 'Ku-ring-gai'],
  ['Campbelltown', 'Campbelltown'],
  ['Strathfield', 'Strathfield'],
  ['Canada Bay', 'Canada Bay'],
  ['Sutherland Shire', 'Sutherland Shire'],
  ['Hunters Hill', 'Hunters Hill'],
  ['Woollahra', 'Woollahra'],
  ['Fairfield', 'Fairfield'],
  ['The Hills Shire', 'The Hills Shire'],
  ['Penrith', 'Penrith'],
  ['Georges River', 'Georges River'],
  ['Bayside', 'Bayside'],
  ['Blacktown', 'Blacktown'],
  ['Cumberland', 'Cumberland'],
  ['Burwood', 'Burwood'],
  ['Newcastle', 'Newcastle'],
  ['City of Newcastle', 'Newcastle'],
  ['Lake Macquarie', 'Lake Macquarie'],
  ['Maitland', 'Maitland'],
  ['Port Stephens', 'Port Stephens'],
  ['Cessnock', 'Cessnock']
])

function canonicalCouncil(raw) {
  const cleaned = clean(raw)
  return cleaned ? councilMap.get(cleaned) || cleaned : null
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    councils: null,
    stages: null,
    maxPages: null,
    configPath: null
  }

  for (const arg of args) {
    if (arg.startsWith('--councils=')) options.councils = arg.split('=')[1].split(',').map((value) => value.trim()).filter(Boolean)
    if (arg.startsWith('--stages=')) options.stages = arg.split('=')[1].split(',').map((value) => value.trim()).filter(Boolean)
    if (arg.startsWith('--max-pages=')) options.maxPages = Number.parseInt(arg.split('=')[1], 10)
    if (arg.startsWith('--config=')) options.configPath = arg.split('=')[1].trim()
  }

  return options
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

async function createIngestRun(client, sourceName, sourceScope) {
  const { rows } = await client.query(
    `insert into public.ingest_runs (source_name, source_scope, run_status)
     values ($1, $2, 'started')
     returning id`,
    [sourceName, sourceScope]
  )
  return rows[0].id
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

function buildStageUrl(stagePath, filterValue, pageNumber) {
  const base = `${BASE_URL}/ppr/${stagePath}`
  const params = new URLSearchParams()
  params.set('field_ppr_local_government_value', filterValue)
  if (pageNumber > 0) params.set('page', String(pageNumber))
  return `${base}?${params.toString()}`
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; radarestate-bot/1.0)'
    }
  })
  if (!response.ok) {
    throw new Error(`Planning proposals request failed: ${response.status} for ${url}`)
  }
  return response.text()
}

function extractResultsCount($) {
  const text = clean($('.row__filter .form__item--meta').first().text())
  const match = text?.match(/Showing:\s*([0-9,]+)/i)
  return match ? Number.parseInt(match[1].replace(/,/g, ''), 10) : null
}

function parseCards(html, normalizedStage, terminal) {
  const $ = cheerio.load(html)
  const resultsCount = extractResultsCount($)
  const cards = []

  $('.page__content .card').each((_, element) => {
    const card = $(element)
    const proposalNumber = clean(card.find('.field-field-panel-reference-number').first().text())
    const title = clean(card.find('.card__title').first().text())
    const tagText = clean(card.find('.tag').first().text())
    const locationText = clean(
      card.find('.card__content > div').filter((__, div) => $(div).find('span.icon--pin').length > 0).first().text()
    )
    const href = clean(card.find('a[href]').first().attr('href'))

    if (!title || !href) return

    cards.push({
      proposalKey: proposalNumber || (href.startsWith('http') ? href : `${BASE_URL}${href}`),
      proposalNumber,
      title,
      stage: normalizedStage,
      stageRank: stageRank(normalizedStage),
      locationText,
      sourceUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      summary: tagText,
      analystNote: terminal && tagText ? `List tag: ${tagText}` : null
    })
  })

  return { resultsCount, cards }
}

function parseProposalDetail(html) {
  const $ = cheerio.load(html)
  const details = {}

  $('.project__details .row').each((_, element) => {
    const label = clean($(element).find('b').first().text())
    const value = clean($(element).find('div').last().text())
    if (label && value) details[label] = value
  })

  const headingLocation = clean($('.content-heading p').last().text())
  return {
    proposalNumber: details.Number || null,
    localGovernmentArea: details['Local government area'] || headingLocation || null,
    detailStage: details.Stage || null,
    reviewCommenced: details['Date Review Commenced'] || null
  }
}

async function hydrateProposalRow(row) {
  if (row.proposalNumber) return row
  const html = await fetchHtml(row.sourceUrl)
  const detail = parseProposalDetail(html)
  return {
    ...row,
    proposalNumber: detail.proposalNumber || row.proposalNumber,
    proposalKey: detail.proposalNumber || row.proposalKey,
    councilName: canonicalCouncil(detail.localGovernmentArea) || row.councilName,
    analystNote: clean([row.analystNote, detail.detailStage ? `Detail stage: ${detail.detailStage}` : null].filter(Boolean).join(' | '))
  }
}

function stageRank(stage) {
  return {
    under_assessment: 1,
    pre_exhibition: 2,
    on_exhibition: 3,
    finalisation: 5,
    made: 6,
    withdrawn: 7
  }[stage] ?? null
}

async function collectStageCouncilRows(stageConfig, councilConfig, maxPages) {
  const collected = []
  let page = 0
  let resultsCount = null

  while (true) {
    if (maxPages && page >= maxPages) break
    const url = buildStageUrl(stageConfig.path, councilConfig.filterValue, page)
    const html = await fetchHtml(url)
    const parsed = parseCards(html, stageConfig.stage, stageConfig.terminal)

    if (resultsCount === null) resultsCount = parsed.resultsCount
    if (!parsed.cards.length) break

    collected.push(...parsed.cards.map((row) => ({
      ...row,
      councilName: councilConfig.canonicalName,
      regionGroup: councilConfig.regionGroup || 'Greater Sydney'
    })))

    if (parsed.cards.length < 9) break
    page += 1
  }

  return {
    council: councilConfig.canonicalName,
    stage: stageConfig.stage,
    resultsCount: resultsCount ?? collected.length,
    rows: collected
  }
}

async function upsertPlanningProposals(client, rows, observedAt) {
  const dedupedMap = new Map()
  for (const row of rows) {
    dedupedMap.set(row.proposalKey, row)
  }

  let upserted = 0
  for (const baseRow of dedupedMap.values()) {
    const row = await hydrateProposalRow(baseRow)
    const councilId = await ensureCouncil(client, row.councilName, row.regionGroup || 'Greater Sydney')
    const isActive = !['made', 'withdrawn'].includes(row.stage)
    const upsert = await client.query(
      `insert into public.planning_proposals (
         proposal_key, source_name, proposal_number, title, stage, stage_rank,
         council_id, location_text, source_url, summary, analyst_note,
         first_seen_at, last_seen_at, is_active, raw_payload
       ) values (
         $1, 'Planning Proposals Online', $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14::jsonb
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
        row.proposalKey,
        row.proposalNumber,
        row.title,
        row.stage,
        row.stageRank,
        councilId,
        row.locationText,
        row.sourceUrl,
        row.summary,
        row.analystNote,
        observedAt,
        observedAt,
        isActive,
        JSON.stringify(row)
      ]
    )

    await client.query(
      `insert into public.planning_proposal_stage_history (
         proposal_id, stage, stage_rank, observed_at, source_url, notes
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (proposal_id, stage, observed_at) do nothing`,
      [
        upsert.rows[0].id,
        row.stage,
        row.stageRank,
        observedAt,
        row.sourceUrl,
        row.summary
      ]
    )
    upserted += 1
  }
  return upserted
}

async function verifyRemote(client) {
  const counts = await client.query(
    `select stage, count(*)::int as total
     from public.planning_proposals
     group by stage
     order by min(stage_rank) nulls last, stage`
  )
  const total = await client.query(`select count(*)::int as total from public.planning_proposals`)
  console.log(`planning_proposals total rows: ${total.rows[0].total}`)
  console.log('Stage counts:')
  for (const row of counts.rows) {
    console.log(JSON.stringify(row))
  }
}

async function main() {
  const cli = parseArgs()
  const config = loadConfig(cli.configPath || 'mvp/config/planning-proposal-sync.json')
  const selectedCouncils = cli.councils ? new Set(cli.councils.map((value) => canonicalCouncil(value) || value)) : null
  const selectedStages = cli.stages ? new Set(cli.stages) : null

  const councilsToSync = selectedCouncils
    ? config.councils.filter((item) => selectedCouncils.has(item.canonicalName))
    : config.councils

  const stagesToSync = selectedStages
    ? config.stages.filter((item) => selectedStages.has(item.stage))
    : config.stages

  const observedAt = new Date().toISOString().slice(0, 10)
  const client = await connectWithFallback()
  await abandonOpenRuns(client, 'Planning Proposals Online')
  const ingestRunId = await createIngestRun(client, 'Planning Proposals Online', `focus councils across ${stagesToSync.length} stages`)

  try {
    const collected = []
    for (const stageConfig of stagesToSync) {
      for (const councilConfig of councilsToSync) {
        const result = await collectStageCouncilRows(stageConfig, councilConfig, cli.maxPages)
        if (result.rows.length) {
          collected.push(...result.rows)
        }
        console.log(`Collected ${result.council} / ${result.stage}: ${result.rows.length} rows (reported ${result.resultsCount ?? 0})`)
      }
    }

    const upserted = await upsertPlanningProposals(client, collected, observedAt)
    await completeIngestRun(
      client,
      ingestRunId,
      'completed',
      upserted,
      `Synced ${upserted} planning proposals from ${councilsToSync.length} councils across ${stagesToSync.length} stages`
    )

    await verifyRemote(client)
  } catch (error) {
    await completeIngestRun(client, ingestRunId, 'failed', null, String(error.message || error))
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
