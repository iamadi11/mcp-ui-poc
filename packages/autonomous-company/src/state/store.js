import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULTS_DIR,
  loadConfig,
  loadJson,
  newId,
  nowIso,
  fingerprintTask,
} from '../config.js'
import { createWorkItem, normalizeStatus } from '../work/schema.js'
import { createDefaultWorkers } from '../workers/roster.js'

function atomicWrite(path, data) {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  renameSync(tmp, path)
}

export function statePaths(repoRoot, config) {
  const root = join(repoRoot, config.paths.stateDir)
  return {
    root,
    run: join(root, 'run.json'),
    pool: join(root, 'tasks', 'pool.json'),
    tasksDir: join(root, 'tasks'),
    workers: join(root, 'workers.json'),
    memory: join(root, 'memory', 'project.json'),
    artifacts: join(root, 'artifacts'),
    research: join(root, 'research', 'index.json'),
    improvements: join(root, 'improvements', 'index.json'),
    eventsDir: join(root, 'events'),
    deliberations: join(root, 'deliberations'),
    configLocal: join(root, 'config.json'),
  }
}

export function ensureStateDirs(paths) {
  for (const dir of [
    paths.root,
    paths.tasksDir,
    join(paths.root, 'memory'),
    paths.artifacts,
    join(paths.root, 'research'),
    join(paths.root, 'improvements'),
    paths.eventsDir,
    paths.deliberations,
  ]) {
    mkdirSync(dir, { recursive: true })
  }
}

export function createEmptyPool() {
  return {
    version: 1,
    updatedAt: nowIso(),
    tasks: [],
    lastDiscoveryAt: null,
    lastNoWorkReason: null,
  }
}

export function createEmptyRun({ runId } = {}) {
  return {
    version: 2,
    runId: runId || newId('run'),
    status: 'idle',
    mode: 'stopped',
    phase: 'idle',
    activeTaskId: null,
    iteration: 0,
    cycle: 0,
    startedAt: null,
    updatedAt: nowIso(),
    wallDeadlineAt: null,
    budgets: {},
    locks: {},
    cadences: {},
    workOrders: [],
    lastError: null,
    stopReason: null,
  }
}

export function initStore(repoRoot, options = {}) {
  const config = loadConfig(repoRoot, options.configOverrides)
  const paths = statePaths(repoRoot, config)
  ensureStateDirs(paths)

  if (!existsSync(paths.memory)) {
    const seed = loadJson(join(DEFAULTS_DIR, 'memory.seed.json'))
    seed.updatedAt = nowIso()
    atomicWrite(paths.memory, seed)
  }
  if (!existsSync(paths.pool)) {
    atomicWrite(paths.pool, createEmptyPool())
  }
  if (!existsSync(paths.research)) {
    atomicWrite(paths.research, { version: 1, findings: [], updatedAt: nowIso() })
  }
  if (!existsSync(paths.improvements)) {
    atomicWrite(paths.improvements, {
      version: 1,
      proposals: [],
      workflowVersions: [{ version: '0.1.0', status: 'active', createdAt: nowIso() }],
      updatedAt: nowIso(),
    })
  }
  if (!existsSync(paths.run)) {
    atomicWrite(paths.run, createEmptyRun())
  }
  if (!existsSync(paths.workers)) {
    atomicWrite(paths.workers, createDefaultWorkers())
  }

  appendEvent(paths, {
    type: 'store_initialized',
    at: nowIso(),
    runId: loadJson(paths.run).runId,
  })

  return { config, paths, created: true }
}

export function loadStore(repoRoot, options = {}) {
  const config = loadConfig(repoRoot, options.configOverrides)
  const paths = statePaths(repoRoot, config)
  if (!existsSync(paths.root) || !existsSync(paths.run)) {
    return initStore(repoRoot, options)
  }
  ensureStateDirs(paths)
  if (!existsSync(paths.workers)) {
    atomicWrite(paths.workers, createDefaultWorkers())
  }
  return {
    config,
    paths,
    run: loadJson(paths.run),
    pool: loadJson(paths.pool),
    workers: loadJson(paths.workers),
    memory: loadJson(paths.memory),
    research: existsSync(paths.research)
      ? loadJson(paths.research)
      : { version: 1, findings: [] },
    improvements: existsSync(paths.improvements)
      ? loadJson(paths.improvements)
      : { version: 1, proposals: [], workflowVersions: [] },
  }
}

export function saveWorkers(paths, workers) {
  workers.updatedAt = nowIso()
  atomicWrite(paths.workers, workers)
}

export function listTasks(paths) {
  if (!existsSync(paths.tasksDir)) return []
  return readdirSync(paths.tasksDir)
    .filter((f) => f.endsWith('.json') && f !== 'pool.json')
    .map((f) => loadJson(join(paths.tasksDir, f)))
}

export function saveRun(paths, run) {
  run.updatedAt = nowIso()
  atomicWrite(paths.run, run)
}

export function savePool(paths, pool) {
  pool.updatedAt = nowIso()
  atomicWrite(paths.pool, pool)
}

export function saveMemory(paths, memory) {
  memory.updatedAt = nowIso()
  atomicWrite(paths.memory, memory)
}

export function saveResearch(paths, research) {
  research.updatedAt = nowIso()
  atomicWrite(paths.research, research)
}

export function saveImprovements(paths, improvements) {
  improvements.updatedAt = nowIso()
  atomicWrite(paths.improvements, improvements)
}

export function taskPath(paths, taskId) {
  return join(paths.tasksDir, `${taskId}.json`)
}

export function saveTask(paths, task) {
  task.updatedAt = nowIso()
  atomicWrite(taskPath(paths, task.id), task)
}

export function loadTask(paths, taskId) {
  const p = taskPath(paths, taskId)
  if (!existsSync(p)) return null
  return loadJson(p)
}

export function appendEvent(paths, event) {
  ensureStateDirs(paths)
  const runId = event.runId || 'system'
  const file = join(paths.eventsDir, `${runId}.jsonl`)
  appendFileSync(file, `${JSON.stringify({ ...event, at: event.at || nowIso() })}\n`)
}

export function listEventFiles(paths) {
  if (!existsSync(paths.eventsDir)) return []
  return readdirSync(paths.eventsDir).filter((f) => f.endsWith('.jsonl'))
}

export function readEvents(paths, runId) {
  const file = join(paths.eventsDir, `${runId}.jsonl`)
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

/**
 * Upsert a candidate into the pool without duplicates.
 */
export function upsertCandidate(paths, pool, candidate) {
  const id = fingerprintTask({
    category: candidate.category,
    problemKey: candidate.problemKey,
  })
  const existingIdx = pool.tasks.findIndex((t) => t.id === id)
  const existingDetail = loadTask(paths, id)

  const blocking = ['completed', 'ready', 'queued', 'in_progress', 'active', 'claimed', 'review', 'in_review', 'validation']
  if (existingDetail && blocking.includes(existingDetail.status)) {
    return { id, created: false, reason: `exists_as_${existingDetail.status}` }
  }

  const task = createWorkItem(
    {
      ...candidate,
      status: normalizeStatus(candidate.status || 'discovered'),
      createdAt: existingDetail?.createdAt,
      attempts: existingDetail?.attempts || 0,
      branch: existingDetail?.branch || null,
    },
    { id, now: nowIso() },
  )

  saveTask(paths, task)
  const summary = {
    id,
    category: task.category,
    title: task.title,
    status: task.status,
    priorityScore: task.priority?.score ?? null,
    department: task.department || null,
    updatedAt: task.updatedAt,
  }
  if (existingIdx >= 0) pool.tasks[existingIdx] = summary
  else pool.tasks.push(summary)
  savePool(paths, pool)
  return { id, created: !existingDetail, reason: existingDetail ? 'updated' : 'created' }
}
