import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { assertPhase, newId, nowIso } from '../config.js'
import {
  appendEvent,
  initStore,
  loadStore,
  loadTask,
  savePool,
  saveRun,
  saveMemory,
  saveTask,
  upsertCandidate,
} from '../state/store.js'
import { discoverCandidates } from '../discovery/engine.js'
import { prioritizeCandidates, selectNextTask } from '../prioritization/score.js'
import { acquireLocks, releaseLocks, detectFileConflicts } from './conflict.js'
import { seedMemoryFromRepoDocs, consolidateMemory, recordRejection } from '../memory/project.js'
import { formatStatus } from '../observability/status.js'
import { evaluateAntiSlopAnswers } from '../anti-slop/protocol.js'
import {
  evaluateGates,
  checkSafetyAction,
  suggestedValidationCommands,
} from '../gates/quality.js'
import { agentsForPhase, routeEngineerSubtype } from '../agents/registry.js'
import { concludeNoImprovement } from '../improve/proposals.js'

function touchContext(repoRoot) {
  const contextPath = join(repoRoot, 'CONTEXT.md')
  const workflowPath = join(repoRoot, 'docs/AI_WORKFLOW.md')
  return {
    contextExcerpt: existsSync(contextPath)
      ? readFileSync(contextPath, 'utf8').slice(0, 800)
      : '',
    workflowNote: existsSync(workflowPath)
      ? 'Follow docs/AI_WORKFLOW.md; client lint; packages/core vitest; MANUAL_QA for journeys'
      : '',
  }
}

function budgetExceeded(run, config) {
  if (run.iteration > config.execution.maxIterations) {
    return 'max_iterations'
  }
  if (run.wallDeadlineAt && Date.now() > Date.parse(run.wallDeadlineAt)) {
    return 'max_wall_time'
  }
  return null
}

export function boot(repoRoot, options = {}) {
  const initialized = initStore(repoRoot, options)
  const store = loadStore(repoRoot, options)
  const docs = touchContext(repoRoot)
  store.memory = seedMemoryFromRepoDocs(store.memory, docs)
  store.memory = consolidateMemory(store.memory)
  saveMemory(store.paths, store.memory)

  const run = store.run
  if (options.fresh && run.status === 'running') {
    run.status = 'interrupted'
    run.lastError = 'Superseded by fresh boot'
    saveRun(store.paths, run)
  }

  appendEvent(store.paths, {
    type: 'boot',
    runId: run.runId,
    phase: run.phase,
  })

  return {
    ...store,
    status: formatStatus(store),
    agents: agentsForPhase(run.phase || 'boot'),
  }
}

export function beginRun(repoRoot, options = {}) {
  const store = loadStore(repoRoot, options)
  const { config, paths, run } = store

  if (run.status === 'running' && !options.resume) {
    return {
      ok: false,
      error: 'Run already in progress — use resume',
      status: formatStatus(store),
    }
  }

  if (options.resume && (run.status === 'running' || run.status === 'interrupted')) {
    appendEvent(paths, { type: 'resume', runId: run.runId, phase: run.phase })
    run.status = 'running'
    saveRun(paths, run)
    return { ok: true, resumed: true, store: loadStore(repoRoot, options), status: formatStatus(loadStore(repoRoot, options)) }
  }

  run.status = 'running'
  run.phase = 'discover'
  run.iteration = 0
  run.startedAt = nowIso()
  run.wallDeadlineAt = new Date(Date.now() + config.execution.maxWallTimeMs).toISOString()
  run.stopReason = null
  run.lastError = null
  run.activeTaskId = null
  saveRun(paths, run)
  appendEvent(paths, { type: 'run_started', runId: run.runId })
  return { ok: true, resumed: false, store: loadStore(repoRoot, options), status: formatStatus(loadStore(repoRoot, options)) }
}

export function runDiscovery(repoRoot, options = {}) {
  const store = loadStore(repoRoot, options)
  const { config, paths, pool, run } = store
  assertPhase('discover')
  run.phase = 'discover'
  saveRun(paths, run)

  const discovery = discoverCandidates(repoRoot, store, config)
  const prioritized = prioritizeCandidates(discovery.candidates, config)
  const accepted = []
  const rejected = []

  for (const item of prioritized) {
    if (item.decision === 'queue') {
      const enriched = {
        ...item.candidate,
        status: 'queued',
        priority: item.priority,
      }
      const result = upsertCandidate(paths, pool, enriched)
      accepted.push({ ...item, upsert: result })
    } else {
      const enriched = {
        ...item.candidate,
        status: 'rejected',
        priority: item.priority,
        rejection: { reasons: item.challenge.reasons, at: nowIso() },
      }
      upsertCandidate(paths, pool, enriched)
      recordRejection(store.memory, {
        idea: item.candidate.title,
        reason: item.challenge.reasons.join('; '),
      })
      rejected.push(item)
    }
  }

  const selection = selectNextTask(prioritized)
  pool.lastDiscoveryAt = discovery.scannedAt
  pool.lastNoWorkReason = selection.task ? null : selection.reason
  savePool(paths, pool)
  saveMemory(paths, store.memory)

  appendEvent(paths, {
    type: 'discovery_completed',
    runId: run.runId,
    accepted: accepted.length,
    rejected: rejected.length,
    selection: selection.reason,
  })

  return {
    discovery,
    prioritized,
    accepted,
    rejected,
    selection,
    unfinishedTaskIds: discovery.unfinishedTaskIds,
    status: formatStatus(loadStore(repoRoot, options)),
  }
}

export function activateTask(repoRoot, taskId, options = {}) {
  const store = loadStore(repoRoot, options)
  const { paths, run, pool, config } = store
  const task = loadTask(paths, taskId)
  if (!task) throw new Error(`Unknown task: ${taskId}`)
  if (task.status === 'rejected') throw new Error('Cannot activate rejected task')

  const activeCount = pool.tasks.filter((t) => t.status === 'active').length
  if (activeCount >= config.execution.maxConcurrentTasks && task.status !== 'active') {
    return { ok: false, error: 'maxConcurrentTasks reached', conflicts: [] }
  }

  const lockResult = acquireLocks(run, task)
  if (!lockResult.ok) {
    task.status = 'blocked'
    saveTask(paths, task)
    run.lastError = 'file_lock_conflict'
    saveRun(paths, run)
    return { ok: false, error: 'file_lock_conflict', conflicts: lockResult.conflicts }
  }

  run.locks = lockResult.locks
  run.activeTaskId = task.id
  run.phase = 'define'
  task.status = 'active'
  task.attempts = (task.attempts || 0) + 1
  task.ownerRole = task.ownerRole || 'engineer'
  task.engineerSubtype = routeEngineerSubtype(task)
  saveTask(paths, task)
  const idx = pool.tasks.findIndex((t) => t.id === task.id)
  if (idx >= 0) pool.tasks[idx] = { ...pool.tasks[idx], status: 'active', updatedAt: nowIso() }
  savePool(paths, pool)
  saveRun(paths, run)
  appendEvent(paths, { type: 'task_activated', runId: run.runId, taskId: task.id })
  return { ok: true, task, status: formatStatus(loadStore(repoRoot, options)) }
}

export function advancePhase(repoRoot, nextPhase, options = {}) {
  const store = loadStore(repoRoot, options)
  assertPhase(nextPhase)
  const { paths, run } = store
  const prev = run.phase
  run.phase = nextPhase
  saveRun(paths, run)
  appendEvent(paths, {
    type: 'phase_advanced',
    runId: run.runId,
    from: prev,
    to: nextPhase,
    agents: agentsForPhase(nextPhase).map((a) => a.id),
  })
  return { phase: nextPhase, agents: agentsForPhase(nextPhase), status: formatStatus(loadStore(repoRoot, options)) }
}

export function interruptRun(repoRoot, reason = 'interrupted', options = {}) {
  const store = loadStore(repoRoot, options)
  const { paths, run } = store
  run.status = 'interrupted'
  run.stopReason = reason
  saveRun(paths, run)
  appendEvent(paths, { type: 'interrupted', runId: run.runId, reason })
  return formatStatus(loadStore(repoRoot, options))
}

export function stopRun(repoRoot, reason, options = {}) {
  const store = loadStore(repoRoot, options)
  const { paths, run } = store
  if (run.activeTaskId) {
    run.locks = releaseLocks(run, run.activeTaskId)
  }
  run.status = 'stopped'
  run.phase = 'idle'
  run.stopReason = reason
  run.activeTaskId = null
  saveRun(paths, run)
  appendEvent(paths, { type: 'stopped', runId: run.runId, reason })
  return formatStatus(loadStore(repoRoot, options))
}

/**
 * One controller cycle: boot → discover → select → activate (or stop).
 * Does not implement code — produces durable work orders for agents.
 */
export function runCycle(repoRoot, options = {}) {
  boot(repoRoot, options)
  const started = beginRun(repoRoot, {
    ...options,
    resume: options.resume === true,
  })
  if (!started.ok) return { ok: false, ...started }

  const store = loadStore(repoRoot, options)
  const exceeded = budgetExceeded(store.run, store.config)
  if (exceeded) {
    return { ok: true, stopped: true, status: stopRun(repoRoot, exceeded, options), improvement: concludeNoImprovement() }
  }

  // Resume unfinished active task first
  if (options.resume && store.run.activeTaskId) {
    const task = loadTask(store.paths, store.run.activeTaskId)
    appendEvent(store.paths, {
      type: 'resume_active_task',
      runId: store.run.runId,
      taskId: store.run.activeTaskId,
      phase: store.run.phase,
    })
    return {
      ok: true,
      resumed: true,
      activeTask: task,
      workOrder: buildWorkOrder(task, store.run.phase),
      status: formatStatus(store),
      dryRun: options.dryRun === true,
    }
  }

  store.run.iteration += 1
  saveRun(store.paths, store.run)

  const discovered = runDiscovery(repoRoot, options)
  if (!discovered.selection.task) {
    const status = stopRun(repoRoot, discovered.selection.reason, options)
    return {
      ok: true,
      stopped: true,
      message: discovered.selection.message,
      discovery: discovered,
      status,
      improvement: concludeNoImprovement(),
    }
  }

  if (options.dryRun) {
    const status = stopRun(repoRoot, 'dry_run_complete', options)
    return {
      ok: true,
      dryRun: true,
      wouldSelect: discovered.selection.task.candidate,
      priority: discovered.selection.task.priority,
      discovery: discovered,
      status,
    }
  }

  // Re-load accepted queued task with highest score
  const fresh = loadStore(repoRoot, options)
  const queued = fresh.pool.tasks
    .filter((t) => t.status === 'queued')
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
  if (!queued.length) {
    const status = stopRun(repoRoot, 'NO_ACTIONABLE_HIGH_VALUE_TASK', options)
    return {
      ok: true,
      stopped: true,
      message: 'NO ACTIONABLE HIGH-VALUE TASK IDENTIFIED.',
      status,
    }
  }

  const activated = activateTask(repoRoot, queued[0].id, options)
  if (!activated.ok) {
    const status = stopRun(repoRoot, activated.error, options)
    return { ok: false, ...activated, status }
  }

  const workOrder = buildWorkOrder(activated.task, 'define')
  return {
    ok: true,
    dryRun: false,
    activeTask: activated.task,
    workOrder,
    discovery: discovered,
    status: activated.status,
    nextAgentSteps: workOrder.steps,
  }
}

export function buildWorkOrder(task, phase) {
  const agents = agentsForPhase(phase)
  const validation = suggestedValidationCommands({
    files: task.filesLikely || [],
    category: task.category,
  })
  return {
    taskId: task.id,
    phase,
    title: task.title,
    category: task.category,
    engineerSubtype: task.engineerSubtype || routeEngineerSubtype(task),
    agents: agents.map((a) => ({ id: a.id, responsibility: a.responsibility })),
    antiSlopRequired: true,
    validation,
    steps: [
      'Load CONTEXT.md and docs/AI_WORKFLOW.md',
      'Write or update product/tech proposal artifact under .autonomous-company/artifacts/<taskId>/',
      'Execute phase roles; reuse studio-staff / implement-feature / Matt skills as mapped',
      'Record validation command evidence — never invent pass',
      'Independent review before complete',
      'Update project memory and advance phase via CLI',
    ],
    reuseSkills: [
      'studio-staff (PM/EM)',
      'implement-feature + matt implement/tdd (not both TDD skills)',
      'review-changes / matt code-review',
      'validate-release',
    ],
  }
}

export function completeTask(repoRoot, taskId, report, options = {}) {
  const store = loadStore(repoRoot, options)
  const { paths, run, pool, config } = store
  const task = loadTask(paths, taskId)
  if (!task) throw new Error(`Unknown task: ${taskId}`)

  const antiSlop = evaluateAntiSlopAnswers(report.antiSlopAnswers || {})
  if (!antiSlop.pass) {
    return { ok: false, error: 'anti_slop_failed', antiSlop }
  }

  const gates = evaluateGates({
    category: task.category,
    checklist: report.gateChecklist || {},
  })
  if (!gates.pass) {
    return { ok: false, error: 'gates_failed', gates }
  }

  if (config.execution.requireReviewForCode && report.reviewVerdict !== 'approve') {
    if (['bug', 'security', 'product', 'ux'].includes(task.category)) {
      return { ok: false, error: 'review_required', reviewVerdict: report.reviewVerdict || null }
    }
  }

  // Validation honesty: every required command must have recorded evidence
  const requiredCmds = (report.validationResults || []).filter((v) => v.required)
  for (const v of report.validationResults || []) {
    if (v.status === 'skipped' && v.required) {
      return { ok: false, error: 'required_validation_skipped', command: v.command }
    }
    if (v.claimedPass && v.status !== 'passed') {
      return { ok: false, error: 'falsified_validation', command: v.command }
    }
  }
  void requiredCmds

  task.status = 'completed'
  task.completionReport = {
    at: nowIso(),
    summary: report.summary || null,
    validationResults: report.validationResults || [],
    reviewVerdict: report.reviewVerdict,
  }
  saveTask(paths, task)
  const idx = pool.tasks.findIndex((t) => t.id === task.id)
  if (idx >= 0) pool.tasks[idx] = { ...pool.tasks[idx], status: 'completed', updatedAt: nowIso() }
  savePool(paths, pool)

  run.locks = releaseLocks(run, task.id)
  run.activeTaskId = null
  run.phase = 'postmortem'
  saveRun(paths, run)
  appendEvent(paths, { type: 'task_completed', runId: run.runId, taskId: task.id })
  return { ok: true, task, status: formatStatus(loadStore(repoRoot, options)) }
}

export function rejectTaskImplementation(repoRoot, taskId, review, options = {}) {
  const store = loadStore(repoRoot, options)
  const task = loadTask(store.paths, taskId)
  if (!task) throw new Error(`Unknown task: ${taskId}`)
  task.status = 'active'
  task.attempts = (task.attempts || 0) + 0
  task.lastReview = { ...review, at: nowIso(), verdict: 'request_changes' }
  saveTask(store.paths, task)
  store.run.phase = 'implement'
  saveRun(store.paths, store.run)
  appendEvent(store.paths, {
    type: 'review_rejected',
    runId: store.run.runId,
    taskId,
    reasons: review.reasons || [],
  })
  if ((task.attempts || 0) >= store.config.execution.maxRetriesPerTask) {
    task.status = 'failed'
    saveTask(store.paths, task)
    return {
      ok: false,
      error: 'max_retries',
      status: stopRun(repoRoot, 'max_retries', options),
    }
  }
  return { ok: true, task, status: formatStatus(loadStore(repoRoot, options)) }
}

export function requestHighImpact(repoRoot, action, options = {}) {
  const store = loadStore(repoRoot, options)
  const result = checkSafetyAction(action, store.config, options)
  appendEvent(store.paths, {
    type: 'high_impact_request',
    runId: store.run.runId,
    action,
    allowed: result.allowed,
    reason: result.reason,
  })
  return result
}

export function getConflicts(repoRoot, options = {}) {
  const store = loadStore(repoRoot, options)
  const tasks = store.pool.tasks.map((t) => loadTask(store.paths, t.id)).filter(Boolean)
  return detectFileConflicts(tasks)
}

export { formatStatus, loadStore, initStore, newId }
