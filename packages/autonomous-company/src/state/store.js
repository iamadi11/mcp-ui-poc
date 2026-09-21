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
    memory: join(root, 'memory', 'project.json'),
    artifacts: join(root, 'artifacts'),
    research: join(root, 'research', 'index.json'),
    improvements: join(root, 'improvements', 'index.json'),
    eventsDir: join(root, 'events'),
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
    version: 1,
    runId: runId || newId('run'),
    status: 'idle',
    phase: 'idle',
    activeTaskId: null,
    iteration: 0,
    startedAt: null,
    updatedAt: nowIso(),
    wallDeadlineAt: null,
    budgets: {},
    locks: {},
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
  return {
    config,
    paths,
    run: loadJson(paths.run),
    pool: loadJson(paths.pool),
    memory: loadJson(paths.memory),
    research: existsSync(paths.research)
      ? loadJson(paths.research)
      : { version: 1, findings: [] },
    improvements: existsSync(paths.improvements)
      ? loadJson(paths.improvements)
      : { version: 1, proposals: [], workflowVersions: [] },
  }
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

  if (existingDetail && ['completed', 'queued', 'active', 'in_review'].includes(existingDetail.status)) {
    return { id, created: false, reason: `exists_as_${existingDetail.status}` }
  }

  const task = {
    id,
    category: candidate.category,
    problemKey: candidate.problemKey,
    title: candidate.title,
    status: candidate.status || 'candidate',
    evidence: candidate.evidence || [],
    hypothesis: candidate.hypothesis || null,
    impact: candidate.impact || null,
    effort: candidate.effort || null,
    risks: candidate.risks || [],
    ownerRole: candidate.ownerRole || null,
    filesLikely: candidate.filesLikely || [],
    acceptanceCriteria: candidate.acceptanceCriteria || [],
    nonGoals: candidate.nonGoals || [],
    validationPlan: candidate.validationPlan || [],
    priority: candidate.priority || null,
    rejection: candidate.rejection || null,
    createdAt: existingDetail?.createdAt || nowIso(),
    updatedAt: nowIso(),
    attempts: existingDetail?.attempts || 0,
    branch: existingDetail?.branch || null,
  }

  saveTask(paths, task)
  const summary = {
    id,
    category: task.category,
    title: task.title,
    status: task.status,
    priorityScore: task.priority?.score ?? null,
    updatedAt: task.updatedAt,
  }
  if (existingIdx >= 0) pool.tasks[existingIdx] = summary
  else pool.tasks.push(summary)
  savePool(paths, pool)
  return { id, created: !existingDetail, reason: existingDetail ? 'updated' : 'created' }
}
