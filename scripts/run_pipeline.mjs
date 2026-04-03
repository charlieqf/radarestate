import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const runsDir = path.join(root, 'runs')
const archiveDir = path.join(root, 'archive')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    mode: 'daily',
    skipSync: false,
    skipBuild: false,
    skipReports: false,
    includeRegionalDaily: false,
    skipHunterPack: false,
    applicationConfig: null,
    proposalConfig: null,
    precinctConfig: null
  }

  for (const arg of args) {
    if (arg.startsWith('--mode=')) options.mode = arg.split('=')[1]
    if (arg === '--skip-sync') options.skipSync = true
    if (arg === '--skip-build') options.skipBuild = true
    if (arg === '--skip-reports') options.skipReports = true
    if (arg === '--include-regional-daily') options.includeRegionalDaily = true
    if (arg === '--skip-hunter-pack') options.skipHunterPack = true
    if (arg.startsWith('--application-config=')) options.applicationConfig = arg.split('=')[1]
    if (arg.startsWith('--proposal-config=')) options.proposalConfig = arg.split('=')[1]
    if (arg.startsWith('--precinct-config=')) options.precinctConfig = arg.split('=')[1]
  }

  if (!['daily', 'weekly'].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`)
  }

  return options
}

function runNodeScript(relativeScript, args = []) {
  execFileSync(process.execPath, [path.join(root, relativeScript), ...args], {
    cwd: root,
    stdio: 'inherit'
  })
}

function nowIso() {
  return new Date().toISOString()
}

function timeSlug(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

function writeManifest(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function listFiles(dirPath, matcher) {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath)
    .filter((name) => matcher(name))
    .map((name) => path.join(dirPath, name))
}

function relativePath(filePath) {
  return path.relative(root, filePath)
}

function collectArtifacts(mode, options, runPath) {
  const files = new Set()
  files.add(runPath)
  files.add(path.join(runsDir, `latest-${mode}.json`))

  if (mode === 'daily') {
    files.add(path.join(root, 'dashboard', 'latest-report.html'))
    files.add(path.join(root, 'reports', 'weekly-radar-latest.md'))
    files.add(path.join(root, 'client-output', 'weekly-radar-latest.html'))

    if (options.includeRegionalDaily) {
      files.add(path.join(root, 'dashboard', 'newcastle-hunter-report.html'))
      files.add(path.join(root, 'reports', 'weekly-radar-newcastle-hunter.md'))
      files.add(path.join(root, 'client-output', 'weekly-radar-newcastle-hunter.html'))
    }
  } else {
    for (const filePath of listFiles(path.join(root, 'dashboard'), (name) => name.endsWith('.html'))) files.add(filePath)
    for (const filePath of listFiles(path.join(root, 'reports'), (name) => name.endsWith('.md'))) files.add(filePath)
    for (const filePath of listFiles(path.join(root, 'client-output'), (name) => name.endsWith('.html'))) files.add(filePath)
  }

  return [...files].filter((filePath) => fs.existsSync(filePath))
}

function archiveArtifacts(mode, slug, files) {
  ensureDir(archiveDir)
  const targetRoot = path.join(archiveDir, mode, slug)
  ensureDir(targetRoot)
  for (const filePath of files) {
    const rel = relativePath(filePath)
    const targetPath = path.join(targetRoot, rel)
    ensureDir(path.dirname(targetPath))
    fs.copyFileSync(filePath, targetPath)
  }
  return targetRoot
}

async function postNotification(status, manifest, runPath, archivedPath) {
  const webhookUrl = process.env.RADARESTATE_NOTIFY_WEBHOOK_URL
  if (!webhookUrl) return

  const failedStep = manifest.steps.find((step) => step.status === 'failed')
  const icon = status === 'completed' ? '✅' : '❌'
  const summary = [
    `${icon} radarestate ${manifest.mode} pipeline ${status}`,
    `Started: ${manifest.started_at}`,
    `Completed: ${manifest.completed_at || '-'}`,
    `Run manifest: ${relativePath(runPath)}`,
    archivedPath ? `Archive: ${relativePath(archivedPath)}` : null,
    failedStep ? `Failed step: ${failedStep.name}` : null,
    manifest.error ? `Error: ${manifest.error}` : null
  ].filter(Boolean).join('\n')

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: summary })
  })
}

function buildSteps(options) {
  const steps = []
  const primaryPrecinctArgs = options.precinctConfig ? [`--config=${options.precinctConfig}`] : []
  const hunterProposalArgs = ['--config=mvp/config/planning-proposal-sync-newcastle.json']
  const hunterApplicationArgs = ['--config=mvp/config/application-sync-newcastle.json']
  const hunterPrecinctArgs = ['--config=mvp/config/precinct-focus-map-newcastle.json']

  if (!options.skipSync) {
    steps.push(
      {
        name: 'sync_planning_proposals',
        script: 'scripts/sync_planning_proposals.mjs',
        args: options.proposalConfig ? [`--config=${options.proposalConfig}`] : []
      },
      {
        name: 'sync_application_tracker',
        script: 'scripts/sync_application_tracker.mjs',
        args: options.applicationConfig ? [`--config=${options.applicationConfig}`] : []
      }
    )

    if (options.mode === 'weekly' && !options.skipHunterPack) {
      steps.push(
        {
          name: 'sync_planning_proposals_hunter',
          script: 'scripts/sync_planning_proposals.mjs',
          args: hunterProposalArgs
        },
        {
          name: 'sync_application_tracker_hunter',
          script: 'scripts/sync_application_tracker.mjs',
          args: hunterApplicationArgs
        }
      )
    }
  }

  if (!options.skipBuild) {
    steps.push(
      {
        name: 'build_precinct_shortlist_pre_constraints',
        script: 'scripts/build_precinct_shortlist.mjs',
        args: primaryPrecinctArgs
      }
    )

    if (options.mode === 'weekly' && !options.skipHunterPack) {
      steps.push({
        name: 'build_precinct_shortlist_hunter_pre_constraints',
        script: 'scripts/build_precinct_shortlist.mjs',
        args: hunterPrecinctArgs
      })
    }

    steps.push({ name: 'build_constraints_layer', script: 'scripts/build_constraints_layer.mjs' })

    steps.push({
      name: 'build_precinct_shortlist_post_constraints',
      script: 'scripts/build_precinct_shortlist.mjs',
      args: primaryPrecinctArgs
    })

    if (options.mode === 'weekly' && !options.skipHunterPack) {
      steps.push({
        name: 'build_precinct_shortlist_hunter_post_constraints',
        script: 'scripts/build_precinct_shortlist.mjs',
        args: hunterPrecinctArgs
      })
    }
  }

  if (!options.skipReports) {
    if (options.mode === 'daily') {
      steps.push(
        { name: 'generate_dashboard', script: 'scripts/generate_dashboard_report.mjs' },
        { name: 'generate_weekly_radar', script: 'scripts/generate_weekly_radar.mjs' },
        { name: 'render_client_reports', script: 'scripts/render_client_reports.mjs' }
      )
      if (options.includeRegionalDaily) {
        steps.push({
          name: 'generate_hunter_region_bundle',
          script: 'scripts/generate_region_bundle.mjs',
          args: ['--region-group=Hunter', '--label=Newcastle-Hunter', '--slug=newcastle-hunter']
        })
      }
    } else {
      steps.push({ name: 'generate_client_pack', script: 'scripts/generate_client_pack.mjs' })
      if (!options.skipHunterPack) {
        steps.push({
          name: 'generate_hunter_client_pack',
          script: 'scripts/generate_client_pack.mjs',
          args: [
            '--region-group=Hunter',
            '--label=Newcastle-Hunter',
            '--slug=newcastle-hunter'
          ]
        })
      }
    }
  }

  return steps
}

async function main() {
  const options = parseArgs()
  ensureDir(runsDir)
  ensureDir(archiveDir)

  const startedAt = nowIso()
  const manifest = {
    mode: options.mode,
    started_at: startedAt,
    completed_at: null,
    status: 'running',
    options,
    steps: []
  }

  const slug = timeSlug(new Date())
  const runPath = path.join(runsDir, `pipeline-${options.mode}-${slug}.json`)
  const latestPath = path.join(runsDir, `latest-${options.mode}.json`)
  writeManifest(runPath, manifest)
  writeManifest(latestPath, manifest)
  let archivedPath = null

  try {
    for (const step of buildSteps(options)) {
      const stepRecord = {
        name: step.name,
        script: step.script,
        started_at: nowIso(),
        completed_at: null,
        status: 'running'
      }
      manifest.steps.push(stepRecord)
      writeManifest(runPath, manifest)
      writeManifest(latestPath, manifest)

      try {
        runNodeScript(step.script, step.args || [])
      } catch (error) {
        stepRecord.status = 'failed'
        stepRecord.completed_at = nowIso()
        manifest.status = 'failed'
        manifest.completed_at = nowIso()
        manifest.error = String(error?.message || error)
        writeManifest(runPath, manifest)
        writeManifest(latestPath, manifest)
        archivedPath = archiveArtifacts(options.mode, slug, collectArtifacts(options.mode, options, runPath))
        await postNotification('failed', manifest, runPath, archivedPath)
        throw error
      }

      stepRecord.status = 'completed'
      stepRecord.completed_at = nowIso()
      writeManifest(runPath, manifest)
      writeManifest(latestPath, manifest)
    }

    manifest.status = 'completed'
    manifest.completed_at = nowIso()
    writeManifest(runPath, manifest)
    writeManifest(latestPath, manifest)
    archivedPath = archiveArtifacts(options.mode, slug, collectArtifacts(options.mode, options, runPath))
    await postNotification('completed', manifest, runPath, archivedPath)
    console.log(`Pipeline completed: ${runPath}`)
  } catch (error) {
    throw error
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
