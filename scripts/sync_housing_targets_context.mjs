import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

const root = process.cwd()
const INDEX_URL = 'https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets'

function parseArgs() {
  const today = new Date().toISOString().slice(0, 10)
  const args = process.argv.slice(2)
  const options = {
    regionGroup: 'Greater Sydney',
    observedAt: today,
    outputPath: 'mvp/data/interim/housing_target_context.csv',
    rawDir: 'mvp/data/raw/housing-targets'
  }
  for (const arg of args) {
    if (arg.startsWith('--region-group=')) options.regionGroup = arg.split('=')[1].trim()
    if (arg.startsWith('--observed-at=')) options.observedAt = arg.split('=')[1].trim()
    if (arg.startsWith('--output-path=')) options.outputPath = arg.split('=')[1].trim()
    if (arg.startsWith('--raw-dir=')) options.rawDir = arg.split('=')[1].trim()
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeCouncilName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(city|council|shire|municipal|municipality|the council of the)\b/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  }

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim()
}

function extractStatisticsMap(html) {
  const map = new Map()
  const regex = /<div class="statisticsText">[\s\S]*?<span class="number">([^<]*)<\/span>[\s\S]*?<p class="nsw-intro">([\s\S]*?)<\/p>/gi
  for (const match of html.matchAll(regex)) {
    const value = decodeHtml(match[1]).replace(/\s+/g, ' ').trim()
    const label = decodeHtml(match[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (label) map.set(label, value)
  }
  return map
}

function extractSnapshotPaths(indexHtml) {
  const matches = [...indexHtml.matchAll(/href="(\/policy-and-legislation\/housing\/housing-targets\/[a-z0-9-]+councils(?:-housing)?-snapshot)"/gi)]
  return [...new Set(matches.map((match) => match[1]))]
}

function buildCouncilPathCandidates(councilName) {
  const slug = slugify(councilName)
  const variants = new Set([
    slug,
    slug.replace(/-shire$/i, ''),
    slug.replace(/^the-/, '')
  ])

  return [...variants].flatMap((value) => [
    `/policy-and-legislation/housing/housing-targets/${value}-councils-snapshot`,
    `/policy-and-legislation/housing/housing-targets/${value}-councils-housing-snapshot`
  ])
}

function resolveCouncilPath(councilName, availablePaths) {
  const direct = buildCouncilPathCandidates(councilName).find((candidate) => availablePaths.has(candidate))
  if (direct) return direct

  const normalizedCouncil = normalizeCouncilName(councilName)
  const fuzzy = [...availablePaths].find((candidate) => normalizeCouncilName(candidate).includes(normalizedCouncil))
  return fuzzy || null
}

function extract(text, regex, parser = (value) => value) {
  const match = text.match(regex)
  return match ? parser(match[1]) : null
}

function extractEither(text, patterns, parser = (value) => value) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const value = match[1] || match[2]
      if (value !== undefined) return parser(value)
    }
  }
  return null
}

function toIsoDate(value) {
  if (!value) return null
  const parsed = new Date(`${value} UTC`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function parseCouncilSnapshot(html, councilName) {
  const text = htmlToText(html)
  const stats = extractStatisticsMap(html)
  const targetLabel = [...stats.keys()].find((label) => /New completed homes by\s+[0-9]{4}/i.test(label)) || null
  const targetValue = targetLabel ? stats.get(targetLabel) : null
  const targetYear = targetLabel ? extract(targetLabel, /([0-9]{4})/i) : null
  const residentPopulation = stats.get('Resident population') || null
  const numberOfHomes = stats.get('Number of homes') || null
  const averageHouseholdSize = stats.get('Average household size (number of people)') || null
  const urbanTreeCanopy = extract(text, /urban area has a total tree canopy cover of\s+([0-9.]+)%/i)
  const highHeatApprox = extract(text, /approximately\s+([0-9.]+)% of neighbourhoods have high heat vulnerability/i)
  const highHeatLessThan = extract(text, /less than\s+([0-9.]+)% of neighbourhoods have high heat vulnerability/i)
  const moderateHeat = extract(text, /([0-9.]+)% have moderate heat vulnerability/i)
  const updatedDate = toIsoDate(extract(text, /Updated\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i))

  if (!targetValue || !targetYear || !residentPopulation || !numberOfHomes || !averageHouseholdSize || !urbanTreeCanopy) {
    throw new Error(`Failed to parse required fields for ${councilName}`)
  }

  const highHeatPhrase = highHeatApprox
    ? `high heat vulnerability approx ${highHeatApprox}% of neighbourhoods`
    : highHeatLessThan
      ? `high heat vulnerability less than ${highHeatLessThan}% of neighbourhoods`
      : 'high heat vulnerability approx 0% of neighbourhoods'

  const notes = [
    `Resident population ${residentPopulation}`,
    `number of homes ${numberOfHomes}`,
    `average household size ${averageHouseholdSize}`,
    `urban tree canopy ${urbanTreeCanopy}%`,
    highHeatPhrase,
    moderateHeat ? `moderate heat vulnerability approx ${moderateHeat}% of neighbourhoods` : null,
    updatedDate ? `updated ${updatedDate}` : null
  ].filter(Boolean).join('; ')

  return {
    targetPeriod: `5-year target to ${targetYear}`,
    targetValueRaw: `${targetValue} new completed homes by ${targetYear}`,
    notes,
    updatedDate
  }
}

function csvValue(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function writeCsv(outputPath, rows) {
  const headers = ['context_id', 'lga', 'region_group', 'target_period', 'target_value_raw', 'completion_or_progress_raw', 'source_url', 'notes', 'last_reviewed_at']
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => csvValue(row[header])).join(','))
  }
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`)
  return response.text()
}

async function loadTargetCouncils(client, regionGroup) {
  const result = await client.query('select canonical_name from public.councils where region_group = $1 order by canonical_name', [regionGroup])
  return result.rows.map((row) => row.canonical_name)
}

async function main() {
  const options = parseArgs()
  const outputPath = path.resolve(root, options.outputPath)
  const rawDir = path.resolve(root, options.rawDir)
  ensureDir(path.dirname(outputPath))
  ensureDir(rawDir)

  const client = await connectWithFallback()
  try {
    const councils = await loadTargetCouncils(client, options.regionGroup)
    const indexHtml = await fetchText(INDEX_URL)
    const observedSlug = options.observedAt.replace(/-/g, '')
    fs.writeFileSync(path.join(rawDir, `housing-targets_index_${options.observedAt}.html`), indexHtml, 'utf8')
    const availablePaths = new Set(extractSnapshotPaths(indexHtml))

    const rows = []
    for (const councilName of councils) {
      const relativePath = resolveCouncilPath(councilName, availablePaths)
      if (!relativePath) throw new Error(`No housing target snapshot path found for ${councilName}`)
      const url = new URL(relativePath, INDEX_URL).toString()
      const html = await fetchText(url)
      const parsed = parseCouncilSnapshot(html, councilName)
      fs.writeFileSync(path.join(rawDir, `housing-targets_${path.basename(relativePath)}_${options.observedAt}.html`), html, 'utf8')
      rows.push({
        context_id: `HTC_${observedSlug}_${slugify(councilName).toUpperCase().replace(/-/g, '_')}`,
        lga: councilName,
        region_group: options.regionGroup,
        target_period: parsed.targetPeriod,
        target_value_raw: parsed.targetValueRaw,
        completion_or_progress_raw: '',
        source_url: url,
        notes: parsed.notes,
        last_reviewed_at: options.observedAt
      })
      console.log(`Fetched housing target context for ${councilName}`)
    }

    writeCsv(outputPath, rows)
    console.log(`Wrote ${rows.length} rows to ${outputPath}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
